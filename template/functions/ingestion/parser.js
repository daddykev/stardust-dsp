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
 * Detect message type from ERN data
 */
function detectMessageType(ernData, rootKey) {
  // Check root element name
  if (rootKey.toUpperCase().includes('NEWRELEASE')) {
    return 'NewRelease';
  }
  
  // Check for UpdateIndicator in releases
  const releaseList = ernData.RELEASELIST || {};
  const releases = releaseList.RELEASE || [];
  const firstRelease = Array.isArray(releases) ? releases[0] : releases;
  
  if (firstRelease) {
    // Check for takedown indicators
    const dealList = ernData.DEALLIST || {};
    const deals = dealList.RELEASEDEAL || dealList.Deal || [];
    const firstDeal = Array.isArray(deals) ? deals[0] : deals;
    
    if (firstDeal?.DealTerms?.TakeDown === 'true' || 
        firstDeal?.DEALTERMS?.TAKEDOWN === 'true') {
      return 'Takedown';
    }
    
    // Check for update indicator
    if (firstRelease.UpdateIndicator === 'OriginalMessage' || 
        firstRelease.UPDATEINDICATOR === 'OriginalMessage') {
      return 'NewRelease';
    } else if (firstRelease.UpdateIndicator || firstRelease.UPDATEINDICATOR) {
      return 'Update';
    }
  }
  
  // Default to NewRelease
  return 'NewRelease';
}

