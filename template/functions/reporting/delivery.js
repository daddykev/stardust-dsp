/**
 * Report Delivery Function
 * Handles delivery of reports to distributors and partners
 */

const { onCall, onSchedule } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const { Storage } = require('@google-cloud/storage');
const ftp = require('basic-ftp');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const db = admin.firestore();
const storage = new Storage();
const bucket = storage.bucket();

// Email transporter configuration
const mailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

/**
 * Send report to distributor
 */
exports.sendReport = onCall({
  cors: true,
  maxInstances: 5
}, async (request) => {
  const { reportId, distributorId, deliveryMethod } = request.data;
  const auth = request.auth;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  if (!reportId || !distributorId) {
    throw new HttpsError('invalid-argument', 'Report ID and Distributor ID are required');
  }

  try {
    console.log(`Sending report ${reportId} to distributor ${distributorId} via ${deliveryMethod}`);

    // Fetch report details
    const reportDoc = await db.collection('reports').doc(reportId).get();
    if (!reportDoc.exists) {
      throw new HttpsError('not-found', 'Report not found');
    }
    const report = reportDoc.data();

    // Fetch distributor details
    const distributorDoc = await db.collection('distributors').doc(distributorId).get();
    if (!distributorDoc.exists) {
      throw new HttpsError('not-found', 'Distributor not found');
    }
    const distributor = distributorDoc.data();

    // Deliver based on method
    let deliveryResult;
    switch (deliveryMethod || distributor.preferredDeliveryMethod) {
      case 'email':
        deliveryResult = await deliverViaEmail(report, distributor);
        break;
      
      case 'ftp':
        deliveryResult = await deliverViaFTP(report, distributor);
        break;
      
      case 's3':
        deliveryResult = await deliverViaS3(report, distributor);
        break;
      
      case 'api':
        deliveryResult = await deliverViaAPI(report, distributor);
        break;
      
      case 'webhook':
        deliveryResult = await deliverViaWebhook(report, distributor);
        break;
      
      default:
        throw new HttpsError('invalid-argument', `Unsupported delivery method: ${deliveryMethod}`);
    }

    // Log delivery
    await db.collection('report_deliveries').add({
      reportId,
      distributorId,
      deliveryMethod: deliveryMethod || distributor.preferredDeliveryMethod,
      status: deliveryResult.success ? 'delivered' : 'failed',
      deliveredAt: admin.firestore.FieldValue.serverTimestamp(),
      deliveredBy: auth.uid,
      result: deliveryResult
    });

    // Update report status
    await reportDoc.ref.update({
      deliveryStatus: deliveryResult.success ? 'delivered' : 'failed',
      lastDeliveryAttempt: admin.firestore.FieldValue.serverTimestamp(),
      deliveryAttempts: admin.firestore.FieldValue.increment(1)
    });

    console.log(`Report ${reportId} delivered successfully to ${distributorId}`);
    return deliveryResult;

  } catch (error) {
    console.error('Error sending report:', error);
    throw new HttpsError('internal', `Failed to send report: ${error.message}`);
  }
});

/**
 * Deliver report via email
 */
async function deliverViaEmail(report, distributor) {
  if (!distributor.email) {
    throw new Error('Distributor email not configured');
  }

  // Download report file from storage
  const file = bucket.file(report.fileName);
  const [fileData] = await file.download();

  // Prepare email
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: distributor.email,
    cc: distributor.ccEmails?.join(','),
    subject: `${report.type} Report - ${report.period.startDate} to ${report.period.endDate}`,
    html: `
      <h2>${report.type} Report</h2>
      <p>Dear ${distributor.name},</p>
      <p>Please find attached your ${report.type} report for the period ${report.period.startDate} to ${report.period.endDate}.</p>
      <h3>Report Summary:</h3>
      <ul>
        <li>Total Tracks: ${report.statistics?.totalTracks || 0}</li>
        <li>Total Plays: ${report.statistics?.totalPlays || 0}</li>
        <li>Total Revenue: $${report.statistics?.totalRevenue?.toFixed(2) || '0.00'}</li>
      </ul>
      <p>If you have any questions, please don't hesitate to contact us.</p>
      <p>Best regards,<br>Stardust DSP Team</p>
    `,
    attachments: [{
      filename: report.fileName.split('/').pop(),
      content: fileData
    }]
  };

  // Send email
  const info = await mailTransporter.sendMail(mailOptions);
  
  return {
    success: true,
    method: 'email',
    messageId: info.messageId,
    recipients: [distributor.email, ...(distributor.ccEmails || [])]
  };
}

