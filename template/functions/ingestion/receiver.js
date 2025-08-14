// functions/ingestion/receiver.js
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const { Storage } = require("@google-cloud/storage");
const { PubSub } = require("@google-cloud/pubsub");
const path = require("path");

const db = admin.firestore();
const storage = new Storage();
const pubsub = new PubSub();

// Firebase Storage bucket name
const STORAGE_BUCKET = "stardust-dsp.firebasestorage.app";

/**
 * Cloud Function triggered when a delivery package is uploaded
 * Expects deliveries in format: /deliveries/{distributorId}/{timestamp}/manifest.xml
 */
exports.processDelivery = onObjectFinalized({
  bucket: STORAGE_BUCKET, // Use the correct bucket
  maxInstances: 10,
  timeoutSeconds: 300,
  memory: "512MiB"
}, async (event) => {
  const filePath = event.data.name;
  const bucket = storage.bucket(event.data.bucket);
  
  // Only process manifest.xml files in deliveries folder
  if (!filePath.includes("deliveries/") || !filePath.endsWith("manifest.xml")) {
    logger.log(`Skipping non-manifest file: ${filePath}`);
    return null;
  }
  
  logger.log(`Processing delivery: ${filePath}`);
  
  // Extract metadata from path
  const pathParts = filePath.split("/");
  const distributorId = pathParts[1];
  const timestamp = pathParts[2];
  const deliveryId = `${distributorId}_${timestamp}`;
  
  try {
    // Create delivery record
    const deliveryRef = db.collection("deliveries").doc(deliveryId);
    await deliveryRef.set({
      id: deliveryId,
      sender: distributorId,
      package: {
        originalPath: filePath,
        size: parseInt(event.data.size),
        contentType: event.data.contentType,
        timeCreated: event.data.timeCreated
      },
      processing: {
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "pending"
      }
    });
    
    // Trigger processing pipeline via Pub/Sub
    const topic = pubsub.topic("ern-processing");
    await topic.publishMessage({
      json: {
        deliveryId,
        manifestPath: filePath,
        bucket: event.data.bucket
      }
    });
    
    logger.log(`Delivery ${deliveryId} queued for processing`);
    return { success: true, deliveryId };
    
  } catch (error) {
    logger.error("Delivery processing failed:", error);
    
    // Update delivery status
    await db.collection("deliveries").doc(deliveryId).update({
      "processing.status": "failed",
      "processing.error": error.message,
      "processing.failedAt": admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Send notification
    await notifyDeliveryError(distributorId, deliveryId, error);
    
    throw error;
  }
});

async function notifyDeliveryError(distributorId, deliveryId, error) {
  // Publish error notification
  const topic = pubsub.topic("delivery-errors");
  await topic.publishMessage({
    json: {
      distributorId,
      deliveryId,
      error: error.message,
      timestamp: new Date().toISOString()
    }
  });
}