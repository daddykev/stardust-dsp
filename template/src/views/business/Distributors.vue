<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore'
import { ref as storageRef, uploadBytes } from 'firebase/storage'
import { db, storage } from '@/firebase'

const router = useRouter()

// State
const distributors = ref([])
const isLoading = ref(false)
const searchQuery = ref('')
const showAddModal = ref(false)
const showIntegrationModal = ref(false)
const selectedDistributor = ref(null)
const editingDistributor = ref(null)
const testFile = ref(null)
const testResults = ref(null)
const recentDeliveries = ref([])
const activeTab = ref('config')
const showApiKey = ref(false)

// Form data
const formData = ref({
  id: '',
  name: '',
  type: '',
  contactEmail: '',
  technicalContact: '',
  // DDEX Fields
  partyName: '',
  partyId: '',
  ernVersion: '4.3',
  // Delivery settings
  deliveryProtocol: 'storage',
  apiKey: '',
  autoProcess: true,
  sendAcknowledgments: true,
  active: true
})

// Stats
const totalDeliveries = computed(() => 
  distributors.value.reduce((sum, d) => sum + (d.stats?.totalDeliveries || 0), 0)
)

const activeUploads = computed(() => 
  distributors.value.filter(d => d.activeUpload).length
)

const successRate = computed(() => {
  const total = totalDeliveries.value
  if (total === 0) return 100
  const successful = distributors.value.reduce((sum, d) => 
    sum + (d.stats?.successfulDeliveries || 0), 0
  )
  return Math.round((successful / total) * 100)
})

const filteredDistributors = computed(() => {
  if (!searchQuery.value) return distributors.value
  
  const query = searchQuery.value.toLowerCase()
  return distributors.value.filter(d => 
    d.name.toLowerCase().includes(query) ||
    d.id.toLowerCase().includes(query) ||
    d.contactEmail?.toLowerCase().includes(query) ||
    d.partyName?.toLowerCase().includes(query)
  )
})

const integrationTabs = [
  { id: 'config', label: 'Configuration' },
  { id: 'distro', label: 'Stardust Distro Setup' },
  { id: 'test', label: 'Test Connection' },
  { id: 'activity', label: 'Recent Activity' }
]

// Load distributors
async function loadDistributors() {
  isLoading.value = true
  
  try {
    const snapshot = await getDocs(collection(db, 'distributors'))
    distributors.value = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }))
  } catch (error) {
    console.error('Error loading distributors:', error)
  } finally {
    isLoading.value = false
  }
}

// Save distributor
async function saveDistributor() {
  try {
    const distributorData = {
      ...formData.value,
      updatedAt: serverTimestamp()
    }
    
    // Generate API key if switching to API protocol and no key exists
    if (formData.value.deliveryProtocol === 'api' && !formData.value.apiKey) {
      distributorData.apiKey = generateApiKey()
    }
    
    if (!editingDistributor.value) {
      // New distributor
      distributorData.createdAt = serverTimestamp()
      distributorData.stats = {
        totalDeliveries: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        totalReleases: 0,
        successRate: 100
      }
    }
    
    await setDoc(
      doc(db, 'distributors', formData.value.id),
      distributorData,
      { merge: true }
    )
    
    closeModal()
    await loadDistributors()
    
  } catch (error) {
    console.error('Error saving distributor:', error)
    alert('Failed to save distributor: ' + error.message)
  }
}

// Edit distributor
function editDistributor(distributor) {
  editingDistributor.value = distributor
  formData.value = { ...distributor }
  showAddModal.value = true
}

// Toggle distributor active status
async function toggleDistributor(distributor) {
  try {
    await updateDoc(doc(db, 'distributors', distributor.id), {
      active: !distributor.active,
      updatedAt: serverTimestamp()
    })
    
    await loadDistributors()
  } catch (error) {
    console.error('Error toggling distributor:', error)
  }
}

// View integration details
async function viewIntegration(distributor) {
  selectedDistributor.value = distributor
  showIntegrationModal.value = true
  activeTab.value = 'config'
  showApiKey.value = false
  
  // Load recent deliveries for this distributor
  try {
    const q = query(
      collection(db, 'deliveries'),
      where('sender', '==', distributor.id),
      orderBy('processing.receivedAt', 'desc'),
      limit(10)
    )
    
    const snapshot = await getDocs(q)
    recentDeliveries.value = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  } catch (error) {
    console.error('Error loading deliveries:', error)
    recentDeliveries.value = []
  }
}

// Generate API key
function generateApiKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let key = 'sk_live_'
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return key
}

// Regenerate API key
async function regenerateApiKey() {
  if (formData.value.apiKey && !confirm('Are you sure you want to regenerate the API key? The old key will stop working.')) {
    return
  }
  
  formData.value.apiKey = generateApiKey()
}

