<!-- src/views/Ingestion.vue -->
<template>
  <div class="ingestion-page">
    <div class="container">
      <div class="page-header">
        <div>
          <h1>Ingestion Pipeline</h1>
          <p class="page-subtitle">Monitor ERN deliveries and processing status</p>
        </div>
        <div class="header-actions">
          <button @click="refreshDeliveries" class="btn btn-secondary">
            <font-awesome-icon icon="sync" :spin="isRefreshing" />
            Refresh
          </button>
          <router-link to="/distributors" class="btn btn-primary">
            <font-awesome-icon icon="cog" />
            Configure Distributors
          </router-link>
        </div>
      </div>

      <!-- Real-time Status -->
      <div class="status-banner" :class="pipelineStatus">
        <div class="status-indicator"></div>
        <div class="status-content">
          <h3>Pipeline Status: {{ pipelineStatusText }}</h3>
          <p>{{ pipelineStatusDescription }}</p>
        </div>
        <div class="status-stats">
          <div class="stat">
            <span class="stat-value">{{ processingCount }}</span>
            <span class="stat-label">Processing</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ queuedCount }}</span>
            <span class="stat-label">Queued</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ todayCount }}</span>
            <span class="stat-label">Today</span>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters card">
        <div class="card-body">
          <div class="filter-row">
            <div class="filter-group">
              <label>Status</label>
              <select v-model="filters.status" @change="applyFilters">
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="parsing">Parsing</option>
                <option value="validating">Validating</option>
                <option value="processing_releases">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div class="filter-group">
              <label>Distributor</label>
              <select v-model="filters.distributor" @change="applyFilters">
                <option value="">All Distributors</option>
                <option v-for="dist in distributors" :key="dist.id" :value="dist.id">
                  {{ dist.name }}
                </option>
              </select>
            </div>
            <div class="filter-group">
              <label>Date Range</label>
              <input type="date" v-model="filters.startDate" @change="applyFilters">
              <span>to</span>
              <input type="date" v-model="filters.endDate" @change="applyFilters">
            </div>
            <div class="filter-group">
              <label>Search</label>
              <input 
                v-model="filters.search" 
                type="text" 
                placeholder="Message ID, Release..."
                @input="applyFilters"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Deliveries Timeline -->
      <div class="deliveries-timeline card">
        <div class="card-header">
          <h2>Recent Deliveries</h2>
          <div class="view-toggle">
            <button 
              @click="viewMode = 'timeline'" 
              class="view-btn"
              :class="{ active: viewMode === 'timeline' }"
            >
              <font-awesome-icon icon="stream" />
              Timeline
            </button>
            <button 
              @click="viewMode = 'table'" 
              class="view-btn"
              :class="{ active: viewMode === 'table' }"
            >
              <font-awesome-icon icon="table" />
              Table
            </button>
          </div>
        </div>
        
        <div class="card-body">
          <div v-if="isLoading" class="loading-state">
            <div class="spinner"></div>
            <p>Loading deliveries...</p>
          </div>
          
          <div v-else-if="deliveries.length === 0" class="empty-state">
            <font-awesome-icon icon="inbox" class="empty-icon" />
            <h3>No Deliveries Yet</h3>
            <p>Waiting for distributors to send content</p>
            <router-link to="/distributors" class="btn btn-primary">
              Configure First Distributor
            </router-link>
          </div>
          
          <!-- Timeline View -->
          <div v-else-if="viewMode === 'timeline'" class="timeline-view">
            <div 
              v-for="delivery in deliveries" 
              :key="delivery.id"
              class="timeline-item"
              @click="viewDeliveryDetails(delivery)"
            >
              <div class="timeline-marker" :class="getStatusClass(delivery.processing.status)">
                <font-awesome-icon :icon="getStatusIcon(delivery.processing.status)" />
              </div>
              
              <div class="timeline-content">
                <div class="timeline-header">
                  <h4>{{ delivery.ern?.messageId || delivery.id }}</h4>
                  <span class="timeline-time">{{ formatRelativeTime(delivery.processing.receivedAt) }}</span>
                </div>
                
                <div class="timeline-details">
                  <div class="detail-item">
                    <font-awesome-icon icon="truck" />
                    <span>{{ getDistributorName(delivery.sender) }}</span>
                  </div>
                  <div class="detail-item">
                    <font-awesome-icon icon="compact-disc" />
                    <span>{{ delivery.ern?.releaseCount || 0 }} releases</span>
                  </div>
                  <div class="detail-item">
                    <span class="status-badge" :class="getStatusClass(delivery.processing.status)">
                      {{ formatStatus(delivery.processing.status) }}
                    </span>
                  </div>
                </div>
                
                <!-- Processing Progress -->
                <div v-if="isProcessing(delivery)" class="processing-progress">
                  <div class="progress-bar">
                    <div class="progress-fill" :style="{ width: getProgress(delivery) + '%' }"></div>
                  </div>
                  <span class="progress-text">{{ getCurrentStep(delivery) }}</span>
                </div>
                
                <!-- Error Display -->
                <div v-if="delivery.processing.error" class="error-message">
                  <font-awesome-icon icon="exclamation-triangle" />
                  {{ delivery.processing.error }}
                </div>
                
                <!-- Success Info -->
                <div v-if="delivery.processing.status === 'completed'" class="success-info">
                  <div class="release-list">
                    <div 
                      v-for="release in delivery.processing.releases" 
                      :key="release.releaseId"
                      class="release-item"
                    >
                      <font-awesome-icon icon="check" />
                      <span>{{ release.title }} - {{ release.artist }}</span>
                      <router-link 
                        :to="`/releases/${release.releaseId}`"
                        class="view-link"
                        @click.stop
                      >
                        View
                      </router-link>
                    </div>
                  </div>
                  <button 
                    v-if="delivery.acknowledgment"
                    @click.stop="downloadAcknowledgment(delivery)"
                    class="btn btn-sm btn-secondary"
                  >
                    <font-awesome-icon icon="download" />
                    Acknowledgment
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Table View -->
          <div v-else class="table-view">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Message ID</th>
                  <th>Distributor</th>
                  <th>Status</th>
                  <th>Releases</th>
                  <th>Received</th>
                  <th>Completed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="delivery in deliveries" :key="delivery.id">
                  <td>
                    <code>{{ delivery.ern?.messageId || delivery.id }}</code>
                  </td>
                  <td>{{ getDistributorName(delivery.sender) }}</td>
                  <td>
                    <span class="status-badge" :class="getStatusClass(delivery.processing.status)">
                      {{ formatStatus(delivery.processing.status) }}
                    </span>
                  </td>
                  <td>{{ delivery.ern?.releaseCount || 0 }}</td>
                  <td>{{ formatDate(delivery.processing.receivedAt) }}</td>
                  <td>{{ formatDate(delivery.processing.completedAt) || '-' }}</td>
                  <td>
                    <div class="action-buttons">
                      <button 
                        @click="viewDeliveryDetails(delivery)"
                        class="btn-icon"
                        title="View Details"
                      >
                        <font-awesome-icon icon="eye" />
                      </button>
                      <button 
                        v-if="canReprocess(delivery)"
                        @click="reprocessDelivery(delivery)"
                        class="btn-icon"
                        title="Reprocess"
                      >
                        <font-awesome-icon icon="redo" />
                      </button>
                      <button 
                        v-if="delivery.acknowledgment"
                        @click="downloadAcknowledgment(delivery)"
                        class="btn-icon"
                        title="Download Acknowledgment"
                      >
                        <font-awesome-icon icon="download" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  onSnapshot,
  updateDoc,
  doc
} from 'firebase/firestore'
import { db } from '../firebase'

