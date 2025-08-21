// functions/ingestion/validator.js
const admin = require("firebase-admin");
const axios = require("axios");

// Use console.log if logger is not available
const logger = {
  log: (...args) => console.log(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args)
};

const db = admin.firestore();

// DDEX Workbench API configuration
const WORKBENCH_CONFIG = {
  baseUrl: "https://api.ddex-workbench.org",
  apiPath: "/v1/validate",
  useAPI: process.env.USE_DDEX_API !== 'false', // Enabled by default
  timeout: 30000, // 30 seconds for large files
  maxRetries: 2, // Reduce retries
  retryDelay: 1000
};

/**
 * Map ERN version to simple version string for API
 */
function getAPIVersion(ernVersion) {
  const versionMap = {
    "ERN-4.3": "4.3",
    "ERN-4.2": "4.2", 
    "ERN-4.1": "4.1",
    "ERN-4.0": "4.0",
    "ERN-3.8.2": "3.8.2",
    "ERN-3.8.1": "3.8.1",
    "ERN-3.7": "3.7",
    "ERN-3.6": "3.6"
  };
  
  return versionMap[ernVersion] || "4.3";
}

/**
 * Map profile to API-compatible profile name
 */
function getAPIProfile(profile) {
  // Handle test messages
  if (profile === "TestMessage" || profile === "Test" || profile === "LiveMessage") {
    return "AudioSingle"; // Default for test messages
  }
  
  // Simplify profile names for the API
  const profileMap = {
    "AudioAlbumMusicOnly": "AudioAlbum",
    "AudioSingleMusicOnly": "AudioSingle",
    "VideoAlbum": "VideoAlbum",
    "VideoSingle": "VideoSingle",
    "CommonReleaseProfile": "CommonRelease"
  };
  
  return profileMap[profile] || "AudioAlbum";
}

/**
 * Validate ERN using DDEX Workbench API
 */