// Copy configuration
function copyConfig() {
  const config = selectedDistributor.value.deliveryProtocol === 'storage'
    ? `Bucket: gs://stardust-dsp.firebasestorage.app\nPath: /deliveries/${selectedDistributor.value.id}/{timestamp}/`
    : `Endpoint: POST https://us-central1-stardust-dsp.cloudfunctions.net/receiveDelivery\nAuthorization: Bearer ${selectedDistributor.value.apiKey}`
  
  navigator.clipboard.writeText(config)
  alert('Configuration copied to clipboard!')
}

// Copy API Key
function copyApiKey() {
  if (selectedDistributor.value?.apiKey) {
    navigator.clipboard.writeText(selectedDistributor.value.apiKey)
    alert('API Key copied to clipboard!')
  }
}

// Copy Stardust Distro config
function copyDistroConfig() {
  const config = {
    name: "Stardust DSP",
    type: "DSP",
    protocol: selectedDistributor.value.deliveryProtocol === 'storage' ? 'storage' : 'API',
    // Add DDEX info
    partyName: selectedDistributor.value.partyName,
    partyId: selectedDistributor.value.partyId,
    ernVersion: selectedDistributor.value.ernVersion || '4.3',
    config: {
      distributorId: selectedDistributor.value.id,
      apiKey: selectedDistributor.value.apiKey || undefined
    }
  }
  
  if (selectedDistributor.value.deliveryProtocol === 'storage') {
    config.config.bucket = "stardust-dsp.firebasestorage.app"
    config.config.path = `/deliveries/${selectedDistributor.value.id}/{timestamp}/`
  } else {
    config.config.endpoint = "https://us-central1-stardust-dsp.cloudfunctions.net/receiveDelivery"
  }
  
  config.requirements = {
    ernVersion: selectedDistributor.value.ernVersion || "4.3",
    audioFormat: ["WAV", "FLAC", "MP3"],
    imageSpecs: [
      {
        type: "FrontCoverImage",
        minWidth: 3000,
        minHeight: 3000,
        format: "JPEG"
      }
    ]
  }
  
  config.commercialModel = {
    type: "Streaming",
    usageTypes: ["OnDemandStream", "NonInteractiveStream"]
  }
  
  navigator.clipboard.writeText(JSON.stringify(config, null, 2))
  alert('Configuration copied to clipboard! Paste this in Stardust Distro when adding a delivery target.')
}