const router = useRouter()

// State
const deliveries = ref([])
const distributors = ref([])
const isLoading = ref(false)
const isRefreshing = ref(false)
const viewMode = ref('timeline')
const filters = ref({
  status: '',
  distributor: '',
  startDate: '',
  endDate: '',
  search: ''
})

// Real-time subscription
let unsubscribe = null

// Computed
const pipelineStatus = computed(() => {
  const processing = deliveries.value.filter(d => isProcessing(d)).length
  if (processing > 5) return 'busy'
  if (processing > 0) return 'active'
  return 'idle'
})

const pipelineStatusText = computed(() => {
  const status = pipelineStatus.value
  return status === 'busy' ? 'Busy' : status === 'active' ? 'Active' : 'Idle'
})

const pipelineStatusDescription = computed(() => {
  const status = pipelineStatus.value
  if (status === 'busy') return 'High volume - deliveries may take longer to process'
  if (status === 'active') return 'Processing deliveries normally'
  return 'Ready to receive deliveries'
})

const processingCount = computed(() => 
  deliveries.value.filter(d => isProcessing(d)).length
)

const queuedCount = computed(() => 
  deliveries.value.filter(d => d.processing.status === 'pending').length
)

const todayCount = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return deliveries.value.filter(d => {
    const deliveryDate = d.processing.receivedAt?.toDate?.() || new Date(d.processing.receivedAt)
    return deliveryDate >= today
  }).length
})

