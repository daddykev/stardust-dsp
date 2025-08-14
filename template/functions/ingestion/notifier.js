// functions/ingestion/notifier.js
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const xml2js = require("xml2js");

const db = admin.firestore();

/**
 * Generate and send DDEX acknowledgment
 * Stores acknowledgment in Firestore for later retrieval
 */
exports.sendAcknowledgment = onMessagePublished({
  topic: "send-acknowledgment",
  timeoutSeconds: 60,
  memory: "256MiB"
}, async (event) => {
  const { deliveryId, releases } = event.data.message.json;
  
  logger.log(`Generating acknowledgment for delivery: ${deliveryId}`);
  
  try {
    // Get delivery details
    const deliveryDoc = await db.collection("deliveries").doc(deliveryId).get();
    const delivery = deliveryDoc.data();
    
    // Generate acknowledgment message
    const acknowledgment = generateAcknowledgmentMessage(delivery, releases);
    
    // Convert to XML
    const builder = new xml2js.Builder({
      rootName: "AcknowledgmentMessage",
      xmldec: { version: "1.0", encoding: "UTF-8" }
    });
    const acknowledgmentXML = builder.buildObject(acknowledgment);
    
    // Store acknowledgment in Firestore
    const ackRef = await db.collection("acknowledgments").add({
      deliveryId,
      messageId: acknowledgment.MessageHeader.MessageId,
      content: acknowledgmentXML,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Update delivery record
    await db.collection("deliveries").doc(deliveryId).update({
      acknowledgment: {
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        messageId: acknowledgment.MessageHeader.MessageId,
        documentId: ackRef.id
      }
    });
    
    // Store notification for distributor to retrieve later
    await db.collection("notifications").add({
      type: "acknowledgment",
      deliveryId,
      distributorId: delivery.sender,
      messageId: delivery.ern.messageId,
      status: "success",
      acknowledgmentId: ackRef.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false
    });
    
    logger.log(`Acknowledgment stored for delivery: ${deliveryId}, ID: ${ackRef.id}`);
    return { success: true, acknowledgmentId: ackRef.id };
    
  } catch (error) {
    logger.error("Acknowledgment generation failed:", error);
    throw error;
  }
});

/**
 * Log error notifications when delivery fails
 */
exports.notifyError = onDocumentUpdated({
  document: "deliveries/{deliveryId}",
  maxInstances: 5
}, async (event) => {
  const newData = event.data.after.data();
  const oldData = event.data.before.data();
  const deliveryId = event.params.deliveryId;
  
  // Check if status changed to error
  if (newData.processing.status.includes("failed") && 
      oldData.processing.status !== newData.processing.status) {
    
    await logErrorNotification(deliveryId, newData);
  }
});

// Helper functions
function generateAcknowledgmentMessage(delivery, releases) {
  const now = new Date().toISOString();
  
  return {
    MessageHeader: {
      MessageId: `ACK-${delivery.ern.messageId}-${Date.now()}`,
      MessageCreatedDateTime: now,
      MessageSender: {
        PartyId: "STARDUST_DSP",
        PartyName: {
          FullName: "Stardust DSP Platform"
        }
      },
      MessageRecipient: {
        PartyId: delivery.ern.messageSender.partyId,
        PartyName: {
          FullName: delivery.ern.messageSender.partyName
        }
      }
    },
    AcknowledgmentStatus: {
      Status: "Acknowledged",
      DateTime: now
    },
    ProcessedReleases: {
      Release: releases.map(r => ({
        ReleaseId: r.releaseId,
        Title: r.title,
        ProcessingStatus: "Success",
        TrackCount: r.trackCount,
        ProcessingDateTime: now
      }))
    }
  };
}

async function logErrorNotification(deliveryId, delivery) {
  logger.error(`Delivery failed: ${deliveryId}`, {
    status: delivery.processing.status,
    error: delivery.processing.error
  });
  
  // Store error notification in Firestore for distributor to see
  await db.collection("notifications").add({
    type: "error",
    deliveryId,
    distributorId: delivery.sender,
    messageId: delivery.ern?.messageId || "unknown",
    status: delivery.processing.status,
    error: delivery.processing.error,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    read: false
  });
  
  logger.log(`Error notification stored for delivery: ${deliveryId}`);
}