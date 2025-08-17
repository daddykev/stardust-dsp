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
            <span class="stat-value">{{ fileTransferStatus }}</span>
            <span class="stat-label">Transferring</span>
          </div>
          <div class="stat">
            <span class="stat-value">{{ todayCount }}</span>
            <span class="stat-label">Today</span>
          </div>
        </div>
      </div>

      <!-- Debug Info (remove in production) -->
      <div v-if="debugMode" class="debug-info card">
        <div class="card-body">
          <h3>Debug Information</h3>
          <p>Total deliveries found: {{ deliveries.length }}</p>
          <p>Total distributors found: {{ distributors.length }}</p>
          <p>Files transferring: {{ fileTransferStatus }}</p>
          <p>Last query error: {{ lastError || 'None' }}</p>
          <button @click="testCreateDelivery" class="btn btn-warning btn-sm">
            Create Test Delivery
          </button>
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
                <option value="received">Received</option>
                <option value="pending">Pending</option>
                <option value="waiting_for_files">Transferring Files</option>
                <option value="files_ready">Files Ready</option>  <!-- Add this -->
                <option value="parsing">Parsing</option>
                <option value="validating">Validating</option>
                <option value="processing_releases">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>  <!-- Add this -->
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

      <!-- Active File Transfers Monitor -->
      <div v-if="fileTransferStatus > 0" class="file-transfers-monitor card">
        <div class="card-header">
          <h2>Active File Transfers</h2>
          <div class="transfer-count">
            <font-awesome-icon icon="cloud-download-alt" spin />
            {{ fileTransferStatus }} active transfers
          </div>
        </div>
        <div class="card-body">
          <div v-for="delivery in deliveries.filter(d => d.processing?.status === 'waiting_for_files')" 
               :key="delivery.id"
               class="transfer-item">
            <div class="transfer-info">
              <h4>{{ delivery.releaseTitle || 'Unknown Release' }}</h4>
              <p>{{ getDistributorName(delivery.sender) }}</p>
            </div>
            <div class="transfer-stats">
              <span v-if="delivery.audioFiles">
                Audio: {{ delivery.files?.audioCount || 0 }}/{{ delivery.audioFiles?.length || 0 }}
              </span>
              <span v-if="delivery.imageFiles">
                Images: {{ delivery.files?.imageCount || 0 }}/{{ delivery.imageFiles?.length || 0 }}
              </span>
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
            <p v-if="distributors.length === 0" class="text-warning">
              No distributors configured yet!
            </p>
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
              <div class="timeline-marker" :class="getStatusClass(delivery.processing?.status || delivery.status)">
                <font-awesome-icon :icon="getStatusIcon(delivery.processing?.status || delivery.status)" />
              </div>
              
              <div class="timeline-content">
                <div class="timeline-header">
                  <h4>{{ getMessageId(delivery) }}</h4>
                  <span class="timeline-time">{{ formatRelativeTime(getReceivedAt(delivery)) }}</span>
                </div>
                
                <div class="timeline-details">
                  <div class="detail-item">
                    <font-awesome-icon icon="truck" />
                    <span>{{ getDistributorName(delivery.sender) }}</span>
                  </div>
                  <div class="detail-item">
                    <font-awesome-icon icon="compact-disc" />
                    <span>{{ getReleaseCount(delivery) }} releases</span>
                  </div>
                  <div v-if="delivery.audioFiles?.length || delivery.imageFiles?.length || delivery.files" class="detail-item">
                    <font-awesome-icon icon="file" />
                    <span>
                      {{ delivery.files?.audioCount || delivery.audioFiles?.length || 0 }} audio, 
                      {{ delivery.files?.imageCount || delivery.imageFiles?.length || 0 }} image files
                    </span>
                  </div>
                  <div class="detail-item">
                    <span class="status-badge" :class="getStatusClass(delivery.processing?.status || delivery.status)">
                      {{ formatStatus(delivery.processing?.status || delivery.status) }}
                    </span>
                  </div>
                </div>
                
                <!-- File Transfer Status -->
                <div v-if="delivery.processing?.status === 'waiting_for_files'" class="file-transfer-status">
                  <div class="transfer-progress">
                    <font-awesome-icon icon="cloud-download-alt" class="transfer-icon" />
                    <span class="transfer-text">
                      Transferring files from distributor...
                      <span v-if="delivery.files">
                        ({{ delivery.files.audioCount || 0 }}/{{ delivery.audioFiles?.length || 0 }} audio, 
                        {{ delivery.files.imageCount || 0 }}/{{ delivery.imageFiles?.length || 0 }} images)
                      </span>
                    </span>
                  </div>
                </div>
                
                <!-- Transferred Files Info -->
                <div v-if="delivery.files?.transferredAt && delivery.processing?.status !== 'waiting_for_files'" class="transferred-files-info">
                  <div class="files-summary">
                    <font-awesome-icon icon="check" class="success-icon" />
                    <span>{{ delivery.files.audioCount + delivery.files.imageCount }} files transferred</span>
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
                <div v-if="delivery.processing?.error" class="error-message">
                  <font-awesome-icon icon="exclamation-triangle" />
                  {{ delivery.processing.error }}
                </div>
                
                <!-- Success Info -->
                <div v-if="(delivery.processing?.status || delivery.status) === 'completed'" class="success-info">
                  <div v-if="delivery.processing?.releases" class="release-list">
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
                  <th>Files</th>
                  <th>Releases</th>
                  <th>Received</th>
                  <th>Completed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="delivery in deliveries" :key="delivery.id">
                  <td>
                    <code>{{ getMessageId(delivery) }}</code>
                  </td>
                  <td>{{ getDistributorName(delivery.sender) }}</td>
                  <td>
                    <span class="status-badge" :class="getStatusClass(delivery.processing?.status || delivery.status)">
                      {{ formatStatus(delivery.processing?.status || delivery.status) }}
                    </span>
                  </td>
                  <td>
                    <span v-if="delivery.files?.transferredAt" class="files-badge success">
                      <font-awesome-icon icon="check-circle" />
                      {{ delivery.files.audioCount + delivery.files.imageCount }} files
                    </span>
                    <span v-else-if="delivery.processing?.status === 'waiting_for_files'" class="files-badge transferring">
                      <font-awesome-icon icon="cloud-download-alt" spin />
                      Transferring...
                    </span>
                    <span v-else-if="delivery.audioFiles?.length || delivery.imageFiles?.length" class="files-badge pending">
                      {{ (delivery.audioFiles?.length || 0) + (delivery.imageFiles?.length || 0) }} files
                    </span>
                    <span v-else class="files-badge">
                      No files
                    </span>
                  </td>
                  <td>{{ getReleaseCount(delivery) }}</td>
                  <td>{{ formatDate(getReceivedAt(delivery)) }}</td>
                  <td>{{ formatDate(delivery.processing?.completedAt) || '-' }}</td>
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
  doc,
  addDoc,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '../firebase'