async function validateERN(deliveryId, ernData, ernVersion) {
  logger.log(`Validating ERN for delivery: ${deliveryId}, version: ${ernVersion}`);
  
  try {
    // Update status
    await db.collection("deliveries").doc(deliveryId).update({
      "processing.status": "validating",
      "processing.validatingAt": admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Get delivery for ERN XML
    const deliveryDoc = await db.collection("deliveries").doc(deliveryId).get();
    const delivery = deliveryDoc.data();
    const ernXml = delivery.ernXml || delivery.ern?.xml;
    
    if (!ernXml) {
      throw new Error("No ERN XML found for validation");
    }
    
    // Detect profile from ERN data
    const profile = detectProfile(ernData, ernVersion);
    
    logger.log(`Validation parameters:`, {
      ernVersion,
      detectedProfile: profile,
      xmlLength: ernXml.length,
      useAPI: WORKBENCH_CONFIG.useAPI
    });
    
    let validation;
    
    if (WORKBENCH_CONFIG.useAPI) {
      try {
        // Try DDEX Workbench API with proper error handling
        validation = await callDDEXWorkbenchAPI(ernXml, ernVersion, profile);
        logger.log("DDEX Workbench API validation completed successfully");
      } catch (apiError) {
        logger.warn(`DDEX Workbench API failed: ${apiError.message}`);
        logger.warn("Falling back to comprehensive local validation");
        validation = await performComprehensiveValidation(ernData, ernVersion, ernXml);
      }
    } else {
      logger.log("Using comprehensive local validation (API disabled)");
      validation = await performComprehensiveValidation(ernData, ernVersion, ernXml);
    }
    
    // Store validation results
    await db.collection("deliveries").doc(deliveryId).update({
      validation: {
        valid: validation.valid,
        errors: validation.errors || [],
        warnings: validation.warnings || [],
        info: validation.info || [],
        validatedAt: admin.firestore.FieldValue.serverTimestamp(),
        validatorVersion: validation.version || "unknown",
        ernVersion: ernVersion,
        profile: profile,
        apiProfile: getAPIProfile(profile)
      }
    });
    
    if (!validation.valid) {
      await db.collection("deliveries").doc(deliveryId).update({
        "processing.status": "validation_failed",
        "processing.failedAt": admin.firestore.FieldValue.serverTimestamp()
      });
      
      throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
    }
    
    logger.log(`Validation passed for delivery: ${deliveryId}`);
    return validation;
    
  } catch (error) {
    logger.error("Validation process failed:", error);
    
    await db.collection("deliveries").doc(deliveryId).update({
      "processing.status": "validation_error",
      "processing.error": error.message,
      "processing.failedAt": admin.firestore.FieldValue.serverTimestamp()
    });
    
    throw error;
  }
}

/**
 * Call DDEX Workbench API for validation
 * Using standard HTTP request without Firebase Functions SDK
 */
async function callDDEXWorkbenchAPI(ernXml, ernVersion, profile) {
  const apiVersion = getAPIVersion(ernVersion);
  const apiProfile = getAPIProfile(profile);
  const endpoint = `${WORKBENCH_CONFIG.baseUrl}${WORKBENCH_CONFIG.apiPath}`;
  
  logger.log(`Calling DDEX Workbench API: ${endpoint}`);
  logger.log(`Request params: version=${apiVersion}, profile=${apiProfile}`);
  
  for (let attempt = 1; attempt <= WORKBENCH_CONFIG.maxRetries; attempt++) {
    try {
      // Prepare the request body
      const requestBody = {
        content: ernXml,
        type: "ERN",
        version: apiVersion,
        profile: apiProfile
      };
      
      logger.log(`API attempt ${attempt}/${WORKBENCH_CONFIG.maxRetries}`);
      
      // Make the HTTP request using axios
      const response = await axios({
        method: 'POST',
        url: endpoint,
        data: requestBody,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          // Add origin header to help with CORS
          'Origin': 'https://stardust-dsp.firebasestorage.app'
        },
        timeout: WORKBENCH_CONFIG.timeout,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        validateStatus: (status) => status < 500 // Don't throw on 4xx
      });
      
      logger.log(`API response status: ${response.status}`);
      
      // Handle different response statuses
      if (response.status === 200) {
        const result = response.data;
        
        logger.log(`Validation result: valid=${result.valid}, errors=${result.errors?.length || 0}, warnings=${result.warnings?.length || 0}`);
        
        // Extract error messages from error objects
        const errorMessages = (result.errors || []).map(err => {
          if (typeof err === 'string') return err;
          if (err.message) return err.message;
          if (err.error) return err.error;
          if (err.description) return err.description;
          if (err.text) return err.text;
          // Log the error object for debugging
          logger.log('Error object structure:', JSON.stringify(err));
          return JSON.stringify(err);
        });
        
        // Extract warning messages from warning objects
        const warningMessages = (result.warnings || []).map(warn => {
          if (typeof warn === 'string') return warn;
          if (warn.message) return warn.message;
          if (warn.warning) return warn.warning;
          if (warn.description) return warn.description;
          if (warn.text) return warn.text;
          return JSON.stringify(warn);
        });
        
        return {
          valid: result.valid === true,
          errors: errorMessages,
          warnings: warningMessages,
          info: result.info || result.messages || [],
          version: "ddex-workbench-api-v1"
        };
      }
      
      if (response.status === 400) {
        // Bad request - probably invalid content
        const errorData = response.data;
        logger.warn(`API rejected content: ${JSON.stringify(errorData)}`);
        
        return {
          valid: false,
          errors: [errorData.message || errorData.error || "Invalid ERN content"],
          warnings: [],
          info: ["API rejected the content with status 400"],
          version: "ddex-workbench-api-v1"
        };
      }
      
      if (response.status === 404) {
        throw new Error(`API endpoint not found (404). Please check if the API is available.`);
      }
      
      // Unexpected status
      throw new Error(`Unexpected API response status: ${response.status}`);
      
    } catch (error) {
      const errorMessage = error.response ? 
        `API error ${error.response.status}: ${error.response.statusText}` :
        error.request ? 
        `No response from API: ${error.code || 'Network error'}` :
        `Request setup error: ${error.message}`;
      
      logger.error(`Attempt ${attempt} failed: ${errorMessage}`);
      
      // Check if it's a CORS error
      if (error.code === 'ERR_NETWORK' || error.message.includes('CORS')) {
        logger.error('Possible CORS issue detected. The DDEX Workbench API may need to whitelist this origin.');
      }
      
      if (attempt < WORKBENCH_CONFIG.maxRetries) {
        const delay = WORKBENCH_CONFIG.retryDelay * attempt;
        logger.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw new Error(`DDEX Workbench API failed after ${WORKBENCH_CONFIG.maxRetries} attempts: ${errorMessage}`);
      }
    }
  }
}

/**
 * Comprehensive local validation
 */
async function performComprehensiveValidation(ernData, ernVersion, ernXml) {
  const errors = [];
  const warnings = [];
  const info = [];
  
  logger.log("Performing comprehensive local validation");
  
  // XML structure checks
  if (!ernXml || ernXml.length < 100) {
    errors.push("XML content is missing or too short");
  }
  
  // Check MessageHeader
  if (!ernData.MESSAGEHEADER) {
    errors.push("Missing required MessageHeader element");
  } else {
    const header = ernData.MESSAGEHEADER;
    
    if (!header.MESSAGEID) {
      errors.push("MessageHeader missing required MessageId");
    }
    
    if (!header.MESSAGECREATEDDATETIME) {
      errors.push("MessageHeader missing required MessageCreatedDateTime");
    }
    
    if (!header.MESSAGESENDER) {
      errors.push("MessageHeader missing required MessageSender");
    }
  }
  
  // Check ReleaseList
  if (!ernData.RELEASELIST) {
    errors.push("Missing required ReleaseList element");
  } else {
    const releases = ernData.RELEASELIST.RELEASE || [];
    const releaseArray = Array.isArray(releases) ? releases : [releases];
    
    if (releaseArray.length === 0) {
      errors.push("ReleaseList must contain at least one Release");
    }
    
    releaseArray.forEach((release, index) => {
      if (!release.RELEASEREFERENCE) {
        errors.push(`Release ${index + 1}: Missing required ReleaseReference`);
      }
      
      if (!release.RELEASEID) {
        errors.push(`Release ${index + 1}: Missing required ReleaseId`);
      }
      
      if (!release.REFERENCETITLE && !release.DISPLAYTITLETEXT) {
        errors.push(`Release ${index + 1}: Missing title information`);
      }
    });
  }
  
  // Check ResourceList
  if (!ernData.RESOURCELIST) {
    errors.push("Missing required ResourceList element");
  } else {
    const soundRecordings = ernData.RESOURCELIST.SOUNDRECORDING || [];
    const images = ernData.RESOURCELIST.IMAGE || [];
    
    const totalResources = 
      (Array.isArray(soundRecordings) ? soundRecordings.length : (soundRecordings ? 1 : 0)) +
      (Array.isArray(images) ? images.length : (images ? 1 : 0));
    
    if (totalResources === 0) {
      errors.push("ResourceList must contain at least one resource");
    }
  }
  
  // Add info
  info.push(`ERN Version: ${ernVersion}`);
  info.push(`Validation mode: Local comprehensive validation`);
  info.push(`Total errors: ${errors.length}`);
  info.push(`Total warnings: ${warnings.length}`);
  
  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    info: info,
    version: "local-validator-2.0"
  };
}

