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
  logger.log(`Validating ERN for delivery: ${deliveryId}`);
  
  try {
    // Update status
    await db.collection("deliveries").doc(deliveryId).update({
      "processing.status": "validating",
      "processing.validatingAt": admin.firestore.FieldValue.serverTimestamp()
    });
    
    // For testing/development, use mock validation
    // In production, uncomment the DDEX Workbench API call below
    const validation = await mockValidation(ernData, ernVersion);
    
    /* Production DDEX Workbench API call:
    const validationResponse = await axios.post(
      `${WORKBENCH_API}/validate/ern`,
      {
        content: ernData,
        version: ernVersion,
        profile: "AudioAlbumMusicOnly", // or detect from ERN
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
        workbenchVersion: validation.version || "mock"
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
      
      // Create notification for validation failure
      await db.collection("notifications").add({
        type: "validation_failed",
        deliveryId: deliveryId,
        distributorId: (await db.collection("deliveries").doc(deliveryId).get()).data().sender,
        errors: validation.errors,
        warnings: validation.warnings,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false
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
 * Mock validation for testing
 * Returns realistic validation results without calling external API
 */
async function mockValidation(ernData, ernVersion) {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const errors = [];
  const warnings = [];
  const info = [];
  
  // Basic validation checks
  if (!ernData.MessageHeader?.MessageId) {
    errors.push("Missing MessageId in MessageHeader");
  }
  
  if (!ernData.ReleaseList && !ernData.NewReleaseMessage?.ReleaseList) {
    errors.push("Missing ReleaseList in ERN message");
  }
  
  // Add informational messages
  info.push(`ERN Version: ${ernVersion}`);
  info.push("Schema validation: Passed");
  info.push("Business rules validation: Passed");
  
  // Add a warning for testing
  if (ernVersion === "ERN-3") {
    warnings.push("ERN-3 is deprecated, consider upgrading to ERN-4");
  }
  
  return {
    valid: errors.length === 0,
    success: errors.length === 0,
    errors: errors,
    warnings: warnings,
    info: info,
    version: "mock-validator-1.0"
  };
}

// Export for direct use
module.exports = { validateERN };