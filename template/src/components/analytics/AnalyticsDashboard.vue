<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Chart, registerables } from 'chart.js';
import analyticsService from '@/services/analytics';
import { useToast } from '@/composables/useToast';

Chart.register(...registerables);

export default {
  name: 'AnalyticsDashboard',
  setup() {
    const loading = ref(false);
    const selectedRange = ref('7d');
    const analytics = ref({
      totalPlays: 0,
      uniqueListeners: new Set(),
      totalDuration: 0,
      topTracks: [],
      topReleases: [],
      dailyTrend: []
    });
    
    const topTracks = ref([]);
    const charts = ref({});
    const { showToast } = useToast();

    // Refs for chart canvases
    const trendChart = ref(null);
    const deviceChart = ref(null);
    const hourlyChart = ref(null);

    // Computed properties
    const playGrowth = computed(() => {
      // Calculate growth percentage
      return 15; // Placeholder
    });

    const estimatedRevenue = computed(() => {
      // Calculate estimated revenue based on plays
      return (analytics.value.totalPlays * 0.003).toFixed(2);
    });

    // Load analytics data
    const loadAnalytics = async () => {
      loading.value = true;
      try {
        const data = await analyticsService.getAnalytics(selectedRange.value);
        analytics.value = data;
        
        // Load track metadata for top tracks
        await loadTrackMetadata();
        
        // Update charts
        updateCharts();
      } catch (error) {
        console.error('Error loading analytics:', error);
        showToast('Failed to load analytics', 'error');
      } finally {
        loading.value = false;
      }
    };

    // Load track metadata
    const loadTrackMetadata = async () => {
      // This would fetch actual track data from Firestore
      topTracks.value = analytics.value.topTracks.map(track => ({
        ...track,
        title: `Track ${track.trackId.substring(0, 8)}`,
        artist: 'Artist Name'
      }));
    };

    // Update chart visualizations
    const updateCharts = () => {
      // Trend Chart
      if (trendChart.value) {
        if (charts.value.trend) {
          charts.value.trend.destroy();
        }
        
        const ctx = trendChart.value.getContext('2d');
        charts.value.trend = new Chart(ctx, {
          type: 'line',
          data: {
            labels: analytics.value.dailyTrend.map(d => d.date),
            datasets: [{
              label: 'Plays',
              data: analytics.value.dailyTrend.map(d => d.plays),
              borderColor: 'rgb(59, 130, 246)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            }
          }
        });
      }

      // Device Chart
      if (deviceChart.value) {
        if (charts.value.device) {
          charts.value.device.destroy();
        }
        
        const ctx = deviceChart.value.getContext('2d');
        charts.value.device = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['Mobile', 'Desktop', 'Tablet', 'Smart TV'],
            datasets: [{
              data: [45, 35, 15, 5],
              backgroundColor: [
                'rgb(59, 130, 246)',
                'rgb(16, 185, 129)',
                'rgb(251, 146, 60)',
                'rgb(147, 51, 234)'
              ]
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false
          }
        });
      }

      // Hourly Chart
      if (hourlyChart.value) {
        if (charts.value.hourly) {
          charts.value.hourly.destroy();
        }
        
        const ctx = hourlyChart.value.getContext('2d');
        charts.value.hourly = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
            datasets: [{
              label: 'Plays by Hour',
              data: analytics.value.hourlyDistribution || Array(24).fill(0),
              backgroundColor: 'rgba(59, 130, 246, 0.8)'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            }
          }
        });
      }
    };

    // Export data
    const exportData = () => {
      const dataStr = JSON.stringify(analytics.value, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `analytics_${selectedRange.value}_${new Date().toISOString()}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      showToast('Analytics data exported', 'success');
    };

    // Refresh data
    const refreshData = () => {
      loadAnalytics();
    };

    // Generate DSR
    const generateDSR = () => {
      // Navigate to DSR generator
      showToast('Opening DSR generator...', 'info');
    };

    // Show royalties calculator
    const showRoyalties = () => {
      showToast('Opening royalty calculator...', 'info');
    };

    // Show usage reports
    const showUsageReports = () => {
      showToast('Opening usage reports...', 'info');
    };

    // Show distributor portal
    const showDistributorPortal = () => {
      showToast('Opening distributor portal...', 'info');
    };

    // Utility functions
    const formatNumber = (num) => {
      if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
      } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
      }
      return num.toString();
    };

    const formatDuration = (seconds) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    };

    // Lifecycle
    onMounted(() => {
      loadAnalytics();
      
      // Set up auto-refresh
      const refreshInterval = setInterval(loadAnalytics, 60000); // Refresh every minute
      
      onUnmounted(() => {
        clearInterval(refreshInterval);
        // Clean up charts
        Object.values(charts.value).forEach(chart => chart.destroy());
      });
    });

    return {
      loading,
      selectedRange,
      analytics,
      topTracks,
      playGrowth,
      estimatedRevenue,
      trendChart,
      deviceChart,
      hourlyChart,
      loadAnalytics,
      exportData,
      refreshData,
      generateDSR,
      showRoyalties,
      showUsageReports,
      showDistributorPortal,
      formatNumber,
      formatDuration
    };
  }
};
</script>

<template>
  <div class="analytics-dashboard">
    <!-- Header with Date Range Selector -->
    <div class="dashboard-header">
      <h2 class="dashboard-title">Analytics Dashboard</h2>
      <div class="controls">
        <select v-model="selectedRange" @change="loadAnalytics" class="form-select">
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
          <option value="1y">Last Year</option>
        </select>
        <button @click="exportData" class="btn btn-secondary">
          <i class="fas fa-download"></i> Export
        </button>
        <button @click="refreshData" class="btn btn-primary">
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }"></i> Refresh
        </button>
      </div>
    </div>

    <!-- Key Metrics -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-icon">
          <i class="fas fa-play"></i>
        </div>
        <div class="metric-content">
          <div class="metric-value">{{ formatNumber(analytics.totalPlays) }}</div>
          <div class="metric-label">Total Plays</div>
          <div class="metric-change" :class="{ positive: playGrowth > 0 }">
            <i class="fas" :class="playGrowth > 0 ? 'fa-arrow-up' : 'fa-arrow-down'"></i>
            {{ Math.abs(playGrowth) }}%
          </div>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon">
          <i class="fas fa-users"></i>
        </div>
        <div class="metric-content">
          <div class="metric-value">{{ formatNumber(analytics.uniqueListeners?.size || 0) }}</div>
          <div class="metric-label">Unique Listeners</div>
          <div class="metric-change positive">
            <i class="fas fa-arrow-up"></i> 12%
          </div>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon">
          <i class="fas fa-clock"></i>
        </div>
        <div class="metric-content">
          <div class="metric-value">{{ formatDuration(analytics.totalDuration) }}</div>
          <div class="metric-label">Total Listening Time</div>
          <div class="metric-change positive">
            <i class="fas fa-arrow-up"></i> 8%
          </div>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-icon">
          <i class="fas fa-dollar-sign"></i>
        </div>
        <div class="metric-content">
          <div class="metric-value">${{ formatNumber(estimatedRevenue) }}</div>
          <div class="metric-label">Estimated Revenue</div>
          <div class="metric-change positive">
            <i class="fas fa-arrow-up"></i> 15%
          </div>
        </div>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="charts-row">
      <!-- Play Trend Chart -->
      <div class="chart-card">
        <h3 class="chart-title">Play Trend</h3>
        <canvas ref="trendChart"></canvas>
      </div>

      <!-- Top Content -->
      <div class="chart-card">
        <h3 class="chart-title">Top Tracks</h3>
        <div class="top-content-list">
          <div v-for="(track, index) in topTracks" :key="track.trackId" class="top-content-item">
            <span class="rank">{{ index + 1 }}</span>
            <div class="content-info">
              <div class="content-title">{{ track.title || 'Loading...' }}</div>
              <div class="content-artist">{{ track.artist || 'Unknown Artist' }}</div>
            </div>
            <div class="play-count">{{ formatNumber(track.plays) }} plays</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Geographic Distribution -->
    <div class="chart-card full-width">
      <h3 class="chart-title">Geographic Distribution</h3>
      <div class="geo-map" ref="geoMap">
        <!-- Placeholder for map visualization -->
        <div class="map-placeholder">
          <i class="fas fa-globe-americas"></i>
          <p>Geographic data visualization coming soon</p>
        </div>
      </div>
    </div>

    <!-- Device & Platform Stats -->
    <div class="charts-row">
      <div class="chart-card">
        <h3 class="chart-title">Listening Devices</h3>
        <canvas ref="deviceChart"></canvas>
      </div>

      <div class="chart-card">
        <h3 class="chart-title">Peak Listening Hours</h3>
        <canvas ref="hourlyChart"></canvas>
      </div>
    </div>

    <!-- Detailed Reports Section -->
    <div class="reports-section">
      <h3 class="section-title">Reports & Exports</h3>
      <div class="reports-grid">
        <button @click="generateDSR" class="report-card">
          <i class="fas fa-file-invoice"></i>
          <span>Generate DSR</span>
        </button>
        <button @click="showRoyalties" class="report-card">
          <i class="fas fa-calculator"></i>
          <span>Royalty Calculator</span>
        </button>
        <button @click="showUsageReports" class="report-card">
          <i class="fas fa-chart-line"></i>
          <span>Usage Reports</span>
        </button>
        <button @click="showDistributorPortal" class="report-card">
          <i class="fas fa-building"></i>
          <span>Distributor Portal</span>
        </button>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div v-if="loading" class="loading-overlay">
      <div class="spinner"></div>
      <p>Loading analytics data...</p>
    </div>
  </div>
</template>

<style scoped>
.analytics-dashboard {
  padding: var(--spacing-lg);
  max-width: 1400px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xl);
}

.dashboard-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.controls {
  display: flex;
  gap: var(--spacing-md);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.metric-card {
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
  transition: var(--transition-base);
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.metric-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  background: var(--primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
  font-size: var(--font-size-xl);
}

.metric-content {
  flex: 1;
}

.metric-value {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-bold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.metric-label {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-xs);
}

.metric-change {
  font-size: var(--font-size-sm);
  color: var(--danger);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.metric-change.positive {
  color: var(--success);
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.chart-card {
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
}

.chart-card.full-width {
  grid-column: 1 / -1;
}

.chart-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-lg);
}

.chart-card canvas {
  max-height: 300px;
}

.top-content-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.top-content-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  transition: var(--transition-base);
}

.top-content-item:hover {
  background: var(--surface-secondary);
}

.rank {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  background: var(--primary-light);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-semibold);
}

.content-info {
  flex: 1;
}

.content-title {
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.content-artist {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.play-count {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.geo-map {
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-secondary);
  border-radius: var(--radius-md);
}

.map-placeholder {
  text-align: center;
  color: var(--text-secondary);
}

.map-placeholder i {
  font-size: 48px;
  margin-bottom: var(--spacing-md);
  opacity: 0.5;
}

.reports-section {
  margin-top: var(--spacing-xl);
}

.section-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-lg);
}

.reports-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-lg);
}

.report-card {
  background: var(--surface-primary);
  border: 2px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  cursor: pointer;
  transition: var(--transition-base);
}

.report-card:hover {
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.report-card i {
  font-size: 32px;
  color: var(--primary);
}

.report-card span {
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--surface-primary);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-overlay p {
  color: white;
  margin-top: var(--spacing-lg);
}
</style>