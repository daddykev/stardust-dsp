// functions/index.js

/**
 * Import function triggers from their respective submodules:
 */
const {setGlobalOptions} = require("firebase-functions/v2");
const {onRequest} = require("firebase-functions/v2/https");
const {onObjectFinalized} = require("firebase-functions/v2/storage");
const logger = require("firebase-functions/logger");

// Initialize Firebase Admin once
const admin = require("firebase-admin");
admin.initializeApp();

// Set global options for all functions
setGlobalOptions({ 
  maxInstances: 10,
  region: "us-central1" // or your preferred region
});

// ============================================
// INGESTION PIPELINE FUNCTIONS
// ============================================

// Import ingestion functions
const { processDelivery } = require("./ingestion/receiver");
const { parseERN } = require("./ingestion/parser");
const { validateERN } = require("./ingestion/validator");
const { processRelease } = require("./ingestion/processor");
const { sendAcknowledgment, notifyError } = require("./ingestion/notifier");

// Export ingestion functions
exports.processDelivery = processDelivery;
exports.parseERN = parseERN;
exports.validateERN = validateERN;
exports.processRelease = processRelease;
exports.sendAcknowledgment = sendAcknowledgment;
exports.notifyError = notifyError;

// ============================================
// PROCESSING PIPELINE
// ============================================

/**
 * Process delivery through the pipeline
 * This function orchestrates the entire processing flow
 */
