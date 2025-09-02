<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCatalog } from '../composables/useCatalog'
import { usePlayer } from '../composables/usePlayer'
import { db } from '../firebase'
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'

const route = useRoute()
const router = useRouter()
const catalog = useCatalog()
const player = usePlayer()

// State
const release = ref(null)
const tracks = ref([])
const relatedReleases = ref([])
const isLoading = ref(true)
const error = ref(null)
const isFavorite = ref(false)

// Computed
const releaseId = computed(() => route.params.id)

const artistId = computed(() => {
  // Try to get artist ID from the artist name
  // In a real app, this would be stored in the release document
  return null // TODO: Implement artist ID lookup
})

const totalDuration = computed(() => {
  return tracks.value.reduce((total, track) => total + (track.duration || 0), 0)
})

// Load release data
async function loadRelease() {
  isLoading.value = true
  error.value = null
  
  try {
    // Get release document
    const releaseDoc = await getDoc(doc(db, 'releases', releaseId.value))
    
    if (!releaseDoc.exists()) {
      error.value = 'Release not found'
      return
    }
    
    const releaseData = releaseDoc.data()
    
    // Create a unified release object with both nested and flat properties
    release.value = {
      id: releaseDoc.id,
      ...releaseData,
      // Flatten key properties for easier template access
      title: releaseData.metadata?.title || 'Unknown Title',
      artistName: releaseData.metadata?.displayArtist || 'Unknown Artist',
      releaseDate: releaseData.metadata?.releaseDate,
      releaseType: releaseData.metadata?.releaseType || 'Album',
      labelName: releaseData.metadata?.label,
      artworkUrl: releaseData.assets?.coverArt?.url || releaseData.assets?.coverArt || '/placeholder-album.png',
      copyright: releaseData.metadata?.copyright,
      upc: releaseData.metadata?.upc,
      // Preserve original structure
      sender: releaseData.sender,
      senderName: releaseData.senderName,
      messageId: releaseData.messageId,
      ingestedAt: releaseData.ingestion?.completedAt || releaseData.ingestion?.receivedAt,
      ern: releaseData.ingestion?.ernVersion ? { version: releaseData.ingestion.ernVersion } : releaseData.ern
    }
    
    // Get tracks for this release
    await loadTracks()
    
    // Load related releases
    await loadRelatedReleases()
    
  } catch (err) {
    console.error('Error loading release:', err)
    error.value = err.message
  } finally {
    isLoading.value = false
  }
}

// Load tracks
async function loadTracks() {
  try {
    const q = query(
      collection(db, 'tracks'),
      where('releaseId', '==', releaseId.value)
    )
    
    const snapshot = await getDocs(q)
    tracks.value = snapshot.docs.map(doc => {
      const trackData = doc.data()
      return {
        id: doc.id,
        ...trackData,
        // Flatten for template access
        title: trackData.metadata?.title || 'Unknown Track',
        artistName: trackData.metadata?.displayArtist || release.value.artistName,
        duration: trackData.metadata?.duration || 0,
        trackNumber: trackData.metadata?.trackNumber || 1,
        discNumber: trackData.metadata?.discNumber || 1,
        isrc: trackData.isrc,
        // Add release info for player
        albumTitle: release.value.title,
        artworkUrl: release.value.artworkUrl,
        // Set audio URL for player
        audioUrl: trackData.audio?.original || trackData.audio?.streams?.hls
      }
    })
    
    // Sort by disc and track number
    tracks.value.sort((a, b) => {
      if (a.discNumber !== b.discNumber) {
        return a.discNumber - b.discNumber
      }
      return a.trackNumber - b.trackNumber
    })
    
  } catch (err) {
    console.error('Error loading tracks:', err)
  }
}

// Load related releases
async function loadRelatedReleases() {
  if (!release.value?.artistName) return
  
  try {
    // Query using the nested field structure
    const q = query(
      collection(db, 'releases'),
      where('metadata.displayArtist', '==', release.value.artistName),
      where('status', '==', 'active'),
      limit(6)
    )
    
    const snapshot = await getDocs(q)
    relatedReleases.value = snapshot.docs
      .map(doc => {
        const data = doc.data()
        return {
          id: doc.id,
          title: data.metadata?.title || 'Unknown Title',
          releaseDate: data.metadata?.releaseDate,
          artworkUrl: data.assets?.coverArt?.url || data.assets?.coverArt || '/placeholder-album.png'
        }
      })
      .filter(r => r.id !== releaseId.value)
      .slice(0, 5)
    
  } catch (err) {
    console.error('Error loading related releases:', err)
    // Fallback without ordering if index doesn't exist
    try {
      const q = query(
        collection(db, 'releases'),
        where('status', '==', 'active'),
        limit(10)
      )
      
      const snapshot = await getDocs(q)
      relatedReleases.value = snapshot.docs
        .map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            title: data.metadata?.title || 'Unknown Title',
            releaseDate: data.metadata?.releaseDate,
            artworkUrl: data.assets?.coverArt?.url || '/placeholder-album.png'
          }
        })
        .filter(r => {
          const artistName = doc.data().metadata?.displayArtist
          return r.id !== releaseId.value && artistName === release.value.artistName
        })
        .slice(0, 5)
    } catch (fallbackErr) {
      console.error('Fallback query also failed:', fallbackErr)
    }
  }
}

