<template>
  <div class="usage-reports">
    <div class="reports-header">
      <h2>Usage Reports</h2>
      <p class="description">Comprehensive usage analytics and detailed reporting for your catalog</p>
    </div>

    <!-- Report Filters -->
    <div class="filters-section">
      <div class="filter-row">
        <div class="filter-group">
          <label>Report Type</label>
          <select v-model="filters.reportType" @change="loadReport" class="form-select">
            <option value="streaming">Streaming Analytics</option>
            <option value="downloads">Download Statistics</option>
            <option value="geographic">Geographic Distribution</option>
            <option value="demographic">Demographic Analysis</option>
            <option value="playlist">Playlist Performance</option>
            <option value="discovery">Discovery Sources</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Time Period</label>
          <select v-model="filters.period" @change="loadReport" class="form-select">
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Granularity</label>
          <select v-model="filters.granularity" @change="loadReport" class="form-select">
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Content Filter</label>
          <select v-model="filters.content" @change="loadReport" class="form-select">
            <option value="all">All Content</option>
            <option value="releases">By Release</option>
            <option value="tracks">By Track</option>
            <option value="artists">By Artist</option>
            <option value="labels">By Label</option>
          </select>
        </div>
      </div>

      <!-- Custom Date Range -->
      <div v-if="filters.period === 'custom'" class="date-range">
        <div class="filter-group">
          <label>Start Date</label>
          <input type="date" v-model="filters.startDate" @change="loadReport" class="form-input" />
        </div>
        <div class="filter-group">
          <label>End Date</label>
          <input type="date" v-model="filters.endDate" @change="loadReport" class="form-input" />
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="filter-actions">
        <button @click="loadReport" class="btn btn-primary" :disabled="loading">
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }"></i>
          {{ loading ? 'Loading...' : 'Refresh Report' }}
        </button>
        <button @click="scheduleReport" class="btn btn-secondary">
          <i class="fas fa-clock"></i> Schedule
        </button>
        <button @click="exportReport" class="btn btn-secondary">
          <i class="fas fa-download"></i> Export
        </button>
      </div>
    </div>

    <!-- Report Content -->
    <div v-if="reportData" class="report-content">
      <!-- Streaming Analytics Report -->
      <div v-if="filters.reportType === 'streaming'" class="streaming-report">
        <!-- Overview Metrics -->
        <div class="metrics-row">
          <div class="metric-box">
            <div class="metric-title">Total Streams</div>
            <div class="metric-value">{{ formatNumber(reportData.totalStreams) }}</div>
            <div class="metric-change" :class="{ positive: reportData.streamGrowth > 0 }">
              <i class="fas" :class="reportData.streamGrowth > 0 ? 'fa-arrow-up' : 'fa-arrow-down'"></i>
              {{ Math.abs(reportData.streamGrowth) }}%
            </div>
          </div>

          <div class="metric-box">
            <div class="metric-title">Unique Listeners</div>
            <div class="metric-value">{{ formatNumber(reportData.uniqueListeners) }}</div>
            <div class="metric-change positive">
              <i class="fas fa-arrow-up"></i> 12%
            </div>
          </div>

          <div class="metric-box">
            <div class="metric-title">Avg. Stream Duration</div>
            <div class="metric-value">{{ reportData.avgDuration }}</div>
            <div class="metric-change">-</div>
          </div>

          <div class="metric-box">
            <div class="metric-title">Completion Rate</div>
            <div class="metric-value">{{ reportData.completionRate }}%</div>
            <div class="metric-change positive">
              <i class="fas fa-arrow-up"></i> 3%
            </div>
          </div>
        </div>

        <!-- Stream Trends Chart -->
        <div class="chart-container">
          <h3>Streaming Trends</h3>
          <canvas ref="trendsChart"></canvas>
        </div>

        <!-- Top Performing Content -->
        <div class="performance-grid">
          <div class="performance-section">
            <h3>Top Tracks</h3>
            <div class="performance-list">
              <div v-for="(track, index) in reportData.topTracks" :key="track.id" class="performance-item">
                <span class="rank">{{ index + 1 }}</span>
                <div class="item-info">
                  <div class="item-title">{{ track.title }}</div>
                  <div class="item-artist">{{ track.artist }}</div>
                </div>
                <div class="item-stats">
                  <div class="stat-value">{{ formatNumber(track.streams) }}</div>
                  <div class="stat-label">streams</div>
                </div>
              </div>
            </div>
          </div>

          <div class="performance-section">
            <h3>Top Albums</h3>
            <div class="performance-list">
              <div v-for="(album, index) in reportData.topAlbums" :key="album.id" class="performance-item">
                <span class="rank">{{ index + 1 }}</span>
                <div class="item-info">
                  <div class="item-title">{{ album.title }}</div>
                  <div class="item-artist">{{ album.artist }}</div>
                </div>
                <div class="item-stats">
                  <div class="stat-value">{{ formatNumber(album.streams) }}</div>
                  <div class="stat-label">streams</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Geographic Distribution Report -->
      <div v-if="filters.reportType === 'geographic'" class="geographic-report">
        <div class="map-container">
          <h3>Geographic Distribution</h3>
          <div class="world-map" ref="worldMap">
            <!-- Placeholder for map -->
            <div class="map-placeholder">
              <i class="fas fa-globe-americas"></i>
              <p>Interactive map visualization</p>
            </div>
          </div>
        </div>

        <div class="countries-table">
          <h3>Top Countries</h3>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Country</th>
                <th>Streams</th>
                <th>Users</th>
                <th>Avg. Duration</th>
                <th>Revenue</th>
                <th>Growth</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(country, index) in reportData.countries" :key="country.code">
                <td>{{ index + 1 }}</td>
                <td>
                  <div class="country-info">
                    <span class="country-flag">{{ country.flag }}</span>
                    <span>{{ country.name }}</span>
                  </div>
                </td>
                <td>{{ formatNumber(country.streams) }}</td>
                <td>{{ formatNumber(country.users) }}</td>
                <td>{{ country.avgDuration }}</td>
                <td>${{ formatNumber(country.revenue) }}</td>
                <td>
                  <span class="growth" :class="{ positive: country.growth > 0 }">
                    {{ country.growth > 0 ? '+' : '' }}{{ country.growth }}%
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Demographic Analysis Report -->
      <div v-if="filters.reportType === 'demographic'" class="demographic-report">
        <div class="demographic-charts">
          <div class="chart-box">
            <h3>Age Distribution</h3>
            <canvas ref="ageChart"></canvas>
          </div>

          <div class="chart-box">
            <h3>Gender Split</h3>
            <canvas ref="genderChart"></canvas>
          </div>
        </div>

        <div class="demographic-insights">
          <h3>Audience Insights</h3>
          <div class="insights-grid">
            <div class="insight-card">
              <div class="insight-icon">
                <i class="fas fa-users"></i>
              </div>
              <div class="insight-content">
                <div class="insight-title">Primary Audience</div>
                <div class="insight-value">18-24 years</div>
                <div class="insight-detail">45% of total listeners</div>
              </div>
            </div>

            <div class="insight-card">
              <div class="insight-icon">
                <i class="fas fa-clock"></i>
              </div>
              <div class="insight-content">
                <div class="insight-title">Peak Hours</div>
                <div class="insight-value">7-9 PM</div>
                <div class="insight-detail">35% of daily streams</div>
              </div>
            </div>

            <div class="insight-card">
              <div class="insight-icon">
                <i class="fas fa-mobile-alt"></i>
              </div>
              <div class="insight-content">
                <div class="insight-title">Primary Device</div>
                <div class="insight-value">Mobile</div>
                <div class="insight-detail">68% of streams</div>
              </div>
            </div>

            <div class="insight-card">
              <div class="insight-icon">
                <i class="fas fa-heart"></i>
              </div>
              <div class="insight-content">
                <div class="insight-title">Engagement Rate</div>
                <div class="insight-value">72%</div>
                <div class="insight-detail">Above industry average</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Playlist Performance Report -->
      <div v-if="filters.reportType === 'playlist'" class="playlist-report">
        <div class="playlist-overview">
          <h3>Playlist Impact</h3>
          <div class="impact-metrics">
            <div class="impact-metric">
              <div class="impact-label">Total Playlist Adds</div>
              <div class="impact-value">{{ formatNumber(reportData.totalAdds) }}</div>
            </div>
            <div class="impact-metric">
              <div class="impact-label">Playlist Reach</div>
              <div class="impact-value">{{ formatNumber(reportData.playlistReach) }}</div>
            </div>
            <div class="impact-metric">
              <div class="impact-label">Streams from Playlists</div>
              <div class="impact-value">{{ reportData.playlistStreamPercentage }}%</div>
            </div>
          </div>
        </div>

        <div class="playlist-table">
          <h3>Top Performing Playlists</h3>
          <table>
            <thead>
              <tr>
                <th>Playlist</th>
                <th>Curator</th>
                <th>Followers</th>
                <th>Your Tracks</th>
                <th>Streams Generated</th>
                <th>Conversion</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="playlist in reportData.topPlaylists" :key="playlist.id">
                <td>
                  <div class="playlist-info">
                    <div class="playlist-name">{{ playlist.name }}</div>
                    <div class="playlist-genre">{{ playlist.genre }}</div>
                  </div>
                </td>
                <td>{{ playlist.curator }}</td>
                <td>{{ formatNumber(playlist.followers) }}</td>
                <td>{{ playlist.trackCount }}</td>
                <td>{{ formatNumber(playlist.streams) }}</td>
                <td>{{ playlist.conversion }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Discovery Sources Report -->
      <div v-if="filters.reportType === 'discovery'" class="discovery-report">
        <div class="discovery-funnel">
          <h3>Discovery Funnel</h3>
          <div class="funnel-stages">
            <div v-for="stage in reportData.discoveryFunnel" :key="stage.name" class="funnel-stage">
              <div class="stage-bar" :style="{ width: `${stage.percentage}%` }"></div>
              <div class="stage-info">
                <div class="stage-name">{{ stage.name }}</div>
                <div class="stage-value">{{ formatNumber(stage.value) }} ({{ stage.percentage }}%)</div>
              </div>
            </div>
          </div>
        </div>

        <div class="discovery-sources">
          <h3>Traffic Sources</h3>
          <div class="sources-chart">
            <canvas ref="sourcesChart"></canvas>
          </div>
        </div>
      </div>
    </div>

    <!-- Scheduled Reports -->
    <div class="scheduled-reports">
      <h3>Scheduled Reports</h3>
      <div class="scheduled-list">
        <div v-for="report in scheduledReports" :key="report.id" class="scheduled-item">
          <div class="schedule-info">
            <div class="schedule-name">{{ report.name }}</div>
            <div class="schedule-frequency">{{ report.frequency }} • Next: {{ formatDate(report.nextRun) }}</div>
          </div>
          <div class="schedule-actions">
            <button @click="editSchedule(report)" class="btn-icon">
              <i class="fas fa-edit"></i>
            </button>
            <button @click="deleteSchedule(report)" class="btn-icon danger">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { Chart, registerables } from 'chart.js';
import analyticsService from '@/services/analytics';
import { useToast } from '@/composables/useToast';

Chart.register(...registerables);

export default {
  name: 'UsageReports',
  setup() {
    const loading = ref(false);
    const reportData = ref(null);
    const scheduledReports = ref([]);
    const charts = ref({});
    const { showToast } = useToast();

    // Chart refs
    const trendsChart = ref(null);
    const ageChart = ref(null);
    const genderChart = ref(null);
    const sourcesChart = ref(null);

    // Filters
    const filters = ref({
      reportType: 'streaming',
      period: 'month',
      granularity: 'daily',
      content: 'all',
      startDate: '',
      endDate: ''
    });

    // Load report data
    const loadReport = async () => {
      loading.value = true;
      try {
        const response = await analyticsService.getUsageReport(
          filters.value.reportType,
          filters.value
        );

        // Mock data for demonstration
        reportData.value = generateMockData(filters.value.reportType);
        
        // Update charts
        setTimeout(() => updateCharts(), 100);
        
      } catch (error) {
        console.error('Error loading report:', error);
        showToast('Failed to load report', 'error');
      } finally {
        loading.value = false;
      }
    };

    // Generate mock data based on report type
    const generateMockData = (type) => {
      const baseData = {
        totalStreams: 1250000,
        streamGrowth: 15,
        uniqueListeners: 85000,
        avgDuration: '3:24',
        completionRate: 72,
        topTracks: [
          { id: 1, title: 'Summer Nights', artist: 'The Waves', streams: 125000 },
          { id: 2, title: 'City Lights', artist: 'Urban Dreams', streams: 98000 },
          { id: 3, title: 'Mountain High', artist: 'Alpine Echo', streams: 87000 },
          { id: 4, title: 'Ocean Drive', artist: 'Coastal', streams: 76000 },
          { id: 5, title: 'Midnight Jazz', artist: 'Smooth Crew', streams: 65000 }
        ],
        topAlbums: [
          { id: 1, title: 'Greatest Hits', artist: 'Various Artists', streams: 245000 },
          { id: 2, title: 'Summer Collection', artist: 'The Waves', streams: 198000 },
          { id: 3, title: 'Urban Landscapes', artist: 'City Sounds', streams: 167000 },
          { id: 4, title: 'Nature Calls', artist: 'Ambient Works', streams: 145000 },
          { id: 5, title: 'Jazz Sessions', artist: 'Multiple Artists', streams: 132000 }
        ]
      };

      if (type === 'geographic') {
        return {
          ...baseData,
          countries: [
            { code: 'US', name: 'United States', flag: '🇺🇸', streams: 450000, users: 32000, avgDuration: '3:15', revenue: 2025, growth: 12 },
            { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', streams: 280000, users: 18000, avgDuration: '3:28', revenue: 1260, growth: 8 },
            { code: 'DE', name: 'Germany', flag: '🇩🇪', streams: 195000, users: 12000, avgDuration: '3:42', revenue: 877, growth: 15 },
            { code: 'FR', name: 'France', flag: '🇫🇷', streams: 165000, users: 10500, avgDuration: '3:19', revenue: 742, growth: -3 },
            { code: 'JP', name: 'Japan', flag: '🇯🇵', streams: 160000, users: 9800, avgDuration: '3:55', revenue: 720, growth: 22 }
          ]
        };
      }

      if (type === 'demographic') {
        return {
          ...baseData,
          ageGroups: [
            { range: '13-17', percentage: 15 },
            { range: '18-24', percentage: 45 },
            { range: '25-34', percentage: 25 },
            { range: '35-44', percentage: 10 },
            { range: '45+', percentage: 5 }
          ],
          genderSplit: {
            male: 55,
            female: 42,
            other: 3
          }
        };
      }

      if (type === 'playlist') {
        return {
          ...baseData,
          totalAdds: 3450,
          playlistReach: 2500000,
          playlistStreamPercentage: 68,
          topPlaylists: [
            { id: 1, name: 'Today\'s Top Hits', genre: 'Pop', curator: 'Platform Editorial', followers: 25000000, trackCount: 3, streams: 450000, conversion: 1.8 },
            { id: 2, name: 'Chill Vibes', genre: 'Chill', curator: 'User Curated', followers: 500000, trackCount: 5, streams: 125000, conversion: 25 },
            { id: 3, name: 'Workout Motivation', genre: 'Electronic', curator: 'Fitness Brand', followers: 1200000, trackCount: 2, streams: 98000, conversion: 8.2 }
          ]
        };
      }

      if (type === 'discovery') {
        return {
          ...baseData,
          discoveryFunnel: [
            { name: 'Impressions', value: 5000000, percentage: 100 },
            { name: 'Clicks', value: 250000, percentage: 50 },
            { name: 'Plays', value: 125000, percentage: 25 },
            { name: 'Completes', value: 90000, percentage: 18 },
            { name: 'Saves', value: 12500, percentage: 2.5 }
          ],
          trafficSources: {
            search: 35,
            playlists: 28,
            recommendations: 20,
            direct: 10,
            social: 7
          }
        };
      }

      return baseData;
    };

    // Update charts
    const updateCharts = () => {
      // Destroy existing charts
      Object.values(charts.value).forEach(chart => chart?.destroy());
      charts.value = {};

      if (filters.value.reportType === 'streaming' && trendsChart.value) {
        const ctx = trendsChart.value.getContext('2d');
        charts.value.trends = new Chart(ctx, {
          type: 'line',
          data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [{
              label: 'Streams',
              data: [280000, 310000, 335000, 325000],
              borderColor: 'rgb(59, 130, 246)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              tension: 0.4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false
          }
        });
      }

      if (filters.value.reportType === 'demographic') {
        if (ageChart.value) {
          const ctx = ageChart.value.getContext('2d');
          charts.value.age = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: reportData.value.ageGroups.map(g => g.range),
              datasets: [{
                label: 'Percentage',
                data: reportData.value.ageGroups.map(g => g.percentage),
                backgroundColor: 'rgba(59, 130, 246, 0.8)'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false
            }
          });
        }

        if (genderChart.value) {
          const ctx = genderChart.value.getContext('2d');
          charts.value.gender = new Chart(ctx, {
            type: 'doughnut',
            data: {
              labels: ['Male', 'Female', 'Other'],
              datasets: [{
                data: [
                  reportData.value.genderSplit.male,
                  reportData.value.genderSplit.female,
                  reportData.value.genderSplit.other
                ],
                backgroundColor: [
                  'rgb(59, 130, 246)',
                  'rgb(236, 72, 153)',
                  'rgb(168, 85, 247)'
                ]
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false
            }
          });
        }
      }

      if (filters.value.reportType === 'discovery' && sourcesChart.value) {
        const ctx = sourcesChart.value.getContext('2d');
        charts.value.sources = new Chart(ctx, {
          type: 'pie',
          data: {
            labels: Object.keys(reportData.value.trafficSources),
            datasets: [{
              data: Object.values(reportData.value.trafficSources),
              backgroundColor: [
                'rgb(59, 130, 246)',
                'rgb(16, 185, 129)',
                'rgb(251, 146, 60)',
                'rgb(147, 51, 234)',
                'rgb(239, 68, 68)'
              ]
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false
          }
        });
      }
    };

    // Schedule report
    const scheduleReport = () => {
      showToast('Report scheduling interface opening...', 'info');
    };

    // Export report
    const exportReport = () => {
      if (!reportData.value) {
        showToast('No report data to export', 'warning');
        return;
      }

      const dataStr = JSON.stringify(reportData.value, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `usage_report_${filters.value.reportType}_${new Date().toISOString()}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      showToast('Report exported successfully', 'success');
    };

    // Edit schedule
    const editSchedule = (report) => {
      showToast(`Editing schedule: ${report.name}`, 'info');
    };

    // Delete schedule
    const deleteSchedule = (report) => {
      if (confirm(`Delete scheduled report: ${report.name}?`)) {
        scheduledReports.value = scheduledReports.value.filter(r => r.id !== report.id);
        showToast('Schedule deleted', 'success');
      }
    };

    // Utility functions
    const formatNumber = (num) => {
      return new Intl.NumberFormat().format(num || 0);
    };

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString();
    };

    // Load scheduled reports
    const loadScheduledReports = () => {
      scheduledReports.value = [
        {
          id: 1,
          name: 'Weekly Streaming Report',
          frequency: 'Weekly on Monday',
          nextRun: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        },
        {
          id: 2,
          name: 'Monthly Revenue Report',
          frequency: 'Monthly on 1st',
          nextRun: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
        }
      ];
    };

    onMounted(() => {
      loadReport();
      loadScheduledReports();
    });

    onUnmounted(() => {
      Object.values(charts.value).forEach(chart => chart?.destroy());
    });

    return {
      loading,
      reportData,
      scheduledReports,
      filters,
      trendsChart,
      ageChart,
      genderChart,
      sourcesChart,
      loadReport,
      scheduleReport,
      exportReport,
      editSchedule,
      deleteSchedule,
      formatNumber,
      formatDate
    };
  }
};
</script>

<style scoped>
.usage-reports {
  padding: var(--spacing-lg);
  max-width: 1400px;
  margin: 0 auto;
}

.reports-header {
  margin-bottom: var(--spacing-xl);
}

.reports-header h2 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-sm);
}

.description {
  color: var(--text-secondary);
}

.filters-section {
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
  margin-bottom: var(--spacing-xl);
}

.filter-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.filter-group label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.date-range {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.filter-actions {
  display: flex;
  gap: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--border-subtle);
}

.report-content {
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
  margin-bottom: var(--spacing-xl);
}

.metrics-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
}

.metric-box {
  padding: var(--spacing-md);
  background: var(--surface-secondary);
  border-radius: var(--radius-md);
}

.metric-title {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-bottom: var(--spacing-xs);
}

.metric-value {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
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

.chart-container,
.chart-box {
  margin-bottom: var(--spacing-xl);
}

.chart-container h3,
.chart-box h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-md);
}

.chart-container canvas,
.chart-box canvas {
  max-height: 300px;
}

.performance-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-lg);
}

.performance-section h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-md);
}

.performance-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.performance-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  transition: var(--transition-base);
}

.performance-item:hover {
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

.item-info {
  flex: 1;
}

.item-title {
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.item-artist {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.item-stats {
  text-align: right;
}

.stat-value {
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.map-container {
  margin-bottom: var(--spacing-xl);
}

.world-map {
  height: 400px;
  background: var(--surface-secondary);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
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

.countries-table {
  margin-bottom: var(--spacing-xl);
}

.countries-table h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-md);
}

.countries-table table {
  width: 100%;
  border-collapse: collapse;
}

.countries-table th {
  text-align: left;
  padding: var(--spacing-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-subtle);
  font-size: var(--font-size-sm);
}

.countries-table td {
  padding: var(--spacing-sm);
  border-bottom: 1px solid var(--border-subtle);
}

.country-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.country-flag {
  font-size: var(--font-size-lg);
}

.growth {
  font-weight: var(--font-medium);
  color: var(--danger);
}

.growth.positive {
  color: var(--success);
}

.demographic-charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.demographic-insights {
  margin-bottom: var(--spacing-xl);
}

.insights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--spacing-md);
}

.insight-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--surface-secondary);
  border-radius: var(--radius-md);
}

.insight-icon {
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

.insight-content {
  flex: 1;
}

.insight-title {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-bottom: var(--spacing-xs);
}

.insight-value {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.insight-detail {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.playlist-overview {
  margin-bottom: var(--spacing-xl);
}

.playlist-overview h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-md);
}

.impact-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-md);
}

.impact-metric {
  padding: var(--spacing-md);
  background: var(--surface-secondary);
  border-radius: var(--radius-md);
  text-align: center;
}

.impact-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-bottom: var(--spacing-xs);
}

.impact-value {
  font-size: var(--font-size-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.playlist-table {
  margin-bottom: var(--spacing-xl);
}

.playlist-table h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-md);
}

.playlist-table table {
  width: 100%;
  border-collapse: collapse;
}

.playlist-table th {
  text-align: left;
  padding: var(--spacing-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-subtle);
  font-size: var(--font-size-sm);
}

.playlist-table td {
  padding: var(--spacing-sm);
  border-bottom: 1px solid var(--border-subtle);
}

.playlist-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.playlist-name {
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.playlist-genre {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.discovery-funnel {
  margin-bottom: var(--spacing-xl);
}

.discovery-funnel h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-md);
}

.funnel-stages {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.funnel-stage {
  position: relative;
}

.stage-bar {
  height: 40px;
  background: linear-gradient(to right, var(--primary), var(--primary-light));
  border-radius: var(--radius-md);
  transition: var(--transition-base);
}

.stage-info {
  position: absolute;
  top: 50%;
  left: var(--spacing-md);
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  color: white;
}

.stage-name {
  font-weight: var(--font-medium);
}

.stage-value {
  font-size: var(--font-size-sm);
}

.discovery-sources {
  margin-bottom: var(--spacing-xl);
}

.discovery-sources h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-md);
}

.sources-chart {
  height: 300px;
}

.scheduled-reports {
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
}

.scheduled-reports h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-md);
}

.scheduled-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.scheduled-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  transition: var(--transition-base);
}

.scheduled-item:hover {
  background: var(--surface-secondary);
}

.schedule-info {
  flex: 1;
}

.schedule-name {
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.schedule-frequency {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.schedule-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.btn-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: var(--surface-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--transition-base);
}

.btn-icon:hover {
  background: var(--primary-light);
  color: var(--primary);
  border-color: var(--primary);
}

.btn-icon.danger:hover {
  background: var(--danger-light);
  color: var(--danger);
  border-color: var(--danger);
}

@media (max-width: 768px) {
  .performance-grid,
  .demographic-charts {
    grid-template-columns: 1fr;
  }
}
</style>