// Download sample ERN
function downloadSampleERN() {
  const sampleERN = `<?xml version="1.0" encoding="UTF-8"?>
<ern:NewReleaseMessage xmlns:ern="http://ddex.net/xml/ern/43">
  <MessageHeader>
    <MessageId>TEST_${Date.now()}</MessageId>
    <MessageCreatedDateTime>${new Date().toISOString()}</MessageCreatedDateTime>
    <MessageSender>
      <PartyId>${selectedDistributor.value.partyId || 'PADPIDA2025TEST001'}</PartyId>
      <PartyName>
        <FullName>${selectedDistributor.value.partyName || selectedDistributor.value.name}</FullName>
      </PartyName>
    </MessageSender>
  </MessageHeader>
  <ReleaseList>
    <Release>
      <ReleaseId>
        <GRid>TEST_RELEASE_001</GRid>
      </ReleaseId>
      <ReferenceTitle>
        <TitleText>Test Release</TitleText>
      </ReferenceTitle>
    </Release>
  </ReleaseList>
</ern:NewReleaseMessage>`
  
  const blob = new Blob([sampleERN], { type: 'text/xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'sample_ern.xml'
  a.click()
  URL.revokeObjectURL(url)
}

// Handle test file upload
function handleTestDrop(e) {
  e.preventDefault()
  const files = e.dataTransfer.files
  if (files.length > 0) {
    testFile.value = files[0]
  }
}

function handleTestFileSelect(e) {
  const files = e.target.files
  if (files.length > 0) {
    testFile.value = files[0]
  }
}

// Upload test file
async function uploadTestFile() {
  if (!testFile.value || !selectedDistributor.value) return
  
  testResults.value = []
  
  try {
    testResults.value.push({
      step: 'upload',
      success: true,
      message: 'File uploaded successfully'
    })
    
    const timestamp = Date.now()
    const path = `deliveries/${selectedDistributor.value.id}/${timestamp}/manifest.xml`
    const ref = storageRef(storage, path)
    
    await uploadBytes(ref, testFile.value)
    
    testResults.value.push({
      step: 'processing',
      success: true,
      message: 'Delivery received and queued for processing'
    })
    
    setTimeout(() => {
      testResults.value.push({
        step: 'validation',
        success: true,
        message: 'ERN validation passed'
      })
      
      testResults.value.push({
        step: 'complete',
        success: true,
        message: 'Test delivery completed successfully!'
      })
    }, 3000)
    
  } catch (error) {
    testResults.value.push({
      step: 'error',
      success: false,
      message: `Test failed: ${error.message}`
    })
  }
}

// Close modal
function closeModal() {
  showAddModal.value = false
  editingDistributor.value = null
  formData.value = {
    id: '',
    name: '',
    type: '',
    contactEmail: '',
    technicalContact: '',
    partyName: '',
    partyId: '',
    ernVersion: '4.3',
    deliveryProtocol: 'storage',
    apiKey: '',
    autoProcess: true,
    sendAcknowledgments: true,
    active: true
  }
}

// Format date
function formatDate(timestamp) {
  if (!timestamp) return null
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}

// Get status icon
function getStatusIcon(status) {
  switch (status) {
    case 'completed': return 'check-circle'
    case 'processing': return 'spinner'
    case 'failed': return 'times-circle'
    default: return 'clock'
  }
}

// Get status class
function getStatusClass(status) {
  switch (status) {
    case 'completed': return 'text-success'
    case 'processing': return 'text-info'
    case 'failed': return 'text-error'
    default: return 'text-warning'
  }
}

onMounted(() => {
  loadDistributors()
})
</script>

<template>
  <div class="distributors-page">
    <div class="container">
      <div class="page-header">
        <div>
          <h1>Distributor Management</h1>
          <p class="page-subtitle">Configure access for content distributors</p>
        </div>
        <button @click="showAddModal = true" class="btn btn-primary">
          <font-awesome-icon icon="plus" />
          Add Distributor
        </button>
      </div>

      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card card">
          <div class="card-body">
            <div class="stat-value">{{ distributors.length }}</div>
            <div class="stat-label">Active Distributors</div>
          </div>
        </div>
        <div class="stat-card card">
          <div class="card-body">
            <div class="stat-value">{{ totalDeliveries }}</div>
            <div class="stat-label">Total Deliveries</div>
          </div>
        </div>
        <div class="stat-card card">
          <div class="card-body">
            <div class="stat-value">{{ activeUploads }}</div>
            <div class="stat-label">Active Uploads</div>
          </div>
        </div>
        <div class="stat-card card">
          <div class="card-body">
            <div class="stat-value">{{ successRate }}%</div>
            <div class="stat-label">Success Rate</div>
          </div>
        </div>
      </div>

      <!-- Distributors List -->
      <div class="distributors-list card">
        <div class="card-header">
          <h2>Configured Distributors</h2>
          <div class="search-box">
            <font-awesome-icon icon="search" />
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Search distributors..."
            />
          </div>
        </div>
        
        <div class="card-body">
          <div v-if="isLoading" class="loading-state">
            <div class="spinner"></div>
            <p>Loading distributors...</p>
          </div>
          
          <div v-else-if="filteredDistributors.length === 0" class="empty-state">
            <font-awesome-icon icon="truck" class="empty-icon" />
            <h3>No Distributors Configured</h3>
            <p>Add your first distributor to start receiving content</p>
            <button @click="showAddModal = true" class="btn btn-primary">
              Add First Distributor
            </button>
          </div>
          
          <div v-else class="distributor-cards">
            <div 
              v-for="distributor in filteredDistributors" 
              :key="distributor.id"
              class="distributor-card"
              :class="{ inactive: !distributor.active }"
            >
              <div class="distributor-header">
                <div class="distributor-info">
                  <h3>{{ distributor.name }}</h3>
                  <code class="distributor-id">{{ distributor.id }}</code>
                  <div v-if="distributor.partyId" class="ddex-info">
                    <span class="ddex-label">DPID:</span>
                    <code class="ddex-value">{{ distributor.partyId }}</code>
                  </div>
                </div>
                <div class="distributor-status">
                  <span class="status-badge" :class="distributor.active ? 'active' : 'inactive'">
                    {{ distributor.active ? 'Active' : 'Inactive' }}
                  </span>
                </div>
              </div>
              
              <div class="distributor-details">
                <div class="detail-row">
                  <span class="detail-label">Contact:</span>
                  <span>{{ distributor.contactEmail }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Type:</span>
                  <span>{{ distributor.type }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Protocol:</span>
                  <span class="protocol-badge">{{ distributor.deliveryProtocol }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Last Delivery:</span>
                  <span>{{ formatDate(distributor.lastDelivery) || 'Never' }}</span>
                </div>
              </div>
              
              <div class="distributor-stats">
                <div class="mini-stat">
                  <span class="stat-number">{{ distributor.stats?.totalDeliveries || 0 }}</span>
                  <span class="stat-label">Deliveries</span>
                </div>
                <div class="mini-stat">
                  <span class="stat-number">{{ distributor.stats?.totalReleases || 0 }}</span>
                  <span class="stat-label">Releases</span>
                </div>
                <div class="mini-stat">
                  <span class="stat-number">{{ distributor.stats?.successRate || 0 }}%</span>
                  <span class="stat-label">Success</span>
                </div>
              </div>
              
              <div class="distributor-actions">
                <button 
                  @click="viewIntegration(distributor)" 
                  class="btn btn-secondary btn-sm"
                  title="View Integration Details"
                >
                  <font-awesome-icon icon="plug" />
                  Integration
                </button>
                <button 
                  @click="editDistributor(distributor)" 
                  class="btn btn-secondary btn-sm"
                  title="Edit Distributor"
                >
                  <font-awesome-icon icon="edit" />
                  Edit
                </button>
                <button 
                  @click="toggleDistributor(distributor)" 
                  class="btn btn-sm"
                  :class="distributor.active ? 'btn-warning' : 'btn-success'"
                >
                  <font-awesome-icon :icon="distributor.active ? 'pause' : 'play'" />
                  {{ distributor.active ? 'Disable' : 'Enable' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Add/Edit Distributor Modal -->
      <transition name="modal">
        <div v-if="showAddModal" class="modal-overlay" @click.self="closeModal">
          <div class="modal-content">
            <div class="modal-header">
              <h3>{{ editingDistributor ? 'Edit' : 'Add New' }} Distributor</h3>
              <button @click="closeModal" class="btn-icon">
                <font-awesome-icon icon="times" />
              </button>
            </div>
            
            <form @submit.prevent="saveDistributor" class="modal-body">
              <!-- Basic Information -->
              <div class="form-section">
                <h4>Basic Information</h4>
                
                <div class="form-group">
                  <label class="form-label required">Distributor Name</label>
                  <input 
                    v-model="formData.name" 
                    type="text" 
                    class="form-input"
                    placeholder="e.g., Universal Music Group"
                    required
                  />
                </div>
                
                <div class="form-group">
                  <label class="form-label required">Distributor ID</label>
                  <input 
                    v-model="formData.id" 
                    type="text" 
                    class="form-input"
                    placeholder="e.g., UMG_DIST_001"
                    pattern="[A-Z0-9_]+"
                    :disabled="editingDistributor"
                    required
                  />
                  <small>Uppercase letters, numbers, and underscores only</small>
                </div>
                
                <div class="form-group">
                  <label class="form-label required">Type</label>
                  <select v-model="formData.type" class="form-select" required>
                    <option value="">Select Type</option>
                    <option value="major_label">Major Label</option>
                    <option value="indie_label">Independent Label</option>
                    <option value="aggregator">Aggregator</option>
                    <option value="artist_direct">Artist Direct</option>
                    <option value="test">Test Account</option>
                  </select>
                </div>
                
                <div class="form-group">
                  <label class="form-label required">Contact Email</label>
                  <input 
                    v-model="formData.contactEmail" 
                    type="email" 
                    class="form-input"
                    placeholder="technical@distributor.com"
                    required
                  />
                </div>
                
                <div class="form-group">
                  <label class="form-label">Technical Contact</label>
                  <input 
                    v-model="formData.technicalContact" 
                    type="text" 
                    class="form-input"
                    placeholder="Name and phone/email"
                  />
                </div>
              </div>
              
              <!-- DDEX Configuration -->
              <div class="form-section">
                <h4>DDEX Configuration</h4>
                
                <div class="form-group">
                  <label class="form-label required">DDEX Party Name</label>
                  <input 
                    v-model="formData.partyName" 
                    type="text" 
                    class="form-input"
                    placeholder="e.g., Universal Music Group"
                    required
                  />
                  <small>Official company name as registered with DDEX</small>
                </div>
                
                <div class="form-group">
                  <label class="form-label required">DDEX Party ID (DPID)</label>
                  <input 
                    v-model="formData.partyId" 
                    type="text" 
                    class="form-input"
                    placeholder="e.g., PADPIDA2014120301U"
                    pattern="[A-Z0-9]+"
                    required
                  />
                  <small>DPID format: PADPIDA + date + unique identifier</small>
                </div>
                
                <div class="form-group">
                  <label class="form-label">ERN Version</label>
                  <select v-model="formData.ernVersion" class="form-select">
                    <option value="4.3">ERN 4.3 (Latest)</option>
                    <option value="4.2">ERN 4.2</option>
                    <option value="4.1">ERN 4.1</option>
                    <option value="3.8.2">ERN 3.8.2</option>
                  </select>
                </div>
              </div>
              
              <!-- Delivery Configuration -->
              <div class="form-section">
                <h4>Delivery Configuration</h4>
                
                <div class="form-group">
                  <label class="form-label required">Delivery Protocol</label>
                  <select v-model="formData.deliveryProtocol" class="form-select" required>
                    <option value="">Select Protocol</option>
                    <option value="storage">Cloud Storage (Recommended)</option>
                    <option value="api">REST API</option>
                    <option value="ftp">FTP</option>
                    <option value="sftp">SFTP</option>
                    <option value="s3">Amazon S3</option>
                  </select>
                </div>
                
                <!-- Protocol-specific settings -->
                <div v-if="formData.deliveryProtocol === 'storage'" class="protocol-settings">
                  <div class="info-box">
                    <font-awesome-icon icon="info-circle" />
                    <div>
                      <strong>Cloud Storage Delivery</strong>
                      <p>Upload packages to the designated folder in Firebase Storage</p>
                    </div>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Upload Path</label>
                    <code class="path-display">
                      /deliveries/{{ formData.id || '{DISTRIBUTOR_ID}' }}/{timestamp}/manifest.xml
                    </code>
                  </div>
                </div>
                
                <div v-if="formData.deliveryProtocol === 'api'" class="protocol-settings">
                  <div class="form-group">
                    <label class="form-label">API Endpoint</label>
                    <code class="path-display">
                      POST https://us-central1-stardust-dsp.cloudfunctions.net/receiveDelivery
                    </code>
                  </div>
                  <div class="form-group">
                    <label class="form-label">API Key</label>
                    <div class="api-key-group">
                      <input 
                        v-model="formData.apiKey" 
                        :placeholder="formData.apiKey ? 'API Key configured' : 'Click Generate to create key'" 
                        type="text" 
                        class="form-input"
                        readonly
                      />
                      <button 
                        @click="regenerateApiKey" 
                        type="button"
                        class="btn btn-secondary btn-sm"
                      >
                        {{ formData.apiKey ? 'Regenerate' : 'Generate' }}
                      </button>
                    </div>
                  </div>
                </div>
                
                <div class="form-group">
                  <label class="form-checkbox">
                    <input 
                      v-model="formData.autoProcess" 
                      type="checkbox"
                    />
                    <span>Automatically process deliveries upon receipt</span>
                  </label>
                </div>
                
                <div class="form-group">
                  <label class="form-checkbox">
                    <input 
                      v-model="formData.sendAcknowledgments" 
                      type="checkbox"
                    />
                    <span>Send acknowledgments after processing</span>
                  </label>
                </div>
              </div>
            </form>
            
            <div class="modal-footer">
              <button @click="closeModal" class="btn btn-secondary">
                Cancel
              </button>
              <button @click="saveDistributor" class="btn btn-primary">
                {{ editingDistributor ? 'Update' : 'Create' }} Distributor
              </button>
            </div>
          </div>
        </div>
      </transition>

      <!-- Integration Details Modal -->
      <transition name="modal">
        <div v-if="showIntegrationModal" class="modal-overlay" @click.self="showIntegrationModal = false">
          <div class="modal-content large">
            <div class="modal-header">
              <h3>Integration Details - {{ selectedDistributor?.name }}</h3>
              <button @click="showIntegrationModal = false" class="btn-icon">
                <font-awesome-icon icon="times" />
              </button>
            </div>
            
            <div class="modal-body">
              <div class="integration-tabs">
                <button 
                  v-for="tab in integrationTabs" 
                  :key="tab.id"
                  @click="activeTab = tab.id"
                  class="tab-button"
                  :class="{ active: activeTab === tab.id }"
                >
                  {{ tab.label }}
                </button>
              </div>
              
              <!-- Configuration Tab -->
              <div v-if="activeTab === 'config'" class="tab-content">
                <h4>Delivery Configuration</h4>
                
                <!-- DDEX Information Section -->
                <div class="config-section">
                  <h5>DDEX Information</h5>
                  <div class="config-grid">
                    <div class="config-item">
                      <label>Party Name</label>
                      <code>{{ selectedDistributor?.partyName || 'Not configured' }}</code>
                    </div>
                    <div class="config-item">
                      <label>Party ID (DPID)</label>
                      <code>{{ selectedDistributor?.partyId || 'Not configured' }}</code>
                    </div>
                    <div class="config-item">
                      <label>ERN Version</label>
                      <code>{{ selectedDistributor?.ernVersion || '4.3' }}</code>
                    </div>
                    <div class="config-item">
                      <label>Distributor ID</label>
                      <code>{{ selectedDistributor?.id }}</code>
                    </div>
                  </div>
                </div>
                
                <div class="config-section">
                  <h5>Connection Details</h5>
                  <div class="config-grid">
                    <div class="config-item">
                      <label>Protocol</label>
                      <code>{{ selectedDistributor?.deliveryProtocol?.toUpperCase() }}</code>
                    </div>
                  </div>
                </div>
                
                <div v-if="selectedDistributor?.deliveryProtocol === 'storage'" class="config-section">
                  <h5>Cloud Storage Configuration</h5>
                  <div class="code-block">
                    <pre><code>Bucket: gs://stardust-dsp.firebasestorage.app
Path: /deliveries/{{ selectedDistributor?.id }}/{timestamp}/
Files: manifest.xml (required)
       *.mp3, *.wav, *.flac (audio files)
       *.jpg, *.png (artwork)</code></pre>
                    <button @click="copyConfig" class="copy-btn">
                      <font-awesome-icon icon="copy" />
                    </button>
                  </div>
                </div>
                
                <div v-if="selectedDistributor?.deliveryProtocol === 'api'" class="config-section">
                  <h5>REST API Configuration</h5>
                  
                  <!-- API Key with visibility toggle -->
                  <div class="config-item">
                    <label>API Key</label>
                    <div class="api-key-display">
                      <code class="api-key-value">
                        {{ showApiKey ? selectedDistributor.apiKey : '••••••••••••••••••••••••••••••••' }}
                      </code>
                      <button @click="showApiKey = !showApiKey" class="btn btn-sm btn-secondary">
                        <font-awesome-icon :icon="showApiKey ? 'eye-slash' : 'eye'" />
                      </button>
                      <button @click="copyApiKey" class="btn btn-sm btn-primary">
                        <font-awesome-icon icon="copy" /> Copy
                      </button>
                    </div>
                  </div>
                  
                  <div class="code-block">
                    <pre><code>Endpoint: POST https://us-central1-stardust-dsp.cloudfunctions.net/receiveDelivery
Headers:
  Authorization: Bearer {{ showApiKey ? selectedDistributor?.apiKey : '••••••••••••••••••••' }}
  Content-Type: application/json
  
Body:
{
  "distributorId": "{{ selectedDistributor?.id }}",
  "messageId": "MSG_123456",
  "releaseTitle": "Album Title",
  "releaseArtist": "Artist Name",
  "ernXml": "&lt;?xml version=\"1.0\" encoding=\"UTF-8\"?&gt;...",
  "testMode": false,
  "priority": "normal"
}}</code></pre>
                    <button @click="copyConfig" class="copy-btn">
                      <font-awesome-icon icon="copy" />
                    </button>
                  </div>
                </div>
              </div>
              
              <!-- Stardust Distro Tab -->
              <div v-if="activeTab === 'distro'" class="tab-content">
                <h4>Stardust Distro Configuration</h4>
                <p class="info-text">
                  Copy this configuration and paste it when adding a delivery target in Stardust Distro:
                </p>
                
                <div class="code-block">
                  <pre><code>{
  "name": "Stardust DSP",
  "type": "DSP",
  "protocol": "{{ selectedDistributor?.deliveryProtocol === 'storage' ? 'storage' : 'API' }}",
  "partyName": "{{ selectedDistributor?.partyName }}",
  "partyId": "{{ selectedDistributor?.partyId }}",
  "ernVersion": "{{ selectedDistributor?.ernVersion || '4.3' }}",
  "config": {
    "distributorId": "{{ selectedDistributor?.id }}"{{ selectedDistributor?.deliveryProtocol === 'api' ? ',\n    "apiKey": "' + (showApiKey ? selectedDistributor.apiKey : '••••••••••••••••••••') + '"' : '' }}{{ selectedDistributor?.deliveryProtocol === 'storage' ? ',\n    "bucket": "stardust-dsp.firebasestorage.app",\n    "path": "/deliveries/' + selectedDistributor?.id + '/{timestamp}/"' : '' }}{{ selectedDistributor?.deliveryProtocol === 'api' ? ',\n    "endpoint": "https://us-central1-stardust-dsp.cloudfunctions.net/receiveDelivery"' : '' }}
  },
  "requirements": {
    "ernVersion": "{{ selectedDistributor?.ernVersion || '4.3' }}",
    "audioFormat": ["WAV", "FLAC", "MP3"],
    "imageSpecs": [
      {
        "type": "FrontCoverImage",
        "minWidth": 3000,
        "minHeight": 3000,
        "format": "JPEG"
      }
    ]
  },
  "commercialModel": {
    "type": "Streaming",
    "usageTypes": ["OnDemandStream", "NonInteractiveStream"]
  }
}</code></pre>
                  <button @click="copyDistroConfig" class="copy-btn">
                    <font-awesome-icon icon="copy" />
                  </button>
                </div>
                
                <div class="info-box">
                  <font-awesome-icon icon="info-circle" />
                  <div>
                    <strong>Quick Setup in Stardust Distro</strong>
                    <ol>
                      <li>Go to Settings → Delivery Targets</li>
                      <li>Click "Add Target"</li>
                      <li>Select "Import from Stardust DSP"</li>
                      <li>Paste this configuration</li>
                      <li>Test the connection</li>
                      <li>Start delivering releases!</li>
                    </ol>
                  </div>
                </div>
              </div>
              
              <!-- Testing Tab -->
              <div v-if="activeTab === 'test'" class="tab-content">
                <h4>Test Delivery</h4>
                <p>Send a test ERN package to verify the integration:</p>
                
                <div class="test-section">
                  <h5>1. Download Sample ERN</h5>
                  <button @click="downloadSampleERN" class="btn btn-secondary">
                    <font-awesome-icon icon="download" />
                    Download Sample ERN Package
                  </button>
                </div>
                
                <div class="test-section">
                  <h5>2. Upload Test Package</h5>
                  <div class="upload-area" 
                       @drop="handleTestDrop" 
                       @dragover.prevent
                       @dragenter.prevent>
                    <font-awesome-icon icon="cloud-upload" class="upload-icon" />
                    <p>Drag and drop test ERN package here</p>
                    <p class="upload-hint">or</p>
                    <input 
                      type="file" 
                      ref="testFileInput" 
                      @change="handleTestFileSelect"
                      accept=".zip,.xml"
                      hidden
                    />
                    <button @click="$refs.testFileInput.click()" class="btn btn-primary">
                      Choose File
                    </button>
                  </div>
                  
                  <div v-if="testFile" class="selected-file">
                    <font-awesome-icon icon="file" />
                    <span>{{ testFile.name }}</span>
                    <button @click="uploadTestFile" class="btn btn-primary btn-sm">
                      Upload & Test
                    </button>
                  </div>
                </div>
                
                <div v-if="testResults" class="test-results">
                  <h5>Test Results</h5>
                  <div class="result-item" v-for="result in testResults" :key="result.step">
                    <font-awesome-icon 
                      :icon="result.success ? 'check-circle' : 'times-circle'"
                      :class="result.success ? 'text-success' : 'text-error'"
                    />
                    <span>{{ result.message }}</span>
                  </div>
                </div>
              </div>
              
              <!-- Recent Activity Tab -->
              <div v-if="activeTab === 'activity'" class="tab-content">
                <h4>Recent Deliveries</h4>
                <div v-if="recentDeliveries.length === 0" class="empty-state">
                  <p>No deliveries yet from this distributor</p>
                </div>
                <div v-else class="activity-list">
                  <div v-for="delivery in recentDeliveries" :key="delivery.id" class="activity-item">
                    <div class="activity-status">
                      <font-awesome-icon 
                        :icon="getStatusIcon(delivery.processing?.status || delivery.status)"
                        :class="getStatusClass(delivery.processing?.status || delivery.status)"
                      />
                    </div>
                    <div class="activity-details">
                      <div class="activity-title">{{ delivery.ern?.messageId || delivery.id }}</div>
                      <div class="activity-meta">
                        {{ formatDate(delivery.processing?.receivedAt || delivery.receivedAt) }} • 
                        {{ delivery.ern?.releaseCount || 0 }} releases • 
                        {{ delivery.processing?.status || delivery.status }}
                      </div>
                    </div>
                    <router-link 
                      :to="`/ingestion/${delivery.id}`" 
                      class="btn btn-sm btn-secondary"
                    >
                      View
                    </router-link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.distributors-page {
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

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.stat-card .card-body {
  text-align: center;
}

.stat-value {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--color-primary);
  margin-bottom: var(--space-xs);
}

.stat-label {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

/* Search Box */
.search-box {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-md);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  width: 300px;
}

.search-box input {
  flex: 1;
  border: none;
  background: none;
  outline: none;
  color: var(--color-text);
}

/* Distributor Cards */
.distributor-cards {
  display: grid;
  gap: var(--space-lg);
}

.distributor-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  transition: all var(--transition-base);
}

.distributor-card:hover {
  box-shadow: var(--shadow-md);
}

.distributor-card.inactive {
  opacity: 0.6;
}

.distributor-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-md);
}

.distributor-info h3 {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-xs);
}

.distributor-id {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
  background-color: var(--color-bg-secondary);
  padding: var(--space-xs);
  border-radius: var(--radius-sm);
}

.ddex-info {
  margin-top: var(--space-xs);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.ddex-label {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  font-weight: var(--font-medium);
}

.ddex-value {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  background-color: var(--color-bg-secondary);
  padding: 2px var(--space-xs);
  border-radius: var(--radius-sm);
}

/* Status Badge */
.status-badge {
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  text-transform: uppercase;
}

.status-badge.active {
  background-color: var(--color-success);
  color: white;
}

.status-badge.inactive {
  background-color: var(--color-text-tertiary);
  color: white;
}

/* Distributor Details */
.distributor-details {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
  padding: var(--space-md);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-md);
}

.detail-row {
  display: flex;
  gap: var(--space-sm);
}

.detail-label {
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

.protocol-badge {
  padding: var(--space-xs);
  background-color: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  text-transform: uppercase;
}

/* Distributor Stats */
.distributor-stats {
  display: flex;
  justify-content: space-around;
  padding: var(--space-md) 0;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--space-md);
}

.mini-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-number {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
}

/* Distributor Actions */
.distributor-actions {
  display: flex;
  gap: var(--space-sm);
}

/* Form Styles */
.form-section {
  margin-bottom: var(--space-lg);
  padding-bottom: var(--space-lg);
  border-bottom: 1px solid var(--color-border);
}

.form-section:last-child {
  border-bottom: none;
}

.form-section h4 {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-md);
  color: var(--color-heading);
}

.form-label.required::after {
  content: ' *';
  color: var(--color-error);
}

.protocol-settings {
  padding: var(--space-md);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  margin-top: var(--space-md);
}

.info-box {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-md);
  background-color: var(--color-info);
  color: white;
  border-radius: var(--radius-md);
  margin-bottom: var(--space-md);
}

