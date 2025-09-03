<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useDualAuth'
import { db } from '@/firebase'
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  limit,
  onSnapshot,
  Timestamp
} from 'firebase/firestore'

const router = useRouter()
const { userProfile } = useAuth()

// State
const stats = ref({
  totalReleases: 0,
  totalTracks: 0,
  totalDeliveries: 0,
  activeDistributors: 0,
  releasesChange: 0,
  tracksChange: 0,
  successRate: 0,
  pendingDeliveries: 0
})

const recentActivity = ref([])
const recentReleases = ref([])
const topDistributors = ref([])
const pipelineStatus = ref({
  ingestion: 'success',
  validation: 'success',
  storage: 'success',
  catalog: 'success'
})
const systemHealth = ref({
  uptime: '99.9%',
  responseTime: 145,
  storageUsed: '2.3 GB',
  lastBackup: '2 hours ago'
})

const isLoading = ref(true)
const isRefreshing = ref(false)

// Subscriptions
let activityUnsubscribe = null

// Computed
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
async function loadDashboardData() {
  try {
    // Load stats
    await loadStats()
    
    // Load recent releases
    await loadRecentReleases()
    
    // Load top distributors
    await loadTopDistributors()
    
    // Setup real-time activity monitoring
    setupActivityMonitoring()
    
    // Check pipeline status
    await checkPipelineStatus()
    
  } catch (error) {
    console.error('Error loading dashboard data:', error)
  } finally {
    isLoading.value = false
  }
}

// Load platform statistics
async function loadStats() {
  try {
    // Count releases
    const releasesSnapshot = await getDocs(
      query(collection(db, 'releases'), where('status', '==', 'active'))
    )
    stats.value.totalReleases = releasesSnapshot.size
    
    // Count tracks
    const tracksSnapshot = await getDocs(collection(db, 'tracks'))
    stats.value.totalTracks = tracksSnapshot.size
    
    // Count deliveries
    const deliveriesSnapshot = await getDocs(collection(db, 'deliveries'))
    stats.value.totalDeliveries = deliveriesSnapshot.size
    
    // Count successful deliveries
    const successfulDeliveries = deliveriesSnapshot.docs.filter(doc => {
      const data = doc.data()
      return data.processing?.status === 'completed'
    }).length
    
    stats.value.successRate = deliveriesSnapshot.size > 0 
      ? Math.round((successfulDeliveries / deliveriesSnapshot.size) * 100)
      : 100
    
    // Count pending deliveries
    stats.value.pendingDeliveries = deliveriesSnapshot.docs.filter(doc => {
      const data = doc.data()
      const status = data.processing?.status
      return ['received', 'pending', 'parsing', 'validating', 'processing_releases'].includes(status)
    }).length
    
    // Count active distributors
    const distributorsSnapshot = await getDocs(
      query(collection(db, 'distributors'), where('active', '==', true))
    )
    stats.value.activeDistributors = distributorsSnapshot.size
    
    // Calculate weekly changes
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    
    // Releases this week
    const recentReleasesSnapshot = await getDocs(
      query(
        collection(db, 'releases'),
        where('createdAt', '>=', Timestamp.fromDate(oneWeekAgo))
      )
    )
    stats.value.releasesChange = recentReleasesSnapshot.size
    
    // Tracks this week
    const recentTracksSnapshot = await getDocs(
      query(
        collection(db, 'tracks'),
        where('createdAt', '>=', Timestamp.fromDate(oneWeekAgo))
      )
    )
    stats.value.tracksChange = recentTracksSnapshot.size
    
  } catch (error) {
    console.error('Error loading stats:', error)
  }
}

