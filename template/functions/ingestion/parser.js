// functions/ingestion/parser.js
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const xml2js = require("xml2js");
const { Storage } = require("@google-cloud/storage");

const db = admin.firestore();
const storage = new Storage();

/**
 * Parse ERN XML and extract release information
 * Direct function - no longer Pub/Sub triggered
 */
async function parseERN(deliveryId, ernXml) {
  logger.log(`Parsing ERN for delivery: ${deliveryId}`);
  
  try {
    // Update status
    await db.collection("deliveries").doc(deliveryId).update({
      "processing.status": "parsing",
      "processing.parsedAt": admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Parse XML
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      tagNameProcessors: [xml2js.processors.stripPrefix]
    });
    
    const ernData = await parser.parseStringPromise(ernXml);
    
    // Extract ERN version and profile
    const ernVersion = detectERNVersion(ernData);
    const ernProfile = detectERNProfile(ernData);
    
    // Extract releases
    const releases = extractReleases(ernData);
    
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
        releaseCount: releases.length
      },
      parsedData: {
        releases: releases,
        resourceList: ernData.ResourceList,
        dealList: ernData.DealList
      },
      "processing.parsedAt": admin.firestore.FieldValue.serverTimestamp()
    });
    
    logger.log(`ERN parsed successfully for delivery: ${deliveryId}`);
    return { 
      success: true, 
      releases: releases,
      ernData: ernData,
      ernVersion: ernVersion
    };
    
  } catch (error) {
    logger.error("ERN parsing failed:", error);
    
    await db.collection("deliveries").doc(deliveryId).update({
      "processing.status": "parse_failed",
      "processing.error": error.message,
      "processing.errorDetails": error.stack,
      "processing.failedAt": admin.firestore.FieldValue.serverTimestamp()
    });
    
    throw error;
  }
}

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

function extractReleases(ernData) {
  // Handle different ERN structures
  let releases = [];
  
  if (ernData.ReleaseList?.Release) {
    releases = Array.isArray(ernData.ReleaseList.Release) 
      ? ernData.ReleaseList.Release 
      : [ernData.ReleaseList.Release];
  } else if (ernData.NewReleaseMessage?.ReleaseList?.Release) {
    releases = Array.isArray(ernData.NewReleaseMessage.ReleaseList.Release)
      ? ernData.NewReleaseMessage.ReleaseList.Release
      : [ernData.NewReleaseMessage.ReleaseList.Release];
  }
  
  return releases.map(release => ({
    ReleaseId: release.ReleaseId,
    ReleaseReference: release.ReleaseReference,
    ReleaseType: release.ReleaseType,
    ReleaseDetailsByTerritory: release.ReleaseDetailsByTerritory,
    ReferenceTitle: release.ReferenceTitle,
    ReleaseResourceReferenceList: release.ReleaseResourceReferenceList,
    ResourceList: ernData.ResourceList,
    GlobalReleaseDate: release.GlobalReleaseDate,
    GlobalOriginalReleaseDate: release.GlobalOriginalReleaseDate
  }));
}

module.exports = { parseERN };