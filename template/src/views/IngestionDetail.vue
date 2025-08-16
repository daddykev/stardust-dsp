<!-- src/views/IngestionDetail.vue -->
<template>
  <div class="ingestion-detail-page">
    <div class="container">
      <!-- Header -->
      <div class="page-header">
        <div class="header-nav">
          <router-link to="/ingestion" class="back-link">
            <font-awesome-icon icon="arrow-left" />
            Back to Ingestion
          </router-link>
        </div>
        <div class="header-content">
          <div>
            <h1>{{ delivery?.ern?.messageId || delivery?.id || 'Loading...' }}</h1>
            <div class="header-meta">
              <span class="meta-item">
                <font-awesome-icon icon="truck" />
                {{ distributorName }}
              </span>
              <span class="meta-item">
                <font-awesome-icon icon="clock" />
                {{ formatDate(delivery?.processing?.receivedAt) }}
              </span>
              <span class="status-badge" :class="getStatusClass(delivery?.processing?.status)">
                {{ formatStatus(delivery?.processing?.status) }}
              </span>
            </div>
          </div>
          <div class="header-actions">
            <!-- Manual Process button for testing -->
            <button 
              @click="manualProcess"
              class="btn btn-warning"
              :disabled="isLoading"
              title="Manually trigger processing (for testing)"
            >
              <font-awesome-icon icon="play" :spin="isLoading" />
              Manual Process
            </button>
            <button 
              v-if="canReprocess"
              @click="reprocessDelivery"
              class="btn btn-secondary"
              :disabled="isLoading"
            >
              <font-awesome-icon icon="redo" />
              Reprocess
            </button>
            <button 
              v-if="delivery?.acknowledgment"
              @click="downloadAcknowledgment"
              class="btn btn-primary"
            >
              <font-awesome-icon icon="download" />
              Download Acknowledgment
            </button>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading delivery details...</p>
      </div>

      <!-- Main Content -->
      <div v-else-if="delivery" class="detail-content">
        <!-- Processing Timeline -->
        <div class="card">
          <div class="card-header">
            <h2>Processing Timeline</h2>
            <div class="refresh-wrapper">
              <button @click="refreshDelivery" class="btn-icon" :disabled="isRefreshing">
                <font-awesome-icon icon="sync" :spin="isRefreshing" />
              </button>
            </div>
          </div>
          <div class="card-body">
            <div class="timeline">
              <div 
                v-for="step in processingSteps" 
                :key="step.id"
                class="timeline-step"
                :class="{ 
                  completed: step.completed, 
                  current: step.current,
                  failed: step.failed 
                }"
              >
                <div class="step-marker">
                  <font-awesome-icon 
                    :icon="step.icon" 
                    :spin="step.current && !step.failed"
                  />
                </div>
                <div class="step-content">
                  <h4>{{ step.label }}</h4>
                  <p class="step-time">{{ step.time }}</p>
                  <p v-if="step.error" class="step-error">
                    <font-awesome-icon icon="exclamation-triangle" />
                    {{ step.error }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Progress Bar -->
            <div v-if="isProcessing" class="progress-section">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
              </div>
              <p class="progress-text">{{ currentStepText }}</p>
            </div>
          </div>
        </div>

        <!-- Main Info Grid -->
        <div class="info-grid">
          <!-- ERN Information -->
          <div class="card">
            <div class="card-header">
              <h3>ERN Information</h3>
            </div>
            <div class="card-body">
              <div class="info-list">
                <div class="info-item">
                  <label>Message ID</label>
                  <code>{{ delivery.ern?.messageId || 'N/A' }}</code>
                </div>
                <div class="info-item">
                  <label>ERN Version</label>
                  <span>{{ delivery.ern?.version || 'Unknown' }}</span>
                </div>
                <div class="info-item">
                  <label>Profile</label>
                  <span>{{ delivery.ern?.profile || 'N/A' }}</span>
                </div>
                <div class="info-item">
                  <label>Sender Party ID</label>
                  <code>{{ delivery.ern?.messageSender?.partyId || 'N/A' }}</code>
                </div>
                <div class="info-item">
                  <label>Sender Name</label>
                  <span>{{ delivery.ern?.messageSender?.partyName || 'N/A' }}</span>
                </div>
                <div class="info-item">
                  <label>Created Date</label>
                  <span>{{ formatDate(delivery.ern?.messageCreatedDateTime) || 'N/A' }}</span>
                </div>
                <div class="info-item">
                  <label>Release Count</label>
                  <span class="badge">{{ delivery.ern?.releaseCount || 0 }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Package Information -->
          <div class="card">
            <div class="card-header">
              <h3>Package Information</h3>
            </div>
            <div class="card-body">
              <div class="info-list">
                <div class="info-item">
                  <label>Delivery ID</label>
                  <code>{{ delivery.id }}</code>
                </div>
                <div class="info-item">
                  <label>Original Path</label>
                  <code class="path-text">{{ delivery.package?.originalPath || 'N/A' }}</code>
                </div>
                <div class="info-item">
                  <label>Package Size</label>
                  <span>{{ formatFileSize(delivery.package?.size) || 'N/A' }}</span>
                </div>
                <div class="info-item">
                  <label>Content Type</label>
                  <span>{{ delivery.package?.contentType || 'N/A' }}</span>
                </div>
                <div class="info-item">
                  <label>Received At</label>
                  <span>{{ formatDate(delivery.processing?.receivedAt) }}</span>
                </div>
                <div class="info-item">
                  <label>Processing Time</label>
                  <span>{{ getProcessingTime() }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Validation Results -->
        <div v-if="delivery.validation" class="card">
          <div class="card-header">
            <h3>Validation Results</h3>
            <span class="validation-status" :class="delivery.validation.valid ? 'valid' : 'invalid'">
              <font-awesome-icon :icon="delivery.validation.valid ? 'check-circle' : 'times-circle'" />
              {{ delivery.validation.valid ? 'Valid' : 'Invalid' }}
            </span>
          </div>
          <div class="card-body">
            <!-- Errors -->
            <div v-if="delivery.validation.errors?.length > 0" class="validation-section">
              <h4 class="validation-title error">
                <font-awesome-icon icon="times-circle" />
                Errors ({{ delivery.validation.errors.length }})
              </h4>
              <div class="validation-list">
                <div v-for="(error, index) in delivery.validation.errors" :key="index" class="validation-item error">
                  <span class="item-number">{{ index + 1 }}</span>
                  <span class="item-message">{{ error }}</span>
                </div>
              </div>
            </div>

            <!-- Warnings -->
            <div v-if="delivery.validation.warnings?.length > 0" class="validation-section">
              <h4 class="validation-title warning">
                <font-awesome-icon icon="exclamation-triangle" />
                Warnings ({{ delivery.validation.warnings.length }})
              </h4>
              <div class="validation-list">
                <div v-for="(warning, index) in delivery.validation.warnings" :key="index" class="validation-item warning">
                  <span class="item-number">{{ index + 1 }}</span>
                  <span class="item-message">{{ warning }}</span>
                </div>
              </div>
            </div>

            <!-- Info -->
            <div v-if="delivery.validation.info?.length > 0" class="validation-section">
              <h4 class="validation-title info">
                <font-awesome-icon icon="info-circle" />
                Information ({{ delivery.validation.info.length }})
              </h4>
              <div class="validation-list">
                <div v-for="(info, index) in delivery.validation.info" :key="index" class="validation-item info">
                  <span class="item-number">{{ index + 1 }}</span>
                  <span class="item-message">{{ info }}</span>
                </div>
              </div>
            </div>

            <div v-if="!delivery.validation.errors?.length && !delivery.validation.warnings?.length && !delivery.validation.info?.length" class="empty-validation">
              <font-awesome-icon icon="check" />
              <span>No issues found - ERN is fully compliant</span>
            </div>
          </div>
        </div>

        <!-- Processed Releases -->
        <div v-if="delivery.processing?.releases?.length > 0" class="card">
          <div class="card-header">
            <h3>Processed Releases</h3>
            <span class="count-badge">{{ delivery.processing.releases.length }}</span>
          </div>
          <div class="card-body">
            <div class="releases-table">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Release ID</th>
                    <th>Title</th>
                    <th>Artist</th>
                    <th>Tracks</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="release in delivery.processing.releases" :key="release.releaseId">
                    <td><code>{{ release.releaseId }}</code></td>
                    <td>{{ release.title }}</td>
                    <td>{{ release.artist }}</td>
                    <td>
                      <span class="badge">{{ release.trackCount }}</span>
                    </td>
                    <td>
                      <span class="status-badge success">Active</span>
                    </td>
                    <td>
                      <router-link 
                        :to="`/catalog/${release.releaseId}`"
                        class="btn btn-sm btn-secondary"
                      >
                        View Release
                      </router-link>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Acknowledgment -->
        <div v-if="delivery.acknowledgment" class="card">
          <div class="card-header">
            <h3>Acknowledgment</h3>
            <span class="status-badge success">Sent</span>
          </div>
          <div class="card-body">
            <div class="info-list horizontal">
              <div class="info-item">
                <label>Message ID</label>
                <code>{{ delivery.acknowledgment.messageId }}</code>
              </div>
              <div class="info-item">
                <label>Sent At</label>
                <span>{{ formatDate(delivery.acknowledgment.sentAt) }}</span>
              </div>
              <div class="info-item">
                <label>Document ID</label>
                <code>{{ delivery.acknowledgment.documentId }}</code>
              </div>
            </div>
            <div class="ack-actions">
              <button @click="downloadAcknowledgment" class="btn btn-primary">
                <font-awesome-icon icon="download" />
                Download XML
              </button>
              <button @click="viewAcknowledgment" class="btn btn-secondary">
                <font-awesome-icon icon="eye" />
                View Content
              </button>
            </div>
          </div>
        </div>

        <!-- Error Details -->
        <div v-if="delivery.processing?.error" class="card error-card">
          <div class="card-header">
            <h3>Error Details</h3>
          </div>
          <div class="card-body">
            <div class="error-content">
              <div class="error-message">
                <font-awesome-icon icon="exclamation-circle" />
                <span>{{ delivery.processing.error }}</span>
              </div>
              <div v-if="delivery.processing.errorDetails" class="error-stack">
                <h4>Stack Trace</h4>
                <pre><code>{{ delivery.processing.errorDetails }}</code></pre>
              </div>
              <div class="error-actions">
                <button @click="reprocessDelivery" class="btn btn-primary" :disabled="isLoading">
                  <font-awesome-icon icon="redo" />
                  Retry Processing
                </button>
                <button @click="reportIssue" class="btn btn-secondary">
                  <font-awesome-icon icon="bug" />
                  Report Issue
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Raw Data (Debug) -->
        <div v-if="showDebug" class="card">
          <div class="card-header">
            <h3>Raw Data (Debug)</h3>
            <button @click="showDebug = false" class="btn-icon">
              <font-awesome-icon icon="times" />
            </button>
          </div>
          <div class="card-body">
            <pre class="debug-content"><code>{{ JSON.stringify(delivery, null, 2) }}</code></pre>
          </div>
        </div>
      </div>

      <!-- Not Found -->
      <div v-else class="empty-state">
        <font-awesome-icon icon="inbox" class="empty-icon" />
        <h3>Delivery Not Found</h3>
        <p>The requested delivery could not be found</p>
        <router-link to="/ingestion" class="btn btn-primary">
          Back to Ingestion
        </router-link>
      </div>

      <!-- Debug Toggle -->
      <button 
        v-if="!showDebug && delivery"
        @click="showDebug = true" 
        class="debug-toggle"
        title="Show Debug Info"
      >
        <font-awesome-icon icon="bug" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

const route = useRoute()
const router = useRouter()

// State
const delivery = ref(null)
const distributor = ref(null)
const isLoading = ref(true)
const isRefreshing = ref(false)
const showDebug = ref(false)

// Real-time subscription
let unsubscribe = null

// Computed
const distributorName = computed(() => {
  return distributor.value?.name || delivery.value?.sender || 'Unknown Distributor'
})

const canReprocess = computed(() => {
  const status = delivery.value?.processing?.status
  return status && ['failed', 'validation_failed', 'processing_failed', 'parse_failed'].includes(status)
})

const isProcessing = computed(() => {
  const status = delivery.value?.processing?.status
  return status && ['pending', 'parsing', 'validating', 'processing_releases'].includes(status)
})

const processingSteps = computed(() => {
  if (!delivery.value) return []
  
  const status = delivery.value.processing?.status
  const steps = [
    {
      id: 'received',
      label: 'Delivery Received',
      icon: 'inbox',
      completed: true,
      time: formatDate(delivery.value.processing?.receivedAt)
    },
    {
      id: 'parsing',
      label: 'Parsing ERN',
      icon: 'file-code',
      completed: ['parsing', 'validating', 'processing_releases', 'completed'].includes(status),
      current: status === 'parsing',
      failed: status === 'parse_failed',
      time: formatDate(delivery.value.processing?.parsedAt),
      error: status === 'parse_failed' ? delivery.value.processing?.error : null
    },
    {
      id: 'validating',
      label: 'Validating with DDEX Workbench',
      icon: 'check-circle',
      completed: ['validating', 'processing_releases', 'completed'].includes(status),
      current: status === 'validating',
      failed: status === 'validation_failed',
      time: formatDate(delivery.value.validation?.validatedAt),
      error: status === 'validation_failed' ? 'Validation failed - see errors below' : null
    },
    {
      id: 'processing',
      label: 'Processing Releases',
      icon: 'compact-disc',
      completed: ['processing_releases', 'completed'].includes(status),
      current: status === 'processing_releases',
      failed: status === 'processing_failed',
      time: formatDate(delivery.value.processing?.processingStartedAt),
      error: status === 'processing_failed' ? delivery.value.processing?.error : null
    },
    {
      id: 'completed',
      label: 'Processing Complete',
      icon: 'flag-checkered',
      completed: status === 'completed',
      failed: status === 'failed',
      time: formatDate(delivery.value.processing?.completedAt),
      error: status === 'failed' ? delivery.value.processing?.error : null
    }
  ]
  
  return steps
})

const progressPercentage = computed(() => {
  const status = delivery.value?.processing?.status
  const percentages = {
    'pending': 10,
    'parsing': 25,
    'validating': 50,
    'processing_releases': 75,
    'completed': 100
  }
  return percentages[status] || 0
})

const currentStepText = computed(() => {
  const status = delivery.value?.processing?.status
  const texts = {
    'pending': 'Queued for processing...',
    'parsing': 'Parsing ERN XML structure...',
    'validating': 'Validating with DDEX Workbench API...',
    'processing_releases': 'Processing releases and assets...',
    'completed': 'Processing complete!'
  }
  return texts[status] || 'Processing...'
})

// Load delivery
async function loadDelivery() {
  isLoading.value = true
  
  try {
    const deliveryId = route.params.id
    const deliveryDoc = await getDoc(doc(db, 'deliveries', deliveryId))
    
    if (deliveryDoc.exists()) {
      delivery.value = {
        id: deliveryDoc.id,
        ...deliveryDoc.data()
      }
      
      // Load distributor info
      if (delivery.value.sender) {
        const distDoc = await getDoc(doc(db, 'distributors', delivery.value.sender))
        if (distDoc.exists()) {
          distributor.value = {
            id: distDoc.id,
            ...distDoc.data()
          }
        }
      }
    }
  } catch (error) {
    console.error('Error loading delivery:', error)
  } finally {
    isLoading.value = false
  }
}

// Refresh delivery
async function refreshDelivery() {
  isRefreshing.value = true
  await loadDelivery()
  setTimeout(() => {
    isRefreshing.value = false
  }, 500)
}

// Reprocess delivery using Cloud Function
async function reprocessDelivery() {
  if (!confirm('Are you sure you want to reprocess this delivery?')) return
  
  isLoading.value = true
  
  try {
    // Call the Cloud Function endpoint
    const response = await fetch('https://us-central1-stardust-dsp.cloudfunctions.net/reprocessDelivery', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deliveryId: delivery.value.id
      })
    })
    
    const result = await response.json()
    
    if (response.ok) {
      // Success - the delivery should start processing
      console.log('Reprocess triggered:', result)
      
      // Show success message
      alert('Delivery reprocessing started successfully!')
      
      // The real-time listener will automatically update the UI
    } else {
      // Error from the function
      console.error('Reprocess failed:', result)
      alert(`Failed to reprocess: ${result.error || 'Unknown error'}`)
    }
  } catch (error) {
    console.error('Error calling reprocess function:', error)
    alert('Failed to reprocess delivery. Please check the console for details.')
  } finally {
    isLoading.value = false
  }
}

