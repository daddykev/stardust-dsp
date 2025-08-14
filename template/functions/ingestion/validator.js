// functions/ingestion/validator.js
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const { PubSub } = require("@google-cloud/pubsub");

const db = admin.firestore();
const pubsub = new PubSub();

// DDEX Workbench API URL (no authentication needed)
const WORKBENCH_API = process.env.WORKBENCH_API_URL || "https://ddex-workbench.org/api";

/**
 * Validate ERN via DDEX Workbench API
 * API Docs: https://ddex-workbench.org/api
 */
exports.validateERN = onMessagePublished({
  topic: "ern-validation",
  timeoutSeconds: 300,
  memory: "512MiB",
  maxInstances: 5
}, async (event) => {
  const { deliveryId, ernData, ernVersion } = event.data.message.json;
  
  logger.log(`Validating ERN for delivery: ${deliveryId}`);
  
  try {
    // Update status
    await db.collection("deliveries").doc(deliveryId).update({
      "processing.status": "validating"
    });
    
    // Call DDEX Workbench API - No authentication needed
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
    
    // Store validation results
    await db.collection("deliveries").doc(deliveryId).update({
      validation: {
        valid: validation.valid || validation.success,
        errors: validation.errors || [],
        warnings: validation.warnings || [],
        info: validation.info || [],
        validatedAt: admin.firestore.FieldValue.serverTimestamp(),
        workbenchVersion: validation.version || "unknown"
      }
    });
    
    if (validation.valid || validation.success) {
      // Trigger processing
      const processingTopic = pubsub.topic("release-processing");
      await processingTopic.publishMessage({
        json: {
          deliveryId,
          releaseData: ernData.ReleaseList?.Release,
          deliveryPath: event.data.message.json.manifestPath,
          ernVersion
        }
      });
      
      logger.log(`Validation passed for delivery: ${deliveryId}`);
    } else {
      // Mark as validation failed
      await db.collection("deliveries").doc(deliveryId).update({
        "processing.status": "validation_failed",
        "processing.failedAt": admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Send validation error notification
      const errorTopic = pubsub.topic("validation-errors");
      await errorTopic.publishMessage({
        json: {
          deliveryId,
          errors: validation.errors,
          warnings: validation.warnings
        }
      });
      
      logger.warn(`Validation failed for delivery: ${deliveryId}`, {
        errors: validation.errors,
        warnings: validation.warnings
      });
    }
    
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
});