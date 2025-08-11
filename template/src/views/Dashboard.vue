<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { db } from '../firebase'
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore'

const router = useRouter()
const { userProfile, logout } = useAuth()

// Dashboard data for DSP (streaming platform)
const stats = ref({
  totalTracks: 0,
  activeListeners: 0,
  streamsToday: 0,
  newReleases: 0
})

const recentActivity = ref([])
const topTracks = ref([])
const isLoading = ref(true)

// Computed greeting
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
})

const displayName = computed(() => {
  return userProfile.value?.organizationName || userProfile.value?.displayName || 'Admin'
})

// Load dashboard data
const loadDashboardData = async () => {
  if (!userProfile.value) return
  
  try {
    // Simulate loading real data
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Mock stats for DSP (replace with real Firestore queries)
    stats.value = {
      totalTracks: 45234,
      activeListeners: 1247,
      streamsToday: 89453,
      newReleases: 23
    }
    
    // Mock recent activity for DSP
    recentActivity.value = [
      {
        id: '1',
        type: 'delivery_received',
        title: 'New delivery received',
        description: 'Universal Music - 12 releases',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        status: 'success'
      },
      {
        id: '2',
        type: 'ingestion_complete',
        title: 'Ingestion completed',
        description: '45 tracks processed successfully',
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        status: 'success'
      },
      {
        id: '3',
        type: 'validation_failed',
        title: 'ERN validation failed',
        description: 'Indie Records - Missing ISRC codes',
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
        status: 'error'
      },
      {
        id: '4',
        type: 'catalog_update',
        title: 'Catalog indexed',
        description: '234 new tracks added to search',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        status: 'success'
      }
    ]
    
    // Mock top tracks
    topTracks.value = [
      {
        id: '1',
        title: 'Summer Vibes',
        artist: 'The Wavelengths',
        plays: 12453,
        trend: 'up'
      },
      {
        id: '2',
        title: 'Midnight Dreams',
        artist: 'Luna Park',
        plays: 9832,
        trend: 'up'
      },
      {
        id: '3',
        title: 'Electric Feel',
        artist: 'Neon Lights',
        plays: 8234,
        trend: 'down'
      }
    ]
  } catch (error) {
    console.error('Error loading dashboard data:', error)
  } finally {
    isLoading.value = false
  }
}