// Load deliveries
async function loadDeliveries() {
  isLoading.value = true
  
  try {
    let q = query(
      collection(db, 'deliveries'),
      orderBy('processing.receivedAt', 'desc'),
      limit(50)
    )
    
    // Apply filters
    if (filters.value.status) {
      q = query(q, where('processing.status', '==', filters.value.status))
    }
    if (filters.value.distributor) {
      q = query(q, where('sender', '==', filters.value.distributor))
    }
    
    const snapshot = await getDocs(q)
    deliveries.value = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    
  } catch (error) {
    console.error('Error loading deliveries:', error)
  } finally {
    isLoading.value = false
  }
}

// Load distributors
async function loadDistributors() {
  try {
    const snapshot = await getDocs(collection(db, 'distributors'))
    distributors.value = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  } catch (error) {
    console.error('Error loading distributors:', error)
  }
}

// Refresh deliveries
async function refreshDeliveries() {
  isRefreshing.value = true
  await loadDeliveries()
  setTimeout(() => {
    isRefreshing.value = false
  }, 500)
}

// Apply filters
function applyFilters() {
  loadDeliveries()
}

// View delivery details
function viewDeliveryDetails(delivery) {
  router.push(`/ingestion/${delivery.id}`)
}

// Check if can reprocess
function canReprocess(delivery) {
  return ['failed', 'validation_failed', 'processing_failed'].includes(
    delivery.processing.status
  )
}

// Reprocess delivery
async function reprocessDelivery(delivery) {
  if (!confirm('Reprocess this delivery?')) return
  
  try {
    await updateDoc(doc(db, 'deliveries', delivery.id), {
      'processing.status': 'pending',
      'processing.reprocessedAt': new Date()
    })
    
    await loadDeliveries()
  } catch (error) {
    console.error('Error reprocessing:', error)
  }
}

// Download acknowledgment
async function downloadAcknowledgment(delivery) {
  const url = `https://us-central1-stardust-dsp.cloudfunctions.net/getAcknowledgment?deliveryId=${delivery.id}`
  window.open(url, '_blank')
}

// Utility functions
function isProcessing(delivery) {
  const status = delivery.processing.status
  return ['pending', 'parsing', 'validating', 'processing_releases'].includes(status)
}

function getProgress(delivery) {
  const status = delivery.processing.status
  const steps = {
    'pending': 10,
    'parsing': 30,
    'validating': 50,
    'processing_releases': 75,
    'completed': 100
  }
  return steps[status] || 0
}

function getCurrentStep(delivery) {
  const status = delivery.processing.status
  const steps = {
    'pending': 'Queued for processing...',
    'parsing': 'Parsing ERN XML...',
    'validating': 'Validating with DDEX Workbench...',
    'processing_releases': 'Processing releases and assets...',
    'completed': 'Complete!'
  }
  return steps[status] || 'Unknown'
}

function getStatusClass(status) {
  if (status === 'completed') return 'success'
  if (status.includes('failed')) return 'error'
  if (['parsing', 'validating', 'processing_releases'].includes(status)) return 'processing'
  if (status === 'pending') return 'pending'
  return 'default'
}