// Manual process for testing (forces processing regardless of status)
async function manualProcess() {
  if (!confirm('Manually trigger processing for this delivery? This will force processing regardless of current status.')) return
  
  isLoading.value = true
  
  try {
    const response = await fetch('https://us-central1-stardust-dsp.cloudfunctions.net/reprocessDelivery', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deliveryId: delivery.value.id
      })
    })
    
    const result = await response.json()
    
    if (response.ok) {
      console.log('Manual processing triggered:', result)
      alert('Manual processing started!')
      // The real-time listener will automatically update the UI
    } else {
      console.error('Manual process failed:', result)
      alert(`Failed: ${result.error || 'Unknown error'}`)
    }
  } catch (error) {
    console.error('Error triggering manual process:', error)
    alert('Failed to trigger manual processing')
  } finally {
    isLoading.value = false
  }
}

// Download acknowledgment
function downloadAcknowledgment() {
  const url = `https://us-central1-stardust-dsp.cloudfunctions.net/getAcknowledgment?deliveryId=${delivery.value.id}`
  window.open(url, '_blank')
}

// View acknowledgment
function viewAcknowledgment() {
  // Could open in a modal or new tab
  const url = `https://us-central1-stardust-dsp.cloudfunctions.net/getAcknowledgment?deliveryId=${delivery.value.id}`
  window.open(url, '_blank')
}