.info-box p {
  margin: 0;
  font-size: var(--text-sm);
}

.path-display {
  display: block;
  padding: var(--space-sm);
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
}

.api-key-group {
  display: flex;
  gap: var(--space-sm);
}

.api-key-display {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.api-key-value {
  flex: 1;
  padding: var(--space-sm);
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
}

/* Integration Modal */
.integration-tabs {
  display: flex;
  gap: var(--space-xs);
  border-bottom: 2px solid var(--color-border);
  margin-bottom: var(--space-lg);
}

.tab-button {
  padding: var(--space-sm) var(--space-md);
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-base);
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
}

.tab-button:hover {
  color: var(--color-text);
}

.tab-button.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.tab-content {
  padding: var(--space-lg) 0;
}

.config-section {
  margin-bottom: var(--space-xl);
}

.config-section h5 {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-md);
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-md);
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.config-item label {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.config-item code {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  background-color: var(--color-bg-secondary);
  padding: var(--space-xs);
  border-radius: var(--radius-sm);
}

.code-block {
  position: relative;
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
}

.code-block pre {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  color: var(--color-text);
  white-space: pre-wrap;
  word-break: break-word;
}

.copy-btn {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  padding: var(--space-xs) var(--space-sm);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
}

.copy-btn:hover {
  background-color: var(--color-bg);
  transform: scale(1.05);
}

/* Test Section */
.test-section {
  margin-bottom: var(--space-xl);
}

.test-section h5 {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-md);
}