function getStatusIcon(status) {
  if (status === 'completed') return 'check-circle'
  if (status.includes('failed')) return 'times-circle'
  if (['parsing', 'validating', 'processing_releases'].includes(status)) return 'spinner'
  if (status === 'pending') return 'clock'
  return 'question-circle'
}

function formatStatus(status) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function getDistributorName(distributorId) {
  const dist = distributors.value.find(d => d.id === distributorId)
  return dist?.name || distributorId
}

function formatDate(timestamp) {
  if (!timestamp) return null
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}

function formatRelativeTime(timestamp) {
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

// Setup real-time updates
function setupRealtimeUpdates() {
  unsubscribe = onSnapshot(
    query(
      collection(db, 'deliveries'),
      orderBy('processing.receivedAt', 'desc'),
      limit(20)
    ),
    (snapshot) => {
      const updates = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      // Update or add deliveries
      updates.forEach(update => {
        const index = deliveries.value.findIndex(d => d.id === update.id)
        if (index >= 0) {
          deliveries.value[index] = update
        } else {
          deliveries.value.unshift(update)
        }
      })
      
      // Keep only the most recent 50
      if (deliveries.value.length > 50) {
        deliveries.value = deliveries.value.slice(0, 50)
      }
    }
  )
}

onMounted(() => {
  loadDeliveries()
  loadDistributors()
  setupRealtimeUpdates()
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})
</script>

<style scoped>
/* Page Layout */
.ingestion-page {
  padding: var(--space-xl);
  min-height: calc(100vh - 64px);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-xl);
}

.page-header h1 {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  margin-bottom: var(--space-xs);
}

.page-subtitle {
  color: var(--color-text-secondary);
  font-size: var(--text-lg);
}

.header-actions {
  display: flex;
  gap: var(--space-sm);
}

/* Status Banner */
.status-banner {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-lg);
  background: linear-gradient(135deg, var(--color-bg-secondary) 0%, var(--color-bg) 100%);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-xl);
  border: 1px solid var(--color-border);
}

.status-banner.active {
  background: linear-gradient(135deg, var(--color-info) 0%, var(--color-primary) 100%);
  color: white;
}

.status-banner.busy {
  background: linear-gradient(135deg, var(--color-warning) 0%, var(--color-error) 100%);
  color: white;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full);
  background-color: var(--color-text-tertiary);
  animation: pulse 2s infinite;
}

.status-banner.active .status-indicator {
  background-color: white;
  animation: pulse 1s infinite;
}

.status-banner.busy .status-indicator {
  background-color: white;
  animation: pulse 0.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.status-content {
  flex: 1;
}

.status-content h3 {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-xs);
}

.status-content p {
  font-size: var(--text-sm);
  opacity: 0.9;
}

.status-stats {
  display: flex;
  gap: var(--space-xl);
}

.status-stats .stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
}

.stat-label {
  font-size: var(--text-sm);
  opacity: 0.8;
}

/* Filters */
.filter-row {
  display: flex;
  gap: var(--space-lg);
  align-items: end;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  flex: 1;
  min-width: 150px;
}

.filter-group label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

.filter-group select,
.filter-group input {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-surface);
}

/* View Toggle */
.view-toggle {
  display: flex;
  gap: var(--space-xs);
  background-color: var(--color-bg-secondary);
  padding: var(--space-xs);
  border-radius: var(--radius-md);
}

.view-btn {
  padding: var(--space-xs) var(--space-sm);
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-base);
}

.view-btn:hover {
  background-color: var(--color-bg);
}

.view-btn.active {
  background-color: var(--color-surface);
  color: var(--color-primary);
  box-shadow: var(--shadow-sm);
}

/* Timeline View */
.timeline-view {
  position: relative;
  padding-left: var(--space-xl);
}

.timeline-view::before {
  content: '';
  position: absolute;
  left: 20px;
  top: 0;
  bottom: 0;
  width: 2px;
  background-color: var(--color-border);
}

