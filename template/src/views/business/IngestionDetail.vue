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
const fileTransferJob = ref(null)
const isLoading = ref(true)
const isRefreshing = ref(false)
const showDebug = ref(false)
const showXMLModal = ref(false)

// Real-time subscription
let unsubscribe = null
let unsubscribeTransfer = null

// Computed
const distributorName = computed(() => {
  return distributor.value?.name || delivery.value?.sender || 'Unknown Distributor'
})

const canReprocess = computed(() => {
  const status = delivery.value?.processing?.status
  return status && [
    'failed', 
    'validation_failed', 
    'validation_error',
    'processing_failed', 
    'parse_failed',
    'cancelled'
  ].includes(status)
})

const isProcessing = computed(() => {
  const status = delivery.value?.processing?.status
  return status && ['pending', 'parsing', 'validating', 'processing_releases', 'waiting_for_files'].includes(status)
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
      id: 'file_transfer',
      label: 'File Transfer',
      icon: 'cloud-download-alt',
      completed: ['files_ready', 'parsing', 'validating', 'processing_releases', 'completed'].includes(status) || 
                 delivery.value.files?.transferredAt,
      current: status === 'waiting_for_files',
      failed: fileTransferJob.value?.status === 'permanently_failed',
      time: formatDate(delivery.value.files?.transferredAt),
      error: fileTransferJob.value?.error,
      details: delivery.value.files ? {
        audioTransferred: delivery.value.files.audioCount || 0,
        imageTransferred: delivery.value.files.imageCount || 0
      } : null
    },
    {
      id: 'files_ready',
      label: 'Files Ready',
      icon: 'check-circle',
      completed: ['parsing', 'validating', 'processing_releases', 'completed'].includes(status),
      current: status === 'files_ready',
      time: formatDate(delivery.value.files?.transferredAt)
    },
    {
      id: 'parsing',
      label: 'Parsing ERN',
      icon: 'file-code',
      completed: ['validating', 'processing_releases', 'completed'].includes(status),
      current: status === 'parsing',
      failed: status === 'parse_failed',
      time: formatDate(delivery.value.processing?.parsedAt),
      error: status === 'parse_failed' ? delivery.value.processing?.error : null
    },
    {
      id: 'validating',
      label: 'Validating with DDEX Workbench',
      icon: 'check-circle',
      completed: ['processing_releases', 'completed'].includes(status),
      current: status === 'validating',
      failed: status === 'validation_failed' || status === 'validation_error',
      time: formatDate(delivery.value.validation?.validatedAt),
      error: (status === 'validation_failed' || status === 'validation_error') ? 'Validation failed - see errors below' : null
    },
    {
      id: 'processing',
      label: 'Processing Releases',
      icon: 'compact-disc',
      completed: status === 'completed',
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
      cancelled: status === 'cancelled',
      time: formatDate(delivery.value.processing?.completedAt),
      error: status === 'failed' ? delivery.value.processing?.error : null
    }
  ]
  
  return steps
})

const progressPercentage = computed(() => {
  const status = delivery.value?.processing?.status
  const percentages = {
    'received': 5,
    'pending': 10,
    'waiting_for_files': 20,
    'files_ready': 30,
    'parsing': 40,
    'validating': 60,
    'processing_releases': 80,
    'completed': 100,
    'cancelled': 0,
    'failed': 0
  }
  return percentages[status] || 0
})