// Player functions
function playAll() {
  if (tracks.value.length === 0) return
  
  // Clear queue and add all tracks
  player.clearQueue()
  tracks.value.forEach(track => {
    // Ensure audio URL is set
    if (!track.audioUrl && track.audio?.original) {
      track.audioUrl = track.audio.original
    }
    player.addToQueue(track)
  })
  
  // Start playing first track
  player.playTrack(tracks.value[0])
}

function shufflePlay() {
  if (tracks.value.length === 0) return
  
  // Clear queue and add all tracks
  player.clearQueue()
  
  // Shuffle tracks
  const shuffled = [...tracks.value].sort(() => Math.random() - 0.5)
  shuffled.forEach(track => {
    // Ensure audio URL is set
    if (!track.audioUrl && track.audio?.original) {
      track.audioUrl = track.audio.original
    }
    player.addToQueue(track)
  })
  
  // Start playing first track
  player.playTrack(shuffled[0])
}

function playTrack(track, index) {
  // Clear queue and add all tracks from this position
  player.clearQueue()
  
  // Add remaining tracks to queue with proper audio URLs
  for (let i = index; i < tracks.value.length; i++) {
    const t = tracks.value[i]
    if (!t.audioUrl && t.audio?.original) {
      t.audioUrl = t.audio.original
    }
    player.addToQueue(t)
  }
  
  // Play the selected track
  player.playTrack(track)
}

function addTrackToQueue(track) {
  // Ensure audio URL is set
  if (!track.audioUrl && track.audio?.original) {
    track.audioUrl = track.audio.original
  }
  player.addToQueue(track)
  // TODO: Show toast notification
  console.log('Added to queue:', track.title)
}

function isCurrentTrack(track) {
  return player.currentTrack.value?.id === track.id
}

function showTrackMenu(track) {
  // TODO: Implement context menu
  console.log('Show menu for:', track)
}

// Actions
function toggleFavorite() {
  isFavorite.value = !isFavorite.value
  // TODO: Save to user's library
  console.log('Toggle favorite:', release.value.title)
}

function addToPlaylist() {
  // TODO: Show playlist selector
  console.log('Add to playlist:', release.value.title)
}

function shareRelease() {
  // TODO: Implement sharing
  const url = window.location.href
  navigator.clipboard.writeText(url)
  console.log('Link copied to clipboard')
}

function goToRelease(id) {
  router.push(`/releases/${id}`)
}