const router = useRouter()

// State
const deliveries = ref([])
const distributors = ref([])
const isLoading = ref(false)
const isRefreshing = ref(false)
const viewMode = ref('timeline')
const debugMode = ref(true) // Set to false in production
const lastError = ref(null)
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
  const transferring = deliveries.value.filter(d => 
    d.processing?.status === 'waiting_for_files'
  ).length
  
  if (processing > 5 || transferring > 3) return 'busy'
  if (processing > 0 || transferring > 0) return 'active'
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

const fileTransferStatus = computed(() => {
  return deliveries.value.filter(d => 
    d.processing?.status === 'waiting_for_files'
  ).length
})

const processingCount = computed(() => 
  deliveries.value.filter(d => 
    isProcessing(d) && d.processing?.status !== 'waiting_for_files'
  ).length
)

const queuedCount = computed(() => 
  deliveries.value.filter(d => {
    const status = d.processing?.status || d.status
    return status === 'pending' || status === 'received'
  }).length
)

const todayCount = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return deliveries.value.filter(d => {
    const receivedAt = getReceivedAt(d)
    if (!receivedAt) return false
    const deliveryDate = receivedAt.toDate?.() || new Date(receivedAt)
    return deliveryDate >= today
  }).length
})

// Helper functions for flexible data structure
function getMessageId(delivery) {
  return delivery.ern?.messageId || delivery.messageId || delivery.id
}

function getReleaseCount(delivery) {
  return delivery.ern?.releaseCount || delivery.releaseCount || 0
}

