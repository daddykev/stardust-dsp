<template>
  <div class="distributor-portal">
    <div class="portal-header">
      <h2>Distributor Portal</h2>
      <p class="description">Access reports, analytics, and delivery status for distributor partners</p>
    </div>

    <!-- Distributor Selection -->
    <div class="distributor-selector">
      <div class="selector-row">
        <div class="selector-group">
          <label>Select Distributor</label>
          <select v-model="selectedDistributor" @change="loadDistributorData" class="form-select">
            <option value="">Choose a distributor...</option>
            <option v-for="dist in distributors" :key="dist.id" :value="dist.id">
              {{ dist.name }} ({{ dist.type }})
            </option>
          </select>
        </div>

        <div class="selector-group">
          <label>Reporting Period</label>
          <select v-model="reportingPeriod" @change="loadDistributorData" class="form-select">
            <option value="current">Current Period</option>
            <option value="last-month">Last Month</option>
            <option value="last-quarter">Last Quarter</option>
            <option value="year-to-date">Year to Date</option>
          </select>
        </div>

        <button @click="refreshData" class="btn btn-primary" :disabled="!selectedDistributor">
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }"></i>
          Refresh
        </button>
      </div>
    </div>

    <!-- Distributor Dashboard -->
    <div v-if="distributorData" class="distributor-dashboard">
      <!-- Distributor Info Card -->
      <div class="distributor-info">
        <div class="info-header">
          <div class="distributor-logo">
            <i :class="distributorData.icon || 'fas fa-building'"></i>
          </div>
          <div class="distributor-details">
            <h3>{{ distributorData.name }}</h3>
            <div class="distributor-meta">
              <span class="meta-item">
                <i class="fas fa-globe"></i> {{ distributorData.territories.join(', ') }}
              </span>
              <span class="meta-item">
                <i class="fas fa-music"></i> {{ formatNumber(distributorData.catalogSize) }} tracks
              </span>
              <span class="meta-item">
                <i class="fas fa-calendar"></i> Partner since {{ distributorData.partnerSince }}
              </span>
            </div>
          </div>
        </div>

        <div class="connection-status">
          <div class="status-indicator" :class="`status-${distributorData.connectionStatus}`"></div>
          <span>{{ distributorData.connectionStatus === 'active' ? 'Connected' : 'Disconnected' }}</span>
        </div>
      </div>

      <!-- Key Metrics -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-header">
            <i class="fas fa-upload"></i>
            <span>Deliveries</span>
          </div>
          <div class="metric-value">{{ formatNumber(distributorData.metrics.totalDeliveries) }}</div>
          <div class="metric-subtext">{{ distributorData.metrics.pendingDeliveries }} pending</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <i class="fas fa-check-circle"></i>
            <span>Success Rate</span>
          </div>
          <div class="metric-value">{{ distributorData.metrics.successRate }}%</div>
          <div class="metric-subtext">Last 30 days</div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <i class="fas fa-play"></i>
            <span>Total Streams</span>
          </div>
          <div class="metric-value">{{ formatNumber(distributorData.metrics.totalStreams) }}</div>
          <div class="metric-subtext">
            <span :class="{ positive: distributorData.metrics.streamGrowth > 0 }">
              {{ distributorData.metrics.streamGrowth > 0 ? '+' : '' }}{{ distributorData.metrics.streamGrowth }}%
            </span>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-header">
            <i class="fas fa-dollar-sign"></i>
            <span>Revenue</span>
          </div>
          <div class="metric-value">${{ formatNumber(distributorData.metrics.revenue) }}</div>
          <div class="metric-subtext">This period</div>
        </div>
      </div>

      <!-- Delivery Status -->
      <div class="delivery-status-section">
        <div class="section-header">
          <h3>Recent Deliveries</h3>
          <button @click="viewAllDeliveries" class="btn btn-sm btn-secondary">
            View All
          </button>
        </div>

        <div class="deliveries-table">
          <table>
            <thead>
              <tr>
                <th>Delivery ID</th>
                <th>Type</th>
                <th>Content</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="delivery in recentDeliveries" :key="delivery.id">
                <td class="mono">{{ delivery.id }}</td>
                <td>
                  <span class="badge" :class="`badge-${delivery.type.toLowerCase()}`">
                    {{ delivery.type }}
                  </span>
                </td>
                <td>
                  <div class="content-info">
                    <div>{{ delivery.releaseCount }} releases</div>
                    <div class="text-secondary">{{ delivery.trackCount }} tracks</div>
                  </div>
                </td>
                <td>{{ formatDate(delivery.submittedAt) }}</td>
                <td>
                  <span class="status-badge" :class="`status-${delivery.status}`">
                    {{ delivery.status }}
                  </span>
                </td>
                <td>
                  <div class="action-buttons">
                    <button @click="viewDeliveryDetails(delivery)" class="btn-icon">
                      <i class="fas fa-eye"></i>
                    </button>
                    <button @click="downloadDeliveryReport(delivery)" class="btn-icon">
                      <i class="fas fa-download"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Content Performance -->
      <div class="content-performance">
        <h3>Content Performance</h3>
        
        <div class="performance-tabs">
          <button 
            v-for="tab in performanceTabs" 
            :key="tab"
            @click="activePerformanceTab = tab"
            :class="['tab-btn', { active: activePerformanceTab === tab }]"
          >
            {{ tab }}
          </button>
        </div>

        <div class="performance-content">
          <!-- Top Releases -->
          <div v-if="activePerformanceTab === 'Releases'" class="top-releases">
            <div class="release-grid">
              <div v-for="release in topReleases" :key="release.id" class="release-card">
                <div class="release-artwork">
                  <img :src="release.artwork || '/placeholder-album.jpg'" :alt="release.title" />
                </div>
                <div class="release-info">
                  <div class="release-title">{{ release.title }}</div>
                  <div class="release-artist">{{ release.artist }}</div>
                  <div class="release-stats">
                    <span><i class="fas fa-play"></i> {{ formatNumber(release.streams) }}</span>
                    <span><i class="fas fa-dollar-sign"></i> {{ formatCurrency(release.revenue) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Top Tracks -->
          <div v-if="activePerformanceTab === 'Tracks'" class="top-tracks">
            <div class="tracks-list">
              <div v-for="(track, index) in topTracks" :key="track.id" class="track-item">
                <span class="track-rank">{{ index + 1 }}</span>
                <div class="track-info">
                  <div class="track-title">{{ track.title }}</div>
                  <div class="track-artist">{{ track.artist }}</div>
                </div>
                <div class="track-stats">
                  <div>{{ formatNumber(track.streams) }} streams</div>
                  <div class="text-secondary">${{ formatNumber(track.revenue) }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Territories -->
          <div v-if="activePerformanceTab === 'Territories'" class="territories">
            <div class="territory-chart">
              <canvas ref="territoryChart"></canvas>
            </div>
            <div class="territory-list">
              <div v-for="territory in topTerritories" :key="territory.code" class="territory-item">
                <div class="territory-info">
                  <span class="territory-flag">{{ territory.flag }}</span>
                  <span>{{ territory.name }}</span>
                </div>
                <div class="territory-stats">
                  <div>{{ formatNumber(territory.streams) }} streams</div>
                  <div class="territory-percentage">{{ territory.percentage }}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Financial Reports -->
      <div class="financial-reports">
        <div class="section-header">
          <h3>Financial Reports</h3>
          <button @click="generateStatement" class="btn btn-sm btn-primary">
            Generate Statement
          </button>
        </div>

        <div class="financial-summary">
          <div class="summary-item">
            <span class="summary-label">Gross Revenue</span>
            <span class="summary-value">${{ formatNumber(financialSummary.gross) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Platform Fee ({{ financialSummary.feePercentage }}%)</span>
            <span class="summary-value">-${{ formatNumber(financialSummary.fees) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Processing Fees</span>
            <span class="summary-value">-${{ formatNumber(financialSummary.processingFees) }}</span>
          </div>
          <div class="summary-item total">
            <span class="summary-label">Net Payable</span>
            <span class="summary-value">${{ formatNumber(financialSummary.net) }}</span>
          </div>
        </div>

        <div class="payment-schedule">
          <h4>Payment Schedule</h4>
          <div class="schedule-items">
            <div v-for="payment in paymentSchedule" :key="payment.id" class="schedule-item">
              <div class="payment-date">
                <i class="fas fa-calendar"></i>
                {{ formatDate(payment.date) }}
              </div>
              <div class="payment-amount">${{ formatNumber(payment.amount) }}</div>
              <div class="payment-status">
                <span class="badge" :class="`badge-${payment.status}`">
                  {{ payment.status }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- API Access -->
      <div class="api-access">
        <h3>API Access</h3>
        
        <div class="api-credentials">
          <div class="credential-item">
            <label>API Key</label>
            <div class="credential-value">
              <code>{{ showApiKey ? distributorData.apiKey : '••••••••••••••••' }}</code>
              <button @click="toggleApiKey" class="btn-icon">
                <i :class="showApiKey ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
              </button>
              <button @click="copyApiKey" class="btn-icon">
                <i class="fas fa-copy"></i>
              </button>
            </div>
          </div>

          <div class="credential-item">
            <label>Webhook URL</label>
            <div class="credential-value">
              <code>{{ distributorData.webhookUrl || 'Not configured' }}</code>
              <button @click="configureWebhook" class="btn-icon">
                <i class="fas fa-cog"></i>
              </button>
            </div>
          </div>
        </div>

        <div class="api-stats">
          <div class="stat-item">
            <span>API Calls Today</span>
            <strong>{{ formatNumber(apiStats.callsToday) }}</strong>
          </div>
          <div class="stat-item">
            <span>Rate Limit</span>
            <strong>{{ apiStats.rateLimit }}/hour</strong>
          </div>
          <div class="stat-item">
            <span>Last Call</span>
            <strong>{{ formatRelativeTime(apiStats.lastCall) }}</strong>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!loading" class="empty-state">
      <i class="fas fa-building"></i>
      <h3>Select a Distributor</h3>
      <p>Choose a distributor from the dropdown to view their portal</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading distributor data...</p>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';
import { Chart, registerables } from 'chart.js';
import analyticsService from '@/services/analytics';
import { useToast } from '@/composables/useToast';

Chart.register(...registerables);

export default {
  name: 'DistributorPortal',
  setup() {
    const loading = ref(false);
    const selectedDistributor = ref('');
    const reportingPeriod = ref('current');
    const distributorData = ref(null);
    const recentDeliveries = ref([]);
    const topReleases = ref([]);
    const topTracks = ref([]);
    const topTerritories = ref([]);
    const financialSummary = ref({});
    const paymentSchedule = ref([]);
    const apiStats = ref({});
    const showApiKey = ref(false);
    const activePerformanceTab = ref('Releases');
    const charts = ref({});
    const { showToast } = useToast();

    // Chart refs
    const territoryChart = ref(null);

    const performanceTabs = ['Releases', 'Tracks', 'Territories'];

    // Available distributors
    const distributors = ref([
      { id: 'spotify', name: 'Spotify', type: 'Streaming' },
      { id: 'apple-music', name: 'Apple Music', type: 'Streaming' },
      { id: 'amazon-music', name: 'Amazon Music', type: 'Streaming' },
      { id: 'youtube-music', name: 'YouTube Music', type: 'Streaming' },
      { id: 'tidal', name: 'Tidal', type: 'Streaming' },
      { id: 'deezer', name: 'Deezer', type: 'Streaming' },
      { id: 'beatport', name: 'Beatport', type: 'Download' },
      { id: 'traxsource', name: 'Traxsource', type: 'Download' }
    ]);

    // Load distributor data
    const loadDistributorData = async () => {
      if (!selectedDistributor.value) {
        distributorData.value = null;
        return;
      }

      loading.value = true;
      try {
        // Mock data for demonstration
        distributorData.value = {
          id: selectedDistributor.value,
          name: distributors.value.find(d => d.id === selectedDistributor.value)?.name,
          icon: 'fab fa-spotify',
          territories: ['US', 'GB', 'EU', 'JP', 'AU'],
          catalogSize: 12450,
          partnerSince: '2020',
          connectionStatus: 'active',
          apiKey: 'sk_live_4242424242424242',
          webhookUrl: 'https://api.example.com/webhook',
          metrics: {
            totalDeliveries: 342,
            pendingDeliveries: 3,
            successRate: 98.5,
            totalStreams: 4500000,
            streamGrowth: 12,
            revenue: 18750
          }
        };

        // Load recent deliveries
        recentDeliveries.value = [
          {
            id: 'DEL-2025-001',
            type: 'NewRelease',
            releaseCount: 5,
            trackCount: 42,
            submittedAt: new Date('2025-02-01'),
            status: 'completed'
          },
          {
            id: 'DEL-2025-002',
            type: 'Update',
            releaseCount: 2,
            trackCount: 18,
            submittedAt: new Date('2025-02-02'),
            status: 'processing'
          },
          {
            id: 'DEL-2025-003',
            type: 'Takedown',
            releaseCount: 1,
            trackCount: 12,
            submittedAt: new Date('2025-02-03'),
            status: 'pending'
          }
        ];

        // Load top content
        topReleases.value = [
          {
            id: 1,
            title: 'Summer Vibes',
            artist: 'The Waves',
            artwork: null,
            streams: 450000,
            revenue: 2025
          },
          {
            id: 2,
            title: 'Night Drive',
            artist: 'Midnight Crew',
            artwork: null,
            streams: 320000,
            revenue: 1440
          },
          {
            id: 3,
            title: 'Mountain High',
            artist: 'Alpine Echo',
            artwork: null,
            streams: 280000,
            revenue: 1260
          }
        ];

        topTracks.value = [
          {
            id: 1,
            title: 'Summer Nights',
            artist: 'The Waves',
            streams: 125000,
            revenue: 562.50
          },
          {
            id: 2,
            title: 'City Lights',
            artist: 'Urban Dreams',
            streams: 98000,
            revenue: 441
          },
          {
            id: 3,
            title: 'Ocean Drive',
            artist: 'Coastal',
            streams: 87000,
            revenue: 391.50
          }
        ];

        topTerritories.value = [
          { code: 'US', name: 'United States', flag: '🇺🇸', streams: 1800000, percentage: 40 },
          { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', streams: 900000, percentage: 20 },
          { code: 'DE', name: 'Germany', flag: '🇩🇪', streams: 675000, percentage: 15 },
          { code: 'FR', name: 'France', flag: '🇫🇷', streams: 450000, percentage: 10 },
          { code: 'JP', name: 'Japan', flag: '🇯🇵', streams: 675000, percentage: 15 }
        ];

        // Financial summary
        financialSummary.value = {
          gross: 18750,
          feePercentage: 15,
          fees: 2812.50,
          processingFees: 187.50,
          net: 15750
        };

        // Payment schedule
        paymentSchedule.value = [
          {
            id: 1,
            date: new Date('2025-03-01'),
            amount: 15750,
            status: 'scheduled'
          },
          {
            id: 2,
            date: new Date('2025-02-01'),
            amount: 14250,
            status: 'paid'
          },
          {
            id: 3,
            date: new Date('2025-01-01'),
            amount: 12850,
            status: 'paid'
          }
        ];

        // API stats
        apiStats.value = {
          callsToday: 342,
          rateLimit: 1000,
          lastCall: new Date(Date.now() - 15 * 60 * 1000) // 15 minutes ago
        };

        // Update chart
        setTimeout(() => updateTerritoryChart(), 100);

      } catch (error) {
        console.error('Error loading distributor data:', error);
        showToast('Failed to load distributor data', 'error');
      } finally {
        loading.value = false;
      }
    };

    // Update territory chart
    const updateTerritoryChart = () => {
      if (!territoryChart.value) return;

      if (charts.value.territory) {
        charts.value.territory.destroy();
      }

      const ctx = territoryChart.value.getContext('2d');
      charts.value.territory = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: topTerritories.value.map(t => t.name),
          datasets: [{
            label: 'Streams',
            data: topTerritories.value.map(t => t.streams),
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
    };

    // Refresh data
    const refreshData = () => {
      loadDistributorData();
    };

    // View all deliveries
    const viewAllDeliveries = () => {
      showToast('Opening delivery history...', 'info');
    };

    // View delivery details
    const viewDeliveryDetails = (delivery) => {
      showToast(`Opening delivery ${delivery.id}...`, 'info');
    };

    // Download delivery report
    const downloadDeliveryReport = (delivery) => {
      showToast(`Downloading report for ${delivery.id}...`, 'info');
    };

    // Generate statement
    const generateStatement = () => {
      showToast('Generating financial statement...', 'info');
    };

    // Toggle API key visibility
    const toggleApiKey = () => {
      showApiKey.value = !showApiKey.value;
    };

    // Copy API key
    const copyApiKey = () => {
      if (distributorData.value?.apiKey) {
        navigator.clipboard.writeText(distributorData.value.apiKey);
        showToast('API key copied to clipboard', 'success');
      }
    };

    // Configure webhook
    const configureWebhook = () => {
      showToast('Opening webhook configuration...', 'info');
    };

    // Utility functions
    const formatNumber = (num) => {
      return new Intl.NumberFormat().format(num || 0);
    };

    const formatCurrency = (amount) => {
      return formatNumber(amount?.toFixed(2) || 0);
    };

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString();
    };

    const formatRelativeTime = (date) => {
      const diff = Date.now() - new Date(date).getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 60) return `${minutes} minutes ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} hours ago`;
      const days = Math.floor(hours / 24);
      return `${days} days ago`;
    };

    onMounted(() => {
      // Auto-load if distributor is pre-selected
      if (selectedDistributor.value) {
        loadDistributorData();
      }
    });

    onUnmounted(() => {
      Object.values(charts.value).forEach(chart => chart?.destroy());
    });

    return {
      loading,
      selectedDistributor,
      reportingPeriod,
      distributorData,
      distributors,
      recentDeliveries,
      topReleases,
      topTracks,
      topTerritories,
      financialSummary,
      paymentSchedule,
      apiStats,
      showApiKey,
      activePerformanceTab,
      performanceTabs,
      territoryChart,
      loadDistributorData,
      refreshData,
      viewAllDeliveries,
      viewDeliveryDetails,
      downloadDeliveryReport,
      generateStatement,
      toggleApiKey,
      copyApiKey,
      configureWebhook,
      formatNumber,
      formatCurrency,
      formatDate,
      formatRelativeTime
    };
  }
};
</script>

<style scoped>
.distributor-portal {
  padding: var(--spacing-lg);
  max-width: 1400px;
  margin: 0 auto;
}

.portal-header {
  margin-bottom: var(--spacing-xl);
}

.portal-header h2 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-sm);
}

.description {
  color: var(--text-secondary);
}

.distributor-selector {
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
  margin-bottom: var(--spacing-xl);
}

.selector-row {
  display: flex;
  gap: var(--spacing-md);
  align-items: flex-end;
}

.selector-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.selector-group label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.distributor-dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
}

.distributor-info {
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-header {
  display: flex;
  gap: var(--spacing-lg);
  align-items: center;
}

.distributor-logo {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-md);
  background: var(--primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  color: var(--primary);
}

.distributor-details h3 {
  font-size: var(--font-size-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-sm);
}

.distributor-meta {
  display: flex;
  gap: var(--spacing-lg);
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.connection-status {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--surface-secondary);
  border-radius: var(--radius-md);
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--danger);
}

.status-indicator.status-active {
  background: var(--success);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-md);
}

.metric-card {
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
}

.metric-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  margin-bottom: var(--spacing-sm);
}

.metric-value {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.metric-subtext {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.metric-subtext .positive {
  color: var(--success);
}

.delivery-status-section,
.content-performance,
.financial-reports,
.api-access {
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.section-header h3,
.content-performance h3,
.api-access h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.deliveries-table {
  overflow-x: auto;
}

.deliveries-table table {
  width: 100%;
  border-collapse: collapse;
}

.deliveries-table th {
  text-align: left;
  padding: var(--spacing-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-subtle);
  font-size: var(--font-size-sm);
}

.deliveries-table td {
  padding: var(--spacing-sm);
  border-bottom: 1px solid var(--border-subtle);
}

.mono {
  font-family: monospace;
  font-size: var(--font-size-sm);
}

.badge {
  display: inline-block;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-medium);
  text-transform: uppercase;
}

.badge-newrelease {
  background: var(--primary-light);
  color: var(--primary);
}

.badge-update {
  background: var(--warning-light);
  color: var(--warning);
}

.badge-takedown {
  background: var(--danger-light);
  color: var(--danger);
}

.content-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.text-secondary {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.status-badge {
  display: inline-block;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-medium);
  text-transform: uppercase;
}

.status-completed {
  background: var(--success-light);
  color: var(--success);
}

.status-processing {
  background: var(--warning-light);
  color: var(--warning);
}

.status-pending {
  background: var(--secondary-light);
  color: var(--secondary);
}

.action-buttons {
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

.performance-tabs {
  display: flex;
  gap: var(--spacing-sm);
  margin: var(--spacing-lg) 0;
  border-bottom: 1px solid var(--border-subtle);
}

.tab-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: var(--transition-base);
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.release-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--spacing-md);
}

.release-card {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: var(--transition-base);
}

.release-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.release-artwork {
  aspect-ratio: 1;
  background: var(--surface-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.release-artwork img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.release-info {
  padding: var(--spacing-md);
}

.release-title {
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.release-artist {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-bottom: var(--spacing-sm);
}

.release-stats {
  display: flex;
  gap: var(--spacing-md);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.tracks-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.track-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  transition: var(--transition-base);
}

.track-item:hover {
  background: var(--surface-secondary);
}

.track-rank {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background: var(--primary-light);
  color: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-semibold);
}

.track-info {
  flex: 1;
}

.track-title {
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.track-artist {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.track-stats {
  text-align: right;
}

.territory-chart {
  height: 300px;
  margin-bottom: var(--spacing-lg);
}

.territory-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.territory-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  transition: var(--transition-base);
}

.territory-item:hover {
  background: var(--surface-secondary);
}

.territory-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.territory-flag {
  font-size: var(--font-size-xl);
}

.territory-stats {
  text-align: right;
}

.territory-percentage {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.financial-summary {
  background: var(--surface-secondary);
  border-radius: var(--radius-md);
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.summary-item {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-sm) 0;
}

.summary-item.total {
  border-top: 2px solid var(--border-subtle);
  margin-top: var(--spacing-sm);
  padding-top: var(--spacing-md);
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
}

.summary-label {
  color: var(--text-secondary);
}

.summary-value {
  color: var(--text-primary);
  font-weight: var(--font-medium);
}

.payment-schedule h4 {
  font-size: var(--font-size-md);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-md);
}

.schedule-items {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.schedule-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.payment-date {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--text-secondary);
}

.payment-amount {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.badge-scheduled {
  background: var(--primary-light);
  color: var(--primary);
}

.badge-paid {
  background: var(--success-light);
  color: var(--success);
}

.api-credentials {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin: var(--spacing-lg) 0;
}

.credential-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.credential-item label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.credential-value {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--surface-secondary);
  border-radius: var(--radius-md);
}

.credential-value code {
  flex: 1;
  font-family: monospace;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.api-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--surface-secondary);
  border-radius: var(--radius-md);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  text-align: center;
}

.stat-item span {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.stat-item strong {
  font-size: var(--font-size-lg);
  color: var(--text-primary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  text-align: center;
  padding: var(--spacing-xl);
}

.empty-state i {
  font-size: 48px;
  color: var(--text-secondary);
  opacity: 0.5;
  margin-bottom: var(--spacing-lg);
}

.empty-state h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-sm);
}

.empty-state p {
  color: var(--text-secondary);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  text-align: center;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--surface-secondary);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--spacing-lg);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-state p {
  color: var(--text-secondary);
}

.btn-sm {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-sm);
}

/* Responsive Design */
@media (max-width: 768px) {
  .selector-row {
    flex-direction: column;
  }
  
  .distributor-info {
    flex-direction: column;
    gap: var(--spacing-lg);
  }
  
  .distributor-meta {
    flex-direction: column;
    gap: var(--spacing-sm);
  }
  
  .metrics-grid {
    grid-template-columns: 1fr;
  }
  
  .release-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
  
  .api-stats {
    grid-template-columns: 1fr;
  }
}
</style>