// Report issue
function reportIssue() {
  // Could open a support form or email
  const subject = encodeURIComponent(`Issue with delivery ${delivery.value.id}`)
  const body = encodeURIComponent(`Delivery ID: ${delivery.value.id}\nError: ${delivery.value.processing?.error}`)
  window.location.href = `mailto:support@stardust-dsp.org?subject=${subject}&body=${body}`
}

// Get processing time
function getProcessingTime() {
  if (!delivery.value) return 'N/A'
  
  const start = delivery.value.processing?.receivedAt
  const end = delivery.value.processing?.completedAt || delivery.value.processing?.failedAt
  
  if (!start || !end) return 'In progress...'
  
  const startDate = start.toDate ? start.toDate() : new Date(start)
  const endDate = end.toDate ? end.toDate() : new Date(end)
  
  const diff = endDate - startDate
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

// Format utilities
function formatDate(timestamp) {
  if (!timestamp) return null
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}

function formatFileSize(bytes) {
  if (!bytes) return null
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

function formatStatus(status) {
  if (!status) return 'Unknown'
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function getStatusClass(status) {
  if (!status) return 'default'
  if (status === 'completed') return 'success'
  if (status.includes('failed')) return 'error'
  if (['parsing', 'validating', 'processing_releases'].includes(status)) return 'processing'
  if (status === 'pending') return 'pending'
  return 'default'
}

// Setup real-time subscription
function setupRealtimeUpdates() {
  const deliveryId = route.params.id
  unsubscribe = onSnapshot(
    doc(db, 'deliveries', deliveryId),
    (doc) => {
      if (doc.exists()) {
        delivery.value = {
          id: doc.id,
          ...doc.data()
        }
      }
    }
  )
}

onMounted(() => {
  loadDelivery()
  setupRealtimeUpdates()
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})
</script>

<style scoped>
/* Page Layout */
.ingestion-detail-page {
  padding: var(--space-xl);
  min-height: calc(100vh - 64px);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

/* Header */
.page-header {
  margin-bottom: var(--space-xl);
}

.header-nav {
  margin-bottom: var(--space-md);
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: color var(--transition-base);
}

.back-link:hover {
  color: var(--color-primary);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-lg);
}

.header-content h1 {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  margin-bottom: var(--space-sm);
  color: var(--color-heading);
  word-break: break-all;
}

.header-meta {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.header-actions {
  display: flex;
  gap: var(--space-sm);
  flex-shrink: 0;
}

/* Timeline */
.timeline {
  position: relative;
  padding-left: var(--space-xl);
}

.timeline::before {
  content: '';
  position: absolute;
  left: 16px;
  top: 20px;
  bottom: 20px;
  width: 2px;
  background-color: var(--color-border);
}

.timeline-step {
  position: relative;
  display: flex;
  gap: var(--space-md);
  padding-bottom: var(--space-xl);
}

.timeline-step:last-child {
  padding-bottom: 0;
}

.step-marker {
  position: absolute;
  left: -16px;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  background-color: var(--color-surface);
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  z-index: 1;
}

.timeline-step.completed .step-marker {
  background-color: var(--color-success);
  border-color: var(--color-success);
  color: white;
}

.timeline-step.current .step-marker {
  background-color: var(--color-info);
  border-color: var(--color-info);
  color: white;
}

.timeline-step.failed .step-marker {
  background-color: var(--color-error);
  border-color: var(--color-error);
  color: white;
}

.step-content {
  flex: 1;
  padding-left: var(--space-md);
}

.step-content h4 {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-xs);
}

.step-time {
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}

.step-error {
  margin-top: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  background-color: rgba(234, 67, 53, 0.1);
  border-radius: var(--radius-md);
  color: var(--color-error);
  font-size: var(--text-sm);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

/* Progress */
.progress-section {
  margin-top: var(--space-lg);
  padding-top: var(--space-lg);
  border-top: 1px solid var(--color-border);
}

.progress-bar {
  height: 8px;
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: var(--space-sm);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-info));
  transition: width 0.3s ease;
}

.progress-text {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  text-align: center;
}

/* Info Grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: var(--space-lg);
  margin-bottom: var(--space-lg);
}

/* Info List */
.info-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.info-list.horizontal {
  flex-direction: row;
  flex-wrap: wrap;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.info-list.horizontal .info-item {
  flex: 1;
  min-width: 200px;
}

.info-item label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

.info-item code {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  background-color: var(--color-bg-secondary);
  padding: var(--space-xs);
  border-radius: var(--radius-sm);
  word-break: break-all;
}

.path-text {
  font-size: var(--text-xs);
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-xs) var(--space-sm);
  background-color: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

/* Validation */
.validation-status {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.validation-status.valid {
  background-color: var(--color-success);
  color: white;
}

.validation-status.invalid {
  background-color: var(--color-error);
  color: white;
}

.validation-section {
  margin-bottom: var(--space-lg);
}

.validation-section:last-child {
  margin-bottom: 0;
}

.validation-title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-md);
}

.validation-title.error {
  color: var(--color-error);
}

.validation-title.warning {
  color: var(--color-warning);
}

.validation-title.info {
  color: var(--color-info);
}

.validation-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.validation-item {
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.validation-item.error {
  background-color: rgba(234, 67, 53, 0.1);
  color: var(--color-error);
}

.validation-item.warning {
  background-color: rgba(251, 188, 4, 0.1);
  color: var(--color-warning);
}

.validation-item.info {
  background-color: rgba(66, 133, 244, 0.1);
  color: var(--color-info);
}

.item-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  background-color: currentColor;
  color: white;
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  flex-shrink: 0;
}

.item-message {
  flex: 1;
  line-height: var(--leading-relaxed);
}

.empty-validation {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-lg);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  color: var(--color-success);
}

/* Releases Table */
.releases-table {
  overflow-x: auto;
}

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
  white-space: nowrap;
}

