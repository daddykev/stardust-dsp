// functions/ingestion/notifier.js
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const xml2js = require("xml2js");

const db = admin.firestore();

/**
 * Generate and store DDEX acknowledgment
 * Direct function - no longer Pub/Sub triggered
 */
async function generateAcknowledgment(deliveryId, releases) {
  logger.log(`Generating acknowledgment for delivery: ${deliveryId}`);
  
  try {
    // Get delivery details
    const deliveryDoc = await db.collection("deliveries").doc(deliveryId).get();
    if (!deliveryDoc.exists) {
      throw new Error(`Delivery ${deliveryId} not found`);
    }
    
    const delivery = deliveryDoc.data();
    
    // Generate acknowledgment message
    const acknowledgment = createAcknowledgmentMessage(delivery, releases);
    
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
    
    // Update delivery record with acknowledgment reference
    await db.collection("deliveries").doc(deliveryId).update({
      acknowledgment: {
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        messageId: acknowledgment.MessageHeader.MessageId,
        documentId: ackRef.id
      }
    });
    
    logger.log(`Acknowledgment stored for delivery: ${deliveryId}, ID: ${ackRef.id}`);
    return { 
      success: true, 
      acknowledgmentId: ackRef.id,
      messageId: acknowledgment.MessageHeader.MessageId
    };
    
  } catch (error) {
    logger.error("Acknowledgment generation failed:", error);
    throw error;
  }
}

/**
 * Send notification to distributor
 * Direct function for various notification types
 */
async function sendNotification(type, data) {
  try {
    const notification = {
      type: type,
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      read: false
    };
    
    const notificationRef = await db.collection("notifications").add(notification);
    
    logger.log(`Notification created: ${type} for ${data.distributorId || data.deliveryId}`);
    
    // If it's a critical notification, could trigger additional alerts here
    if (type === 'processing_failed' || type === 'validation_failed') {
      await logCriticalError(data);
    }
    
    return { success: true, notificationId: notificationRef.id };
    
  } catch (error) {
    logger.error("Failed to create notification:", error);
    throw error;
  }
}

/**
 * Log critical errors for monitoring
 */
async function logCriticalError(data) {
  try {
    await db.collection("criticalErrors").add({
      deliveryId: data.deliveryId,
      distributorId: data.distributorId,
      error: data.error || data.message,
      type: data.type,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      resolved: false
    });
    
    // Could also send email/SMS alerts here
    // await sendEmailAlert(data);
    
  } catch (error) {
    logger.error("Failed to log critical error:", error);
  }
}

/**
 * Create acknowledgment message structure
 */
function createAcknowledgmentMessage(delivery, releases) {
  const now = new Date().toISOString();
  
  return {
    MessageHeader: {
      MessageId: `ACK-${delivery.ern?.messageId || delivery.messageId}-${Date.now()}`,
      MessageCreatedDateTime: now,
      MessageSender: {
        PartyId: "STARDUST_DSP",
        PartyName: {
          FullName: "Stardust DSP Platform"
        }
      },
      MessageRecipient: {
        PartyId: delivery.ern?.messageSender?.partyId || delivery.sender,
        PartyName: {
          FullName: delivery.ern?.messageSender?.partyName || delivery.senderName || "Unknown"
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
        Artist: r.artist || "Various Artists",
        ProcessingStatus: "Success",
        TrackCount: r.trackCount || 0,
        ProcessingDateTime: now
      }))
    },
    ProcessingMetrics: {
      TotalReleases: releases.length,
      TotalTracks: releases.reduce((sum, r) => sum + (r.trackCount || 0), 0),
      ProcessingDuration: "PT1M" // Could calculate actual duration
    }
  };
}

/**
 * Generate error acknowledgment for failed deliveries
 */
async function generateErrorAcknowledgment(deliveryId, error) {
  logger.log(`Generating error acknowledgment for delivery: ${deliveryId}`);
  
  try {
    const deliveryDoc = await db.collection("deliveries").doc(deliveryId).get();
    if (!deliveryDoc.exists) {
      throw new Error(`Delivery ${deliveryId} not found`);
    }
    
    const delivery = deliveryDoc.data();
    const now = new Date().toISOString();
    
    const errorAck = {
      MessageHeader: {
        MessageId: `ACK-ERROR-${delivery.messageId}-${Date.now()}`,
        MessageCreatedDateTime: now,
        MessageSender: {
          PartyId: "STARDUST_DSP",
          PartyName: {
            FullName: "Stardust DSP Platform"
          }
        },
        MessageRecipient: {
          PartyId: delivery.sender,
          PartyName: {
            FullName: delivery.senderName || "Unknown"
          }
        }
      },
      AcknowledgmentStatus: {
        Status: "ProcessingFailed",
        DateTime: now,
        ErrorMessage: error.message || "Unknown error occurred",
        ErrorCode: error.code || "PROCESSING_ERROR"
      }
    };
    
    const builder = new xml2js.Builder({
      rootName: "AcknowledgmentMessage",
      xmldec: { version: "1.0", encoding: "UTF-8" }
    });
    const errorXML = builder.buildObject(errorAck);
    
    // Store error acknowledgment
    const ackRef = await db.collection("acknowledgments").add({
      deliveryId,
      messageId: errorAck.MessageHeader.MessageId,
      type: "error",
      content: errorXML,
      error: error.message,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    logger.log(`Error acknowledgment stored for delivery: ${deliveryId}`);
    return { success: true, acknowledgmentId: ackRef.id };
    
  } catch (err) {
    logger.error("Failed to generate error acknowledgment:", err);
    throw err;
  }
}

/**
 * Get all notifications for a distributor
 */
async function getDistributorNotifications(distributorId, limit = 50) {
  try {
    const notifications = await db.collection("notifications")
      .where("distributorId", "==", distributorId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    
    return notifications.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
  } catch (error) {
    logger.error("Failed to get notifications:", error);
    throw error;
  }
}

/**
 * Mark notification as read
 */
async function markNotificationRead(notificationId) {
  try {
    await db.collection("notifications").doc(notificationId).update({
      read: true,
      readAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true };
    
  } catch (error) {
    logger.error("Failed to mark notification as read:", error);
    throw error;
  }
}

// Export all functions for direct use
module.exports = {
  generateAcknowledgment,
  generateErrorAcknowledgment,
  sendNotification,
  getDistributorNotifications,
  markNotificationRead,
  logCriticalError
};