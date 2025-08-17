// functions/index.js

/**
 * Import function triggers from their respective submodules:
 */
const {setGlobalOptions} = require("firebase-functions/v2");
const {onRequest} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");

// Initialize Firebase Admin once
const admin = require("firebase-admin");
admin.initializeApp();

// Set global options for all functions
setGlobalOptions({ 
  maxInstances: 10,
  region: "us-central1"
});

// ============================================
// DIRECT PIPELINE IMPORTS
// ============================================

// Import direct functions from receiver and notifier
const { 
  processIncomingDelivery, 
  getDeliveryStatus,
  cancelDelivery
} = require("./ingestion/receiver");

const { 
  generateAcknowledgment, 
  generateErrorAcknowledgment,
  sendNotification,
  getDistributorNotifications,
  markNotificationRead
} = require("./ingestion/notifier");

// ============================================
// MAIN PROCESSING PIPELINE
// ============================================

/**
 * Process delivery through the direct pipeline
 * This function orchestrates the entire processing flow
 */
async function processDeliveryPipeline(deliveryId) {
  const db = admin.firestore();
  const deliveryRef = db.collection('deliveries').doc(deliveryId);
  
  try {
    console.log(`Starting processing pipeline for delivery: ${deliveryId}`);
    
    // Get delivery data with transaction to prevent concurrent processing
    const delivery = await db.runTransaction(async (transaction) => {
      const deliveryDoc = await transaction.get(deliveryRef);
      
      if (!deliveryDoc.exists) {
        throw new Error(`Delivery ${deliveryId} not found`);
      }
      
      const data = deliveryDoc.data();
      
      // Check if already being processed
      if (data.processing?.locked && 
          data.processing?.lockedAt && 
          (Date.now() - data.processing.lockedAt.toMillis()) < 600000) { // 10 min lock
        console.log(`Delivery ${deliveryId} is locked for processing`);
        return null;
      }
      
      // Check if already completed
      if (data.processing?.status === 'completed') {
        console.log(`Delivery ${deliveryId} already completed`);
        return null;
      }
      
      // Check if cancelled
      if (data.processing?.status === 'cancelled') {
        console.log(`Delivery ${deliveryId} was cancelled`);
        return null;
      }
      
      // Lock for processing
      transaction.update(deliveryRef, {
        'processing.locked': true,
        'processing.lockedAt': admin.firestore.FieldValue.serverTimestamp()
      });
      
      return data;
    });
    
    if (!delivery) {
      console.log(`Skipping locked, completed, or cancelled delivery: ${deliveryId}`);
      return;
    }
    
    // STEP 1: Check if files need to be transferred
    if ((delivery.audioFiles?.length > 0 || delivery.imageFiles?.length > 0) && 
        !delivery.files?.transferredAt) {
      
      console.log(`Delivery ${deliveryId} needs file transfer`);
      
      // Check if transfer job exists
      const transferDoc = await db.collection('fileTransfers').doc(deliveryId).get();
      
      if (!transferDoc.exists) {
        // Create file transfer job
        await db.collection('fileTransfers').doc(deliveryId).set({
          deliveryId: deliveryId,
          distributorId: delivery.sender,
          audioFiles: delivery.audioFiles || [],
          imageFiles: delivery.imageFiles || [],
          status: 'pending',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          retryCount: 0
        });
        
        // Update delivery status
        await deliveryRef.update({
          'processing.status': 'waiting_for_files',
          'processing.locked': false
        });
        
        console.log(`File transfer job created for ${deliveryId}`);
        return; // Let the file transfer scheduled function handle it
      }
      
      const transfer = transferDoc.data();
      
      if (transfer.status !== 'completed') {
        // Still waiting for transfer
        await deliveryRef.update({
          'processing.status': 'waiting_for_files',
          'processing.locked': false
        });
        console.log(`Still waiting for file transfer: ${transfer.status}`);
        return;
      }
      
      console.log(`Files already transferred for ${deliveryId}`);
    }
    
    // STEP 2: Parse ERN
    console.log(`Parsing ERN for ${deliveryId}`);
    
    // Import parser function
    const { parseERN } = require('./ingestion/parser');
    
    // Get ERN XML
    const ernXml = delivery.ernXml || delivery.ern?.xml;
    if (!ernXml) {
      throw new Error('No ERN XML found in delivery');
    }
    
    const parseResult = await parseERN(deliveryId, ernXml);
    
    // STEP 3: Validate ERN
    console.log(`Validating ERN for ${deliveryId}`);
    
    // Import validator function
    const { validateERN } = require('./ingestion/validator');
    
    const validationResult = await validateERN(
      deliveryId, 
      parseResult.ernData,
      parseResult.ernVersion
    );
    
    if (!validationResult.valid && !validationResult.success) {
      const errorMsg = validationResult.errors?.length > 0 
        ? validationResult.errors.join(', ')
        : 'Validation failed';
      throw new Error(`Validation failed: ${errorMsg}`);
    }
    
    // STEP 4: Process Releases
    console.log(`Processing releases for ${deliveryId}`);
    
    await deliveryRef.update({
      'processing.status': 'processing_releases',
      'processing.processingStartedAt': admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Import the direct processor function
    const { processReleases } = require('./ingestion/processor');
    
    const processedReleases = await processReleases(
      deliveryId,
      parseResult.releases,
      delivery
    );
    
    // STEP 5: Complete processing
    await deliveryRef.update({
      'processing.status': 'completed',
      'processing.completedAt': admin.firestore.FieldValue.serverTimestamp(),
      'processing.releases': processedReleases,
      'processing.totalReleases': processedReleases.length,
      'processing.totalTracks': processedReleases.reduce((sum, r) => sum + r.trackCount, 0),
      'processing.locked': false
    });
    
    // STEP 6: Generate acknowledgment using direct function
    const acknowledgmentResult = await generateAcknowledgment(deliveryId, processedReleases);
    
    console.log(`Processing completed for delivery: ${deliveryId}`);
    
    // Send success notification
    await sendNotification('processing_complete', {
      deliveryId: deliveryId,
      distributorId: delivery.sender,
      message: `Delivery ${deliveryId} processed successfully. ${processedReleases.length} releases added.`,
      releases: processedReleases
    });
    
    return { success: true, releases: processedReleases };
    
  } catch (error) {
    console.error(`Processing failed for delivery ${deliveryId}:`, error);
    
    // Update status to failed and unlock
    await deliveryRef.update({
      'processing.status': 'failed',
      'processing.error': error.message,
      'processing.errorDetails': error.stack,
      'processing.failedAt': admin.firestore.FieldValue.serverTimestamp(),
      'processing.locked': false
    });
    
    // Generate error acknowledgment
    await generateErrorAcknowledgment(deliveryId, error);
    
    // Send error notification
    const deliveryData = (await deliveryRef.get()).data();
    await sendNotification('processing_failed', {
      deliveryId: deliveryId,
      distributorId: deliveryData.sender,
      message: `Delivery ${deliveryId} processing failed: ${error.message}`,
      error: error.message
    });
    
    throw error;
  }
}

/**
 * Transfer files from Stardust Distro storage to DSP storage
 */
async function transferDeliveryFiles(deliveryId) {
  const axios = require('axios');
  const { Storage } = require('@google-cloud/storage');
  const storage = new Storage();
  const bucket = admin.storage().bucket();
  
  try {
    console.log(`Starting file transfer for delivery: ${deliveryId}`);
    
    // Get the file transfer job
    const transferDoc = await admin.firestore()
      .collection('fileTransfers')
      .doc(deliveryId)
      .get();
    
    if (!transferDoc.exists) {
      console.error(`No file transfer job found for ${deliveryId}`);
      return;
    }
    
    const transfer = transferDoc.data();
    const { audioFiles, imageFiles, distributorId } = transfer;
    
    // Update status to processing
    await admin.firestore()
      .collection('fileTransfers')
      .doc(deliveryId)
      .update({
        status: 'processing',
        startedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    
    const transferredFiles = {
      audio: [],
      images: []
    };
    
    // Create base path for this delivery
    const basePath = `deliveries/${distributorId}/${deliveryId}`;
    
    // Transfer audio files
    if (audioFiles && audioFiles.length > 0) {
      console.log(`Transferring ${audioFiles.length} audio files...`);
      
      for (let i = 0; i < audioFiles.length; i++) {
        const sourceUrl = audioFiles[i];
        
        try {
          console.log(`Downloading audio file ${i + 1}/${audioFiles.length}: ${sourceUrl}`);
          
          // Download the file from Stardust Distro
          const response = await axios({
            method: 'GET',
            url: sourceUrl,
            responseType: 'arraybuffer',
            timeout: 120000, // 2 minute timeout for large files
            maxContentLength: 500 * 1024 * 1024, // 500MB max
            maxBodyLength: 500 * 1024 * 1024
          });
          
          // Extract filename from URL or generate one
          const fileName = extractFileName(sourceUrl) || `audio_${i + 1}.mp3`;
          const storagePath = `${basePath}/audio/${fileName}`;
          
          // Upload to DSP's storage
          const file = bucket.file(storagePath);
          await file.save(Buffer.from(response.data), {
            metadata: {
              contentType: response.headers['content-type'] || 'audio/mpeg',
              metadata: {
                sourceUrl: sourceUrl,
                deliveryId: deliveryId,
                distributorId: distributorId,
                transferredAt: new Date().toISOString()
              }
            }
          });
          
          // Get public URL
          const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media`;
          
          transferredFiles.audio.push({
            originalUrl: sourceUrl,
            storagePath: storagePath,
            publicUrl: publicUrl,
            fileName: fileName,
            size: response.data.length
          });
          
          console.log(`✅ Transferred audio file: ${fileName} (${response.data.length} bytes)`);
          
        } catch (error) {
          console.error(`Failed to transfer audio file ${sourceUrl}:`, error.message);
          // Continue with other files even if one fails
        }
      }
    }
    
    // Transfer image files
    if (imageFiles && imageFiles.length > 0) {
      console.log(`Transferring ${imageFiles.length} image files...`);
      
      for (let i = 0; i < imageFiles.length; i++) {
        const sourceUrl = imageFiles[i];
        
        try {
          console.log(`Downloading image file ${i + 1}/${imageFiles.length}: ${sourceUrl}`);
          
          // Download the file from Stardust Distro
          const response = await axios({
            method: 'GET',
            url: sourceUrl,
            responseType: 'arraybuffer',
            timeout: 60000, // 1 minute timeout
            maxContentLength: 50 * 1024 * 1024, // 50MB max for images
            maxBodyLength: 50 * 1024 * 1024
          });
          
          // Extract filename from URL or generate one
          const fileName = extractFileName(sourceUrl) || `image_${i + 1}.jpg`;
          const storagePath = `${basePath}/images/${fileName}`;
          
          // Upload to DSP's storage
          const file = bucket.file(storagePath);
          await file.save(Buffer.from(response.data), {
            metadata: {
              contentType: response.headers['content-type'] || 'image/jpeg',
              metadata: {
                sourceUrl: sourceUrl,
                deliveryId: deliveryId,
                distributorId: distributorId,
                transferredAt: new Date().toISOString()
              }
            }
          });
          
          // Get public URL
          const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media`;
          
          transferredFiles.images.push({
            originalUrl: sourceUrl,
            storagePath: storagePath,
            publicUrl: publicUrl,
            fileName: fileName,
            size: response.data.length
          });
          
          console.log(`✅ Transferred image file: ${fileName} (${response.data.length} bytes)`);
          
        } catch (error) {
          console.error(`Failed to transfer image file ${sourceUrl}:`, error.message);
          // Continue with other files even if one fails
        }
      }
    }
    
    // Update the delivery with transferred file information
    await admin.firestore()
      .collection('deliveries')
      .doc(deliveryId)
      .update({
        'files.transferred': transferredFiles,
        'files.transferredAt': admin.firestore.FieldValue.serverTimestamp(),
        'files.audioCount': transferredFiles.audio.length,
        'files.imageCount': transferredFiles.images.length,
        'processing.status': 'files_ready' // Mark as ready for processing
      });
    
    // Update file transfer job status
    await admin.firestore()
      .collection('fileTransfers')
      .doc(deliveryId)
      .update({
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        transferredFiles: transferredFiles,
        summary: {
          audioTransferred: transferredFiles.audio.length,
          audioRequested: audioFiles.length,
          imagesTransferred: transferredFiles.images.length,
          imagesRequested: imageFiles.length,
          totalBytesTransferred: 
            transferredFiles.audio.reduce((sum, f) => sum + f.size, 0) +
            transferredFiles.images.reduce((sum, f) => sum + f.size, 0)
        }
      });
    
    console.log(`✅ File transfer completed for delivery ${deliveryId}`);
    console.log(`Transferred: ${transferredFiles.audio.length} audio, ${transferredFiles.images.length} image files`);
    
    // Trigger processing pipeline now that files are ready
    await processDeliveryPipeline(deliveryId);
    
    return transferredFiles;
    
  } catch (error) {
    console.error(`File transfer failed for ${deliveryId}:`, error);
    
    // Update file transfer job status
    await admin.firestore()
      .collection('fileTransfers')
      .doc(deliveryId)
      .update({
        status: 'failed',
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
        error: error.message,
        errorDetails: error.stack
      });
    
    throw error;
  }
}

// Helper function to extract filename from URL
function extractFileName(url) {
  try {
    // Handle Firebase Storage URLs
    if (url.includes('firebasestorage.googleapis.com')) {
      // Extract from the path parameter
      const match = url.match(/o\/(.+?)\?/);
      if (match) {
        const path = decodeURIComponent(match[1]);
        const parts = path.split('/');
        return parts[parts.length - 1];
      }
    }
    
    // Handle regular URLs
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const parts = pathname.split('/');
    const filename = parts[parts.length - 1];
    
    // Decode URL encoding and remove query params
    return decodeURIComponent(filename.split('?')[0]);
  } catch (error) {
    console.error('Error extracting filename from URL:', error);
    return null;
  }
}

// ============================================
// SCHEDULED FUNCTIONS
// ============================================

/**
 * Scheduled function to process pending deliveries
 * Runs every minute
 */
exports.processPendingDeliveries = onSchedule({
  schedule: "* * * * *", // Every minute
  timeZone: "America/Los_Angeles",
  maxInstances: 5,
  memory: "512MiB",
  timeoutSeconds: 540,
  retryCount: 2
}, async (event) => {
  const db = admin.firestore();
  
  try {
    console.log('Scheduled job: Processing pending deliveries');
    
    // Find deliveries that are ready to process
    const pendingDeliveries = await db.collection('deliveries')
      .where('processing.status', 'in', ['pending', 'received', 'files_ready'])
      .orderBy('processing.receivedAt', 'asc')
      .limit(5)
      .get();
    
    console.log(`Found ${pendingDeliveries.size} pending deliveries`);
    
    if (pendingDeliveries.empty) {
      console.log('No pending deliveries to process');
      return { processed: 0 };
    }
    
    // Process each delivery
    const results = [];
    for (const doc of pendingDeliveries.docs) {
      try {
        console.log(`Processing delivery: ${doc.id}`);
        
        // Process the delivery through direct pipeline
        await processDeliveryPipeline(doc.id);
        results.push({ deliveryId: doc.id, success: true });
        
      } catch (error) {
        console.error(`Failed to process ${doc.id}:`, error);
        results.push({ deliveryId: doc.id, error: error.message });
      }
    }
    
    console.log(`Processed ${results.length} deliveries:`, results);
    return { processed: results.length, results };
    
  } catch (error) {
    console.error('Error in scheduled processing:', error);
    throw error;
  }
});

/**
 * Scheduled function to process pending file transfers
 * Runs every 5 minutes
 */
exports.processPendingFileTransfers = onSchedule({
  schedule: "*/5 * * * *", // Every 5 minutes
  timeZone: "America/Los_Angeles",
  maxInstances: 3,
  memory: "1GiB",
  timeoutSeconds: 540,
  retryCount: 3
}, async (event) => {
  const db = admin.firestore();
  
  try {
    console.log('Scheduled job: Processing pending file transfers');
    
    // Find pending or failed file transfers (with retry limit)
    const pendingTransfers = await db.collection('fileTransfers')
      .where('status', 'in', ['pending', 'failed'])
      .where('retryCount', '<', 3)
      .orderBy('retryCount', 'asc')
      .orderBy('createdAt', 'asc')
      .limit(3)
      .get();
    
    console.log(`Found ${pendingTransfers.size} pending file transfers`);
    
    if (pendingTransfers.empty) {
      console.log('No pending file transfers to process');
      return { processed: 0 };
    }
    
    // Process each transfer
    const results = [];
    for (const doc of pendingTransfers.docs) {
      try {
        console.log(`Processing file transfer: ${doc.id}`);
        
        // Increment retry count
        await doc.ref.update({
          retryCount: admin.firestore.FieldValue.increment(1),
          lastAttemptAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Process the file transfer
        await transferDeliveryFiles(doc.id);
        results.push({ deliveryId: doc.id, success: true });
        
      } catch (error) {
        console.error(`Failed to transfer files for ${doc.id}:`, error);
        
        const retryCount = (doc.data().retryCount || 0) + 1;
        
        // Update status based on retry count
        if (retryCount >= 3) {
          await doc.ref.update({
            status: 'permanently_failed',
            error: error.message,
            failedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        } else {
          await doc.ref.update({
            status: 'failed',
            error: error.message,
            nextRetryAt: admin.firestore.Timestamp.fromDate(
              new Date(Date.now() + (retryCount * 5 * 60 * 1000)) // Exponential backoff
            )
          });
        }
        
        results.push({ deliveryId: doc.id, error: error.message });
      }
    }
    
    console.log(`Processed ${results.length} file transfers:`, results);
    return { processed: results.length, results };
    
  } catch (error) {
    console.error('Error in scheduled file transfer processing:', error);
    throw error;
  }
});

/**
 * Scheduled function to clean up stuck deliveries
 * Runs every 30 minutes
 */
exports.cleanupStuckDeliveries = onSchedule({
  schedule: "*/30 * * * *", // Every 30 minutes
  timeZone: "America/Los_Angeles",
  maxInstances: 1,
  memory: "256MiB",
  timeoutSeconds: 300
}, async (event) => {
  const db = admin.firestore();
  
  try {
    console.log('Scheduled job: Cleaning up stuck deliveries');
    
    // Find deliveries stuck in processing states for more than 30 minutes
    const thirtyMinutesAgo = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 30 * 60 * 1000)
    );
    
    // Find stuck deliveries (locked for too long)
    const stuckDeliveries = await db.collection('deliveries')
      .where('processing.locked', '==', true)
      .where('processing.lockedAt', '<', thirtyMinutesAgo)
      .limit(10)
      .get();
    
    console.log(`Found ${stuckDeliveries.size} stuck deliveries`);
    
    for (const doc of stuckDeliveries.docs) {
      const data = doc.data();
      console.log(`Unlocking stuck delivery: ${doc.id} (was ${data.processing.status})`);
      
      await doc.ref.update({
        'processing.locked': false,
        'processing.error': 'Processing timeout - automatically unlocked',
        'processing.resetAt': admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    return { cleaned: stuckDeliveries.size };
    
  } catch (error) {
    console.error('Error cleaning up stuck deliveries:', error);
    throw error;
  }
});

// ============================================
// API ENDPOINTS
// ============================================

/**
 * Health check endpoint
 */
exports.health = onRequest((request, response) => {
  logger.info("Health check", {structuredData: true});
  response.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "stardust-dsp-ingestion",
    pipeline: "direct",
    version: "1.0.0"
  });
});

/**
 * Receive deliveries from Stardust Distro
 */
exports.receiveDelivery = onRequest({
  cors: true,
  maxInstances: 10
}, async (request, response) => {
  try {
    console.log('Receiving delivery from Stardust Distro');
    
    const authHeader = request.headers.authorization;
    const deliveryData = request.body;
    
    // Use the direct receiver function
    const result = await processIncomingDelivery(deliveryData, authHeader);
    
    // Return acknowledgment
    const acknowledgment = {
      ...result,
      timestamp: new Date().toISOString(),
      message: `Delivery ${result.deliveryId} received successfully`,
      acknowledgmentId: `ACK_${result.deliveryId}`
    };
    
    response.status(200).json(acknowledgment);
    console.log('Acknowledgment sent:', acknowledgment);
    
  } catch (error) {
    console.error('Error receiving delivery:', error);
    
    // Try to generate error acknowledgment
    if (request.body.distributorId && request.body.messageId) {
      const deliveryId = `${request.body.distributorId}_${request.body.messageId || Date.now()}`;
      await generateErrorAcknowledgment(deliveryId, error);
    }
    
    response.status(500).json({ 
      error: error.message,
      details: error.stack 
    });
  }
});

/**
 * Check delivery status
 */
exports.checkDeliveryStatus = onRequest({
  cors: true
}, async (request, response) => {
  try {
    const { deliveryId } = request.query;
    
    if (!deliveryId) {
      response.status(400).json({ error: 'Missing deliveryId' });
      return;
    }
    
    const status = await getDeliveryStatus(deliveryId);
    
    if (!status.found) {
      response.status(404).json({ error: 'Delivery not found' });
      return;
    }
    
    response.json(status);
    
  } catch (error) {
    console.error('Error checking delivery status:', error);
    response.status(500).json({ error: error.message });
  }
});

/**
 * Cancel a delivery
 */
exports.cancelDelivery = onRequest({
  cors: true
}, async (request, response) => {
  try {
    const { deliveryId } = request.body;
    
    if (!deliveryId) {
      response.status(400).json({ error: 'Missing deliveryId' });
      return;
    }
    
    const result = await cancelDelivery(deliveryId);
    
    response.json({
      ...result,
      message: `Delivery ${deliveryId} cancelled successfully`
    });
    
  } catch (error) {
    console.error('Error cancelling delivery:', error);
    response.status(500).json({ error: error.message });
  }
});

/**
 * Get notifications for a distributor
 */
exports.getNotifications = onRequest({
  cors: true
}, async (request, response) => {
  try {
    const { distributorId, limit } = request.query;
    
    if (!distributorId) {
      response.status(400).json({ error: 'Missing distributorId' });
      return;
    }
    
    const notifications = await getDistributorNotifications(
      distributorId, 
      parseInt(limit) || 50
    );
    
    response.json({
      notifications: notifications,
      count: notifications.length
    });
    
  } catch (error) {
    console.error('Error getting notifications:', error);
    response.status(500).json({ error: error.message });
  }
});

/**
 * Mark notification as read
 */
exports.markNotificationRead = onRequest({
  cors: true
}, async (request, response) => {
  try {
    const { notificationId } = request.body;
    
    if (!notificationId) {
      response.status(400).json({ error: 'Missing notificationId' });
      return;
    }
    
    const result = await markNotificationRead(notificationId);
    
    response.json({
      ...result,
      message: 'Notification marked as read'
    });
    
  } catch (error) {
    console.error('Error marking notification as read:', error);
    response.status(500).json({ error: error.message });
  }
});

/**
 * Get acknowledgment for a delivery
 */
exports.getAcknowledgment = onRequest({
  cors: true
}, async (request, response) => {
  try {
    const { deliveryId } = request.query;
    
    if (!deliveryId) {
      response.status(400).json({
        error: "Missing deliveryId parameter"
      });
      return;
    }
    
    // Get delivery to verify it exists
    const deliveryDoc = await admin.firestore()
      .collection("deliveries")
      .doc(deliveryId)
      .get();
    
    if (!deliveryDoc.exists) {
      response.status(404).json({
        error: "Delivery not found"
      });
      return;
    }
    
    const delivery = deliveryDoc.data();
    
    if (!delivery.acknowledgment) {
      response.status(404).json({
        error: "Acknowledgment not yet generated"
      });
      return;
    }
    
    // Get acknowledgment document
    const ackDoc = await admin.firestore()
      .collection("acknowledgments")
      .doc(delivery.acknowledgment.documentId)
      .get();
    
    if (!ackDoc.exists) {
      response.status(404).json({
        error: "Acknowledgment document not found"
      });
      return;
    }
    
    const acknowledgment = ackDoc.data();
    
    // Return XML acknowledgment
    response.set("Content-Type", "application/xml");
    response.send(acknowledgment.content);
    
  } catch (error) {
    logger.error("Failed to retrieve acknowledgment:", error);
    response.status(500).json({
      error: error.message
    });
  }
});

/**
 * Manually trigger processing for a specific delivery
 */
exports.reprocessDelivery = onRequest({
  cors: true,
  maxInstances: 5
}, async (request, response) => {
  try {
    const { deliveryId } = request.body;
    
    if (!deliveryId) {
      response.status(400).json({ error: 'Missing deliveryId' });
      return;
    }
    
    console.log(`Manual reprocess requested for delivery: ${deliveryId}`);
    
    // Reset status to pending
    await admin.firestore()
      .collection('deliveries')
      .doc(deliveryId)
      .update({
        'processing.status': 'pending',
        'processing.error': null,
        'processing.errorDetails': null,
        'processing.locked': false,
        'processing.reprocessedAt': admin.firestore.FieldValue.serverTimestamp()
      });
    
    // Check if files need to be transferred
    const fileTransferDoc = await admin.firestore()
      .collection('fileTransfers')
      .doc(deliveryId)
      .get();
    
    if (fileTransferDoc.exists) {
      const transfer = fileTransferDoc.data();
      if (transfer.status === 'failed' || transfer.status === 'permanently_failed') {
        // Reset file transfer
        await admin.firestore()
          .collection('fileTransfers')
          .doc(deliveryId)
          .update({
            status: 'pending',
            error: null,
            errorDetails: null,
            retryCount: 0
          });
      }
    }
    
    // Process immediately
    await processDeliveryPipeline(deliveryId);
    
    response.json({
      success: true,
      message: `Delivery ${deliveryId} reprocessed successfully`
    });
    
  } catch (error) {
    console.error('Reprocessing failed:', error);
    response.status(500).json({ 
      error: error.message,
      details: error.stack 
    });
  }
});

/**
 * Get queue status
 */
exports.queueStatus = onRequest({
  cors: true
}, async (request, response) => {
  try {
    const db = admin.firestore();
    
    // Get counts for different statuses
    const [pending, processing, failed, completed, waitingForFiles] = await Promise.all([
      db.collection('deliveries').where('processing.status', '==', 'pending').count().get(),
      db.collection('deliveries').where('processing.status', 'in', ['parsing', 'validating', 'processing_releases']).count().get(),
      db.collection('deliveries').where('processing.status', 'in', ['failed', 'validation_failed', 'processing_failed']).count().get(),
      db.collection('deliveries').where('processing.status', '==', 'completed').count().get(),
      db.collection('deliveries').where('processing.status', '==', 'waiting_for_files').count().get()
    ]);
    
    // Get pending file transfers
    const pendingTransfers = await db.collection('fileTransfers')
      .where('status', '==', 'pending')
      .count()
      .get();
    
    response.json({
      queue: {
        pending: pending.data().count,
        processing: processing.data().count,
        failed: failed.data().count,
        completed: completed.data().count,
        waitingForFiles: waitingForFiles.data().count
      },
      fileTransfers: {
        pending: pendingTransfers.data().count
      },
      pipeline: 'direct',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error getting queue status:', error);
    response.status(500).json({ error: error.message });
  }
});

// Debug endpoint
exports.debugDeliveryXML = onRequest({
  cors: true
}, async (request, response) => {
  try {
    const { deliveryId } = request.query;
    
    if (!deliveryId) {
      response.status(400).json({ error: 'Missing deliveryId' });
      return;
    }
    
    const doc = await admin.firestore()
      .collection('deliveries')
      .doc(deliveryId)
      .get();
    
    if (!doc.exists) {
      response.status(404).json({ error: 'Delivery not found' });
      return;
    }
    
    const data = doc.data();
    const xml = data.ernXml;
    
    if (!xml) {
      response.json({ error: 'No XML found' });
      return;
    }
    
    // Get the problematic line
    const lines = xml.split('\n');
    const problemLine = lines[57]; // Line 58 (0-indexed)
    
    response.json({
      deliveryId: deliveryId,
      xmlLength: xml.length,
      lineCount: lines.length,
      line58: problemLine,
      aroundColumn264: problemLine ? problemLine.substring(250, 280) : null,
      first500Chars: xml.substring(0, 500),
      hasHtmlEntities: xml.includes('&nbsp;') || xml.includes('&mdash;'),
      hasUnescapedAmpersands: /&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml)
    });
    
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

/**
 * Debug endpoint to track delivery ID changes
 */
exports.debugDeliveryHistory = onRequest({
  cors: true
}, async (request, response) => {
  try {
    const { deliveryId } = request.query;
    
    if (!deliveryId) {
      response.status(400).json({ error: 'Missing deliveryId' });
      return;
    }
    
    const doc = await admin.firestore()
      .collection('deliveries')
      .doc(deliveryId)
      .get();
    
    if (!doc.exists) {
      response.status(404).json({ error: 'Delivery not found' });
      return;
    }
    
    const data = doc.data();
    
    response.json({
      deliveryId: deliveryId,
      originalMessageId: data.messageId,
      ernMessageId: data.ern?.messageId,
      processedMessageId: data.processing?.messageId,
      senderInfo: {
        sender: data.sender,
        senderName: data.senderName
      },
      timestamps: {
        receivedAt: data.processing?.receivedAt,
        parsedAt: data.processing?.parsedAt,
        validatedAt: data.validation?.validatedAt
      },
      xmlPreview: data.ernXml ? {
        length: data.ernXml.length,
        firstLine: data.ernXml.split('\n')[0],
        hasMessageId: data.ernXml.includes('MessageId'),
        messageIdMatches: data.ernXml.match(/<MessageId[^>]*>([^<]+)<\/MessageId>/g)
      } : null
    });
    
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});