.data-table td {
  padding: var(--space-md) var(--space-sm);
  border-bottom: 1px solid var(--color-border-light);
}

.data-table code {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  background-color: var(--color-bg-secondary);
  padding: var(--space-xs);
  border-radius: var(--radius-sm);
}

/* Acknowledgment */
.ack-actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
}

/* Error Card */
.error-card {
  border-color: var(--color-error);
}

.error-card .card-header {
  background-color: rgba(234, 67, 53, 0.1);
}

.error-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.error-message {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-md);
  background-color: rgba(234, 67, 53, 0.1);
  border-radius: var(--radius-md);
  color: var(--color-error);
}

.error-stack {
  margin-top: var(--space-md);
}

.error-stack h4 {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-sm);
  color: var(--color-text-secondary);
}

.error-stack pre {
  background-color: var(--color-bg-tertiary);
  padding: var(--space-md);
  border-radius: var(--radius-md);
  overflow-x: auto;
  font-size: var(--text-xs);
}

.error-actions {
  display: flex;
  gap: var(--space-sm);
}

/* Debug */
.debug-toggle {
  position: fixed;
  bottom: var(--space-lg);
  right: var(--space-lg);
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  background-color: var(--color-surface);
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-base);
  box-shadow: var(--shadow-md);
}

.debug-toggle:hover {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
  transform: scale(1.1);
}

