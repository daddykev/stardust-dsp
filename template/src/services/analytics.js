// src/services/analytics.js
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  increment,
  updateDoc,
  addDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

/**
 * Analytics Service
 * Handles play tracking, usage analytics, and reporting
 */

// Play tracking
export const trackPlay = async (trackId, releaseId, userId, context = {}) => {
  try {
    const playData = {
      trackId,
      releaseId,
      userId,
      timestamp: serverTimestamp(),
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD for aggregation
      hour: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      ...context, // Additional context like source, quality, location
      completed: false,
      duration: 0,
      percentage: 0
    };

    // Add to plays collection
    const playRef = await addDoc(collection(db, 'plays'), playData);

    // Update real-time counters
    const batch = [];
    
    // Track play count
    batch.push(
      updateDoc(doc(db, 'tracks', trackId), {
        'stats.playCount': increment(1),
        'stats.lastPlayed': serverTimestamp()
      })
    );

    // Release play count
    batch.push(
      updateDoc(doc(db, 'releases', releaseId), {
        'stats.playCount': increment(1),
        'stats.lastPlayed': serverTimestamp()
      })
    );

    // Daily aggregation
    const dailyId = `${new Date().toISOString().split('T')[0]}_${trackId}`;
    batch.push(
      setDoc(doc(db, 'analytics_daily', dailyId), {
        date: new Date().toISOString().split('T')[0],
        trackId,
        releaseId,
        playCount: increment(1),
        uniqueListeners: increment(1), // Would need deduplication logic
        totalDuration: increment(0), // Will be updated on play completion
        updatedAt: serverTimestamp()
      }, { merge: true })
    );

    await Promise.all(batch);

    return playRef.id;
  } catch (error) {
    console.error('Error tracking play:', error);
    throw error;
  }
};

// Update play progress
export const updatePlayProgress = async (playId, duration, percentage, completed = false) => {
  try {
    await updateDoc(doc(db, 'plays', playId), {
      duration,
      percentage,
      completed,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating play progress:', error);
  }
};

// Get analytics data
export const getAnalytics = async (timeRange = '7d', entityType = 'platform') => {
  try {
    const now = new Date();
    const startDate = new Date();
    
    // Calculate start date based on time range
    switch (timeRange) {
      case '24h':
        startDate.setHours(now.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 7);
    }

    // Query analytics data
    const analyticsQuery = query(
      collection(db, 'analytics_daily'),
      where('date', '>=', startDate.toISOString().split('T')[0]),
      orderBy('date', 'desc')
    );

    const snapshot = await getDocs(analyticsQuery);
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Aggregate data
    const aggregated = {
      totalPlays: 0,
      uniqueListeners: new Set(),
      totalDuration: 0,
      topTracks: {},
      topReleases: {},
      hourlyDistribution: Array(24).fill(0),
      dailyTrend: [],
      byDate: {}
    };

    data.forEach(item => {
      aggregated.totalPlays += item.playCount || 0;
      aggregated.totalDuration += item.totalDuration || 0;
      
      // Track top content
      if (item.trackId) {
        aggregated.topTracks[item.trackId] = (aggregated.topTracks[item.trackId] || 0) + item.playCount;
      }
      if (item.releaseId) {
        aggregated.topReleases[item.releaseId] = (aggregated.topReleases[item.releaseId] || 0) + item.playCount;
      }

      // Daily aggregation
      if (!aggregated.byDate[item.date]) {
        aggregated.byDate[item.date] = {
          plays: 0,
          duration: 0,
          tracks: new Set()
        };
      }
      aggregated.byDate[item.date].plays += item.playCount;
      aggregated.byDate[item.date].duration += item.totalDuration;
      aggregated.byDate[item.date].tracks.add(item.trackId);
    });

    // Sort and limit top content
    aggregated.topTracks = Object.entries(aggregated.topTracks)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([trackId, plays]) => ({ trackId, plays }));

    aggregated.topReleases = Object.entries(aggregated.topReleases)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([releaseId, plays]) => ({ releaseId, plays }));

    // Format daily trend
    aggregated.dailyTrend = Object.entries(aggregated.byDate)
      .map(([date, data]) => ({
        date,
        plays: data.plays,
        duration: data.duration,
        uniqueTracks: data.tracks.size
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return aggregated;
  } catch (error) {
    console.error('Error getting analytics:', error);
    throw error;
  }
};

// Generate DSR (Digital Sales Report)
export const generateDSR = async (startDate, endDate, format = 'DDEX') => {
  try {
    const generateDSRFunction = httpsCallable(functions, 'generateDSR');
    const result = await generateDSRFunction({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      format
    });
    
    return result.data;
  } catch (error) {
    console.error('Error generating DSR:', error);
    throw error;
  }
};

// Get usage reports
export const getUsageReport = async (reportType, params = {}) => {
  try {
    const getReportFunction = httpsCallable(functions, 'getUsageReport');
    const result = await getReportFunction({
      reportType,
      ...params
    });
    
    return result.data;
  } catch (error) {
    console.error('Error getting usage report:', error);
    throw error;
  }
};

// Calculate royalties
export const calculateRoyalties = async (period, territory = 'worldwide') => {
  try {
    const calculateRoyaltiesFunction = httpsCallable(functions, 'calculateRoyalties');
    const result = await calculateRoyaltiesFunction({
      period,
      territory
    });
    
    return result.data;
  } catch (error) {
    console.error('Error calculating royalties:', error);
    throw error;
  }
};

// Get distributor reports
export const getDistributorReports = async (distributorId, timeRange) => {
  try {
    const reportsQuery = query(
      collection(db, 'distributor_reports'),
      where('distributorId', '==', distributorId),
      where('createdAt', '>=', Timestamp.fromDate(new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000))),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(reportsQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting distributor reports:', error);
    throw error;
  }
};

// Track user activity
export const trackActivity = async (userId, action, metadata = {}) => {
  try {
    await addDoc(collection(db, 'user_activity'), {
      userId,
      action,
      metadata,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Error tracking activity:', error);
  }
};

// Get platform metrics
export const getPlatformMetrics = async () => {
  try {
    const metrics = {};

    // Get total users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    metrics.totalUsers = usersSnapshot.size;

    // Get total releases
    const releasesSnapshot = await getDocs(collection(db, 'releases'));
    metrics.totalReleases = releasesSnapshot.size;

    // Get total tracks
    const tracksSnapshot = await getDocs(collection(db, 'tracks'));
    metrics.totalTracks = tracksSnapshot.size;

    // Get recent activity
    const recentPlaysQuery = query(
      collection(db, 'plays'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );
    const recentPlaysSnapshot = await getDocs(recentPlaysQuery);
    metrics.recentPlays = recentPlaysSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Calculate growth metrics
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    
    const growthQuery = query(
      collection(db, 'releases'),
      where('createdAt', '>=', Timestamp.fromDate(lastMonth))
    );
    const growthSnapshot = await getDocs(growthQuery);
    metrics.monthlyGrowth = {
      releases: growthSnapshot.size,
      percentage: ((growthSnapshot.size / metrics.totalReleases) * 100).toFixed(2)
    };

    return metrics;
  } catch (error) {
    console.error('Error getting platform metrics:', error);
    throw error;
  }
};

export default {
  trackPlay,
  updatePlayProgress,
  getAnalytics,
  generateDSR,
  getUsageReport,
  calculateRoyalties,
  getDistributorReports,
  trackActivity,
  getPlatformMetrics
};