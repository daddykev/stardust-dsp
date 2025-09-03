/**
 * Royalty Calculation Function
 * Calculates royalties based on streams and distribution agreements
 */

const { onCall, onSchedule } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * Calculate royalties for a period
 */
exports.calculateRoyalties = onCall({
  cors: true,
  maxInstances: 5,
  timeoutSeconds: 180
}, async (request) => {
  const { period, territory, method = 'pro-rata' } = request.data;
  const auth = request.auth;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  if (!period) {
    throw new HttpsError('invalid-argument', 'Period is required');
  }

  try {
    console.log(`Calculating royalties for period: ${period}, territory: ${territory}, method: ${method}`);

    // Determine date range based on period
    const { startDate, endDate } = getPeriodDates(period);

    // Fetch streaming data
    const streamingData = await fetchStreamingData(startDate, endDate, territory);

    // Fetch revenue data from DSPs
    const revenueData = await fetchRevenueData(startDate, endDate);

    // Fetch rights holder information
    const rightsHolders = await fetchRightsHolders();

    // Calculate royalties based on method
    let distributions;
    switch (method) {
      case 'pro-rata':
        distributions = calculateProRataRoyalties(streamingData, revenueData, rightsHolders);
        break;
      case 'user-centric':
        distributions = calculateUserCentricRoyalties(streamingData, revenueData, rightsHolders);
        break;
      case 'hybrid':
        distributions = calculateHybridRoyalties(streamingData, revenueData, rightsHolders);
        break;
      default:
        throw new HttpsError('invalid-argument', `Unknown calculation method: ${method}`);
    }

    // Apply minimum thresholds and rounding
    distributions = applyMinimumThresholds(distributions);

    // Generate royalty statement
    const statementId = await generateRoyaltyStatement({
      period,
      startDate,
      endDate,
      territory,
      method,
      distributions,
      revenueData,
      generatedBy: auth.uid
    });

    // Calculate summary statistics
    const summary = {
      totalRevenue: revenueData.total,
      platformFees: revenueData.platformFees,
      netRevenue: revenueData.net,
      totalDistributed: distributions.reduce((sum, d) => sum + d.netAmount, 0),
      rightsHolderCount: distributions.length,
      averagePayment: distributions.reduce((sum, d) => sum + d.netAmount, 0) / distributions.length
    };

    console.log(`Royalty calculation completed: ${summary.totalDistributed} distributed to ${summary.rightsHolderCount} rights holders`);

    return {
      success: true,
      statementId,
      period,
      summary,
      distributions: distributions.slice(0, 100), // Return top 100 for preview
      message: 'Royalty calculation completed successfully'
    };

  } catch (error) {
    console.error('Error calculating royalties:', error);
    throw new HttpsError('internal', `Failed to calculate royalties: ${error.message}`);
  }
});

/**
 * Get date range for period
 */
function getPeriodDates(period) {
  const now = new Date();
  let startDate, endDate;

  if (period.includes('-')) {
    // Custom date range
    const [start, end] = period.split('_');
    startDate = start;
    endDate = end;
  } else if (period.match(/^\d{4}-\d{2}$/)) {
    // Monthly period (YYYY-MM)
    const [year, month] = period.split('-').map(Number);
    startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    endDate = new Date(year, month, 0).toISOString().split('T')[0];
  } else if (period.match(/^\d{4}-Q\d$/)) {
    // Quarterly period (YYYY-Q#)
    const [year, quarter] = period.split('-Q').map(Number);
    const quarterMonth = (quarter - 1) * 3;
    startDate = new Date(year, quarterMonth, 1).toISOString().split('T')[0];
    endDate = new Date(year, quarterMonth + 3, 0).toISOString().split('T')[0];
  } else if (period.match(/^\d{4}$/)) {
    // Annual period (YYYY)
    const year = parseInt(period);
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  } else {
    throw new Error(`Invalid period format: ${period}`);
  }

  return { startDate, endDate };
}

/**
 * Fetch streaming data for royalty calculation
 */