// Formatting functions
function formatReleaseDate(date) {
  if (!date) return 'Unknown'
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

function formatYear(date) {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.getFullYear()
}

function formatDate(date) {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDuration(seconds) {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatTotalDuration(seconds) {
  if (!seconds) return '0 min'
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours} hr ${mins} min`
  }
  return `${mins} min`
}

function handleImageError(e) {
  e.target.src = '/placeholder-album.png'
}

// Watch for route changes
watch(releaseId, (newId) => {
  if (newId) {
    loadRelease()
  }
})

onMounted(() => {
  loadRelease()
})
</script>

<template>
  <div class="release-detail">
    <div class="container">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading release...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-state card">
        <div class="card-body">
          <font-awesome-icon icon="exclamation-circle" class="error-icon" />
          <h3>Release Not Found</h3>
          <p>{{ error }}</p>
          <router-link to="/catalog" class="btn btn-primary">
            Back to Catalog
          </router-link>
        </div>
      </div>

      <!-- Release Content -->
      <div v-else-if="release">
        <!-- Release Header -->
        <div class="release-header">
          <div class="release-artwork-container">
            <img 
              :src="release.artworkUrl || '/placeholder-album.png'" 
              :alt="release.title"
              class="release-artwork"
              @error="handleImageError"
            />
            <div class="artwork-actions">
              <button @click="playAll" class="btn btn-primary btn-lg">
                <font-awesome-icon icon="play" />
                Play All
              </button>
              <button @click="shufflePlay" class="btn btn-secondary">
                <font-awesome-icon icon="random" />
                Shuffle
              </button>
            </div>
          </div>
          
          <div class="release-info">
            <div class="release-type-badge">{{ release.releaseType || 'Album' }}</div>
            <h1 class="release-title">{{ release.title }}</h1>
            <div class="release-artist">
              <router-link 
                v-if="artistId" 
                :to="`/artists/${artistId}`"
                class="artist-link"
              >
                {{ release.artistName }}
              </router-link>
              <span v-else>{{ release.artistName }}</span>
            </div>
            
            <div class="release-metadata">
              <div class="metadata-item">
                <font-awesome-icon icon="calendar" />
                <span>{{ formatReleaseDate(release.releaseDate) }}</span>
              </div>
              <div class="metadata-item">
                <font-awesome-icon icon="music" />
                <span>{{ tracks.length }} tracks</span>
              </div>
              <div class="metadata-item">
                <font-awesome-icon icon="clock" />
                <span>{{ formatTotalDuration(totalDuration) }}</span>
              </div>
              <div class="metadata-item" v-if="release.labelName">
                <font-awesome-icon icon="building" />
                <span>{{ release.labelName }}</span>
              </div>
            </div>
            
            <div class="release-actions">
              <button @click="toggleFavorite" class="action-btn" :class="{ active: isFavorite }">
                <font-awesome-icon :icon="isFavorite ? 'heart' : ['far', 'heart']" />
                {{ isFavorite ? 'Saved' : 'Save' }}
              </button>
              <button @click="addToPlaylist" class="action-btn">
                <font-awesome-icon icon="plus" />
                Add to Playlist
              </button>
              <button @click="shareRelease" class="action-btn">
                <font-awesome-icon icon="share" />
                Share
              </button>
            </div>

            <!-- Ingestion Info -->
            <div class="ingestion-info" v-if="release.sender">
              <h3>Ingestion Details</h3>
              <div class="ingestion-details">
                <div class="detail-row">
                  <span class="detail-label">Distributor:</span>
                  <span>{{ release.senderName || release.sender }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Message ID:</span>
                  <code>{{ release.messageId }}</code>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Ingested:</span>
                  <span>{{ formatDate(release.ingestedAt || release.createdAt) }}</span>
                </div>
                <div class="detail-row" v-if="release.ern">
                  <span class="detail-label">ERN Version:</span>
                  <span>{{ release.ern.version }}</span>
                </div>
                <div class="detail-row" v-if="release.upc">
                  <span class="detail-label">UPC:</span>
                  <code>{{ release.upc }}</code>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Track List -->
        <div class="track-list-section">
          <h2>Track List</h2>
          <div class="track-list">
            <div 
              v-for="(track, index) in tracks" 
              :key="track.id"
              class="track-item"
              :class="{ playing: isCurrentTrack(track) }"
              @click="playTrack(track, index)"
            >
              <div class="track-number">
                <span v-if="!isCurrentTrack(track)">{{ track.trackNumber || index + 1 }}</span>
                <font-awesome-icon 
                  v-else 
                  :icon="player.isPlaying.value ? 'pause' : 'play'" 
                  class="playing-icon"
                />
              </div>
              
              <div class="track-info">
                <div class="track-title">{{ track.title }}</div>
                <div class="track-artist" v-if="track.artistName !== release.artistName">
                  {{ track.artistName }}
                </div>
              </div>
              
              <div class="track-isrc">
                <code>{{ track.isrc }}</code>
              </div>
              
              <div class="track-duration">
                {{ formatDuration(track.duration) }}
              </div>
              
              <div class="track-actions">
                <button @click.stop="addTrackToQueue(track)" class="btn-icon" title="Add to Queue">
                  <font-awesome-icon icon="plus" />
                </button>
                <button @click.stop="showTrackMenu(track)" class="btn-icon" title="More">
                  <font-awesome-icon icon="ellipsis-v" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Copyright & Credits -->
        <div class="release-credits" v-if="release.copyright || release.credits">
          <h3>Credits & Copyright</h3>
          <div class="credits-content">
            <div v-if="release.copyright" class="copyright-info">
              <p v-for="(copyright, idx) in release.copyright" :key="idx">
                {{ copyright.type }} {{ copyright.text }} {{ copyright.year }}
              </p>
            </div>
            <div v-if="release.credits" class="credits-list">
              <div v-for="(credit, idx) in release.credits" :key="idx" class="credit-item">
                <span class="credit-role">{{ credit.role }}:</span>
                <span class="credit-name">{{ credit.name }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Related Releases -->
        <div class="related-releases" v-if="relatedReleases.length > 0">
          <h3>More from {{ release.artistName }}</h3>
          <div class="releases-grid">
            <div 
              v-for="related in relatedReleases" 
              :key="related.id"
              class="related-release-card"
              @click="goToRelease(related.id)"
            >
              <img 
                :src="related.artworkUrl || '/placeholder-album.png'" 
                :alt="related.title"
                class="related-artwork"
                @error="handleImageError"
              />
              <div class="related-info">
                <h4>{{ related.title }}</h4>
                <p>{{ formatYear(related.releaseDate) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.release-detail {
  padding: var(--space-xl);
  min-height: calc(100vh - 64px);
}

/* Release Header */
.release-header {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: var(--space-2xl);
  margin-bottom: var(--space-2xl);
}

@media (max-width: 768px) {
  .release-header {
    grid-template-columns: 1fr;
  }
}

.release-artwork-container {
  position: sticky;
  top: calc(64px + var(--space-xl));
}

.release-artwork {
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  object-fit: cover;
}

.artwork-actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
}

.artwork-actions .btn {
  flex: 1;
}

.release-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.release-type-badge {
  display: inline-flex;
  padding: var(--space-xs) var(--space-sm);
  background-color: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  text-transform: uppercase;
  width: fit-content;
}

.release-title {
  font-size: var(--text-4xl);
  font-weight: var(--font-bold);
  line-height: 1.1;
}

.release-artist {
  font-size: var(--text-xl);
  color: var(--color-text-secondary);
}

.artist-link {
  color: inherit;
  text-decoration: none;
}

.artist-link:hover {
  color: var(--color-primary);
  text-decoration: underline;
}

.release-metadata {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-lg);
  padding: var(--space-md) 0;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.metadata-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.metadata-item svg {
  color: var(--color-text-tertiary);
}

.release-actions {
  display: flex;
  gap: var(--space-sm);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
  font-weight: var(--font-medium);
}

.action-btn:hover {
  background-color: var(--color-bg);
  border-color: var(--color-primary);
}

.action-btn.active {
  background-color: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

/* Ingestion Info */
.ingestion-info {
  padding: var(--space-lg);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
}

.ingestion-info h3 {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-md);
}

.ingestion-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.detail-row {
  display: flex;
  gap: var(--space-md);
}

.detail-label {
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
  min-width: 100px;
}

.detail-row code {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  background-color: var(--color-bg);
  padding: 2px var(--space-xs);
  border-radius: var(--radius-sm);
}

/* Track List */
.track-list-section {
  margin-bottom: var(--space-2xl);
}

.track-list-section h2 {
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-lg);
}

.track-list {
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.track-item {
  display: grid;
  grid-template-columns: 40px 1fr auto 60px 100px;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--color-border-light);
  cursor: pointer;
  transition: background-color var(--transition-base);
}

.track-item:hover {
  background-color: var(--color-bg-secondary);
}

.track-item.playing {
  background-color: var(--color-primary-light);
}

.track-item:last-child {
  border-bottom: none;
}

.track-number {
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
}

.playing-icon {
  color: var(--color-primary);
}

.track-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.track-title {
  font-weight: var(--font-medium);
}

.track-artist {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.track-isrc code {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  background-color: var(--color-bg-secondary);
  padding: 2px var(--space-xs);
  border-radius: var(--radius-sm);
}

.track-duration {
  text-align: right;
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.track-actions {
  display: flex;
  gap: var(--space-xs);
  justify-content: flex-end;
  opacity: 0;
  transition: opacity var(--transition-base);
}

.track-item:hover .track-actions {
  opacity: 1;
}

.btn-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background-color: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--transition-base);
}

.btn-icon:hover {
  background-color: var(--color-bg);
  color: var(--color-text);
}

/* Credits */
.release-credits {
  padding: var(--space-xl);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-2xl);
}

.release-credits h3 {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-lg);
}

.credits-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.copyright-info {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.credits-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-sm);
}

.credit-item {
  display: flex;
  gap: var(--space-sm);
  font-size: var(--text-sm);
}

.credit-role {
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

/* Related Releases */
.related-releases {
  margin-bottom: var(--space-2xl);
}

.related-releases h3 {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-lg);
}

.releases-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-lg);
}

.related-release-card {
  cursor: pointer;
  transition: transform var(--transition-base);
}

.related-release-card:hover {
  transform: translateY(-4px);
}

.related-artwork {
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  object-fit: cover;
  margin-bottom: var(--space-sm);
  box-shadow: var(--shadow-md);
}

.related-info h4 {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.related-info p {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

/* Loading & Error States */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
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

.error-icon {
  font-size: 3rem;
  color: var(--color-error);
  margin-bottom: var(--space-md);
}

/* Responsive */
@media (max-width: 768px) {
  .release-detail {
    padding: var(--space-md);
  }
  
  .release-title {
    font-size: var(--text-2xl);
  }
  
  .track-item {
    grid-template-columns: 30px 1fr 60px;
  }
  
  .track-isrc,
  .track-actions {
    display: none;
  }
  
  .releases-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }
}
</style>