/**
 * Deliver report via FTP
 */
async function deliverViaFTP(report, distributor) {
  if (!distributor.ftpConfig) {
    throw new Error('FTP configuration not found for distributor');
  }

  const client = new ftp.Client();
  
  try {
    // Connect to FTP server
    await client.access({
      host: distributor.ftpConfig.host,
      port: distributor.ftpConfig.port || 21,
      user: distributor.ftpConfig.username,
      password: distributor.ftpConfig.password,
      secure: distributor.ftpConfig.secure || false
    });

    // Download report file from storage
    const file = bucket.file(report.fileName);
    const [fileData] = await file.download();

    // Upload to FTP
    const remotePath = `${distributor.ftpConfig.directory || '/'}/${report.fileName.split('/').pop()}`;
    await client.uploadFrom(Buffer.from(fileData), remotePath);

    return {
      success: true,
      method: 'ftp',
      remotePath,
      server: distributor.ftpConfig.host
    };

  } finally {
    client.close();
  }
}

/**
 * Deliver report via S3
 */
async function deliverViaS3(report, distributor) {
  if (!distributor.s3Config) {
    throw new Error('S3 configuration not found for distributor');
  }

  const s3Client = new S3Client({
    region: distributor.s3Config.region,
    credentials: {
      accessKeyId: distributor.s3Config.accessKeyId,
      secretAccessKey: distributor.s3Config.secretAccessKey
    }
  });

  // Download report file from storage
  const file = bucket.file(report.fileName);
  const [fileData] = await file.download();

  // Upload to S3
  const key = `${distributor.s3Config.prefix || ''}${report.fileName.split('/').pop()}`;
  const command = new PutObjectCommand({
    Bucket: distributor.s3Config.bucket,
    Key: key,
    Body: fileData,
    ContentType: report.mimeType || 'application/octet-stream',
    Metadata: {
      reportId: report.reportId,
      reportType: report.type,
      period: `${report.period.startDate}_${report.period.endDate}`
    }
  });

  await s3Client.send(command);

  return {
    success: true,
    method: 's3',
    bucket: distributor.s3Config.bucket,
    key,
    region: distributor.s3Config.region
  };
}

/**
 * Deliver report via API
 */
async function deliverViaAPI(report, distributor) {
  if (!distributor.apiConfig) {
    throw new Error('API configuration not found for distributor');
  }

  // Download report file from storage
  const file = bucket.file(report.fileName);
  const [fileData] = await file.download();

  // Prepare API request
  const headers = {
    'Content-Type': report.mimeType || 'application/octet-stream',
    ...distributor.apiConfig.headers
  };

  // Add authentication
  if (distributor.apiConfig.authType === 'bearer') {
    headers['Authorization'] = `Bearer ${distributor.apiConfig.token}`;
  } else if (distributor.apiConfig.authType === 'apikey') {
    headers[distributor.apiConfig.apiKeyHeader || 'X-API-Key'] = distributor.apiConfig.apiKey;
  }

  // Send request
  const response = await fetch(distributor.apiConfig.endpoint, {
    method: distributor.apiConfig.method || 'POST',
    headers,
    body: fileData
  });

  if (!response.ok) {
    throw new Error(`API delivery failed: ${response.status} ${response.statusText}`);
  }

  const responseData = await response.json();

  return {
    success: true,
    method: 'api',
    endpoint: distributor.apiConfig.endpoint,
    response: responseData
  };
}

/**
 * Deliver report via webhook
 */
