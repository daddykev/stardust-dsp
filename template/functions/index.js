// functions/index.js

/**
 * Import function triggers from their respective submodules:
 */
const {setGlobalOptions} = require("firebase-functions/v2");
const {onRequest} = require("firebase-functions/v2/https");
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