function getReceivedAt(delivery) {
  return delivery.processing?.receivedAt || delivery.receivedAt || delivery.createdAt
}

function getStatus(delivery) {
  // Check for file transfer status first
  if (delivery.processing?.status === 'waiting_for_files') {
    return 'waiting_for_files'
  }
  return delivery.processing?.status || delivery.status || 'unknown'
}

// Load deliveries with better error handling
async function loadDeliveries() {
  isLoading.value = true
  lastError.value = null
  
  try {
    console.log('Loading deliveries...')
    
    // First, try a simple query without complex ordering
    let q = query(
      collection(db, 'deliveries'),
      limit(50)
    )
    
    // Apply filters if set
    if (filters.value.status) {
      q = query(q, where('processing.status', '==', filters.value.status))
    }
    if (filters.value.distributor) {
      q = query(q, where('sender', '==', filters.value.distributor))
    }
    
    const snapshot = await getDocs(q)
    console.log(`Found ${snapshot.size} deliveries`)
    
    deliveries.value = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    
    // Sort client-side if needed
    deliveries.value.sort((a, b) => {
      const dateA = getReceivedAt(a)
      const dateB = getReceivedAt(b)
      if (!dateA || !dateB) return 0
      const timeA = dateA.toDate?.() ? dateA.toDate().getTime() : new Date(dateA).getTime()
      const timeB = dateB.toDate?.() ? dateB.toDate().getTime() : new Date(dateB).getTime()
      return timeB - timeA
    })
    
  } catch (error) {
    console.error('Error loading deliveries:', error)
    lastError.value = error.message
    
    // Try loading without any filters as fallback
    try {
      const snapshot = await getDocs(collection(db, 'deliveries'))
      console.log(`Fallback: Found ${snapshot.size} deliveries`)
      deliveries.value = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError)
    }
  } finally {
    isLoading.value = false
  }
}

// Load distributors
async function loadDistributors() {
  try {
    console.log('Loading distributors...')
    const snapshot = await getDocs(collection(db, 'distributors'))
    console.log(`Found ${snapshot.size} distributors`)
    distributors.value = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  } catch (error) {
    console.error('Error loading distributors:', error)
  }
}