.debug-content {
  background-color: var(--color-bg-tertiary);
  padding: var(--space-lg);
  border-radius: var(--radius-md);
  overflow-x: auto;
  font-size: var(--text-xs);
  max-height: 400px;
  overflow-y: auto;
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

/* Count Badge */
.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 var(--space-xs);
  background-color: var(--color-primary);
  color: white;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
}

/* Warning Button */
.btn-warning {
  background-color: var(--color-warning);
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background-color: var(--color-warning);
  color: white;
  filter: brightness(1.1);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.btn-warning:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Utilities */
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

.btn-icon:hover:not(:disabled) {
  background-color: var(--color-bg-secondary);
  color: var(--color-text);
}

.btn-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.refresh-wrapper {
  display: flex;
  align-items: center;
}

/* Responsive */
@media (max-width: 768px) {
  .ingestion-detail-page {
    padding: var(--space-md);
  }
  
  .header-content {
    flex-direction: column;
  }
  
  .header-actions {
    width: 100%;
    flex-wrap: wrap;
  }
  
  .header-actions .btn {
    flex: 1;
    min-width: 150px;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .info-list.horizontal {
    flex-direction: column;
  }
  
  .validation-item {
    flex-direction: column;
    gap: var(--space-xs);
  }
  
  .data-table {
    font-size: var(--text-sm);
  }
  
  .debug-toggle {
    bottom: var(--space-md);
    right: var(--space-md);
  }
}
</style>