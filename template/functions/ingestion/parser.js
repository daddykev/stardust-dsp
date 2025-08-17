// functions/ingestion/parser.js
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const xml2js = require("xml2js");

const db = admin.firestore();

/**
 * Clean object for Firestore - remove undefined values
 */
function cleanForFirestore(obj) {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => cleanForFirestore(item));
  }
  
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      const cleanedValue = cleanForFirestore(value);
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
      }
    }
  }
  return cleaned;
}

/**
 * Sanitize XML to handle common issues
 */
function sanitizeXML(xmlString) {
  if (!xmlString) return xmlString;
  
  // Fix common XML entity issues
  // First, protect already-escaped entities
  let sanitized = xmlString
    .replace(/&amp;/g, '__AMP__')
    .replace(/&lt;/g, '__LT__')
    .replace(/&gt;/g, '__GT__')
    .replace(/&quot;/g, '__QUOT__')
    .replace(/&apos;/g, '__APOS__');
  
  // Now escape any remaining unescaped ampersands
  sanitized = sanitized.replace(/&/g, '&amp;');
  
  // Restore the already-escaped entities
  sanitized = sanitized
    .replace(/__AMP__/g, '&amp;')
    .replace(/__LT__/g, '&lt;')
    .replace(/__GT__/g, '&gt;')
    .replace(/__QUOT__/g, '&quot;')
    .replace(/__APOS__/g, '&apos;');
  
  return sanitized;
}

/**
 * Detect ERN version from XML content before parsing
 */
