/**
 * DSR (Digital Sales Report) Generation Function
 * Creates DDEX-compliant Digital Sales Reports
 */

const { onCall, onSchedule } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { Storage } = require('@google-cloud/storage');
const xml2js = require('xml2js');
const { v4: uuidv4 } = require('uuid');

const db = admin.firestore();
const storage = new Storage();
const bucket = storage.bucket();

/**
 * Generate DSR Report
 * Creates a DDEX-compliant Digital Sales Report
 */
exports.generateDSR = onCall({
  cors: true,
  maxInstances: 5,
  timeoutSeconds: 300
}, async (request) => {
  const { startDate, endDate, format, territory, distributorId } = request.data;
  const auth = request.auth;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  if (!startDate || !endDate) {
    throw new HttpsError('invalid-argument', 'Start date and end date are required');
  }

  try {
    const reportId = `DSR_${uuidv4()}`;
    const timestamp = new Date().toISOString();

    console.log(`Generating DSR ${reportId} for period ${startDate} to ${endDate}`);

    // Fetch analytics data for the period
    const analyticsData = await fetchAnalyticsData(startDate, endDate, territory);
    
    // Fetch catalog metadata
    const catalogData = await fetchCatalogData(analyticsData.trackIds);

    // Generate report based on format
    let reportContent;
    let fileName;
    let mimeType;

    switch (format) {
      case 'DDEX':
        reportContent = await generateDDEXReport(reportId, analyticsData, catalogData, { startDate, endDate, territory });
        fileName = `${reportId}.xml`;
        mimeType = 'application/xml';
        break;
      
      case 'CSV':
        reportContent = generateCSVReport(analyticsData, catalogData);
        fileName = `${reportId}.csv`;
        mimeType = 'text/csv';
        break;
      
      case 'JSON':
        reportContent = JSON.stringify({
          reportId,
          generatedAt: timestamp,
          period: { startDate, endDate },
          territory,
          data: analyticsData,
          catalog: catalogData
        }, null, 2);
        fileName = `${reportId}.json`;
        mimeType = 'application/json';
        break;
      
      default:
        throw new HttpsError('invalid-argument', `Unsupported format: ${format}`);
    }

    // Save report to Cloud Storage
    const file = bucket.file(`reports/dsr/${fileName}`);
    await file.save(reportContent, {
      metadata: {
        contentType: mimeType,
        metadata: {
          reportId,
          format,
          startDate,
          endDate,
          territory: territory || 'worldwide',
          generatedBy: auth.uid,
          generatedAt: timestamp
        }
      }
    });

    // Get signed URL for download
    const [downloadUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Save report metadata to Firestore
    await db.collection('reports').doc(reportId).set({
      reportId,
      type: 'DSR',
      format,
      period: { startDate, endDate },
      territory: territory || 'worldwide',
      distributorId,
      fileName,
      fileUrl: downloadUrl,
      size: Buffer.byteLength(reportContent),
      generatedBy: auth.uid,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'completed',
      statistics: {
        totalTracks: analyticsData.trackIds.length,
        totalPlays: analyticsData.totalPlays,
        totalRevenue: analyticsData.totalRevenue
      }
    });

    console.log(`DSR ${reportId} generated successfully`);

    return {
      success: true,
      reportId,
      downloadUrl,
      preview: format === 'DDEX' ? reportContent.substring(0, 1000) : null,
      statistics: {
        totalTracks: analyticsData.trackIds.length,
        totalPlays: analyticsData.totalPlays,
        totalRevenue: analyticsData.totalRevenue
      }
    };

  } catch (error) {
    console.error('Error generating DSR:', error);
    throw new HttpsError('internal', `Failed to generate DSR: ${error.message}`);
  }
});

/**
 * Fetch analytics data for DSR
 */
async function fetchAnalyticsData(startDate, endDate, territory) {
  let query = db.collection('analytics_daily')
    .where('date', '>=', startDate)
    .where('date', '<=', endDate);

  const snapshot = await query.get();
  
  const data = {
    trackIds: new Set(),
    releaseIds: new Set(),
    totalPlays: 0,
    totalRevenue: 0,
    trackData: {},
    releaseData: {}
  };

  snapshot.forEach(doc => {
    const record = doc.data();
    
    data.trackIds.add(record.trackId);
    data.releaseIds.add(record.releaseId);
    data.totalPlays += record.plays || 0;
    
    // Aggregate by track
    if (!data.trackData[record.trackId]) {
      data.trackData[record.trackId] = {
        plays: 0,
        revenue: 0,
        territories: {}
      };
    }
    
    data.trackData[record.trackId].plays += record.plays || 0;
    data.trackData[record.trackId].revenue += (record.plays || 0) * 0.003; // Default rate
    
    // Territory breakdown
    if (record.countries) {
      Object.entries(record.countries).forEach(([country, count]) => {
        if (!data.trackData[record.trackId].territories[country]) {
          data.trackData[record.trackId].territories[country] = 0;
        }
        data.trackData[record.trackId].territories[country] += count;
      });
    }
  });

  data.trackIds = Array.from(data.trackIds);
  data.releaseIds = Array.from(data.releaseIds);
  data.totalRevenue = Object.values(data.trackData).reduce((sum, track) => sum + track.revenue, 0);

  return data;
}

/**
 * Fetch catalog metadata
 */
async function fetchCatalogData(trackIds) {
  const catalog = {};
  
  // Batch fetch tracks
  const trackChunks = [];
  for (let i = 0; i < trackIds.length; i += 10) {
    trackChunks.push(trackIds.slice(i, i + 10));
  }

  for (const chunk of trackChunks) {
    const trackDocs = await db.collection('tracks')
      .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
      .get();
    
    trackDocs.forEach(doc => {
      const track = doc.data();
      catalog[doc.id] = {
        title: track.title,
        artist: track.artist,
        isrc: track.isrc,
        releaseId: track.releaseId,
        duration: track.duration,
        contributors: track.contributors || []
      };
    });
  }

  return catalog;
}

/**
 * Generate DDEX DSR XML
 */
async function generateDDEXReport(reportId, analyticsData, catalogData, params) {
  const builder = new xml2js.Builder({
    xmldec: { version: '1.0', encoding: 'UTF-8' },
    renderOpts: { pretty: true, indent: '  ' }
  });

  const dsrMessage = {
    SalesReportMessage: {
      $: {
        xmlns: 'http://ddex.net/xml/dsr/30',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        MessageSchemaVersionId: 'dsr/30',
        LanguageAndScriptCode: 'en'
      },
      MessageHeader: {
        MessageId: reportId,
        MessageCreatedDateTime: new Date().toISOString(),
        MessageSender: {
          PartyId: 'STARDUST_DSP',
          PartyName: 'Stardust DSP'
        },
        MessageRecipient: {
          PartyId: params.distributorId || 'RECIPIENT',
          PartyName: params.distributorName || 'Recipient'
        }
      },
      SalesReportHeader: {
        SalesReportId: reportId,
        AccountingPeriod: {
          StartDate: params.startDate,
          EndDate: params.endDate
        },
        ReportType: 'SalesReport',
        ReportStatus: 'Final',
        CurrencyCode: 'USD'
      },
      SalesReportBody: {
        SalesTransaction: Object.entries(analyticsData.trackData).map(([trackId, data]) => {
          const track = catalogData[trackId] || {};
          return {
            TransactionId: `TXN_${trackId}_${params.startDate}`,
            ReleaseReference: track.releaseId,
            ResourceReference: trackId,
            ISRC: track.isrc,
            Title: track.title,
            DisplayArtist: track.artist,
            UsageDate: params.endDate,
            Territory: params.territory || 'Worldwide',
            UseType: 'OnDemandStream',
            Quantity: data.plays,
            UnitPrice: 0.003,
            LineAmount: data.revenue.toFixed(2),
            PayableAmount: (data.revenue * 0.85).toFixed(2) // After platform fee
          };
        })
      },
      SalesReportSummary: {
        TotalQuantity: analyticsData.totalPlays,
        TotalGrossAmount: analyticsData.totalRevenue.toFixed(2),
        TotalNetAmount: (analyticsData.totalRevenue * 0.85).toFixed(2)
      }
    }
  };

  return builder.buildObject(dsrMessage);
}

/**
 * Generate CSV Report
 */
function generateCSVReport(analyticsData, catalogData) {
  const headers = [
    'Track ID',
    'ISRC',
    'Title',
    'Artist',
    'Release ID',
    'Plays',
    'Revenue',
    'Territory'
  ];

  const rows = [headers.join(',')];

  Object.entries(analyticsData.trackData).forEach(([trackId, data]) => {
    const track = catalogData[trackId] || {};
    const row = [
      trackId,
      track.isrc || '',
      `"${track.title || ''}"`,
      `"${track.artist || ''}"`,
      track.releaseId || '',
      data.plays,
      data.revenue.toFixed(2),
      Object.keys(data.territories || {}).join(';')
    ];
    rows.push(row.join(','));
  });

  return rows.join('\n');
}

/**
 * Schedule monthly DSR generation
 */
exports.generateMonthlyDSR = onSchedule({
  schedule: 'every month 1st day 00:00',
  timeZone: 'UTC',
  maxInstances: 1
}, async (context) => {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const startDate = lastMonth.toISOString().split('T')[0];
  const endDate = lastMonthEnd.toISOString().split('T')[0];

  console.log(`Generating monthly DSR for ${startDate} to ${endDate}`);

  try {
    // Get all active distributors
    const distributorsSnapshot = await db.collection('distributors')
      .where('status', '==', 'active')
      .where('autoGenerateDSR', '==', true)
      .get();

    const results = [];

    for (const doc of distributorsSnapshot.docs) {
      const distributor = doc.data();
      
      try {
        // Generate DSR for each distributor
        const result = await exports.generateDSR({
          data: {
            startDate,
            endDate,
            format: distributor.preferredFormat || 'DDEX',
            territory: distributor.territory || 'worldwide',
            distributorId: doc.id
          },
          auth: { uid: 'system' }
        });

        results.push({
          distributorId: doc.id,
          reportId: result.reportId,
          status: 'success'
        });

        // Send notification
        if (distributor.notificationEmail) {
          // Queue email notification
          await db.collection('mail').add({
            to: distributor.notificationEmail,
            template: {
              name: 'dsr-ready',
              data: {
                distributorName: distributor.name,
                period: `${startDate} to ${endDate}`,
                downloadUrl: result.downloadUrl
              }
            }
          });
        }

      } catch (error) {
        console.error(`Failed to generate DSR for distributor ${doc.id}:`, error);
        results.push({
          distributorId: doc.id,
          status: 'failed',
          error: error.message
        });
      }
    }

    console.log(`Monthly DSR generation completed: ${results.length} reports`);
    return { success: true, results };

  } catch (error) {
    console.error('Error in monthly DSR generation:', error);
    throw error;
  }
});