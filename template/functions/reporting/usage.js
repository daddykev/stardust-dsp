/**
 * Track Usage Function
 * Handles play tracking, usage aggregation, and analytics data collection
 */

const { onCall, onSchedule, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * Track play event
 * Called when a user plays a track
 */
exports.trackPlay = onCall({
  cors: true,
  maxInstances: 10
}, async (request) => {
  const { trackId, releaseId, userId, context } = request.data;
  const auth = request.auth;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to track plays');
  }

  if (!trackId || !releaseId) {
    throw new HttpsError('invalid-argument', 'Track ID and Release ID are required');
  }

  try {
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    // Create play record
    const playData = {
      trackId,
      releaseId,
      userId: userId || auth.uid,
      timestamp,
      date: dateStr,
      hour: now.getHours(),
      dayOfWeek: now.getDay(),
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      ...context,
      ip: request.rawRequest.ip,
      userAgent: request.rawRequest.headers['user-agent'],
      completed: false,
      duration: 0,
      percentage: 0
    };

    // Add geolocation if available
    if (request.rawRequest.headers['x-appengine-country']) {
      playData.country = request.rawRequest.headers['x-appengine-country'];
      playData.region = request.rawRequest.headers['x-appengine-region'];
      playData.city = request.rawRequest.headers['x-appengine-city'];
    }

    // Save play record
    const playRef = await db.collection('plays').add(playData);

    // Update real-time counters
    const batch = db.batch();

    // Update track stats
    const trackRef = db.doc(`tracks/${trackId}`);
    batch.update(trackRef, {
      'stats.playCount': admin.firestore.FieldValue.increment(1),
      'stats.lastPlayed': timestamp,
      'stats.monthlyPlays': admin.firestore.FieldValue.increment(1)
    });

    // Update release stats
    const releaseRef = db.doc(`releases/${releaseId}`);
    batch.update(releaseRef, {
      'stats.playCount': admin.firestore.FieldValue.increment(1),
      'stats.lastPlayed': timestamp
    });

    // Update artist stats
    const track = await trackRef.get();
    if (track.exists && track.data().artistId) {
      const artistRef = db.doc(`artists/${track.data().artistId}`);
      batch.update(artistRef, {
        'stats.playCount': admin.firestore.FieldValue.increment(1),
        'stats.monthlyListeners': admin.firestore.FieldValue.arrayUnion(userId || auth.uid)
      });
    }

    await batch.commit();

    console.log(`Play tracked: ${playRef.id} for track ${trackId}`);
    return { 
      success: true, 
      playId: playRef.id,
      message: 'Play tracked successfully'
    };

  } catch (error) {
    console.error('Error tracking play:', error);
    throw new HttpsError('internal', 'Failed to track play');
  }
});

/**
 * Update play progress
 * Called periodically during playback
 */