async function deliverViaWebhook(report, distributor) {
  if (!distributor.webhookUrl) {
    throw new Error('Webhook URL not configured for distributor');
  }

  // Get signed URL for report download
  const file = bucket.file(report.fileName);
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  // Prepare webhook payload
  const payload = {
    event: 'report.ready',
    reportId: report.reportId,
    type: report.type,
    format: report.format,
    period: report.period,
    territory: report.territory,
    downloadUrl: signedUrl,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    statistics: report.statistics,
    generatedAt: report.generatedAt
  };

  // Add signature if configured
  let headers = {
    'Content-Type': 'application/json'
  };

  if (distributor.webhookSecret) {
    const crypto = require('crypto');
    const signature = crypto
      .createHmac('sha256', distributor.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
    headers['X-Webhook-Signature'] = signature;
  }

  // Send webhook
  const response = await fetch(distributor.webhookUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
  }

  return {
    success: true,
    method: 'webhook',
    webhookUrl: distributor.webhookUrl,
    downloadUrl: signedUrl
  };
}

/**
 * Schedule automatic report delivery
 */
exports.scheduleReportDelivery = onSchedule({
  schedule: 'every day 09:00',
  timeZone: 'UTC',
  maxInstances: 1
}, async (context) => {
  console.log('Running scheduled report delivery');

  try {
    // Find reports pending delivery
    const pendingReports = await db.collection('reports')
      .where('deliveryStatus', '==', 'pending')
      .where('scheduledDelivery', '<=', admin.firestore.Timestamp.now())
      .limit(50)
      .get();

    const results = [];

    for (const reportDoc of pendingReports.docs) {
      const report = reportDoc.data();
      
      try {
        // Deliver to configured distributor
        if (report.distributorId) {
          const deliveryResult = await exports.sendReport({
            data: {
              reportId: reportDoc.id,
              distributorId: report.distributorId
            },
            auth: { uid: 'system' }
          });

          results.push({
            reportId: reportDoc.id,
            distributorId: report.distributorId,
            status: 'delivered',
            result: deliveryResult
          });
        }

      } catch (error) {
        console.error(`Failed to deliver report ${reportDoc.id}:`, error);
        results.push({
          reportId: reportDoc.id,
          status: 'failed',
          error: error.message
        });

        // Update retry count
        await reportDoc.ref.update({
          deliveryRetries: admin.firestore.FieldValue.increment(1),
          lastDeliveryError: error.message
        });
      }
    }

    console.log(`Scheduled delivery completed: ${results.length} reports processed`);
    return { success: true, processed: results.length, results };

  } catch (error) {
    console.error('Error in scheduled report delivery:', error);
    throw error;
  }
});

/**
 * Retry failed deliveries
 */
exports.retryFailedDeliveries = onSchedule({
  schedule: 'every 6 hours',
  timeZone: 'UTC',
  maxInstances: 1
}, async (context) => {
  console.log('Retrying failed report deliveries');

  try {
    // Find failed deliveries with retry attempts < 3
    const failedDeliveries = await db.collection('reports')
      .where('deliveryStatus', '==', 'failed')
      .where('deliveryRetries', '<', 3)
      .limit(20)
      .get();

    const results = [];

    for (const reportDoc of failedDeliveries.docs) {
      const report = reportDoc.data();
      
      // Wait before retry (exponential backoff)
      const waitTime = Math.pow(2, report.deliveryRetries || 0) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));

      try {
        const deliveryResult = await exports.sendReport({
          data: {
            reportId: reportDoc.id,
            distributorId: report.distributorId
          },
          auth: { uid: 'system' }
        });

        results.push({
          reportId: reportDoc.id,
          status: 'delivered',
          attempt: report.deliveryRetries + 1
        });

      } catch (error) {
        console.error(`Retry failed for report ${reportDoc.id}:`, error);
        results.push({
          reportId: reportDoc.id,
          status: 'failed',
          attempt: report.deliveryRetries + 1,
          error: error.message
        });
      }
    }

    console.log(`Retry process completed: ${results.length} reports processed`);
    return { success: true, processed: results.length, results };

  } catch (error) {
    console.error('Error in retry process:', error);
    throw error;
  }
});