// Format timestamp
const formatTime = (date) => {
  const now = new Date()
  const diff = now - date
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)
  
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`
  return date.toLocaleDateString()
}

// Format number with commas
const formatNumber = (num) => {
  return num.toLocaleString()
}

// Get icon for activity type
const getActivityIcon = (type) => {
  switch (type) {
    case 'delivery_received':
      return 'truck'
    case 'ingestion_complete':
      return 'check-circle'
    case 'validation_failed':
      return 'times'
    case 'catalog_update':
      return 'music'
    default:
      return 'compact-disc'
  }
}

// Get color class for status
const getStatusClass = (status) => {
  switch (status) {
    case 'success':
      return 'text-success'
    case 'error':
      return 'text-error'
    case 'warning':
      return 'text-warning'
    default:
      return 'text-info'
  }
}

// Get trend icon
const getTrendIcon = (trend) => {
  return trend === 'up' ? 'chart-line' : 'chart-line'
}

// Quick actions
const navigateToCatalog = () => {
  router.push('/catalog')
}

const navigateToDeliveries = () => {
  router.push('/deliveries')
}

const navigateToAnalytics = () => {
  router.push('/analytics')
}

const navigateToIngestion = () => {
  router.push('/ingestion')
}

const navigateToSettings = () => {
  router.push('/settings')
}

onMounted(() => {
  loadDashboardData()
})
</script>

<template>
  <div class="dashboard">
    <div class="container">
      <!-- Welcome Header -->
      <div class="dashboard-header">
        <div>
          <h1 class="dashboard-title">{{ greeting }}, {{ displayName }}!</h1>
          <p class="dashboard-subtitle">Your streaming platform overview</p>
        </div>
        <div class="header-actions">
          <button @click="navigateToDeliveries" class="btn btn-secondary">
            <font-awesome-icon icon="truck" />
            View Deliveries
          </button>
          <button @click="navigateToAnalytics" class="btn btn-primary">
            <font-awesome-icon icon="chart-line" />
            Analytics
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="loading-container">
        <div class="loading-spinner"></div>
        <p>Loading platform data...</p>
      </div>

      <!-- Dashboard Content -->
      <template v-else>
        <!-- Stats Grid -->
        <div class="stats-grid">
          <div class="stat-card card">
            <div class="card-body">
              <div class="stat-icon">
                <font-awesome-icon icon="music" />
              </div>
              <div class="stat-content">
                <h3 class="stat-value">{{ formatNumber(stats.totalTracks) }}</h3>
                <p class="stat-label">Total Tracks</p>
              </div>
            </div>
          </div>

          <div class="stat-card card">
            <div class="card-body">
              <div class="stat-icon info">
                <font-awesome-icon icon="users" />
              </div>
              <div class="stat-content">
                <h3 class="stat-value">{{ formatNumber(stats.activeListeners) }}</h3>
                <p class="stat-label">Active Listeners</p>
              </div>
            </div>
          </div>

          <div class="stat-card card">
            <div class="card-body">
              <div class="stat-icon success">
                <font-awesome-icon icon="play" />
              </div>
              <div class="stat-content">
                <h3 class="stat-value">{{ formatNumber(stats.streamsToday) }}</h3>
                <p class="stat-label">Streams Today</p>
              </div>
            </div>
          </div>

          <div class="stat-card card">
            <div class="card-body">
              <div class="stat-icon warning">
                <font-awesome-icon icon="plus" />
              </div>
              <div class="stat-content">
                <h3 class="stat-value">{{ stats.newReleases }}</h3>
                <p class="stat-label">New Releases (7d)</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content Grid -->
        <div class="content-grid">
          <!-- Recent Activity -->
          <div class="activity-section">
            <div class="card">
              <div class="card-header">
                <h2 class="section-title">Ingestion Activity</h2>
                <button @click="loadDashboardData" class="btn-icon" title="Refresh">
                  <font-awesome-icon icon="sync" />
                </button>
              </div>
              <div class="card-body">
                <div v-if="recentActivity.length === 0" class="empty-state">
                  <font-awesome-icon icon="compact-disc" class="empty-icon" />
                  <p>No recent deliveries</p>
                  <button @click="navigateToIngestion" class="btn btn-primary btn-sm">
                    Configure Ingestion
                  </button>
                </div>
                <div v-else class="activity-list">
                  <div v-for="activity in recentActivity" :key="activity.id" class="activity-item">
                    <div class="activity-icon" :class="getStatusClass(activity.status)">
                      <font-awesome-icon :icon="getActivityIcon(activity.type)" />
                    </div>
                    <div class="activity-content">
                      <h4 class="activity-title">{{ activity.title }}</h4>
                      <p class="activity-description">{{ activity.description }}</p>
                      <span class="activity-time">{{ formatTime(activity.timestamp) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Top Tracks -->
            <div class="card mt-lg">
              <div class="card-header">
                <h2 class="section-title">Trending Now</h2>
                <router-link to="/analytics" class="view-all-link">View all</router-link>
              </div>
              <div class="card-body">
                <div v-if="topTracks.length === 0" class="empty-state">
                  <p>No streaming data yet</p>
                </div>
                <div v-else class="tracks-list">
                  <div v-for="(track, index) in topTracks" :key="track.id" class="track-item">
                    <span class="track-rank">{{ index + 1 }}</span>
                    <div class="track-info">
                      <h4 class="track-title">{{ track.title }}</h4>
                      <p class="track-artist">{{ track.artist }}</p>
                    </div>
                    <div class="track-stats">
                      <span class="track-plays">{{ formatNumber(track.plays) }}</span>
                      <font-awesome-icon 
                        :icon="getTrendIcon(track.trend)" 
                        :class="track.trend === 'up' ? 'trend-up' : 'trend-down'"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Quick Actions & Info -->
          <div class="quick-actions">
            <div class="card">
              <div class="card-header">
                <h2 class="section-title">Quick Actions</h2>
              </div>
              <div class="card-body">
                <div class="action-grid">
                  <button @click="navigateToCatalog" class="action-button">
                    <font-awesome-icon icon="compact-disc" class="action-icon" />
                    <span>Browse Catalog</span>
                  </button>
                  <button @click="navigateToDeliveries" class="action-button">
                    <font-awesome-icon icon="truck" class="action-icon" />
                    <span>Deliveries</span>
                  </button>
                  <button @click="navigateToAnalytics" class="action-button">
                    <font-awesome-icon icon="chart-line" class="action-icon" />
                    <span>Analytics</span>
                  </button>
                  <button @click="navigateToSettings" class="action-button">
                    <font-awesome-icon icon="cog" class="action-icon" />
                    <span>Settings</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Platform Status -->
            <div class="card">
              <div class="card-header">
                <h2 class="section-title">Platform Status</h2>
              </div>
              <div class="card-body">
                <div class="status-list">
                  <div class="status-item">
                    <div class="status-indicator success"></div>
                    <span class="status-label">Ingestion Pipeline</span>
                    <span class="status-value">Active</span>
                  </div>
                  <div class="status-item">
                    <div class="status-indicator success"></div>
                    <span class="status-label">Streaming CDN</span>
                    <span class="status-value">Healthy</span>
                  </div>
                  <div class="status-item">
                    <div class="status-indicator success"></div>
                    <span class="status-label">Search Index</span>
                    <span class="status-value">Synced</span>
                  </div>
                  <div class="status-item">
                    <div class="status-indicator warning"></div>
                    <span class="status-label">DSR Reports</span>
                    <span class="status-value">Pending</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Getting Started Guide -->
            <div class="card">
              <div class="card-header">
                <h2 class="section-title">Setup Progress</h2>
              </div>
              <div class="card-body">
                <div class="checklist">
                  <div class="checklist-item completed">
                    <font-awesome-icon icon="check-circle" class="check-icon" />
                    <span>Platform deployed</span>
                  </div>
                  <div class="checklist-item completed">
                    <font-awesome-icon icon="check-circle" class="check-icon" />
                    <span>Firebase configured</span>
                  </div>
                  <div class="checklist-item">
                    <font-awesome-icon icon="circle" class="check-icon" />
                    <span>Configure ingestion endpoints</span>
                  </div>
                  <div class="checklist-item">
                    <font-awesome-icon icon="circle" class="check-icon" />
                    <span>Setup CDN for streaming</span>
                  </div>
                  <div class="checklist-item">
                    <font-awesome-icon icon="circle" class="check-icon" />
                    <span>Receive first delivery</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  padding: var(--space-xl) 0;
  min-height: calc(100vh - 64px);
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-xl);
  flex-wrap: wrap;
  gap: var(--space-lg);
}

.dashboard-title {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--color-heading);
  margin-bottom: var(--space-xs);
}

.dashboard-subtitle {
  font-size: var(--text-lg);
  color: var(--color-text-secondary);
}

.header-actions {
  display: flex;
  gap: var(--space-sm);
}

/* Loading State */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-3xl);
  color: var(--color-text-secondary);
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--space-md);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.stat-card .card-body {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  background-color: var(--color-primary-light);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.stat-icon.success {
  background-color: rgba(52, 168, 83, 0.1);
  color: var(--color-success);
}

.stat-icon.warning {
  background-color: rgba(251, 188, 4, 0.1);
  color: var(--color-warning);
}

.stat-icon.error {
  background-color: rgba(234, 67, 53, 0.1);
  color: var(--color-error);
}

.stat-icon.info {
  background-color: rgba(66, 133, 244, 0.1);
  color: var(--color-info);
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--color-heading);
  margin-bottom: var(--space-xs);
}

.stat-label {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

/* Content Grid */
.content-grid {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: var(--space-lg);
}

@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

/* Section Headers */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--color-heading);
}

.view-all-link {
  font-size: var(--text-sm);
  color: var(--color-primary);
  text-decoration: none;
}

.view-all-link:hover {
  text-decoration: underline;
}

.btn-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--transition-base);
}

.btn-icon:hover {
  background-color: var(--color-bg-secondary);
  color: var(--color-text);
}

/* Activity List */
.activity-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.activity-item {
  display: flex;
  gap: var(--space-md);
}

.activity-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background-color: var(--color-bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.activity-content {
  flex: 1;
}

.activity-title {
  font-weight: var(--font-medium);
  color: var(--color-heading);
  margin-bottom: var(--space-xs);
}

.activity-description {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  margin-bottom: var(--space-xs);
}

.activity-time {
  color: var(--color-text-tertiary);
  font-size: var(--text-xs);
}

/* Tracks List */
.tracks-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.track-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) 0;
  border-bottom: 1px solid var(--color-border-light);
}

.track-item:last-child {
  border-bottom: none;
}

.track-rank {
  font-weight: var(--font-bold);
  color: var(--color-text-tertiary);
  width: 20px;
  text-align: center;
}

.track-info {
  flex: 1;
}

.track-title {
  font-weight: var(--font-medium);
  color: var(--color-heading);
  margin-bottom: var(--space-xs);
}

.track-artist {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.track-stats {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.track-plays {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.trend-up {
  color: var(--color-success);
}

.trend-down {
  color: var(--color-error);
}

/* Quick Actions */
.action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

.action-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-base);
  gap: var(--space-sm);
}

.action-button:hover {
  background-color: var(--color-bg);
  border-color: var(--color-primary);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.action-icon {
  font-size: 1.5rem;
  color: var(--color-primary);
}

.action-button span {
  font-weight: var(--font-medium);
  color: var(--color-text);
}

/* Status List */
.status-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.status-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.status-indicator.success {
  background-color: var(--color-success);
}

.status-indicator.warning {
  background-color: var(--color-warning);
  animation: pulse 2s infinite;
}

.status-indicator.error {
  background-color: var(--color-error);
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.status-label {
  flex: 1;
  color: var(--color-text);
  font-size: var(--text-sm);
}

.status-value {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

/* Checklist */
.checklist {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.checklist-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--color-text-secondary);
}

.checklist-item.completed {
  color: var(--color-text);
}

.checklist-item .check-icon {
  color: var(--color-border);
}

.checklist-item.completed .check-icon {
  color: var(--color-success);
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--color-text-secondary);
}

.empty-icon {
  font-size: 3rem;
  color: var(--color-border);
  margin-bottom: var(--space-md);
}

.empty-state p {
  margin-bottom: var(--space-lg);
}

/* Responsive */
@media (max-width: 768px) {
  .dashboard-header {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .header-actions {
    width: 100%;
  }
  
  .header-actions .btn {
    flex: 1;
  }
}
</style>