function detectERNVersionFromXML(xmlString) {
  if (!xmlString) return "ERN-4.3"; // Default to latest
  
  // Look for version attributes in the root element
  const versionMatch = xmlString.match(/<NewReleaseMessage[^>]*MessageSchemaVersionId\s*=\s*["']([^"']+)["']/i);
  if (versionMatch) {
    const version = versionMatch[1];
    logger.log(`Found MessageSchemaVersionId: ${version}`);
    // Convert ern/43 format to ERN-4.3 format
    if (version === 'ern/43') return 'ERN-4.3';
    if (version === 'ern/42') return 'ERN-4.2';
    if (version === 'ern/41') return 'ERN-4.1';
    return version;
  }
  
  // Look for namespace declarations that indicate ERN 4.x
  if (xmlString.includes('xmlns:ern="http://ddex.net/xml/ern/43"') || 
      xmlString.includes('xmlns="http://ddex.net/xml/ern/43"')) {
    return "ERN-4.3";
  }
  
  if (xmlString.includes('xmlns:ern="http://ddex.net/xml/ern/42"') || 
      xmlString.includes('xmlns="http://ddex.net/xml/ern/42"')) {
    return "ERN-4.2";
  }
  
  if (xmlString.includes('xmlns:ern="http://ddex.net/xml/ern/41"') || 
      xmlString.includes('xmlns="http://ddex.net/xml/ern/41"')) {
    return "ERN-4.1";
  }
  
  // Look for ERN-3 indicators
  if (xmlString.includes('xmlns="http://ddex.net/xml/ern/382"') ||
      xmlString.includes('xmlns="http://ddex.net/xml/ern/381"')) {
    return "ERN-3.8.2";
  }
  
  // If we can't determine, assume ERN 4.3 (latest)
  logger.warn("Could not determine ERN version from XML, defaulting to ERN-4.3");
  return "ERN-4.3";
}

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
    
    // Get the original delivery record to preserve IDs
    const originalDelivery = await db.collection("deliveries").doc(deliveryId).get();
    const originalData = originalDelivery.data();
    
    // Detect ERN version from XML before parsing
    const detectedVersion = detectERNVersionFromXML(ernXml);
    logger.log(`Detected ERN version: ${detectedVersion}`);
    
    // Sanitize the XML before parsing
    const sanitizedXml = sanitizeXML(ernXml);
    
    // Parse XML with options optimized for ERN 4.3
    // IMPORTANT: normalize must be false to preserve casing
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      tagNameProcessors: [xml2js.processors.stripPrefix], // Remove namespace prefixes
      strict: false,
      normalize: false,  // CHANGED: Don't normalize to uppercase
      normalizeTags: false, // Keep original casing for ERN 4.3
      preserveChildrenOrder: false,
      explicitRoot: true,
      attrkey: '$',
      charkey: '_'
    });
    
    let ernData;
    try {
      ernData = await parser.parseStringPromise(sanitizedXml);
      logger.log("XML parsed successfully");
    } catch (parseError) {
      logger.warn(`Initial parse failed, trying recovery mode: ${parseError.message}`);
      
      // Try to extract just the content between the root tags
      const rootMatch = sanitizedXml.match(/<(NewReleaseMessage|ReleaseNotification|ERN)[^>]*>([\s\S]*)<\/\1>/i);
      if (rootMatch) {
        const cleanedXml = `<?xml version="1.0" encoding="UTF-8"?><${rootMatch[1]}>${rootMatch[2]}</${rootMatch[1]}>`;
        ernData = await parser.parseStringPromise(cleanedXml);
      } else {
        throw parseError;
      }
    }
    
    // Get the root element (could be NewReleaseMessage or other)
    const rootKey = Object.keys(ernData)[0];
    const rootData = ernData[rootKey];
    
    logger.log(`Root element: ${rootKey}`);
    logger.log(`Root data keys: ${Object.keys(rootData).join(', ')}`);
    
    // Extract ERN profile
    const ernProfile = detectERNProfile(rootData, detectedVersion);
    
    // Extract releases using improved logic
    const releases = extractReleases(rootData, detectedVersion);
    
    logger.log(`Found ${releases.length} releases`);
    
    // Build ERN metadata object - case sensitive access
    const messageHeader = rootData.MessageHeader || rootData.messageheader || rootData.MESSAGEHEADER || {};
    const messageSender = messageHeader.MessageSender || messageHeader.messagesender || messageHeader.MESSAGESENDER || {};
    const partyName = messageSender.PartyName || messageSender.partyname || messageSender.PARTYNAME || {};
    
    // Extract parsed messageId but preserve original delivery messageId
    const parsedMessageId = messageHeader.MessageId || messageHeader.messageid || messageHeader.MESSAGEID || null;
    
    logger.log(`DEBUG: Original messageId: ${originalData.messageId}, Parsed messageId: ${parsedMessageId}`);
    logger.log(`DEBUG: MessageHeader keys: ${Object.keys(messageHeader).join(', ')}`);
    
    const ernMetadata = {
      version: detectedVersion,
      profile: ernProfile,
      messageId: originalData.messageId || parsedMessageId || deliveryId,
      releaseCount: releases.length,
      parsedMessageId: parsedMessageId
    };
    
    // Only add optional fields if they exist
    if (messageHeader.MessageCreatedDateTime || messageHeader.messagecreateddatetime || messageHeader.MESSAGECREATEDDATETIME) {
      ernMetadata.messageCreatedDateTime = messageHeader.MessageCreatedDateTime || messageHeader.messagecreateddatetime || messageHeader.MESSAGECREATEDDATETIME;
    }
    
    // Build message sender object
    const messageSenderData = {};
    if (messageSender.PartyId || messageSender.partyid || messageSender.PARTYID) {
      messageSenderData.partyId = messageSender.PartyId || messageSender.partyid || messageSender.PARTYID;
    }
    if (partyName.FullName || partyName.fullname || partyName.FULLNAME) {
      messageSenderData.partyName = partyName.FullName || partyName.fullname || partyName.FULLNAME;
    }
    
    // Only add messageSender if it has data
    if (Object.keys(messageSenderData).length > 0) {
      ernMetadata.messageSender = messageSenderData;
    }
    
    // Clean the parsed data for Firestore
    const parsedDataToStore = {
      releases: cleanForFirestore(releases),
      resourceList: cleanForFirestore(rootData.ResourceList || rootData.resourcelist || rootData.RESOURCELIST),
      dealList: cleanForFirestore(rootData.DealList || rootData.deallist || rootData.DEALLIST),
      messageHeader: cleanForFirestore(messageHeader)
    };
    
    // Remove null/undefined fields from parsedData
    const cleanedParsedData = {};
    if (parsedDataToStore.releases) cleanedParsedData.releases = parsedDataToStore.releases;
    if (parsedDataToStore.resourceList) cleanedParsedData.resourceList = parsedDataToStore.resourceList;
    if (parsedDataToStore.dealList) cleanedParsedData.dealList = parsedDataToStore.dealList;
    if (parsedDataToStore.messageHeader) cleanedParsedData.messageHeader = parsedDataToStore.messageHeader;
    
    // Store parsed data with debug information
    const updateData = {
      ern: ernMetadata,
      "processing.parsedAt": admin.firestore.FieldValue.serverTimestamp(),
      // Add debug info to track ID preservation and version detection
      "debug.parsing": {
        originalMessageId: originalData.messageId,
        parsedMessageId: parsedMessageId,
        finalMessageId: ernMetadata.messageId,
        preservedOriginal: !!originalData.messageId,
        detectedVersion: detectedVersion,
        rootElement: rootKey,
        releaseCount: releases.length,
        hasMessageHeader: !!(messageHeader && (messageHeader.MessageId || messageHeader.messageid || messageHeader.MESSAGEID)),
        hasReleaseList: releases.length > 0,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      }
    };
    
    // Only add parsedData if it has content
    if (Object.keys(cleanedParsedData).length > 0) {
      updateData.parsedData = cleanedParsedData;
    }
    
    await db.collection("deliveries").doc(deliveryId).update(updateData);
    
    logger.log(`ERN parsed successfully for delivery: ${deliveryId}`);
    logger.log(`Version: ${detectedVersion}, Releases: ${releases.length}`);
    logger.log(`ID preservation: Original=${originalData.messageId}, Parsed=${parsedMessageId}, Final=${ernMetadata.messageId}`);
    
    return { 
      success: true, 
      releases: releases,
      ernData: rootData,
      ernVersion: detectedVersion
    };
    
  } catch (error) {
    logger.error("ERN parsing failed:", error);
    logger.error("Error details:", {
      message: error.message,
      line: error.line,
      column: error.column,
      snippet: error.snippet
    });
    
    // Store a sample of the problematic XML for debugging
    if (ernXml && error.line) {
      const lines = ernXml.split('\n');
      const problemLine = lines[error.line - 1]; // Convert to 0-indexed
      logger.error(`Problem line (${error.line}): ${problemLine?.substring(Math.max(0, error.column - 20), error.column + 20)}`);
    }
    
    await db.collection("deliveries").doc(deliveryId).update({
      "processing.status": "parse_failed",
      "processing.error": error.message,
      "processing.errorDetails": error.stack,
      "processing.failedAt": admin.firestore.FieldValue.serverTimestamp()
    });
    
    throw error;
  }
}