exports.updatePlayProgress = onCall({
  cors: true,
  maxInstances: 10
}, async (request) => {
  const { playId, duration, percentage, completed } = request.data;
  
  if (!playId) {
    throw new HttpsError('invalid-argument', 'Play ID is required');
  }

  try {
    const playRef = db.doc(`plays/${playId}`);
    const updateData = {
      duration,
      percentage,
      completed: completed || percentage >= 95,
      lastUpdate: admin.firestore.FieldValue.serverTimestamp()
    };

    await playRef.update(updateData);

    // If play is completed, update completion stats
    if (updateData.completed) {
      const play = await playRef.get();
      const playData = play.data();
      
      if (playData) {
        const batch = db.batch();
        
        // Update track completion rate
        const trackRef = db.doc(`tracks/${playData.trackId}`);
        batch.update(trackRef, {
          'stats.completions': admin.firestore.FieldValue.increment(1)
        });

        // Update daily aggregation
        const dailyId = `${playData.date}_${playData.trackId}`;
        const dailyRef = db.doc(`analytics_daily/${dailyId}`);
        batch.set(dailyRef, {
          date: playData.date,
          trackId: playData.trackId,
          releaseId: playData.releaseId,
          completions: admin.firestore.FieldValue.increment(1),
          totalDuration: admin.firestore.FieldValue.increment(duration),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        await batch.commit();
      }
    }

    return { success: true, message: 'Play progress updated' };

  } catch (error) {
    console.error('Error updating play progress:', error);
    throw new HttpsError('internal', 'Failed to update play progress');
  }
});

/**
 * Aggregate daily analytics
 * Scheduled to run every hour
 */
exports.aggregateDailyAnalytics = onSchedule({
  schedule: 'every 1 hours',
  timeZone: 'UTC',
  maxInstances: 1
}, async (context) => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  try {
    // Query recent plays
    const playsSnapshot = await db.collection('plays')
      .where('timestamp', '>=', oneHourAgo)
      .where('timestamp', '<', now)
      .get();

    console.log(`Aggregating ${playsSnapshot.size} plays from the last hour`);

    // Group by date and track
    const aggregations = {};
    
    playsSnapshot.forEach(doc => {
      const play = doc.data();
      const key = `${play.date}_${play.trackId}`;
      
      if (!aggregations[key]) {
        aggregations[key] = {
          date: play.date,
          trackId: play.trackId,
          releaseId: play.releaseId,
          artistId: play.artistId,
          plays: 0,
          completions: 0,
          duration: 0,
          uniqueListeners: new Set(),
          countries: {},
          devices: {},
          hours: Array(24).fill(0)
        };
      }
      
      aggregations[key].plays++;
      if (play.completed) aggregations[key].completions++;
      if (play.duration) aggregations[key].duration += play.duration;
      if (play.userId) aggregations[key].uniqueListeners.add(play.userId);
      if (play.country) {
        aggregations[key].countries[play.country] = (aggregations[key].countries[play.country] || 0) + 1;
      }
      if (play.hour !== undefined) {
        aggregations[key].hours[play.hour]++;
      }
    });

    // Save aggregations
    const batch = db.batch();
    let batchCount = 0;

    for (const [key, data] of Object.entries(aggregations)) {
      const docRef = db.doc(`analytics_daily/${key}`);
      batch.set(docRef, {
        ...data,
        uniqueListeners: data.uniqueListeners.size,
        uniqueListenersList: Array.from(data.uniqueListeners),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      batchCount++;
      
      // Firestore batch limit is 500
      if (batchCount >= 500) {
        await batch.commit();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`Successfully aggregated analytics for ${Object.keys(aggregations).length} track-days`);
    return { success: true, aggregated: Object.keys(aggregations).length };

  } catch (error) {
    console.error('Error aggregating analytics:', error);
    throw error;
  }
});

/**
 * Get usage report
 * Returns aggregated usage data for reporting
 */
exports.getUsageReport = onCall({
  cors: true,
  maxInstances: 5
}, async (request) => {
  const { reportType, startDate, endDate, territory, granularity } = request.data;
  const auth = request.auth;

  if (!auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  try {
    let query = db.collection('analytics_daily')
      .where('date', '>=', startDate)
      .where('date', '<=', endDate);

    if (territory && territory !== 'worldwide') {
      query = query.where('primaryCountry', '==', territory);
    }

    const snapshot = await query.limit(1000).get();
    
    // Process data based on report type
    const reportData = {
      reportType,
      period: { startDate, endDate },
      territory,
      totalPlays: 0,
      uniqueListeners: new Set(),
      totalDuration: 0,
      topTracks: {},
      topReleases: {},
      topArtists: {},
      dailyBreakdown: {},
      hourlyDistribution: Array(24).fill(0),
      countryBreakdown: {},
      completionRate: 0
    };

    let totalCompletions = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      
      reportData.totalPlays += data.plays || 0;
      reportData.totalDuration += data.duration || 0;
      totalCompletions += data.completions || 0;
      
      // Add unique listeners
      if (data.uniqueListenersList) {
        data.uniqueListenersList.forEach(listener => {
          reportData.uniqueListeners.add(listener);
        });
      }

      // Track top content
      if (data.trackId) {
        reportData.topTracks[data.trackId] = (reportData.topTracks[data.trackId] || 0) + data.plays;
      }
      if (data.releaseId) {
        reportData.topReleases[data.releaseId] = (reportData.topReleases[data.releaseId] || 0) + data.plays;
      }
      if (data.artistId) {
        reportData.topArtists[data.artistId] = (reportData.topArtists[data.artistId] || 0) + data.plays;
      }

      // Daily breakdown
      if (!reportData.dailyBreakdown[data.date]) {
        reportData.dailyBreakdown[data.date] = {
          plays: 0,
          duration: 0,
          listeners: new Set()
        };
      }
      reportData.dailyBreakdown[data.date].plays += data.plays;
      reportData.dailyBreakdown[data.date].duration += data.duration;

      // Hourly distribution
      if (data.hours) {
        data.hours.forEach((count, hour) => {
          reportData.hourlyDistribution[hour] += count;
        });
      }

      // Country breakdown
      if (data.countries) {
        Object.entries(data.countries).forEach(([country, count]) => {
          reportData.countryBreakdown[country] = (reportData.countryBreakdown[country] || 0) + count;
        });
      }
    });

    // Calculate completion rate
    if (reportData.totalPlays > 0) {
      reportData.completionRate = ((totalCompletions / reportData.totalPlays) * 100).toFixed(2);
    }

    // Convert Sets to counts
    reportData.uniqueListeners = reportData.uniqueListeners.size;

    // Sort and limit top content
    reportData.topTracks = Object.entries(reportData.topTracks)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([id, plays]) => ({ id, plays }));

    reportData.topReleases = Object.entries(reportData.topReleases)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([id, plays]) => ({ id, plays }));

    reportData.topArtists = Object.entries(reportData.topArtists)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([id, plays]) => ({ id, plays }));

    console.log(`Generated ${reportType} report with ${reportData.totalPlays} plays`);
    return reportData;

  } catch (error) {
    console.error('Error generating usage report:', error);
    throw new HttpsError('internal', 'Failed to generate usage report');
  }
});

/**
 * Clean up old play records
 * Scheduled to run daily
 */
exports.cleanupOldPlays = onSchedule({
  schedule: 'every 24 hours',
  timeZone: 'UTC',
  maxInstances: 1
}, async (context) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    const batch = db.batch();
    let deletedCount = 0;

    // Query old incomplete plays
    const oldPlaysSnapshot = await db.collection('plays')
      .where('timestamp', '<', thirtyDaysAgo)
      .where('completed', '==', false)
      .limit(500)
      .get();

    oldPlaysSnapshot.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });

    if (deletedCount > 0) {
      await batch.commit();
      console.log(`Cleaned up ${deletedCount} old incomplete play records`);
    }

    return { success: true, deleted: deletedCount };

  } catch (error) {
    console.error('Error cleaning up old plays:', error);
    throw error;
  }
});