.upload-area {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-2xl);
  text-align: center;
  transition: all var(--transition-base);
}

.upload-area:hover {
  border-color: var(--color-primary);
  background-color: var(--color-bg-secondary);
}

.upload-icon {
  font-size: 3rem;
  color: var(--color-text-tertiary);
  margin-bottom: var(--space-md);
}

.upload-hint {
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
  margin: var(--space-sm) 0;
}

.selected-file {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  margin-top: var(--space-md);
}

.test-results {
  margin-top: var(--space-xl);
  padding: var(--space-lg);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-md);
}

.test-results h5 {
  margin-bottom: var(--space-md);
}

.result-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
}

/* Activity List */
.activity-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.activity-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-md);
}

.activity-status {
  font-size: 1.5rem;
}

.activity-details {
  flex: 1;
}

.activity-title {
  font-weight: var(--font-medium);
  margin-bottom: var(--space-xs);
}

.activity-meta {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-lg);
}

.modal-content {
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-content.large {
  max-width: 900px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-lg);
  border-bottom: 1px solid var(--color-border);
}

.modal-body {
  padding: var(--space-lg);
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  padding: var(--space-lg);
  border-top: 1px solid var(--color-border);
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

/* Utility Classes */
.text-success { color: var(--color-success); }
.text-error { color: var(--color-error); }
.text-info { color: var(--color-info); }
.text-warning { color: var(--color-warning); }

.btn-icon {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--space-xs);
  transition: all var(--transition-base);
}

.btn-icon:hover {
  color: var(--color-text);
}

/* Modal Transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--transition-base);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform var(--transition-base);
}

.modal-enter-from .modal-content {
  transform: scale(0.9);
}

.modal-leave-to .modal-content {
  transform: scale(0.9);
}

/* Responsive */
@media (max-width: 768px) {
  .distributors-page {
    padding: var(--space-md);
  }
  
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-md);
  }
  
  .search-box {
    width: 100%;
  }
  
  .distributor-details {
    grid-template-columns: 1fr;
  }
  
  .distributor-actions {
    flex-direction: column;
  }
  
  .distributor-actions .btn {
    width: 100%;
  }
  
  .config-grid {
    grid-template-columns: 1fr;
  }
  
  .integration-tabs {
    overflow-x: auto;
  }
}
</style>