/**
 * Parse ERN XML and extract release information
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
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      tagNameProcessors: [xml2js.processors.stripPrefix],
      strict: false,
      normalize: false,
      normalizeTags: false,
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
      
      const rootMatch = sanitizedXml.match(/<(NewReleaseMessage|ReleaseNotification|ERN)[^>]*>([\s\S]*)<\/\1>/i);
      if (rootMatch) {
        const cleanedXml = `<?xml version="1.0" encoding="UTF-8"?><${rootMatch[1]}>${rootMatch[2]}</${rootMatch[1]}>`;
        ernData = await parser.parseStringPromise(cleanedXml);
      } else {
        throw parseError;
      }
    }
    
    // Get the root element - could be NewReleaseMessage or other
    const rootKey = Object.keys(ernData)[0];
    const rootData = ernData[rootKey];
    
    // Convert all root keys to uppercase for consistency
    const uppercaseRootData = {};
    for (const [key, value] of Object.entries(rootData)) {
      uppercaseRootData[key.toUpperCase()] = value;
    }
    
    logger.log(`Root element: ${rootKey.toUpperCase()}`);
    logger.log(`Root data keys: ${Object.keys(uppercaseRootData).join(', ')}`);
    
    // Detect message type
    const messageType = detectMessageType(uppercaseRootData, rootKey);
    logger.log(`Message type detected: ${messageType}`);
    
    // Extract ERN profile
    const ernProfile = detectERNProfile(uppercaseRootData, detectedVersion);
    
    // Extract releases using improved logic
    const releases = extractReleases(uppercaseRootData, detectedVersion);
    
    logger.log(`Found ${releases.length} releases`);
    
    // Build ERN metadata object
    const messageHeader = uppercaseRootData.MESSAGEHEADER || {};
    const messageSender = messageHeader.MessageSender || messageHeader.MESSAGESENDER || {};
    const partyName = messageSender.PartyName || messageSender.PARTYNAME || {};
    
    const parsedMessageId = messageHeader.MessageId || messageHeader.MESSAGEID || null;
    
    logger.log(`DEBUG: Original messageId: ${originalData.messageId}, Parsed messageId: ${parsedMessageId}`);
    logger.log(`DEBUG: MessageHeader keys: ${Object.keys(messageHeader).map(k => k.toUpperCase()).join(', ')}`);
    
    const ernMetadata = {
      version: detectedVersion,
      profile: ernProfile,
      messageType: messageType,
      messageId: originalData.messageId || parsedMessageId || deliveryId,
      releaseCount: releases.length,
      parsedMessageId: parsedMessageId
    };
    
    if (messageHeader.MessageCreatedDateTime || messageHeader.MESSAGECREATEDDATETIME) {
      ernMetadata.messageCreatedDateTime = messageHeader.MessageCreatedDateTime || messageHeader.MESSAGECREATEDDATETIME;
    }
    
    const messageSenderData = {};
    if (messageSender.PartyId || messageSender.PARTYID) {
      messageSenderData.partyId = messageSender.PartyId || messageSender.PARTYID;
    }
    if (partyName.FullName || partyName.FULLNAME) {
      messageSenderData.partyName = partyName.FullName || partyName.FULLNAME;
    }
    
    if (Object.keys(messageSenderData).length > 0) {
      ernMetadata.messageSender = messageSenderData;
    }
    
    // Clean and prepare parsed data for Firestore
    const parsedDataToStore = {
      releases: cleanForFirestore(releases),
      RESOURCELIST: cleanForFirestore(uppercaseRootData.RESOURCELIST),
      DEALLIST: cleanForFirestore(uppercaseRootData.DEALLIST),
      MESSAGEHEADER: cleanForFirestore(uppercaseRootData.MESSAGEHEADER)
    };
    
    // Remove null/undefined fields from parsedData
    const cleanedParsedData = {};
    for (const [key, value] of Object.entries(parsedDataToStore)) {
      if (value !== null && value !== undefined) {
        cleanedParsedData[key] = value;
      }
    }
    
    // Store parsed data with debug information
    const updateData = {
      ern: ernMetadata,
      parsedData: cleanedParsedData,  // Store the parsed data
      "processing.parsedAt": admin.firestore.FieldValue.serverTimestamp(),
      "debug.parsing": {
        originalMessageId: originalData.messageId,
        parsedMessageId: parsedMessageId,
        finalMessageId: ernMetadata.messageId,
        preservedOriginal: !!originalData.messageId,
        detectedVersion: detectedVersion,
        messageType: messageType,
        rootElement: rootKey.toUpperCase(),
        releaseCount: releases.length,
        hasMessageHeader: !!uppercaseRootData.MESSAGEHEADER,
        hasReleaseList: releases.length > 0,
        hasResourceList: !!uppercaseRootData.RESOURCELIST,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      }
    };
    
    await db.collection("deliveries").doc(deliveryId).update(updateData);
    
    logger.log(`ERN parsed successfully for delivery: ${deliveryId}`);
    logger.log(`Version: ${detectedVersion}, Message Type: ${messageType}, Releases: ${releases.length}`);
    logger.log(`ID preservation: Original=${originalData.messageId}, Parsed=${parsedMessageId}, Final=${ernMetadata.messageId}`);
    
    return { 
      success: true, 
      releases: releases,
      ernData: uppercaseRootData,
      ernVersion: detectedVersion,
      messageType: messageType
    };
    
  } catch (error) {
    logger.error("ERN parsing failed:", error);
    logger.error("Error details:", {
      message: error.message,
      line: error.line,
      column: error.column,
      snippet: error.snippet
    });
    
    await db.collection("deliveries").doc(deliveryId).update({
      "processing.status": "parse_failed",
      "processing.error": error.message,
      "processing.errorDetails": error.stack,
      "processing.failedAt": admin.firestore.FieldValue.serverTimestamp()
    });
    
    throw error;
  }
}

// Fixed extractReleases function
function extractReleases(ernData, ernVersion) {
  let releases = [];
  
  logger.log("Extracting releases from parsed data");
  logger.log("Available root keys:", Object.keys(ernData || {}));
  
  // Look for ReleaseList - should be in UPPERCASE now
  const releaseList = ernData.RELEASELIST || ernData.ReleaseList;
  
  if (releaseList) {
    logger.log("Found ReleaseList with keys:", Object.keys(releaseList));
    
    const releaseData = releaseList.RELEASE || releaseList.Release;
    
    if (releaseData) {
      releases = Array.isArray(releaseData) ? releaseData : [releaseData];
      logger.log(`Found ${releases.length} releases in ReleaseList`);
    }
  }
  
  if (releases.length === 0) {
    logger.warn("No releases found in expected locations");
  }
  
  return releases.map((release, index) => {
    const mappedRelease = {};
    
    logger.log(`Processing release ${index + 1}:`, Object.keys(release || {}).map(k => k.toUpperCase()));
    
    // Map release properties with UPPERCASE keys
    if (release.ReleaseId || release.RELEASEID) {
      mappedRelease.RELEASEID = release.ReleaseId || release.RELEASEID;
      
      // Log the ICPN structure
      const releaseId = mappedRelease.RELEASEID;
      if (releaseId) {
        logger.log(`ReleaseId structure:`, JSON.stringify(releaseId));
        if (releaseId.ICPN) {
          // Extract the actual ICPN value for logging
          let icpnValue = releaseId.ICPN;
          if (typeof icpnValue === 'object' && icpnValue._) {
            icpnValue = icpnValue._;
          }
          logger.log(`Found ICPN: ${icpnValue}`);
        }
      }
    }
    
    // Map all other properties with UPPERCASE
    mappedRelease.RELEASEREFERENCE = release.ReleaseReference || release.RELEASEREFERENCE;
    mappedRelease.RELEASETYPE = release.ReleaseType || release.RELEASETYPE;
    mappedRelease.RELEASEDETAILSBYTERRITORY = release.ReleaseDetailsByTerritory || release.RELEASEDETAILSBYTERRITORY;
    mappedRelease.REFERENCETITLE = release.ReferenceTitle || release.REFERENCETITLE;
    mappedRelease.DISPLAYTITLETEXT = release.DisplayTitleText || release.DISPLAYTITLETEXT;
    mappedRelease.DISPLAYARTIST = release.DisplayArtist || release.DISPLAYARTIST;
    mappedRelease.RELEASERESOURCEREFERENCELIST = release.ReleaseResourceReferenceList || release.RELEASERESOURCEREFERENCELIST;
    mappedRelease.LABELNAME = release.LabelName || release.LABELNAME;
    mappedRelease.GENRE = release.Genre || release.GENRE;
    mappedRelease.PLINE = release.PLine || release.PLINE;
    mappedRelease.CLINE = release.CLine || release.CLINE;
    mappedRelease.RELEASEDATE = release.ReleaseDate || release.RELEASEDATE;
    mappedRelease.ORIGINALRELEASEDATE = release.OriginalReleaseDate || release.ORIGINALRELEASEDATE;
    mappedRelease.UPDATEINDICATOR = release.UpdateIndicator || release.UPDATEINDICATOR;
    
    // Map ResourceList and DealList if present at release level
    if (release.ResourceList || release.RESOURCELIST) {
      mappedRelease.RESOURCELIST = release.ResourceList || release.RESOURCELIST;
    }
    if (release.DealList || release.DEALLIST) {
      mappedRelease.DEALLIST = release.DealList || release.DEALLIST;
    }
    
    return mappedRelease;
  });
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

module.exports = { parseERN };