// Load recent releases
async function loadRecentReleases() {
  try {
    const q = query(
      collection(db, 'releases'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(5)
    )
    
    const snapshot = await getDocs(q)
    recentReleases.value = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    
    // Get track counts for each release
    for (const release of recentReleases.value) {
      const tracksSnapshot = await getDocs(
        query(collection(db, 'tracks'), where('releaseId', '==', release.id))
      )
      release.trackCount = tracksSnapshot.size
    }
    
  } catch (error) {
    console.error('Error loading recent releases:', error)
  }
}

// Load top distributors
async function loadTopDistributors() {
  try {
    const distributorsSnapshot = await getDocs(collection(db, 'distributors'))
    const distributorStats = []
    
    for (const doc of distributorsSnapshot.docs) {
      const distributor = { id: doc.id, ...doc.data() }
      
      // Count deliveries for this distributor
      const deliveriesSnapshot = await getDocs(
        query(collection(db, 'deliveries'), where('sender', '==', doc.id))
      )
      
      const deliveryCount = deliveriesSnapshot.size
      const successCount = deliveriesSnapshot.docs.filter(d => 
        d.data().processing?.status === 'completed'
      ).length
      
      if (deliveryCount > 0) {
        distributorStats.push({
          id: doc.id,
          name: distributor.name,
          deliveryCount,
          successRate: Math.round((successCount / deliveryCount) * 100)
        })
      }
    }
    
    // Sort by delivery count and take top 5
    topDistributors.value = distributorStats
      .sort((a, b) => b.deliveryCount - a.deliveryCount)
      .slice(0, 5)
    
  } catch (error) {
    console.error('Error loading top distributors:', error)
  }
}

// Setup real-time activity monitoring
function setupActivityMonitoring() {
  // Unsubscribe from previous listener if exists
  if (activityUnsubscribe) activityUnsubscribe()
  
  // Listen to recent deliveries
  const q = query(
    collection(db, 'deliveries'),
    orderBy('createdAt', 'desc'),
    limit(10)
  )
  
  activityUnsubscribe = onSnapshot(q, (snapshot) => {
    const activities = []
    
    snapshot.docs.forEach(doc => {
      const data = doc.data()
      const status = data.processing?.status || data.status
      
      activities.push({
        id: doc.id,
        deliveryId: doc.id,
        title: getActivityTitle(status),
        description: getActivityDescription(data),
        timestamp: data.processing?.receivedAt || data.createdAt,
        status: getActivityStatus(status)
      })
    })
    
    recentActivity.value = activities
  })
}

// Check pipeline status
async function checkPipelineStatus() {
  try {
    // Check for recent failures
    const failedDeliveries = await getDocs(
      query(
        collection(db, 'deliveries'),
        where('processing.status', 'in', ['failed', 'validation_failed', 'error']),
        limit(1)
      )
    )
    
    if (failedDeliveries.size > 0) {
      pipelineStatus.value.validation = 'warning'
    }
    
    // Check for stuck deliveries (older than 1 hour and still processing)
    const oneHourAgo = new Date()
    oneHourAgo.setHours(oneHourAgo.getHours() - 1)
    
    const stuckDeliveries = await getDocs(
      query(
        collection(db, 'deliveries'),
        where('processing.status', 'in', ['parsing', 'validating', 'processing_releases']),
        where('createdAt', '<', Timestamp.fromDate(oneHourAgo)),
        limit(1)
      )
    )
    
    if (stuckDeliveries.size > 0) {
      pipelineStatus.value.ingestion = 'warning'
    }
    
  } catch (error) {
    console.error('Error checking pipeline status:', error)
    pipelineStatus.value.ingestion = 'error'
  }
}

// Refresh data
async function refreshData() {
  isRefreshing.value = true
  await loadDashboardData()
  setTimeout(() => {
    isRefreshing.value = false
  }, 500)
}

// Test delivery
function testDelivery() {
  router.push('/ingestion')
  // TODO: Could trigger a test delivery here
}

// Helper functions
function getActivityTitle(status) {
  switch (status) {
    case 'completed': return 'Delivery completed'
    case 'processing_releases': return 'Processing releases'
    case 'validating': return 'Validating ERN'
    case 'parsing': return 'Parsing delivery'
    case 'failed': return 'Delivery failed'
    case 'received': return 'Delivery received'
    default: return 'Delivery update'
  }
}

function getActivityDescription(delivery) {
  const distributor = delivery.senderName || delivery.sender || 'Unknown'
  const releases = delivery.ern?.releaseCount || delivery.processing?.releases?.length || 0
  return `${distributor} - ${releases} release${releases !== 1 ? 's' : ''}`
}

function getActivityStatus(status) {
  if (status === 'completed') return 'success'
  if (status?.includes('failed') || status === 'error') return 'error'
  if (['parsing', 'validating', 'processing_releases'].includes(status)) return 'processing'
  return 'pending'
}

function getActivityIcon(status) {
  switch (status) {
    case 'success': return 'check-circle'
    case 'error': return 'times-circle'
    case 'processing': return 'spinner'
    default: return 'clock'
  }
}

function getStatusClass(status) {
  return `text-${status}`
}

function getPipelineStatusText(component) {
  const status = pipelineStatus.value[component]
  if (status === 'success') return 'Healthy'
  if (status === 'warning') return 'Warning'
  if (status === 'error') return 'Error'
  return 'Unknown'
}

function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  const now = new Date()
  const diff = now - date
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function formatDate(date) {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatNumber(num) {
  return num.toLocaleString()
}

function handleImageError(e) {
  e.target.src = '/placeholder-album.png'
}

onMounted(() => {
  loadDashboardData()
})

onUnmounted(() => {
  if (activityUnsubscribe) activityUnsubscribe()
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
          <button @click="refreshData" class="btn btn-secondary">
            <font-awesome-icon icon="sync" :spin="isRefreshing" />
            Refresh
          </button>
          <router-link to="/ingestion" class="btn btn-primary">
            <font-awesome-icon icon="inbox" />
            Ingestion Pipeline
          </router-link>
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
                <font-awesome-icon icon="compact-disc" />
              </div>
              <div class="stat-content">
                <h3 class="stat-value">{{ formatNumber(stats.totalReleases) }}</h3>
                <p class="stat-label">Total Releases</p>
                <span class="stat-change" :class="stats.releasesChange >= 0 ? 'positive' : 'negative'">
                  <font-awesome-icon :icon="stats.releasesChange >= 0 ? 'arrow-up' : 'arrow-down'" />
                  {{ Math.abs(stats.releasesChange) }} this week
                </span>
              </div>
            </div>
          </div>

          <div class="stat-card card">
            <div class="card-body">
              <div class="stat-icon info">
                <font-awesome-icon icon="music" />
              </div>
              <div class="stat-content">
                <h3 class="stat-value">{{ formatNumber(stats.totalTracks) }}</h3>
                <p class="stat-label">Total Tracks</p>
                <span class="stat-change" :class="stats.tracksChange >= 0 ? 'positive' : 'negative'">
                  <font-awesome-icon :icon="stats.tracksChange >= 0 ? 'arrow-up' : 'arrow-down'" />
                  {{ Math.abs(stats.tracksChange) }} this week
                </span>
              </div>
            </div>
          </div>

          <div class="stat-card card">
            <div class="card-body">
              <div class="stat-icon success">
                <font-awesome-icon icon="truck" />
              </div>
              <div class="stat-content">
                <h3 class="stat-value">{{ formatNumber(stats.totalDeliveries) }}</h3>
                <p class="stat-label">Total Deliveries</p>
                <span class="stat-change">
                  {{ stats.successRate }}% success rate
                </span>
              </div>
            </div>
          </div>

          <div class="stat-card card">
            <div class="card-body">
              <div class="stat-icon warning">
                <font-awesome-icon icon="building" />
              </div>
              <div class="stat-content">
                <h3 class="stat-value">{{ stats.activeDistributors }}</h3>
                <p class="stat-label">Active Distributors</p>
                <span class="stat-change">
                  {{ stats.pendingDeliveries }} pending
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content Grid -->
        <div class="content-grid">
          <!-- Recent Ingestion Activity -->
          <div class="activity-section">
            <div class="card">
              <div class="card-header">
                <h2 class="section-title">Recent Ingestion Activity</h2>
                <router-link to="/ingestion" class="view-all-link">View all</router-link>
              </div>
              <div class="card-body">
                <div v-if="recentActivity.length === 0" class="empty-state">
                  <font-awesome-icon icon="inbox" class="empty-icon" />
                  <p>No recent deliveries</p>
                  <router-link to="/distributors" class="btn btn-primary btn-sm">
                    Configure Distributors
                  </router-link>
                </div>
                <div v-else class="activity-list">
                  <div v-for="activity in recentActivity" :key="activity.id" class="activity-item">
                    <div class="activity-icon" :class="getStatusClass(activity.status)">
                      <font-awesome-icon :icon="getActivityIcon(activity.status)" />
                    </div>
                    <div class="activity-content">
                      <h4 class="activity-title">{{ activity.title }}</h4>
                      <p class="activity-description">{{ activity.description }}</p>
                      <span class="activity-time">{{ formatTime(activity.timestamp) }}</span>
                    </div>
                    <router-link 
                      v-if="activity.deliveryId" 
                      :to="`/ingestion/${activity.deliveryId}`"
                      class="activity-link"
                    >
                      <font-awesome-icon icon="arrow-right" />
                    </router-link>
                  </div>
                </div>
              </div>
            </div>

            <!-- Recent Releases -->
            <div class="card mt-lg">
              <div class="card-header">
                <h2 class="section-title">Latest Releases</h2>
                <router-link to="/catalog" class="view-all-link">Browse catalog</router-link>
              </div>
              <div class="card-body">
                <div v-if="recentReleases.length === 0" class="empty-state">
                  <p>No releases yet</p>
                </div>
                <div v-else class="releases-list">
                  <div v-for="release in recentReleases" :key="release.id" class="release-item">
                    <img 
                      :src="release.artworkUrl || '/placeholder-album.png'" 
                      :alt="release.title"
                      class="release-thumb"
                      @error="handleImageError"
                    />
                    <div class="release-info">
                      <h4 class="release-title">{{ release.title }}</h4>
                      <p class="release-artist">{{ release.artistName }}</p>
                      <span class="release-date">{{ formatDate(release.releaseDate) }}</span>
                    </div>
                    <div class="release-meta">
                      <span class="track-count">{{ release.trackCount || 0 }} tracks</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Side Panel -->
          <div class="side-panel">
            <!-- Quick Actions -->
            <div class="card">
              <div class="card-header">
                <h2 class="section-title">Quick Actions</h2>
              </div>
              <div class="card-body">
                <div class="action-grid">
                  <router-link to="/catalog" class="action-button">
                    <font-awesome-icon icon="compact-disc" class="action-icon" />
                    <span>Browse Catalog</span>
                  </router-link>
                  <router-link to="/ingestion" class="action-button">
                    <font-awesome-icon icon="inbox" class="action-icon" />
                    <span>Ingestion</span>
                  </router-link>
                  <router-link to="/distributors" class="action-button">
                    <font-awesome-icon icon="building" class="action-icon" />
                    <span>Distributors</span>
                  </router-link>
                  <button @click="testDelivery" class="action-button">
                    <font-awesome-icon icon="flask" class="action-icon" />
                    <span>Test Delivery</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Pipeline Status -->
            <div class="card">
              <div class="card-header">
                <h2 class="section-title">Pipeline Status</h2>
              </div>
              <div class="card-body">
                <div class="status-list">
                  <div class="status-item">
                    <div class="status-indicator" :class="pipelineStatus.ingestion"></div>
                    <span class="status-label">Ingestion Pipeline</span>
                    <span class="status-value">{{ getPipelineStatusText('ingestion') }}</span>
                  </div>
                  <div class="status-item">
                    <div class="status-indicator" :class="pipelineStatus.validation"></div>
                    <span class="status-label">DDEX Validation</span>
                    <span class="status-value">{{ getPipelineStatusText('validation') }}</span>
                  </div>
                  <div class="status-item">
                    <div class="status-indicator" :class="pipelineStatus.storage"></div>
                    <span class="status-label">Cloud Storage</span>
                    <span class="status-value">{{ getPipelineStatusText('storage') }}</span>
                  </div>
                  <div class="status-item">
                    <div class="status-indicator" :class="pipelineStatus.catalog"></div>
                    <span class="status-label">Catalog Index</span>
                    <span class="status-value">{{ getPipelineStatusText('catalog') }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Top Distributors -->
            <div class="card">
              <div class="card-header">
                <h2 class="section-title">Top Distributors</h2>
              </div>
              <div class="card-body">
                <div v-if="topDistributors.length === 0" class="empty-state">
                  <p>No distributor activity yet</p>
                </div>
                <div v-else class="distributor-list">
                  <div v-for="dist in topDistributors" :key="dist.id" class="distributor-item">
                    <div class="distributor-info">
                      <h4>{{ dist.name }}</h4>
                      <p>{{ dist.deliveryCount }} deliveries</p>
                    </div>
                    <div class="distributor-stats">
                      <span class="success-rate" :class="dist.successRate >= 90 ? 'high' : 'medium'">
                        {{ dist.successRate }}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- System Health -->
            <div class="card">
              <div class="card-header">
                <h2 class="section-title">System Health</h2>
              </div>
              <div class="card-body">
                <div class="health-metrics">
                  <div class="metric">
                    <span class="metric-label">Uptime</span>
                    <span class="metric-value">{{ systemHealth.uptime }}</span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Response Time</span>
                    <span class="metric-value">{{ systemHealth.responseTime }}ms</span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Storage Used</span>
                    <span class="metric-value">{{ systemHealth.storageUsed }}</span>
                  </div>
                  <div class="metric">
                    <span class="metric-label">Last Backup</span>
                    <span class="metric-value">{{ systemHealth.lastBackup }}</span>
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
  margin-bottom: var(--space-xs);
}

.stat-change {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.stat-change.positive {
  color: var(--color-success);
}

.stat-change.negative {
  color: var(--color-error);
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

/* Activity List */
.activity-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.activity-item {
  display: flex;
  gap: var(--space-md);
  align-items: center;
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

.activity-icon svg {
  animation: spin 1s linear infinite;
}

.text-success { color: var(--color-success); }
.text-error { color: var(--color-error); }
.text-processing { color: var(--color-info); }
.text-pending { color: var(--color-warning); }

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

.activity-link {
  color: var(--color-primary);
  text-decoration: none;
  padding: var(--space-xs);
}

/* Releases List */
.releases-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.release-item {
  display: flex;
  gap: var(--space-md);
  align-items: center;
}

.release-thumb {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  object-fit: cover;
  flex-shrink: 0;
}

.release-info {
  flex: 1;
}

.release-title {
  font-weight: var(--font-medium);
  color: var(--color-heading);
  margin-bottom: 2px;
  font-size: var(--text-sm);
}

.release-artist {
  color: var(--color-text-secondary);
  font-size: var(--text-xs);
  margin-bottom: 2px;
}

.release-date {
  color: var(--color-text-tertiary);
  font-size: var(--text-xs);
}

.release-meta {
  text-align: right;
}

.track-count {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
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
  text-decoration: none;
  color: var(--color-text);
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
  font-size: var(--text-sm);
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

/* Distributor List */
.distributor-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.distributor-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.distributor-info h4 {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  margin-bottom: 2px;
}

.distributor-info p {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.success-rate {
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.success-rate.high {
  background-color: rgba(52, 168, 83, 0.1);
  color: var(--color-success);
}

.success-rate.medium {
  background-color: rgba(251, 188, 4, 0.1);
  color: var(--color-warning);
}

/* Health Metrics */
.health-metrics {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

.metric {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.metric-label {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.metric-value {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text);
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-text-secondary);
}

.empty-icon {
  font-size: 2rem;
  color: var(--color-border);
  margin-bottom: var(--space-md);
}

.empty-state p {
  margin-bottom: var(--space-md);
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
  
  .action-grid {
    grid-template-columns: 1fr;
  }
  
  .health-metrics {
    grid-template-columns: 1fr;
  }
}
</style>