/**
 * Detect profile from ERN data
 */
function detectProfile(ernData, ernVersion) {
  const messageHeader = ernData.MESSAGEHEADER || {};
  const controlType = messageHeader.MESSAGECONTROLTYPE;
  
  if (controlType === "UpdateMessage" || 
      controlType === "OriginalMessage" || 
      controlType === "TestMessage" || 
      controlType === "Test" || 
      controlType === "LiveMessage") {
    
    logger.log(`MessageControlType '${controlType}' detected, inferring profile from content`);
    
    const releaseList = ernData.RELEASELIST || {};
    const releases = releaseList.RELEASE || [];
    const firstRelease = Array.isArray(releases) ? releases[0] : releases;
    
    if (firstRelease) {
      const releaseType = firstRelease.RELEASETYPE;
      
      // Check for video content first
      const resourceList = ernData.RESOURCELIST || {};
      const hasVideo = resourceList.VIDEO || resourceList.VIDEOCLIP;
      
      if (hasVideo) {
        if (releaseType === "Single") {
          return "VideoSingle";
        } else if (releaseType === "Album" || releaseType === "EP") {
          return "VideoAlbum";
        }
      }
      
      // Audio content
      if (releaseType === "Single") {
        return "AudioSingleMusicOnly";
      } else if (releaseType === "Album" || releaseType === "EP") {
        return "AudioAlbumMusicOnly";
      } else if (releaseType === "Compilation") {
        return "AudioAlbumMusicOnly";
      }
      
      // Fallback: Check track count
      const resourceRefs = firstRelease.RELEASERESOURCEREFERENCELIST;
      if (resourceRefs) {
        const refList = resourceRefs.RELEASERESOURCEREFERENCE || [];
        const trackCount = Array.isArray(refList) ? refList.length : 1;
        return trackCount <= 3 ? "AudioSingleMusicOnly" : "AudioAlbumMusicOnly";
      }
    }
    
    // Default based on sound recording count
    if (ernData.RESOURCELIST?.SOUNDRECORDING) {
      const soundCount = Array.isArray(ernData.RESOURCELIST.SOUNDRECORDING) ? 
        ernData.RESOURCELIST.SOUNDRECORDING.length : 1;
      return soundCount <= 3 ? "AudioSingleMusicOnly" : "AudioAlbumMusicOnly";
    }
    
    return "AudioSingleMusicOnly";
  }
  
  // Check if controlType is actually a valid profile name
  const validProfiles = [
    "AudioAlbumMusicOnly",
    "AudioSingleMusicOnly", 
    "VideoAlbum",
    "VideoSingle",
    "CommonReleaseProfile"
  ];
  
  if (controlType && validProfiles.includes(controlType)) {
    return controlType;
  }
  
  // Default: infer from content
  logger.log("No valid profile found, inferring from content");
  const releaseList = ernData.RELEASELIST || {};
  const releases = releaseList.RELEASE || [];
  const firstRelease = Array.isArray(releases) ? releases[0] : releases;
  
  if (firstRelease?.RELEASETYPE === "Single") {
    return "AudioSingleMusicOnly";
  }
  
  return "AudioAlbumMusicOnly";
}

// Export for direct use
module.exports = { 
  validateERN,
  detectProfile,
  getAPIVersion,
  getAPIProfile,
  performComprehensiveValidation
};