async function processDeliveryPipeline(deliveryId) {
  const db = admin.firestore();
  const deliveryRef = db.collection('deliveries').doc(deliveryId);
  
  try {
    console.log(`Starting processing pipeline for delivery: ${deliveryId}`);
    
    // 1. Update status to parsing
    await deliveryRef.update({
      'processing.status': 'parsing',
      'processing.parsedAt': admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Simulate parsing (in production, you'd parse the actual ERN XML)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get delivery data
    const deliveryDoc = await deliveryRef.get();
    const delivery = deliveryDoc.data();
    
    // 2. Update status to validating
    await deliveryRef.update({
      'processing.status': 'validating',
      'validation.validatedAt': admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Simulate validation with DDEX Workbench
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Mock validation results
    const validationResults = {
      valid: true,
      errors: [],
      warnings: [],
      info: ['ERN 4.3 compliant', 'All required fields present']
    };
    
    await deliveryRef.update({
      'validation': validationResults
    });
    
    // 3. Update status to processing releases
    await deliveryRef.update({
      'processing.status': 'processing_releases',
      'processing.processingStartedAt': admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Simulate processing releases
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Mock release data
    const releases = [{
      releaseId: `REL_${Date.now()}`,
      title: delivery.releaseTitle || 'Unknown Release',
      artist: delivery.releaseArtist || 'Unknown Artist',
      trackCount: Math.floor(Math.random() * 10) + 1,
      status: 'active'
    }];
    
    // 4. Complete processing
    await deliveryRef.update({
      'processing.status': 'completed',
      'processing.completedAt': admin.firestore.FieldValue.serverTimestamp(),
      'processing.releases': releases
    });
    
    // 5. Generate acknowledgment
    const acknowledgment = {
      messageId: `ACK_${delivery.messageId}_${Date.now()}`,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      documentId: `ACK_DOC_${deliveryId}`
    };
    
    await deliveryRef.update({
      'acknowledgment': acknowledgment
    });
    
    // Store acknowledgment document
    await db.collection('acknowledgments').doc(acknowledgment.documentId).set({
      deliveryId: deliveryId,
      messageId: acknowledgment.messageId,
      content: generateAcknowledgmentXML(delivery, releases),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`Processing completed for delivery: ${deliveryId}`);
    
    // Send notification
    await db.collection('notifications').add({
      type: 'processing_complete',
      deliveryId: deliveryId,
      distributorId: delivery.sender,
      message: `Delivery ${deliveryId} processed successfully`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false
    });
    
  } catch (error) {
    console.error(`Processing failed for delivery ${deliveryId}:`, error);
    
    // Update status to failed
    await deliveryRef.update({
      'processing.status': 'failed',
      'processing.error': error.message,
      'processing.errorDetails': error.stack,
      'processing.failedAt': admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Send error notification
    await db.collection('notifications').add({
      type: 'processing_failed',
      deliveryId: deliveryId,
      distributorId: (await deliveryRef.get()).data().sender,
      message: `Delivery ${deliveryId} processing failed: ${error.message}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false
    });
    
    throw error;
  }
}

// Helper function to generate acknowledgment XML
function generateAcknowledgmentXML(delivery, releases) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<AcknowledgmentMessage>
  <MessageHeader>
    <MessageId>ACK_${delivery.messageId}</MessageId>
    <MessageCreatedDateTime>${new Date().toISOString()}</MessageCreatedDateTime>
    <MessageSender>
      <PartyId>STARDUST_DSP</PartyId>
      <PartyName>
        <FullName>Stardust DSP Platform</FullName>
      </PartyName>
    </MessageSender>
  </MessageHeader>
  <AcknowledgmentStatus>
    <Status>Acknowledged</Status>
    <DateTime>${new Date().toISOString()}</DateTime>
  </AcknowledgmentStatus>
  <ProcessedReleases>
    ${releases.map(r => `
    <Release>
      <ReleaseId>${r.releaseId}</ReleaseId>
      <Title>${r.title}</Title>
      <ProcessingStatus>Success</ProcessingStatus>
      <TrackCount>${r.trackCount}</TrackCount>
    </Release>`).join('')}
  </ProcessedReleases>
</AcknowledgmentMessage>`;
  return xml;
}

// ============================================
// API ENDPOINTS
// ============================================

// Health check endpoint
exports.health = onRequest((request, response) => {
  logger.info("Health check", {structuredData: true});
  response.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "stardust-dsp-ingestion",
    workbenchAPI: "https://ddex-workbench.org/api"
  });
});

// Manual validation endpoint (for testing)
exports.testValidation = onRequest({
  cors: true,
  maxInstances: 5
}, async (request, response) => {
  const axios = require("axios");
  
  try {
    // Test the DDEX Workbench API directly
    const testResponse = await axios.get("https://ddex-workbench.org/api/health");
    
    response.json({
      success: true,
      message: "DDEX Workbench API is accessible",
      workbenchStatus: testResponse.data
    });
    
  } catch (error) {
    logger.error("Workbench API test failed:", error);
    response.status(500).json({
      error: error.message,
      details: error.response?.data
    });
  }
});

// Get acknowledgment for a delivery
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

// Get notifications for a distributor
exports.getNotifications = onRequest({
  cors: true
}, async (request, response) => {
  try {
    const { distributorId } = request.query;
    
    if (!distributorId) {
      response.status(400).json({
        error: "Missing distributorId parameter"
      });
      return;
    }
    
    // Get notifications for distributor
    const notifications = await admin.firestore()
      .collection("notifications")
      .where("distributorId", "==", distributorId)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    
    const results = notifications.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    response.json({
      notifications: results,
      count: results.length
    });
    
  } catch (error) {
    logger.error("Failed to retrieve notifications:", error);
    response.status(500).json({
      error: error.message
    });
  }
});

// ============================================
// DELIVERY RECEPTION ENDPOINT
// ============================================

/**
 * Receive deliveries from Stardust Distro
 */
exports.receiveDelivery = onRequest({
  cors: true,
  maxInstances: 10
}, async (request, response) => {
  try {
    console.log('Receiving delivery from Stardust Distro');
    console.log('Request body:', JSON.stringify(request.body, null, 2));
    
    // Extract authentication and data
    const authHeader = request.headers.authorization;
    const { 
      distributorId, 
      messageId, 
      releaseTitle, 
      releaseArtist, 
      ernXml, 
      testMode, 
      priority,
      ern,  // This comes from Stardust Distro
      processing,  // This comes from Stardust Distro
      timestamp
    } = request.body;
    
    // Validate required fields
    if (!distributorId) {
      response.status(400).json({ 
        error: 'Missing distributorId' 
      });
      return;
    }
    
    if (!ernXml && !ern) {
      response.status(400).json({ 
        error: 'Missing ERN data' 
      });
      return;
    }
    
    // Verify distributor exists and validate API key
    const distributorDoc = await admin.firestore()
      .collection('distributors')
      .doc(distributorId)
      .get();
    
    if (!distributorDoc.exists) {
      console.log(`Distributor not found: ${distributorId} - creating new distributor`);
      
      // Auto-create distributor for testing
      const newDistributor = {
        id: distributorId,
        name: `Distributor ${distributorId}`,
        active: true,
        autoProcess: true,
        sendAcknowledgments: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        deliveryProtocol: 'API'
      };
      
      await admin.firestore()
        .collection('distributors')
        .doc(distributorId)
        .set(newDistributor);
        
      console.log('Created new distributor:', distributorId);
    } else {
      const distributor = distributorDoc.data();
      
      // Validate API key if present
      if (distributor.apiKey && authHeader) {
        const providedKey = authHeader.replace('Bearer ', '');
        if (distributor.apiKey !== providedKey) {
          console.log('API key mismatch');
          response.status(401).json({ 
            error: 'Invalid API key' 
          });
          return;
        }
      }
    }
    
    const distributor = distributorDoc.exists ? distributorDoc.data() : { autoProcess: true };
    
    // Generate delivery ID
    const now = admin.firestore.Timestamp.now();
    const deliveryId = `${distributorId}_${messageId || Date.now()}`;
    
    // Create delivery document with structure expected by Ingestion.vue
    const deliveryData = {
      id: deliveryId,
      sender: distributorId,  // This is what Ingestion.vue looks for
      senderName: distributor.name || distributorId,
      
      // ERN data (what Ingestion.vue expects)
      ern: ern || {
        messageId: messageId || deliveryId,
        version: '4.3',
        releaseCount: 1
      },
      
      // Core metadata
      messageId: messageId || deliveryId,
      releaseTitle: releaseTitle || 'Unknown Release',
      releaseArtist: releaseArtist || 'Unknown Artist',
      ernXml: ernXml,
      
      // Processing status (what Ingestion.vue expects)
      processing: {
        receivedAt: now,
        status: 'received',  // Initial status
        ...processing  // Merge any processing data from Stardust Distro
      },
      
      // Additional metadata
      testMode: testMode || false,
      priority: priority || 'normal',
      
      // Timestamps
      createdAt: now,
      updatedAt: now,
      receivedAt: now  // Fallback field
    };
    
    // Create the delivery document
    await admin.firestore()
      .collection('deliveries')
      .doc(deliveryId)
      .set(deliveryData);
    
    console.log(`Delivery created: ${deliveryId}`);
    
    // Queue for processing if auto-process is enabled
    if (distributor.autoProcess) {
      // Update status to pending for processing
      await admin.firestore()
        .collection('deliveries')
        .doc(deliveryId)
        .update({
          'processing.status': 'pending',
          'processing.queuedAt': now
        });
        
      console.log('Delivery queued for automatic processing');
      
      // Trigger processing pipeline asynchronously
      // Don't await this so we can return immediately
      processDeliveryPipeline(deliveryId).catch(error => {
        console.error('Background processing failed:', error);
      });
    }
    
    // Send notification if configured
    if (distributor.sendAcknowledgments) {
      await admin.firestore().collection('notifications').add({
        distributorId: distributorId,
        type: 'delivery_received',
        deliveryId: deliveryId,
        message: `New delivery received: ${releaseTitle || 'Unknown Release'}`,
        createdAt: now,
        read: false
      });
    }
    
    // Return acknowledgment
    const acknowledgment = {
      success: true,
      deliveryId: deliveryId,
      messageId: messageId || deliveryId,
      timestamp: now.toDate().toISOString(),
      message: `Delivery ${messageId || deliveryId} received successfully`,
      autoProcess: distributor.autoProcess || false,
      acknowledgmentId: `ACK_${deliveryId}`
    };
    
    response.status(200).json(acknowledgment);
    console.log('Acknowledgment sent:', acknowledgment);
    
  } catch (error) {
    console.error('Error receiving delivery:', error);
    response.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

/**
 * Process deliveries uploaded to Cloud Storage
 */
exports.processStorageDelivery = onObjectFinalized({
  bucket: 'stardust-dsp.firebasestorage.app',
  region: 'us-central1'
}, async (event) => {
  const filePath = event.data.name;
  const contentType = event.data.contentType;
  
  console.log(`New file uploaded: ${filePath}`);
  
  // Check if this is a manifest.xml file in a delivery path
  // Expected path: /deliveries/{distributorId}/{timestamp}/manifest.xml
  const pathMatch = filePath.match(/^deliveries\/([^\/]+)\/([^\/]+)\/manifest\.xml$/);
  
  if (!pathMatch) {
    console.log('Not a delivery manifest, ignoring');
    return;
  }
  
  const distributorId = pathMatch[1];
  const timestamp = pathMatch[2];
  
  console.log(`Processing delivery from distributor: ${distributorId}`);
  
  // Verify distributor exists
  const distributorDoc = await admin.firestore()
    .collection('distributors')
    .doc(distributorId)
    .get();
  
  if (!distributorDoc.exists) {
    console.error(`Unknown distributor: ${distributorId}`);
    return;
  }
  
  const distributor = distributorDoc.data();
  
  // Download and read the manifest
  const bucket = admin.storage().bucket();
  const file = bucket.file(filePath);
  const [fileContent] = await file.download();
  const ernXml = fileContent.toString('utf8');
  
  // Parse basic info from ERN
  const titleMatch = ernXml.match(/<TitleText>([^<]+)<\/TitleText>/);
  const messageIdMatch = ernXml.match(/<MessageId>([^<]+)<\/MessageId>/);
  
  // Create delivery record
  const deliveryId = admin.firestore().collection('deliveries').doc().id;
  const now = admin.firestore.Timestamp.now();
  
  await admin.firestore()
    .collection('deliveries')
    .doc(deliveryId)
    .set({
      id: deliveryId,
      sender: distributorId,
      senderName: distributor.name,
      messageId: messageIdMatch ? messageIdMatch[1] : `MSG_${timestamp}`,
      releaseTitle: titleMatch ? titleMatch[1] : 'Unknown Release',
      ernXml: ernXml,
      storagePath: filePath,
      storageTimestamp: timestamp,
      processing: {
        receivedAt: now,
        status: 'received',
        source: 'storage'
      },
      createdAt: now,
      updatedAt: now
    });
  
  console.log(`Storage delivery ${deliveryId} created`);
  
  // Queue for processing if auto-process is enabled
  if (distributor.autoProcess) {
    await admin.firestore()
      .collection('deliveries')
      .doc(deliveryId)
      .update({
        'processing.status': 'pending',
        'processing.queuedAt': now
      });
    
    // Trigger processing pipeline
    processDeliveryPipeline(deliveryId).catch(error => {
      console.error('Background processing failed:', error);
    });
  }
  
  return { success: true, deliveryId };
});

// ============================================
// BACKGROUND PROCESSING TRIGGER
// ============================================

/**
 * Cloud Scheduler function to process pending deliveries
 * This runs every minute to pick up any pending deliveries
 */
exports.processPendingDeliveries = onRequest({
  cors: false,
  maxInstances: 5
}, async (request, response) => {
  try {
    const db = admin.firestore();
    
    // Find pending deliveries
    const pendingDeliveries = await db.collection('deliveries')
      .where('processing.status', '==', 'pending')
      .orderBy('processing.queuedAt', 'asc')
      .limit(5) // Process up to 5 at a time
      .get();
    
    console.log(`Found ${pendingDeliveries.size} pending deliveries`);
    
    // Process each delivery
    const promises = pendingDeliveries.docs.map(doc => 
      processDeliveryPipeline(doc.id).catch(error => {
        console.error(`Failed to process ${doc.id}:`, error);
        return { deliveryId: doc.id, error: error.message };
      })
    );
    
    const results = await Promise.all(promises);
    
    response.json({
      processed: pendingDeliveries.size,
      results: results
    });
    
  } catch (error) {
    console.error('Error processing pending deliveries:', error);
    response.status(500).json({ error: error.message });
  }
});

// ============================================
// MANUAL TRIGGER FOR STUCK DELIVERIES
// ============================================

/**
 * Manually trigger processing for a specific delivery
 * Useful for retrying failed or stuck deliveries
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
        'processing.reprocessedAt': admin.firestore.FieldValue.serverTimestamp()
      });
    
    // Trigger processing
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