async function fetchStreamingData(startDate, endDate, territory) {
  let query = db.collection('analytics_daily')
    .where('date', '>=', startDate)
    .where('date', '<=', endDate);

  const snapshot = await query.get();
  
  const data = {
    totalStreams: 0,
    trackStreams: {},
    releaseStreams: {},
    artistStreams: {},
    userStreams: {}
  };

  snapshot.forEach(doc => {
    const record = doc.data();
    
    data.totalStreams += record.plays || 0;
    
    // Track streams
    if (record.trackId) {
      data.trackStreams[record.trackId] = (data.trackStreams[record.trackId] || 0) + (record.plays || 0);
    }
    
    // Release streams
    if (record.releaseId) {
      data.releaseStreams[record.releaseId] = (data.releaseStreams[record.releaseId] || 0) + (record.plays || 0);
    }
    
    // Artist streams
    if (record.artistId) {
      data.artistStreams[record.artistId] = (data.artistStreams[record.artistId] || 0) + (record.plays || 0);
    }
    
    // User streams (for user-centric calculation)
    if (record.uniqueListenersList) {
      record.uniqueListenersList.forEach(userId => {
        if (!data.userStreams[userId]) {
          data.userStreams[userId] = {};
        }
        if (record.trackId) {
          data.userStreams[userId][record.trackId] = (data.userStreams[userId][record.trackId] || 0) + 1;
        }
      });
    }
  });

  return data;
}

/**
 * Fetch revenue data from DSPs
 */
async function fetchRevenueData(startDate, endDate) {
  // In production, this would fetch actual revenue from DSP reports
  // For now, we'll calculate based on stream rates
  
  const dspRates = {
    spotify: 0.003,
    apple: 0.0075,
    youtube: 0.002,
    amazon: 0.0045,
    tidal: 0.0125,
    default: 0.004
  };

  const revenueSnapshot = await db.collection('dsp_revenue')
    .where('period.startDate', '==', startDate)
    .where('period.endDate', '==', endDate)
    .get();

  let totalRevenue = 0;
  const dspRevenue = {};

  if (revenueSnapshot.empty) {
    // Calculate estimated revenue based on streams
    const analyticsSnapshot = await db.collection('analytics_daily')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();

    analyticsSnapshot.forEach(doc => {
      const data = doc.data();
      const plays = data.plays || 0;
      const rate = dspRates[data.dsp] || dspRates.default;
      totalRevenue += plays * rate;
      
      if (data.dsp) {
        dspRevenue[data.dsp] = (dspRevenue[data.dsp] || 0) + (plays * rate);
      }
    });
  } else {
    revenueSnapshot.forEach(doc => {
      const data = doc.data();
      totalRevenue += data.amount || 0;
      dspRevenue[data.dsp] = data.amount;
    });
  }

  const platformFeeRate = 0.15; // 15% platform fee
  const platformFees = totalRevenue * platformFeeRate;
  const netRevenue = totalRevenue - platformFees;

  return {
    total: totalRevenue,
    platformFees,
    net: netRevenue,
    byDSP: dspRevenue
  };
}

/**
 * Fetch rights holder information
 */
async function fetchRightsHolders() {
  const rightsHolders = {};

  // Fetch all tracks with rights information
  const tracksSnapshot = await db.collection('tracks')
    .where('status', '==', 'active')
    .get();

  tracksSnapshot.forEach(doc => {
    const track = doc.data();
    const trackId = doc.id;

    // Master rights
    if (track.masterRights) {
      track.masterRights.forEach(holder => {
        if (!rightsHolders[holder.id]) {
          rightsHolders[holder.id] = {
            id: holder.id,
            name: holder.name,
            type: holder.type || 'label',
            tracks: {},
            totalShare: 0
          };
        }
        rightsHolders[holder.id].tracks[trackId] = {
          masterShare: holder.share || 100,
          publishingShare: 0
        };
      });
    }

    // Publishing rights
    if (track.publishingRights) {
      track.publishingRights.forEach(holder => {
        if (!rightsHolders[holder.id]) {
          rightsHolders[holder.id] = {
            id: holder.id,
            name: holder.name,
            type: holder.type || 'publisher',
            tracks: {},
            totalShare: 0
          };
        }
        if (!rightsHolders[holder.id].tracks[trackId]) {
          rightsHolders[holder.id].tracks[trackId] = {
            masterShare: 0,
            publishingShare: 0
          };
        }
        rightsHolders[holder.id].tracks[trackId].publishingShare = holder.share || 100;
      });
    }
  });

  return rightsHolders;
}