.timeline-item {
  position: relative;
  padding-bottom: var(--space-xl);
  cursor: pointer;
}

.timeline-marker {
  position: absolute;
  left: -28px;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background-color: var(--color-surface);
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.timeline-marker.success {
  background-color: var(--color-success);
  border-color: var(--color-success);
  color: white;
}

.timeline-marker.error {
  background-color: var(--color-error);
  border-color: var(--color-error);
  color: white;
}

.timeline-marker.processing {
  background-color: var(--color-info);
  border-color: var(--color-info);
  color: white;
}

.timeline-marker.processing svg {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.timeline-content {
  margin-left: var(--space-lg);
  padding: var(--space-lg);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: all var(--transition-base);
}

.timeline-item:hover .timeline-content {
  box-shadow: var(--shadow-md);
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.timeline-header h4 {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--color-heading);
}

.timeline-time {
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}

.timeline-details {
  display: flex;
  gap: var(--space-lg);
  margin-bottom: var(--space-md);
}

.detail-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

/* Processing Progress */
.processing-progress {
  margin-top: var(--space-md);
}

.progress-bar {
  height: 6px;
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: var(--space-xs);
}

.progress-fill {
  height: 100%;
  background-color: var(--color-primary);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

/* Error Message */
.error-message {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  background-color: rgba(234, 67, 53, 0.1);
  border-radius: var(--radius-md);
  color: var(--color-error);
  font-size: var(--text-sm);
  margin-top: var(--space-md);
}

/* Success Info */
.success-info {
  margin-top: var(--space-md);
}

.release-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.release-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs);
  font-size: var(--text-sm);
}

.release-item svg {
  color: var(--color-success);
  flex-shrink: 0;
}

.view-link {
  margin-left: auto;
  color: var(--color-primary);
  text-decoration: none;
  font-weight: var(--font-medium);
}

.view-link:hover {
  text-decoration: underline;
}

/* Table View */
.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  text-align: left;
  padding: var(--space-sm);
  border-bottom: 2px solid var(--color-border);
  font-weight: var(--font-semibold);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.data-table td {
  padding: var(--space-md) var(--space-sm);
  border-bottom: 1px solid var(--color-border-light);
}

.data-table code {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  background-color: var(--color-bg-secondary);
  padding: var(--space-xs);
  border-radius: var(--radius-sm);
}

/* Status Badge */
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  text-transform: uppercase;
}

.status-badge.success {
  background-color: var(--color-success);
  color: white;
}

.status-badge.error {
  background-color: var(--color-error);
  color: white;
}

.status-badge.processing {
  background-color: var(--color-info);
  color: white;
}

.status-badge.pending {
  background-color: var(--color-warning);
  color: white;
}

.status-badge.default {
  background-color: var(--color-text-tertiary);
  color: white;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: var(--space-xs);
}

.btn-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background-color: var(--color-surface);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-base);
}

.btn-icon:hover {
  background-color: var(--color-bg-secondary);
  color: var(--color-text);
}

/* Loading & Empty States */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-3xl);
  color: var(--color-text-secondary);
}

.empty-state {
  text-align: center;
  padding: var(--space-3xl);
  color: var(--color-text-secondary);
}

.empty-icon {
  font-size: 4rem;
  color: var(--color-border);
  margin-bottom: var(--space-lg);
}

.spinner {
  width: 48px;
  height: 48px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--space-md);
}

/* Responsive */
@media (max-width: 768px) {
  .ingestion-page {
    padding: var(--space-md);
  }
  
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-md);
  }
  
  .status-banner {
    flex-direction: column;
    text-align: center;
  }
  
  .status-stats {
    width: 100%;
    justify-content: space-around;
  }
  
  .filter-row {
    flex-direction: column;
  }
  
  .filter-group {
    width: 100%;
  }
  
  .timeline-details {
    flex-direction: column;
    gap: var(--space-sm);
  }
  
  .data-table {
    font-size: var(--text-sm);
  }
  
  .data-table th,
  .data-table td {
    padding: var(--space-xs);
  }
}
</style>