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

// ============================================
// API ENDPOINTS
// ============================================

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
      audioFiles,
      imageFiles
    } = request.body;
    
    // Validate required fields
    if (!distributorId) {
      response.status(400).json({ 
        error: 'Missing distributorId' 
      });
      return;
    }
    
    if (!ernXml) {
      response.status(400).json({ 
        error: 'Missing ERN XML content' 
      });
      return;
    }
    
    // Verify distributor exists
    const distributorDoc = await admin.firestore()
      .collection('distributors')
      .doc(distributorId)
      .get();
    
    if (!distributorDoc.exists) {
      console.log(`Distributor not found: ${distributorId}`);
      response.status(404).json({ 
        error: 'Distributor not found. Please ensure distributor is registered in Stardust DSP.' 
      });
      return;
    }
    
    const distributor = distributorDoc.data();
    
    // Verify API key if distributor has one configured
    if (distributor.deliveryProtocol === 'api' && distributor.apiKey) {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        response.status(401).json({ 
          error: 'Missing or invalid authorization header' 
        });
        return;
      }
      
      const providedKey = authHeader.substring(7);
      if (providedKey !== distributor.apiKey) {
        console.log('Invalid API key provided');
        response.status(401).json({ 
          error: 'Invalid API key' 
        });
        return;
      }
    }
    
    console.log(`Authenticated delivery from ${distributor.name} (${distributorId})`);
    
    // Create delivery record
    const deliveryId = admin.firestore().collection('deliveries').doc().id;
    const now = admin.firestore.Timestamp.now();
    
    const deliveryData = {
      id: deliveryId,
      sender: distributorId,
      senderName: distributor.name,
      messageId: messageId,
      releaseTitle: releaseTitle,
      releaseArtist: releaseArtist,
      ernXml: ernXml,
      testMode: testMode || false,
      priority: priority || 'normal',
      audioFiles: audioFiles || [],
      imageFiles: imageFiles || [],
      processing: {
        receivedAt: now,
        status: 'received'
      },
      createdAt: now,
      updatedAt: now
    };
    
    await admin.firestore()
      .collection('deliveries')
      .doc(deliveryId)
      .set(deliveryData);
    
    console.log(`Delivery ${deliveryId} saved to Firestore`);
    
    // Queue for processing if auto-process is enabled
    if (distributor.autoProcess) {
      await admin.firestore().collection('processingQueue').add({
        deliveryId: deliveryId,
        distributorId: distributorId,
        priority: priority || 'normal',
        createdAt: now
      });
      console.log('Delivery queued for automatic processing');
    }
    
    // Send notification if configured
    if (distributor.sendAcknowledgments) {
      await admin.firestore().collection('notifications').add({
        distributorId: distributorId,
        type: 'delivery_received',
        deliveryId: deliveryId,
        message: `New delivery received: ${releaseTitle}`,
        createdAt: now,
        read: false
      });
    }
    
    // Return acknowledgment
    const acknowledgment = {
      success: true,
      deliveryId: deliveryId,
      messageId: messageId,
      timestamp: now.toDate().toISOString(),
      message: `Delivery ${messageId} received successfully`,
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
    await admin.firestore().collection('processingQueue').add({
      deliveryId: deliveryId,
      distributorId: distributorId,
      priority: 'normal',
      createdAt: now
    });
  }
  
  return { success: true, deliveryId };
});