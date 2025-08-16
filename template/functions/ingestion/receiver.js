// functions/ingestion/receiver.js
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

const db = admin.firestore();

/**
 * Receiver module for direct pipeline
 * Handles delivery reception and initial processing
 * Storage trigger removed - using HTTP endpoint instead
 */

/**
 * Validate incoming delivery
 */
async function validateDelivery(deliveryData) {
  const errors = [];
  
  // Check required fields
  if (!deliveryData.distributorId) {
    errors.push("Missing distributorId");
  }
  
  if (!deliveryData.ernXml && !deliveryData.ern) {
    errors.push("Missing ERN data");
  }
  
  if (!deliveryData.messageId) {
    logger.warn("No messageId provided, will generate one");
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Verify distributor exists and is authorized
 */
async function verifyDistributor(distributorId, authHeader) {
  try {
    const distributorDoc = await db.collection('distributors').doc(distributorId).get();
    
    if (!distributorDoc.exists) {
      // Auto-create for development/testing
      logger.log(`Auto-creating distributor: ${distributorId}`);
      
      const newDistributor = {
        id: distributorId,
        name: `Distributor ${distributorId}`,
        active: true,
        autoProcess: true,
        sendAcknowledgments: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        deliveryProtocol: 'API'
      };
      
      await db.collection('distributors').doc(distributorId).set(newDistributor);
      return { valid: true, distributor: newDistributor };
    }
    
    const distributor = distributorDoc.data();
    
    // Check if distributor is active
    if (!distributor.active) {
      return { 
        valid: false, 
        error: "Distributor is inactive",
        distributor: distributor 
      };
    }
    
    // Validate API key if configured
    if (distributor.apiKey && authHeader) {
      const providedKey = authHeader.replace('Bearer ', '');
      if (distributor.apiKey !== providedKey) {
        return { 
          valid: false, 
          error: "Invalid API key",
          distributor: null 
        };
      }
    }
    
    return { valid: true, distributor: distributor };
    
  } catch (error) {
    logger.error("Error verifying distributor:", error);
    return { 
      valid: false, 
      error: error.message,
      distributor: null 
    };
  }
}

/**
 * Create delivery record in Firestore
 */
async function createDeliveryRecord(deliveryData, distributor) {
  const now = admin.firestore.Timestamp.now();
  const deliveryId = generateDeliveryId(deliveryData.distributorId, deliveryData.messageId);
  
  const delivery = {
    id: deliveryId,
    sender: deliveryData.distributorId,
    senderName: distributor.name || deliveryData.distributorId,
    
    // ERN data
    ern: deliveryData.ern || {
      messageId: deliveryData.messageId || deliveryId,
      version: '4.3',
      releaseCount: 1
    },
    
    // Core metadata
    messageId: deliveryData.messageId || deliveryId,
    releaseTitle: deliveryData.releaseTitle || 'Unknown Release',
    releaseArtist: deliveryData.releaseArtist || 'Unknown Artist',
    ernXml: deliveryData.ernXml,
    
    // Processing status
    processing: {
      receivedAt: now,
      status: 'received',
      locked: false,
      priority: deliveryData.priority || 'normal'
    },
    
    // File references
    audioFiles: deliveryData.audioFiles || [],
    imageFiles: deliveryData.imageFiles || [],
    
    // Metadata
    testMode: deliveryData.testMode || false,
    source: deliveryData.source || 'API',
    
    // Timestamps
    createdAt: now,
    updatedAt: now
  };
  
  await db.collection('deliveries').doc(deliveryId).set(delivery);
  
  logger.log(`Delivery record created: ${deliveryId}`);
  return { deliveryId, delivery };
}

/**
 * Queue delivery for processing
 */
async function queueForProcessing(deliveryId, distributor) {
  const updates = {
    'processing.status': 'pending',
    'processing.queuedAt': admin.firestore.FieldValue.serverTimestamp()
  };
  
  // Set priority based on distributor settings
  if (distributor.priority) {
    updates['processing.priority'] = distributor.priority;
  }
  
  await db.collection('deliveries').doc(deliveryId).update(updates);
  
  logger.log(`Delivery ${deliveryId} queued for processing`);
}

/**
 * Create file transfer job if needed
 */
async function createFileTransferJob(deliveryId, distributorId, audioFiles, imageFiles) {
  if (!audioFiles?.length && !imageFiles?.length) {
    return null;
  }
  
  const transferJob = {
    deliveryId: deliveryId,
    distributorId: distributorId,
    audioFiles: audioFiles || [],
    imageFiles: imageFiles || [],
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    retryCount: 0
  };
  
  await db.collection('fileTransfers').doc(deliveryId).set(transferJob);
  
  logger.log(`File transfer job created for ${deliveryId}: ${audioFiles?.length || 0} audio, ${imageFiles?.length || 0} image files`);
  return transferJob;
}

/**
 * Generate delivery ID
 */
function generateDeliveryId(distributorId, messageId) {
  if (messageId) {
    // Use message ID if provided
    return `${distributorId}_${messageId}`;
  }
  // Generate timestamp-based ID
  return `${distributorId}_${Date.now()}`;
}

/**
 * Process incoming delivery (main entry point for direct pipeline)
 */
async function processIncomingDelivery(deliveryData, authHeader) {
  try {
    // Step 1: Validate delivery data
    const validation = await validateDelivery(deliveryData);
    if (!validation.valid) {
      throw new Error(`Invalid delivery: ${validation.errors.join(', ')}`);
    }
    
    // Step 2: Verify distributor
    const distributorCheck = await verifyDistributor(deliveryData.distributorId, authHeader);
    if (!distributorCheck.valid) {
      throw new Error(distributorCheck.error);
    }
    
    // Step 3: Create delivery record
    const { deliveryId, delivery } = await createDeliveryRecord(deliveryData, distributorCheck.distributor);
    
    // Step 4: Create file transfer job if needed
    if (deliveryData.audioFiles?.length > 0 || deliveryData.imageFiles?.length > 0) {
      await createFileTransferJob(
        deliveryId, 
        deliveryData.distributorId,
        deliveryData.audioFiles,
        deliveryData.imageFiles
      );
    }
    
    // Step 5: Queue for processing if auto-process enabled
    if (distributorCheck.distributor.autoProcess) {
      await queueForProcessing(deliveryId, distributorCheck.distributor);
    }
    
    // Step 6: Send notification
    if (distributorCheck.distributor.sendAcknowledgments) {
      const { sendNotification } = require('./notifier');
      await sendNotification('delivery_received', {
        distributorId: deliveryData.distributorId,
        deliveryId: deliveryId,
        message: `New delivery received: ${delivery.releaseTitle}`
      });
    }
    
    return {
      success: true,
      deliveryId: deliveryId,
      messageId: delivery.messageId,
      autoProcess: distributorCheck.distributor.autoProcess,
      fileTransferQueued: (deliveryData.audioFiles?.length > 0 || deliveryData.imageFiles?.length > 0)
    };
    
  } catch (error) {
    logger.error("Error processing incoming delivery:", error);
    throw error;
  }
}

/**
 * Get delivery status
 */
async function getDeliveryStatus(deliveryId) {
  try {
    const deliveryDoc = await db.collection('deliveries').doc(deliveryId).get();
    
    if (!deliveryDoc.exists) {
      return { found: false };
    }
    
    const delivery = deliveryDoc.data();
    
    // Check file transfer status if applicable
    let fileTransferStatus = null;
    if (delivery.audioFiles?.length > 0 || delivery.imageFiles?.length > 0) {
      const transferDoc = await db.collection('fileTransfers').doc(deliveryId).get();
      if (transferDoc.exists) {
        fileTransferStatus = transferDoc.data().status;
      }
    }
    
    return {
      found: true,
      deliveryId: deliveryId,
      status: delivery.processing?.status,
      fileTransferStatus: fileTransferStatus,
      receivedAt: delivery.processing?.receivedAt,
      completedAt: delivery.processing?.completedAt,
      error: delivery.processing?.error,
      releases: delivery.processing?.releases || []
    };
    
  } catch (error) {
    logger.error("Error getting delivery status:", error);
    throw error;
  }
}

/**
 * Cancel delivery processing
 */
async function cancelDelivery(deliveryId) {
  try {
    await db.collection('deliveries').doc(deliveryId).update({
      'processing.status': 'cancelled',
      'processing.cancelledAt': admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Also cancel file transfer if exists
    const transferDoc = await db.collection('fileTransfers').doc(deliveryId).get();
    if (transferDoc.exists) {
      await transferDoc.ref.update({
        status: 'cancelled',
        cancelledAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    logger.log(`Delivery ${deliveryId} cancelled`);
    return { success: true };
    
  } catch (error) {
    logger.error("Error cancelling delivery:", error);
    throw error;
  }
}

// Export all functions
module.exports = {
  processIncomingDelivery,
  validateDelivery,
  verifyDistributor,
  createDeliveryRecord,
  queueForProcessing,
  createFileTransferJob,
  getDeliveryStatus,
  cancelDelivery,
  generateDeliveryId
};