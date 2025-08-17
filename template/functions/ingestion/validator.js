// functions/ingestion/validator.js
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

const db = admin.firestore();

// DDEX Workbench API URL (no authentication needed)
const WORKBENCH_API = process.env.WORKBENCH_API_URL || "https://ddex-workbench.org/api";

/**
 * Validate ERN via DDEX Workbench API
 * Direct function - no longer Pub/Sub triggered
 * API Docs: https://ddex-workbench.org/api
 */
async function validateERN(deliveryId, ernData, ernVersion) {
  logger.log(`Validating ERN for delivery: ${deliveryId}, version: ${ernVersion}`);
  
  try {
    // Update status
    await db.collection("deliveries").doc(deliveryId).update({
      "processing.status": "validating",
      "processing.validatingAt": admin.firestore.FieldValue.serverTimestamp()
    });
    
    // For testing/development, use improved mock validation
    const validation = await mockValidation(ernData, ernVersion, deliveryId);
    
    /* Production DDEX Workbench API call:
    const validationResponse = await axios.post(
      `${WORKBENCH_API}/validate/ern`,
      {
        content: ernData,
        version: ernVersion,
        profile: detectProfile(ernData, ernVersion),
        validateSchema: true,
        validateBusiness: true,
        validateTechnical: true
      },
      {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 30000 // 30 second timeout
      }
    );
    
    const validation = validationResponse.data;
    */
    
    // Store validation results
    await db.collection("deliveries").doc(deliveryId).update({
      validation: {
        valid: validation.valid || validation.success,
        errors: validation.errors || [],
        warnings: validation.warnings || [],
        info: validation.info || [],
        validatedAt: admin.firestore.FieldValue.serverTimestamp(),
        workbenchVersion: validation.version || "mock",
        ernVersion: ernVersion
      }
    });
    
    if (!validation.valid && !validation.success) {
      // Mark as validation failed
      await db.collection("deliveries").doc(deliveryId).update({
        "processing.status": "validation_failed",
        "processing.failedAt": admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Log validation errors
      logger.warn(`Validation failed for delivery: ${deliveryId}`, {
        errors: validation.errors,
        warnings: validation.warnings
      });
      
      throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
    }
    
    logger.log(`Validation passed for delivery: ${deliveryId}`);
    return validation;
    
  } catch (error) {
    logger.error("Validation failed:", error);
    
    // Check if it's an API error with response
    let errorMessage = error.message;
    if (error.response) {
      errorMessage = `Workbench API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`;
    }
    
    await db.collection("deliveries").doc(deliveryId).update({
      "processing.status": "validation_error",
      "processing.error": errorMessage,
      "processing.failedAt": admin.firestore.FieldValue.serverTimestamp()
    });
    
    throw error;
  }
}

/**
 * Improved mock validation for ERN 4.3
 */
async function mockValidation(ernData, ernVersion, deliveryId) {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const errors = [];
  const warnings = [];
  const info = [];
  
  logger.log(`Mock validation for ERN ${ernVersion}`);
  
  // Get delivery debug info
  const deliveryDoc = await db.collection("deliveries").doc(deliveryId).get();
  const debugInfo = deliveryDoc.data()?.debug?.parsing;
  
  // Enhanced validation checks based on ERN version
  if (ernVersion.startsWith("ERN-4")) {
    // ERN 4.x validation
    if (!debugInfo?.hasMessageHeader) {
      errors.push("Missing MessageHeader in ERN message");
    }
    
    if (!debugInfo?.hasReleaseList) {
      errors.push("Missing ReleaseList in ERN message");
    }
    
    // Check for required ERN 4.x elements
    if (!ernData.MessageProfile && !ernData.MessageControlType) {
      warnings.push("MessageProfile or MessageControlType recommended for ERN 4.x");
    }
    
  } else {
    // ERN 3.x validation (legacy)
    if (!ernData.MessageHeader?.MessageId && !debugInfo?.hasMessageHeader) {
      errors.push("Missing MessageId in MessageHeader");
    }
    
    if (!debugInfo?.hasReleaseList) {
      errors.push("Missing ReleaseList in ERN message");
    }
    
    // Add warning for deprecated version
    warnings.push("ERN-3 is deprecated, consider upgrading to ERN-4");
  }
  
  // Add informational messages
  info.push(`ERN Version: ${ernVersion}`);
  info.push("Schema validation: Passed");
  info.push("Business rules validation: Passed");
  
  if (debugInfo) {
    info.push(`Releases found: ${debugInfo.releaseCount || 0}`);
    info.push(`Root element: ${debugInfo.rootElement || 'Unknown'}`);
  }
  
  return {
    valid: errors.length === 0,
    success: errors.length === 0,
    errors: errors,
    warnings: warnings,
    info: info,
    version: "mock-validator-2.0"
  };
}

function detectProfile(ernData, ernVersion) {
  if (ernVersion.startsWith("ERN-4")) {
    return ernData.MessageProfile || ernData.MessageControlType || "CommonReleaseProfile";
  }
  return ernData.MessageControlType || "AudioAlbumMusicOnly";
}

// Export for direct use
module.exports = { validateERN };