const currentStepText = computed(() => {
  const status = delivery.value?.processing?.status
  const texts = {
    'received': 'Delivery received successfully',
    'pending': 'Queued for processing...',
    'waiting_for_files': 'Transferring files from distributor...',
    'files_ready': 'Files transferred, starting processing...',
    'parsing': 'Parsing ERN XML structure...',
    'validating': 'Validating with DDEX Workbench API...',
    'processing_releases': 'Processing releases and assets...',
    'completed': 'Processing complete!',
    'cancelled': 'Processing cancelled',
    'failed': 'Processing failed'
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

// Load file transfer job
async function loadFileTransferJob() {
  try {
    const deliveryId = route.params.id
    const transferDoc = await getDoc(doc(db, 'fileTransfers', deliveryId))
    
    if (transferDoc.exists()) {
      fileTransferJob.value = {
        id: transferDoc.id,
        ...transferDoc.data()
      }
    }
  } catch (error) {
    console.error('Error loading file transfer job:', error)
  }
}

// Refresh delivery
async function refreshDelivery() {
  isRefreshing.value = true
  await loadDelivery()
  await loadFileTransferJob()
  setTimeout(() => {
    isRefreshing.value = false
  }, 500)
}

// Reprocess delivery using Cloud Function
async function reprocessDelivery() {
  if (!confirm('Are you sure you want to reprocess this delivery?')) return
  
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
      console.log('Reprocess triggered:', result)
      alert('Delivery reprocessing started successfully!')
    } else {
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

// Manual process for testing
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
  const url = `https://us-central1-stardust-dsp.cloudfunctions.net/getAcknowledgment?deliveryId=${delivery.value.id}`
  window.open(url, '_blank')
}

// Report issue
function reportIssue() {
  const subject = encodeURIComponent(`Issue with delivery ${delivery.value.id}`)
  const body = encodeURIComponent(`Delivery ID: ${delivery.value.id}\nError: ${delivery.value.processing?.error}`)
  window.location.href = `mailto:support@stardust-dsp.org?subject=${subject}&body=${body}`
}

// Raw XML functions
function viewRawXML() {
  if (!delivery.value?.ernXml) {
    alert('No XML data available')
    return
  }
  showXMLModal.value = true
}

function closeXMLModal() {
  showXMLModal.value = false
}

function downloadRawXML() {
  if (!delivery.value?.ernXml) {
    alert('No XML data available')
    return
  }
  
  const filename = `${delivery.value.id || 'delivery'}_ern.xml`
  const blob = new Blob([delivery.value.ernXml], { type: 'application/xml' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

async function copyXMLToClipboard() {
  if (!delivery.value?.ernXml) return
  
  try {
    await navigator.clipboard.writeText(delivery.value.ernXml)
    alert('XML copied to clipboard')
  } catch (error) {
    console.error('Failed to copy XML:', error)
    alert('Failed to copy to clipboard')
  }
}

function formatXML(xml) {
  if (!xml) return ''
  
  try {
    const formatted = xml
      .replace(/></g, '>\n<')
      .replace(/^\s*\n/gm, '')
    return formatted
  } catch (error) {
    return xml
  }
}

// Debug delivery IDs
async function debugDeliveryIDs() {
  try {
    const response = await fetch(`https://us-central1-stardust-dsp.cloudfunctions.net/debugDeliveryHistory?deliveryId=${delivery.value.id}`)
    const result = await response.json()
    
    if (response.ok) {
      console.log('Delivery ID Debug:', result)
      alert('Debug info logged to console. Check browser developer tools.')
    } else {
      console.error('Debug failed:', result)
      alert('Failed to get debug info')
    }
  } catch (error) {
    console.error('Debug request failed:', error)
    alert('Failed to contact debug endpoint')
  }
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
  if (status === 'waiting_for_files') return 'Transferring Files'
  if (status === 'files_ready') return 'Files Ready'
  if (status === 'validation_error') return 'Validation Error'
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function getStatusClass(status) {
  if (!status) return 'status-default'
  if (status === 'completed') return 'status-success'
  if (status.includes('failed')) return 'status-error'
  if (['parsing', 'validating', 'processing_releases'].includes(status)) return 'status-processing'
  if (status === 'waiting_for_files') return 'status-processing'
  if (status === 'pending') return 'status-pending'
  return 'status-default'
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
  
  unsubscribeTransfer = onSnapshot(
    doc(db, 'fileTransfers', deliveryId),
    (doc) => {
      if (doc.exists()) {
        fileTransferJob.value = {
          id: doc.id,
          ...doc.data()
        }
      }
    },
    (error) => {
      console.log('No file transfer job for this delivery')
    }
  )
}

onMounted(() => {
  loadDelivery()
  loadFileTransferJob()
  setupRealtimeUpdates()
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
  if (unsubscribeTransfer) unsubscribeTransfer()
})
</script>

<template>
  <div class="ingestion-detail-page">
    <div class="container">
      <!-- Header -->
      <div class="page-header">
        <div class="mb-md">
          <router-link to="/ingestion" class="back-link">
            <font-awesome-icon icon="arrow-left" />
            Back to Ingestion
          </router-link>
        </div>
        <div class="flex justify-between items-start gap-lg">
          <div>
            <h1 class="text-2xl font-bold mb-sm" style="word-break: break-all;">
              {{ delivery?.ern?.messageId || delivery?.id || 'Loading...' }}
            </h1>
            <div class="flex items-center gap-lg flex-wrap text-sm text-secondary">
              <span class="flex items-center gap-xs">
                <font-awesome-icon icon="truck" />
                {{ distributorName }}
              </span>
              <span class="flex items-center gap-xs">
                <font-awesome-icon icon="clock" />
                {{ formatDate(delivery?.processing?.receivedAt) }}
              </span>
              <span class="status-badge" :class="getStatusClass(delivery?.processing?.status)">
                {{ formatStatus(delivery?.processing?.status) }}
              </span>
            </div>
          </div>
          <div class="flex gap-sm flex-wrap">
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
        <div class="card mb-lg">
          <div class="card-header flex justify-between items-center">
            <h2 class="text-xl font-semibold">Processing Timeline</h2>
            <button @click="refreshDelivery" class="btn-icon" :disabled="isRefreshing">
              <font-awesome-icon icon="sync" :spin="isRefreshing" />
            </button>
          </div>
          <div class="card-body">
            <div class="timeline">
              <div 
                v-for="(step, index) in processingSteps" 
                :key="step.id"
                class="timeline-step"
                :class="{ 'timeline-step-last': index === processingSteps.length - 1 }"
              >
                <div 
                  class="timeline-marker"
                  :class="{ 
                    'timeline-marker-completed': step.completed, 
                    'timeline-marker-current': step.current,
                    'timeline-marker-failed': step.failed,
                    'timeline-marker-cancelled': step.cancelled
                  }"
                >
                  <font-awesome-icon 
                    :icon="step.icon" 
                    :spin="step.current && !step.failed"
                  />
                </div>
                <div class="timeline-content">
                  <h4 class="text-base font-semibold mb-xs">{{ step.label }}</h4>
                  <p class="text-sm text-tertiary">{{ step.time }}</p>
                  <div v-if="step.details" class="flex gap-md text-sm text-secondary mt-xs">
                    <span v-if="step.details.audioTransferred !== undefined">
                      Audio: {{ step.details.audioTransferred }} files
                    </span>
                    <span v-if="step.details.imageTransferred !== undefined">
                      Images: {{ step.details.imageTransferred }} files
                    </span>
                  </div>
                  <div v-if="step.error" class="alert-box alert-error mt-xs">
                    <font-awesome-icon icon="exclamation-triangle" />
                    {{ step.error }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Progress Bar -->
            <div v-if="isProcessing" class="mt-lg pt-lg border-t">
              <div class="progress-bar mb-sm">
                <div class="progress-fill" :style="{ width: progressPercentage + '%' }"></div>
              </div>
              <p class="text-center text-sm text-secondary">{{ currentStepText }}</p>
            </div>
          </div>
        </div>

        <!-- Main Info Grid -->
        <div class="grid grid-cols-1 grid-cols-md-2 gap-lg mb-lg">
          <!-- ERN Information -->
          <div class="card">
            <div class="card-header">
              <h3 class="text-lg font-semibold">ERN Information</h3>
            </div>
            <div class="card-body">
              <div class="info-list">
                <div class="info-item">
                  <label class="text-sm font-medium text-secondary">Message ID</label>
                  <code class="code-text">{{ delivery.ern?.messageId || 'N/A' }}</code>
                </div>
                <div class="info-item">
                  <label class="text-sm font-medium text-secondary">ERN Version</label>
                  <span>{{ delivery.ern?.version || 'Unknown' }}</span>
                </div>
                <div class="info-item">
                  <label class="text-sm font-medium text-secondary">Profile</label>
                  <span>{{ delivery.ern?.profile || 'N/A' }}</span>
                </div>
                <div class="info-item">
                  <label class="text-sm font-medium text-secondary">Sender Party ID</label>
                  <code class="code-text">{{ delivery.ern?.messageSender?.partyId || 'N/A' }}</code>
                </div>
                <div class="info-item">
                  <label class="text-sm font-medium text-secondary">Sender Name</label>
                  <span>{{ delivery.ern?.messageSender?.partyName || 'N/A' }}</span>
                </div>
                <div class="info-item">
                  <label class="text-sm font-medium text-secondary">Created Date</label>
                  <span>{{ formatDate(delivery.ern?.messageCreatedDateTime) || 'N/A' }}</span>
                </div>
                <div class="info-item">
                  <label class="text-sm font-medium text-secondary">Release Count</label>
                  <span class="badge badge-primary">{{ delivery.ern?.releaseCount || 0 }}</span>
                </div>
              </div>
              
              <!-- Raw XML Actions -->
              <div class="flex gap-sm flex-wrap mt-lg pt-lg border-t">
                <button 
                  v-if="delivery.ernXml"
                  @click="viewRawXML" 
                  class="btn btn-secondary btn-sm"
                >
                  <font-awesome-icon icon="eye" />
                  View Raw XML
                </button>
                <button 
                  v-if="delivery.ernXml"
                  @click="downloadRawXML" 
                  class="btn btn-secondary btn-sm"
                >
                  <font-awesome-icon icon="download" />
                  Download XML
                </button>
                <button 
                  @click="debugDeliveryIDs" 
                  class="btn btn-secondary btn-sm"
                  title="Debug delivery ID changes"
                >
                  <font-awesome-icon icon="bug" />
                  Debug IDs
                </button>
              </div>
            </div>
          </div>

          <!-- Package Information -->
          <div class="card">
            <div class="card-header">
              <h3 class="text-lg font-semibold">Package Information</h3>
            </div>
            <div class="card-body">
              <div class="info-list">
                <div class="info-item">
                  <label class="text-sm font-medium text-secondary">Delivery ID</label>
                  <code class="code-text">{{ delivery.id }}</code>
                </div>
                <div class="info-item">
                  <label class="text-sm font-medium text-secondary">Original Path</label>
                  <code class="code-text text-xs">{{ delivery.package?.originalPath || 'N/A' }}</code>
                </div>
                <div class="info-item">
                  <label class="text-sm font-medium text-secondary">Package Size</label>
                  <span>{{ formatFileSize(delivery.package?.size) || 'N/A' }}</span>
                </div>
                <div class="info-item">
                  <label class="text-sm font-medium text-secondary">Content Type</label>
                  <span>{{ delivery.package?.contentType || 'N/A' }}</span>
                </div>
                <div class="info-item">
                  <label class="text-sm font-medium text-secondary">Received At</label>
                  <span>{{ formatDate(delivery.processing?.receivedAt) }}</span>
                </div>
                <div class="info-item">
                  <label class="text-sm font-medium text-secondary">Processing Time</label>
                  <span>{{ getProcessingTime() }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- File Transfer Information -->
        <div v-if="delivery.files || delivery.audioFiles?.length || delivery.imageFiles?.length" class="card mb-lg">
          <div class="card-header flex justify-between items-center">
            <h3 class="text-lg font-semibold">File Transfer Information</h3>
            <span v-if="delivery.files?.transferredAt" class="status-badge status-success">
              <font-awesome-icon icon="check-circle" />
              Completed
            </span>
            <span v-else-if="delivery.processing?.status === 'waiting_for_files'" class="status-badge status-processing">
              <font-awesome-icon icon="cloud-download-alt" spin />
              Transferring
            </span>
          </div>
          <div class="card-body">
            <div class="grid grid-cols-2 grid-cols-md-4 gap-md mb-lg">
              <div class="info-item">
                <label class="text-sm font-medium text-secondary">Requested Audio Files</label>
                <span class="text-lg">{{ delivery.audioFiles?.length || 0 }}</span>
              </div>
              <div class="info-item">
                <label class="text-sm font-medium text-secondary">Requested Image Files</label>
                <span class="text-lg">{{ delivery.imageFiles?.length || 0 }}</span>
              </div>
              <div v-if="delivery.files" class="info-item">
                <label class="text-sm font-medium text-secondary">Transferred Audio Files</label>
                <span class="text-lg">{{ delivery.files.audioCount || 0 }}</span>
              </div>
              <div v-if="delivery.files" class="info-item">
                <label class="text-sm font-medium text-secondary">Transferred Image Files</label>
                <span class="text-lg">{{ delivery.files.imageCount || 0 }}</span>
              </div>
            </div>
            
            <div v-if="delivery.files?.transferredAt" class="info-item mb-md">
              <label class="text-sm font-medium text-secondary">Transfer Completed</label>
              <span>{{ formatDate(delivery.files.transferredAt) }}</span>
            </div>
            
            <div v-if="delivery.files?.transferred" class="info-item mb-lg">
              <label class="text-sm font-medium text-secondary">Storage Path</label>
              <code class="code-text text-xs">deliveries/{{ delivery.sender }}/{{ delivery.id }}/</code>
            </div>
            
            <!-- Transferred Files Details -->
            <div v-if="delivery.files?.transferred">
              <h4 class="text-base font-semibold mb-md">Transferred Files</h4>
              
              <!-- Audio Files -->
              <div v-if="delivery.files.transferred.audio?.length > 0" class="mb-lg">
                <h5 class="text-sm font-medium text-secondary mb-sm">
                  Audio Files ({{ delivery.files.transferred.audio.length }})
                </h5>
                <div class="file-list">
                  <div v-for="(file, index) in delivery.files.transferred.audio" :key="index" class="file-item">
                    <font-awesome-icon icon="music" class="text-tertiary" />
                    <span class="file-name">{{ file.fileName }}</span>
                    <span class="file-size">{{ formatFileSize(file.size) }}</span>
                    <span v-if="file.md5Valid !== undefined" 
                          class="md5-badge"
                          :class="file.md5Valid ? 'md5-valid' : 'md5-invalid'">
                      <font-awesome-icon :icon="file.md5Valid ? 'check-circle' : 'times-circle'" />
                      MD5 {{ file.md5Valid ? 'Valid' : 'Invalid' }}
                    </span>
                  </div>
                </div>
              </div>
              
              <!-- Image Files -->
              <div v-if="delivery.files.transferred.images?.length > 0">
                <h5 class="text-sm font-medium text-secondary mb-sm">
                  Image Files ({{ delivery.files.transferred.images.length }})
                </h5>
                <div class="file-list">
                  <div v-for="(file, index) in delivery.files.transferred.images" :key="index" class="file-item">
                    <font-awesome-icon icon="image" class="text-tertiary" />
                    <span class="file-name">{{ file.fileName }}</span>
                    <span class="file-size">{{ formatFileSize(file.size) }}</span>
                    <span v-if="file.md5Valid !== undefined" 
                          class="md5-badge"
                          :class="file.md5Valid ? 'md5-valid' : 'md5-invalid'">
                      <font-awesome-icon :icon="file.md5Valid ? 'check-circle' : 'times-circle'" />
                      MD5 {{ file.md5Valid ? 'Valid' : 'Invalid' }}
                    </span>                    
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- File Transfer Job Status -->
        <div v-if="fileTransferJob" class="card mb-lg">
          <div class="card-header flex justify-between items-center">
            <h3 class="text-lg font-semibold">File Transfer Job</h3>
            <span class="status-badge" :class="getStatusClass(fileTransferJob.status)">
              {{ fileTransferJob.status }}
            </span>
          </div>
          <div class="card-body">
            <div class="grid grid-cols-2 grid-cols-md-3 gap-md">
              <div class="info-item">
                <label class="text-sm font-medium text-secondary">Job ID</label>
                <code class="code-text text-xs">{{ fileTransferJob.id }}</code>
              </div>
              <div class="info-item">
                <label class="text-sm font-medium text-secondary">Status</label>
                <span>{{ fileTransferJob.status }}</span>
              </div>
              <div v-if="fileTransferJob.startedAt" class="info-item">
                <label class="text-sm font-medium text-secondary">Started</label>
                <span>{{ formatDate(fileTransferJob.startedAt) }}</span>
              </div>
              <div v-if="fileTransferJob.completedAt" class="info-item">
                <label class="text-sm font-medium text-secondary">Completed</label>
                <span>{{ formatDate(fileTransferJob.completedAt) }}</span>
              </div>
              <div v-if="fileTransferJob.summary" class="info-item">
                <label class="text-sm font-medium text-secondary">Summary</label>
                <span>
                  Audio: {{ fileTransferJob.summary.audioTransferred }}/{{ fileTransferJob.summary.audioRequested }},
                  Images: {{ fileTransferJob.summary.imagesTransferred }}/{{ fileTransferJob.summary.imagesRequested }}
                </span>
              </div>
              <div v-if="fileTransferJob.summary?.totalBytesTransferred" class="info-item">
                <label class="text-sm font-medium text-secondary">Total Transferred</label>
                <span>{{ formatFileSize(fileTransferJob.summary.totalBytesTransferred) }}</span>
              </div>
            </div>
            <div v-if="fileTransferJob.error" class="alert-box alert-error mt-md">
              <font-awesome-icon icon="exclamation-circle" />
              {{ fileTransferJob.error }}
            </div>
          </div>
        </div>

        <!-- Validation Results -->
        <div v-if="delivery.validation" class="card mb-lg">
          <div class="card-header flex justify-between items-center">
            <h3 class="text-lg font-semibold">Validation Results</h3>
            <span class="validation-badge" :class="delivery.validation.valid ? 'validation-valid' : 'validation-invalid'">
              <font-awesome-icon :icon="delivery.validation.valid ? 'check-circle' : 'times-circle'" />
              {{ delivery.validation.valid ? 'Valid' : 'Invalid' }}
            </span>
          </div>
          <div class="card-body">
            <!-- Errors -->
            <div v-if="delivery.validation.errors?.length > 0" class="mb-lg">
              <h4 class="text-base font-semibold mb-md flex items-center gap-sm text-error">
                <font-awesome-icon icon="times-circle" />
                Errors ({{ delivery.validation.errors.length }})
              </h4>
              <div class="validation-list">
                <div v-for="(error, index) in delivery.validation.errors" :key="index" 
                     class="validation-item validation-item-error">
                  <span class="validation-number">{{ index + 1 }}</span>
                  <span class="validation-message">{{ error }}</span>
                </div>
              </div>
            </div>

            <!-- Warnings -->
            <div v-if="delivery.validation.warnings?.length > 0" class="mb-lg">
              <h4 class="text-base font-semibold mb-md flex items-center gap-sm text-warning">
                <font-awesome-icon icon="exclamation-triangle" />
                Warnings ({{ delivery.validation.warnings.length }})
              </h4>
              <div class="validation-list">
                <div v-for="(warning, index) in delivery.validation.warnings" :key="index" 
                     class="validation-item validation-item-warning">
                  <span class="validation-number">{{ index + 1 }}</span>
                  <span class="validation-message">{{ warning }}</span>
                </div>
              </div>
            </div>

            <!-- Info -->
            <div v-if="delivery.validation.info?.length > 0" class="mb-lg">
              <h4 class="text-base font-semibold mb-md flex items-center gap-sm text-info">
                <font-awesome-icon icon="info-circle" />
                Information ({{ delivery.validation.info.length }})
              </h4>
              <div class="validation-list">
                <div v-for="(info, index) in delivery.validation.info" :key="index" 
                     class="validation-item validation-item-info">
                  <span class="validation-number">{{ index + 1 }}</span>
                  <span class="validation-message">{{ info }}</span>
                </div>
              </div>
            </div>

            <div v-if="!delivery.validation.errors?.length && !delivery.validation.warnings?.length && !delivery.validation.info?.length" 
                 class="empty-validation">
              <font-awesome-icon icon="check" />
              <span>No issues found - ERN is fully compliant</span>
            </div>
          </div>
        </div>

        <!-- Processed Releases -->
        <div v-if="delivery.processing?.releases?.length > 0" class="card mb-lg">
          <div class="card-header flex justify-between items-center">
            <h3 class="text-lg font-semibold">Processed Releases</h3>
            <span class="count-badge">{{ delivery.processing.releases.length }}</span>
          </div>
          <div class="card-body">
            <div style="overflow-x: auto;">
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
                    <td><code class="code-text text-xs">{{ release.releaseId }}</code></td>
                    <td>{{ release.title }}</td>
                    <td>{{ release.artist }}</td>
                    <td>
                      <span class="badge badge-primary">{{ release.trackCount }}</span>
                    </td>
                    <td>
                      <span class="status-badge status-success">Active</span>
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
        <div v-if="delivery.acknowledgment" class="card mb-lg">
          <div class="card-header flex justify-between items-center">
            <h3 class="text-lg font-semibold">Acknowledgment</h3>
            <span class="status-badge status-success">Sent</span>
          </div>
          <div class="card-body">
            <div class="grid grid-cols-1 grid-cols-md-3 gap-md mb-lg">
              <div class="info-item">
                <label class="text-sm font-medium text-secondary">Message ID</label>
                <code class="code-text text-xs">{{ delivery.acknowledgment.messageId }}</code>
              </div>
              <div class="info-item">
                <label class="text-sm font-medium text-secondary">Sent At</label>
                <span>{{ formatDate(delivery.acknowledgment.sentAt) }}</span>
              </div>
              <div class="info-item">
                <label class="text-sm font-medium text-secondary">Document ID</label>
                <code class="code-text text-xs">{{ delivery.acknowledgment.documentId }}</code>
              </div>
            </div>
            <div class="flex gap-sm">
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
        <div v-if="delivery.processing?.error" class="card error-card mb-lg">
          <div class="card-header">
            <h3 class="text-lg font-semibold">Error Details</h3>
          </div>
          <div class="card-body">
            <div class="alert-box alert-error mb-lg">
              <font-awesome-icon icon="exclamation-circle" />
              <span>{{ delivery.processing.error }}</span>
            </div>
            <div v-if="delivery.processing.errorDetails" class="mb-lg">
              <h4 class="text-sm font-semibold mb-sm text-secondary">Stack Trace</h4>
              <pre class="code-block"><code>{{ delivery.processing.errorDetails }}</code></pre>
            </div>
            <div class="flex gap-sm">
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

        <!-- Raw Data (Debug) -->
        <div v-if="showDebug" class="card mb-lg">
          <div class="card-header flex justify-between items-center">
            <h3 class="text-lg font-semibold">Raw Data (Debug)</h3>
            <button @click="showDebug = false" class="btn-icon">
              <font-awesome-icon icon="times" />
            </button>
          </div>
          <div class="card-body">
            <pre class="code-block"><code>{{ JSON.stringify(delivery, null, 2) }}</code></pre>
          </div>
        </div>
      </div>

      <!-- Not Found -->
      <div v-else class="empty-state">
        <font-awesome-icon icon="inbox" class="empty-icon" />
        <h3 class="text-xl font-semibold mb-sm">Delivery Not Found</h3>
        <p class="mb-xl">The requested delivery could not be found</p>
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

      <!-- Raw XML Modal -->
      <div v-if="showXMLModal" class="modal-overlay" @click="closeXMLModal">
        <div class="modal" @click.stop>
          <div class="modal-header">
            <h3 class="text-lg font-semibold">Raw ERN XML</h3>
            <div class="flex gap-sm">
              <button @click="copyXMLToClipboard" class="btn-icon" title="Copy to Clipboard">
                <font-awesome-icon icon="copy" />
              </button>
              <button @click="downloadRawXML" class="btn-icon" title="Download">
                <font-awesome-icon icon="download" />
              </button>
              <button @click="closeXMLModal" class="btn-icon" title="Close">
                <font-awesome-icon icon="times" />
              </button>
            </div>
          </div>
          <div class="modal-body">
            <pre class="xml-content"><code>{{ formatXML(delivery.ernXml) }}</code></pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

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

.page-header {
  margin-bottom: var(--space-xl);
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

/* Timeline Component - Fixed spacing */
.timeline {
  position: relative;
  padding-left: 48px;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 15px;
  top: 16px;
  bottom: 16px;
  width: 2px;
  background-color: var(--color-border);
}

.timeline-step {
  position: relative;
  padding-bottom: var(--space-lg);
  min-height: 60px;
}

.timeline-step-last {
  padding-bottom: 0;
}

.timeline-marker {
  position: absolute;
  left: -33px;
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

.timeline-marker-completed {
  background-color: var(--color-success);
  border-color: var(--color-success);
  color: white;
}

.timeline-marker-current {
  background-color: var(--color-info);
  border-color: var(--color-info);
  color: white;
}

.timeline-marker-failed {
  background-color: var(--color-error);
  border-color: var(--color-error);
  color: white;
}

.timeline-marker-cancelled {
  background-color: var(--color-text-tertiary);
  border-color: var(--color-text-tertiary);
  color: white;
}

.timeline-content {
  min-height: 32px;
}

/* Progress Bar */
.progress-bar {
  height: 8px;
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-info));
  transition: width 0.3s ease;
}

/* Info Components */
.info-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

/* Code Display */
.code-text {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  background-color: var(--color-bg-secondary);
  padding: var(--space-xs);
  border-radius: var(--radius-sm);
  word-break: break-all;
}

.code-block {
  background-color: var(--color-bg-tertiary);
  padding: var(--space-md);
  border-radius: var(--radius-md);
  overflow-x: auto;
  font-size: var(--text-xs);
  max-height: 400px;
  overflow-y: auto;
}

/* Alert Boxes */
.alert-box {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.alert-error {
  background-color: rgba(234, 67, 53, 0.1);
  color: var(--color-error);
}

.alert-warning {
  background-color: rgba(251, 188, 4, 0.1);
  color: var(--color-warning);
}

.alert-info {
  background-color: rgba(66, 133, 244, 0.1);
  color: var(--color-info);
}

/* Status Badges */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  text-transform: uppercase;
}

.status-success { background-color: var(--color-success); color: white; }
.status-error { background-color: var(--color-error); color: white; }
.status-processing { background-color: var(--color-info); color: white; }
.status-pending { background-color: var(--color-warning); color: white; }
.status-default { background-color: var(--color-text-tertiary); color: white; }

/* Badges */
.badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.badge-primary {
  background-color: var(--color-primary-light);
  color: var(--color-primary);
}

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

/* File Transfer */
.file-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.file-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
}

.file-name {
  flex: 1;
  font-family: var(--font-mono);
  word-break: break-all;
}

.file-size {
  color: var(--color-text-tertiary);
  font-size: var(--text-xs);
  white-space: nowrap;
}

.md5-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  margin-left: auto;
}

.md5-valid {
  background-color: rgba(52, 168, 83, 0.1);
  color: var(--color-success);
}

.md5-invalid {
  background-color: rgba(234, 67, 53, 0.1);
  color: var(--color-error);
}

/* Validation */
.validation-badge {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.validation-valid {
  background-color: var(--color-success);
  color: white;
}

.validation-invalid {
  background-color: var(--color-error);
  color: white;
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

.validation-item-error {
  background-color: rgba(234, 67, 53, 0.1);
  color: var(--color-error);
}

.validation-item-warning {
  background-color: rgba(251, 188, 4, 0.1);
  color: var(--color-warning);
}

.validation-item-info {
  background-color: rgba(66, 133, 244, 0.1);
  color: var(--color-info);
}

.validation-number {
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

.validation-message {
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

/* Data Table */
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

/* Error Card */
.error-card {
  border-color: var(--color-error);
}

.error-card .card-header {
  background-color: rgba(234, 67, 53, 0.1);
}

/* Modals */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
}

.modal {
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 90vw;
  max-width: 1200px;
  height: 80vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-lg);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.modal-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.xml-content {
  flex: 1;
  margin: 0;
  padding: var(--space-lg);
  background-color: var(--color-bg-tertiary);
  border: none;
  overflow: auto;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* Button Variants */
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

/* Debug Toggle */
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

/* Responsive */
@media (max-width: 768px) {
  .ingestion-detail-page {
    padding: var(--space-md);
  }
  
  .modal {
    width: 95vw;
    height: 90vh;
  }
  
  .modal-header {
    flex-direction: column;
    gap: var(--space-sm);
  }
}
</style>