/**
 * Calculate pro-rata royalties
 */
function calculateProRataRoyalties(streamingData, revenueData, rightsHolders) {
  const distributions = [];
  const totalStreams = streamingData.totalStreams;
  const netRevenue = revenueData.net;

  Object.entries(rightsHolders).forEach(([holderId, holder]) => {
    let holderStreams = 0;
    let holderRevenue = 0;

    // Calculate total streams for this rights holder
    Object.entries(holder.tracks).forEach(([trackId, shares]) => {
      const trackStreams = streamingData.trackStreams[trackId] || 0;
      
      // Master rights revenue (80% of track revenue)
      if (shares.masterShare > 0) {
        const masterStreams = trackStreams * (shares.masterShare / 100) * 0.8;
        holderStreams += masterStreams;
      }
      
      // Publishing rights revenue (20% of track revenue)
      if (shares.publishingShare > 0) {
        const publishingStreams = trackStreams * (shares.publishingShare / 100) * 0.2;
        holderStreams += publishingStreams;
      }
    });

    // Calculate revenue share
    if (holderStreams > 0 && totalStreams > 0) {
      holderRevenue = (holderStreams / totalStreams) * netRevenue;
      
      distributions.push({
        rightsHolderId: holderId,
        name: holder.name,
        type: holder.type,
        streams: Math.round(holderStreams),
        sharePercentage: ((holderStreams / totalStreams) * 100).toFixed(2),
        grossAmount: holderRevenue,
        fees: 0, // Additional fees can be added here
        netAmount: holderRevenue,
        trackCount: Object.keys(holder.tracks).length,
        status: 'pending'
      });
    }
  });

  return distributions.sort((a, b) => b.netAmount - a.netAmount);
}

/**
 * Calculate user-centric royalties
 */
function calculateUserCentricRoyalties(streamingData, revenueData, rightsHolders) {
  // User-centric model: Each user's subscription fee is divided among their played tracks
  const distributions = {};
  const userCount = Object.keys(streamingData.userStreams).length;
  const revenuePerUser = revenueData.net / Math.max(userCount, 1);

  Object.entries(streamingData.userStreams).forEach(([userId, userTracks]) => {
    const totalUserStreams = Object.values(userTracks).reduce((sum, count) => sum + count, 0);
    
    Object.entries(userTracks).forEach(([trackId, streamCount]) => {
      const trackShare = streamCount / totalUserStreams;
      const trackRevenue = revenuePerUser * trackShare;
      
      // Distribute to rights holders of this track
      Object.entries(rightsHolders).forEach(([holderId, holder]) => {
        if (holder.tracks[trackId]) {
          const shares = holder.tracks[trackId];
          let holderRevenue = 0;
          
          if (shares.masterShare > 0) {
            holderRevenue += trackRevenue * (shares.masterShare / 100) * 0.8;
          }
          if (shares.publishingShare > 0) {
            holderRevenue += trackRevenue * (shares.publishingShare / 100) * 0.2;
          }
          
          if (!distributions[holderId]) {
            distributions[holderId] = {
              rightsHolderId: holderId,
              name: holder.name,
              type: holder.type,
              streams: 0,
              grossAmount: 0,
              netAmount: 0,
              trackCount: Object.keys(holder.tracks).length,
              status: 'pending'
            };
          }
          
          distributions[holderId].streams += streamCount;
          distributions[holderId].grossAmount += holderRevenue;
          distributions[holderId].netAmount += holderRevenue;
        }
      });
    });
  });

  return Object.values(distributions).sort((a, b) => b.netAmount - a.netAmount);
}

/**
 * Calculate hybrid royalties
 */
