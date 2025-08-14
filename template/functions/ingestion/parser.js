// functions/ingestion/parser.js
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const xml2js = require("xml2js");
const { Storage } = require("@google-cloud/storage");
const { PubSub } = require("@google-cloud/pubsub");

const db = admin.firestore();
const storage = new Storage();
const pubsub = new PubSub();

/**
 * Parse ERN XML and extract release information
 */
exports.parseERN = onMessagePublished({
  topic: "ern-processing",
  timeoutSeconds: 300,
  memory: "1GiB",
  maxInstances: 5
}, async (event) => {
  const { deliveryId, manifestPath, bucket } = event.data.message.json;
  
  logger.log(`Parsing ERN for delivery: ${deliveryId}`);
  
  try {
    // Update status
    await db.collection("deliveries").doc(deliveryId).update({
      "processing.status": "parsing",
      "processing.startedAt": admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Download and parse manifest
    const bucketObj = storage.bucket(bucket);
    const file = bucketObj.file(manifestPath);
    const [content] = await file.download();
    
    // Parse XML
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      tagNameProcessors: [xml2js.processors.stripPrefix]
    });
    
    const ernData = await parser.parseStringPromise(content.toString());
    
    // Extract ERN version and profile
    const ernVersion = detectERNVersion(ernData);
    const ernProfile = detectERNProfile(ernData);
    
    // Store parsed data
    await db.collection("deliveries").doc(deliveryId).update({
      ern: {
        version: ernVersion,
        profile: ernProfile,
        messageId: ernData.MessageHeader?.MessageId || "unknown",
        messageCreatedDateTime: ernData.MessageHeader?.MessageCreatedDateTime,
        messageSender: {
          partyId: ernData.MessageHeader?.MessageSender?.PartyId,
          partyName: ernData.MessageHeader?.MessageSender?.PartyName?.FullName
        },
        releaseCount: Array.isArray(ernData.ReleaseList?.Release) 
          ? ernData.ReleaseList.Release.length 
          : 1
      },
      "processing.parsedAt": admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Trigger validation
    const validationTopic = pubsub.topic("ern-validation");
    await validationTopic.publishMessage({
      json: {
        deliveryId,
        ernData,
        ernVersion,
        manifestPath
      }
    });
    
    logger.log(`ERN parsed successfully for delivery: ${deliveryId}`);
    return { success: true, releases: ernData.ReleaseList?.Release };
    
  } catch (error) {
    logger.error("ERN parsing failed:", error);
    
    await db.collection("deliveries").doc(deliveryId).update({
      "processing.status": "parse_failed",
      "processing.error": error.message,
      "processing.failedAt": admin.firestore.FieldValue.serverTimestamp()
    });
    
    throw error;
  }
});

function detectERNVersion(ernData) {
  // Check for version indicators
  if (ernData.MessageHeader?.MessageStandard) {
    return ernData.MessageHeader.MessageStandard;
  }
  // Default version detection logic
  if (ernData.NewReleaseMessage) return "ERN-3";
  if (ernData.ReleaseNotification) return "ERN-4";
  return "ERN-3.8.2"; // Default
}

function detectERNProfile(ernData) {
  // Detect profile from message type
  if (ernData.NewReleaseMessage?.MessageHeader?.MessageControlType) {
    return ernData.NewReleaseMessage.MessageHeader.MessageControlType;
  }
  return "AudioAlbumMusicOnly"; // Default profile
}