// Create a test delivery for debugging
async function testCreateDelivery() {
  try {
    const testDelivery = {
      sender: distributors.value[0]?.id || 'TEST_DISTRIBUTOR',
      senderName: distributors.value[0]?.name || 'Test Distributor',
      messageId: `TEST_${Date.now()}`,
      releaseTitle: 'Test Release',
      releaseArtist: 'Test Artist',
      ernXml: '<ern>test</ern>',
      audioFiles: [],
      imageFiles: [],
      processing: {
        receivedAt: serverTimestamp(),
        status: 'received'
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
    
    const docRef = await addDoc(collection(db, 'deliveries'), testDelivery)
    console.log('Test delivery created:', docRef.id)
    await loadDeliveries()
  } catch (error) {
    console.error('Error creating test delivery:', error)
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
  const status = getStatus(delivery)
  return ['failed', 'validation_failed', 'processing_failed', 'error'].includes(status)
}

// Reprocess delivery
async function reprocessDelivery(delivery) {
  if (!confirm('Reprocess this delivery?')) return
  
  try {
    await updateDoc(doc(db, 'deliveries', delivery.id), {
      'processing.status': 'pending',
      'processing.reprocessedAt': serverTimestamp()
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
  const status = getStatus(delivery)
  return ['received', 'pending', 'files_ready', 'parsing', 'validating', 'processing_releases', 'waiting_for_files'].includes(status)
}

function getProgress(delivery) {
  const status = getStatus(delivery)
  const steps = {
    'received': 5,
    'pending': 10,
    'waiting_for_files': 25,
    'files_ready': 30,
    'parsing': 40,
    'validating': 60,
    'processing_releases': 80,
    'completed': 100,
    'cancelled': 0,
    'failed': 0
  }
  return steps[status] || 0
}

function getCurrentStep(delivery) {
  const status = getStatus(delivery)
  const steps = {
    'received': 'Delivery received...',
    'pending': 'Queued for processing...',
    'waiting_for_files': 'Transferring files from distributor...',
    'files_ready': 'Files ready, starting processing...',
    'parsing': 'Parsing ERN XML...',
    'validating': 'Validating with DDEX Workbench...',
    'processing_releases': 'Processing releases and assets...',
    'completed': 'Complete!',
    'cancelled': 'Cancelled',
    'failed': 'Failed'
  }
  return steps[status] || 'Unknown'
}

function getStatusClass(status) {
  if (status === 'completed') return 'success'
  if (status?.includes('failed') || status === 'error') return 'error'
  if (['parsing', 'validating', 'processing_releases'].includes(status)) return 'processing'
  if (status === 'waiting_for_files') return 'transferring'
  if (status === 'files_ready') return 'ready'
  if (status === 'pending' || status === 'received') return 'pending'
  if (status === 'cancelled') return 'cancelled'
  return 'default'
}

function getStatusIcon(status) {
  if (status === 'completed') return 'check-circle'
  if (status?.includes('failed') || status === 'error') return 'times-circle'
  if (['parsing', 'validating', 'processing_releases'].includes(status)) return 'spinner'
  if (status === 'waiting_for_files') return 'cloud-download-alt'
  if (status === 'pending' || status === 'received') return 'clock'
  return 'question-circle'
}

function formatStatus(status) {
  if (!status) return 'Unknown'
  if (status === 'waiting_for_files') return 'Transferring Files'
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function getDistributorName(distributorId) {
  const dist = distributors.value.find(d => d.id === distributorId)
  return dist?.name || distributorId || 'Unknown'
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

// Setup real-time updates with better error handling
function setupRealtimeUpdates() {
  try {
    console.log('Setting up real-time updates...')
    
    // Use a simpler query for real-time updates
    unsubscribe = onSnapshot(
      query(
        collection(db, 'deliveries'),
        limit(20)
      ),
      (snapshot) => {
        console.log(`Real-time update: ${snapshot.size} deliveries`)
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
      },
      (error) => {
        console.error('Real-time subscription error:', error)
        lastError.value = error.message
      }
    )
  } catch (error) {
    console.error('Error setting up real-time updates:', error)
  }
}

onMounted(() => {
  console.log('Ingestion component mounted')
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

/* File Transfers Monitor */
.file-transfers-monitor {
  margin-bottom: var(--space-xl);
}

.transfer-count {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--color-info);
  font-size: var(--text-sm);
}

.transfer-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.transfer-item:last-child {
  border-bottom: none;
}

.transfer-info h4 {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-xs);
}

.transfer-info p {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.transfer-stats {
  display: flex;
  gap: var(--space-lg);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
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

.timeline-marker.transferring {
  background-color: var(--color-info);
  border-color: var(--color-info);
  color: white;
}

.timeline-marker.transferring svg {
  animation: pulse 1.5s infinite;
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
  flex-wrap: wrap;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

/* File Transfer Status */
.file-transfer-status {
  margin-top: var(--space-md);
  padding: var(--space-sm);
  background-color: rgba(66, 133, 244, 0.1);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-info);
}

.transfer-progress {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--color-info);
  font-size: var(--text-sm);
}

.transfer-icon {
  animation: pulse 1.5s infinite;
}

.transfer-text {
  flex: 1;
}

.transferred-files-info {
  margin-top: var(--space-sm);
  padding: var(--space-xs);
  background-color: rgba(52, 168, 83, 0.05);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
}

.files-summary {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--color-success);
}

.success-icon {
  color: var(--color-success);
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

.status-badge.transferring {
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

.status-badge.ready {
  background-color: var(--color-info);
  color: white;
}

.status-badge.cancelled {
  background-color: var(--color-text-tertiary);
  color: white;
}

/* Files Badge */
.files-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.files-badge.success {
  background-color: rgba(52, 168, 83, 0.1);
  color: var(--color-success);
}

.files-badge.transferring {
  background-color: rgba(66, 133, 244, 0.1);
  color: var(--color-info);
}

.files-badge.pending {
  background-color: rgba(251, 188, 4, 0.1);
  color: var(--color-warning);
}

/* Debug styles */
.debug-info {
  background-color: var(--color-warning);
  color: white;
  margin-bottom: var(--space-lg);
}

.debug-info h3 {
  margin-bottom: var(--space-sm);
}

.debug-info p {
  margin-bottom: var(--space-xs);
}

.text-warning {
  color: var(--color-warning);
  font-weight: var(--font-medium);
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