function calculateHybridRoyalties(streamingData, revenueData, rightsHolders) {
  // Hybrid model: 50% pro-rata, 50% user-centric
  const proRataDistributions = calculateProRataRoyalties(
    streamingData, 
    { ...revenueData, net: revenueData.net * 0.5 }, 
    rightsHolders
  );
  
  const userCentricDistributions = calculateUserCentricRoyalties(
    streamingData, 
    { ...revenueData, net: revenueData.net * 0.5 }, 
    rightsHolders
  );

  // Merge distributions
  const merged = {};
  
  [...proRataDistributions, ...userCentricDistributions].forEach(dist => {
    if (!merged[dist.rightsHolderId]) {
      merged[dist.rightsHolderId] = { ...dist, netAmount: 0, grossAmount: 0, streams: 0 };
    }
    merged[dist.rightsHolderId].netAmount += dist.netAmount;
    merged[dist.rightsHolderId].grossAmount += dist.grossAmount;
    merged[dist.rightsHolderId].streams += dist.streams;
  });

  return Object.values(merged).sort((a, b) => b.netAmount - a.netAmount);
}

/**
 * Apply minimum payment thresholds
 */
function applyMinimumThresholds(distributions) {
  const minimumPayment = 10; // $10 minimum
  
  return distributions.map(dist => {
    if (dist.netAmount < minimumPayment) {
      return {
        ...dist,
        status: 'held',
        heldReason: 'Below minimum threshold',
        heldAmount: dist.netAmount,
        netAmount: 0
      };
    }
    return dist;
  });
}

/**
 * Generate royalty statement
 */
async function generateRoyaltyStatement(data) {
  const statementId = `STMT_${Date.now()}`;
  
  await db.collection('royalty_statements').doc(statementId).set({
    statementId,
    period: data.period,
    startDate: data.startDate,
    endDate: data.endDate,
    territory: data.territory || 'worldwide',
    method: data.method,
    totalRevenue: data.revenueData.total,
    platformFees: data.revenueData.platformFees,
    netRevenue: data.revenueData.net,
    totalDistributed: data.distributions.reduce((sum, d) => sum + d.netAmount, 0),
    distributions: data.distributions,
    generatedBy: data.generatedBy,
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'draft'
  });

  return statementId;
}

/**
 * Process royalty payments
 */
exports.processRoyaltyPayments = onSchedule({
  schedule: 'every month 5th day 00:00',
  timeZone: 'UTC',
  maxInstances: 1
}, async (context) => {
  console.log('Processing monthly royalty payments');

  try {
    // Get approved royalty statements
    const statementsSnapshot = await db.collection('royalty_statements')
      .where('status', '==', 'approved')
      .where('paymentStatus', '==', null)
      .get();

    const results = [];

    for (const doc of statementsSnapshot.docs) {
      const statement = doc.data();
      
      // Process payments for each distribution
      for (const distribution of statement.distributions) {
        if (distribution.netAmount > 0 && distribution.status === 'pending') {
          try {
            // Create payment record
            const paymentId = await createPayment({
              statementId: statement.statementId,
              rightsHolderId: distribution.rightsHolderId,
              amount: distribution.netAmount,
              currency: 'USD',
              method: 'bank_transfer'
            });

            results.push({
              rightsHolderId: distribution.rightsHolderId,
              amount: distribution.netAmount,
              paymentId,
              status: 'scheduled'
            });

          } catch (error) {
            console.error(`Payment processing failed for ${distribution.rightsHolderId}:`, error);
            results.push({
              rightsHolderId: distribution.rightsHolderId,
              status: 'failed',
              error: error.message
            });
          }
        }
      }

      // Update statement payment status
      await doc.ref.update({
        paymentStatus: 'processing',
        paymentProcessedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    console.log(`Processed ${results.length} royalty payments`);
    return { success: true, processed: results.length, results };

  } catch (error) {
    console.error('Error processing royalty payments:', error);
    throw error;
  }
});

/**
 * Create payment record
 */
async function createPayment(data) {
  const paymentId = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await db.collection('payments').doc(paymentId).set({
    paymentId,
    ...data,
    status: 'scheduled',
    scheduledDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return paymentId;
}