function detectERNProfile(ernData, ernVersion) {
  // For ERN 4.3, look for MessageProfile or MessageControlType (case-insensitive)
  const messageHeader = ernData.MessageHeader || ernData.messageheader || ernData.MESSAGEHEADER || {};
  
  const messageProfile = messageHeader.MessageProfile || 
                        messageHeader.messageprofile ||
                        messageHeader.MESSAGEPROFILE;
  
  if (messageProfile) {
    return messageProfile;
  }
  
  // Fallback to MessageControlType for older versions
  const messageControlType = messageHeader.MessageControlType ||
                            messageHeader.messagecontroltype ||
                            messageHeader.MESSAGECONTROLTYPE;
    
  if (messageControlType) {
    return messageControlType;
  }
  
  // Default based on version
  if (ernVersion.startsWith("ERN-4")) {
    return "CommonReleaseProfile";
  }
  
  return "AudioAlbumMusicOnly";
}

// Updated extractReleases function to handle ERN 4.3 structure with case sensitivity
function extractReleases(ernData, ernVersion) {
  let releases = [];
  
  logger.log("Extracting releases from parsed data");
  logger.log("Available root keys:", Object.keys(ernData || {}));
  
  // ERN 4.3 structure - look for ReleaseList with case variations
  const releaseList = ernData.ReleaseList || ernData.releaselist || ernData.RELEASELIST;
  
  if (releaseList) {
    logger.log("Found ReleaseList with keys:", Object.keys(releaseList));
    
    const releaseData = releaseList.Release || releaseList.release || releaseList.RELEASE;
    
    if (releaseData) {
      releases = Array.isArray(releaseData) ? releaseData : [releaseData];
      logger.log(`Found ${releases.length} releases in ReleaseList`);
    }
  }
  
  // If still no releases, try nested under NewReleaseMessage (ERN 3.x)
  if (releases.length === 0) {
    const nestedMessage = ernData.NewReleaseMessage || ernData.newreleasemessage || ernData.NEWRELEASEMESSAGE;
    if (nestedMessage) {
      const nestedReleaseList = nestedMessage.ReleaseList || nestedMessage.releaselist || nestedMessage.RELEASELIST;
      if (nestedReleaseList) {
        const nestedReleases = nestedReleaseList.Release || nestedReleaseList.release || nestedReleaseList.RELEASE;
        if (nestedReleases) {
          releases = Array.isArray(nestedReleases) ? nestedReleases : [nestedReleases];
          logger.log(`Found ${releases.length} releases in nested structure`);
        }
      }
    }
  }
  
  if (releases.length === 0) {
    logger.warn("No releases found in expected locations");
  }
  
  return releases.map((release, index) => {
    const mappedRelease = {};
    
    logger.log(`Processing release ${index + 1}:`, Object.keys(release || {}));
    
    // Map release properties with case variations
    if (release.ReleaseId || release.releaseid || release.RELEASEID) {
      mappedRelease.ReleaseId = release.ReleaseId || release.releaseid || release.RELEASEID;
    }
    if (release.ReleaseReference || release.releasereference || release.RELEASEREFERENCE) {
      mappedRelease.ReleaseReference = release.ReleaseReference || release.releasereference || release.RELEASEREFERENCE;
    }
    if (release.ReleaseType || release.releasetype || release.RELEASETYPE) {
      mappedRelease.ReleaseType = release.ReleaseType || release.releasetype || release.RELEASETYPE;
    }
    if (release.ReleaseDetailsByTerritory || release.releasedetailsbyterritory || release.RELEASEDETAILSBYTERRITORY) {
      mappedRelease.ReleaseDetailsByTerritory = release.ReleaseDetailsByTerritory || release.releasedetailsbyterritory || release.RELEASEDETAILSBYTERRITORY;
    }
    if (release.ReferenceTitle || release.referencetitle || release.REFERENCETITLE) {
      mappedRelease.ReferenceTitle = release.ReferenceTitle || release.referencetitle || release.REFERENCETITLE;
    }
    if (release.DisplayTitleText || release.displaytitletext || release.DISPLAYTITLETEXT) {
      mappedRelease.DisplayTitleText = release.DisplayTitleText || release.displaytitletext || release.DISPLAYTITLETEXT;
    }
    if (release.DisplayArtist || release.displayartist || release.DISPLAYARTIST) {
      mappedRelease.DisplayArtist = release.DisplayArtist || release.displayartist || release.DISPLAYARTIST;
    }
    if (release.ReleaseResourceReferenceList || release.releaseresourcereferencelist || release.RELEASERESOURCEREFERENCELIST) {
      mappedRelease.ReleaseResourceReferenceList = release.ReleaseResourceReferenceList || release.releaseresourcereferencelist || release.RELEASERESOURCEREFERENCELIST;
    }
    
    // Add ResourceList from parent if available
    mappedRelease.ResourceList = ernData.ResourceList || ernData.resourcelist || ernData.RESOURCELIST;
    
    if (release.GlobalReleaseDate || release.globalreleasedate || release.GLOBALRELEASEDATE || release.ReleaseDate || release.releasedate) {
      mappedRelease.GlobalReleaseDate = release.GlobalReleaseDate || release.globalreleasedate || release.GLOBALRELEASEDATE || release.ReleaseDate || release.releasedate;
    }
    if (release.GlobalOriginalReleaseDate || release.globaloriginalreleasedate || release.GLOBALORIGINALRELEASEDATE || release.OriginalReleaseDate) {
      mappedRelease.GlobalOriginalReleaseDate = release.GlobalOriginalReleaseDate || release.globaloriginalreleasedate || release.GLOBALORIGINALRELEASEDATE || release.OriginalReleaseDate;
    }
    
    return mappedRelease;
  });
}

module.exports = { parseERN };