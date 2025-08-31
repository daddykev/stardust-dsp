<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCatalog } from '../composables/useCatalog'
import { usePlayer } from '../composables/usePlayer'
import { db } from '../firebase'
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore'

const route = useRoute()
const router = useRouter()
const catalog = useCatalog()
const player = usePlayer()

// State
const artist = ref(null)
const similarArtists = ref([])
const isLoading = ref(true)
const error = ref(null)
const isFollowing = ref(false)
const discographyView = ref('grid')

// Computed
const artistId = computed(() => route.params.id)

const totalTracks = computed(() => {
  if (!artist.value?.releases) return 0
  return artist.value.releases.reduce((total, release) => {
    return total + (release.trackCount || 0)
  }, 0)
})

const sortedReleases = computed(() => {
  if (!artist.value?.releases) return []
  return [...artist.value.releases].sort((a, b) => {
    const dateA = a.releaseDate?.toDate ? a.releaseDate.toDate() : new Date(a.releaseDate || 0)
    const dateB = b.releaseDate?.toDate ? b.releaseDate.toDate() : new Date(b.releaseDate || 0)
    return dateB - dateA // Newest first
  })
})

// Load artist data
async function loadArtist() {
  isLoading.value = true
  error.value = null
  
  try {
    // Use the catalog composable's getArtist method
    artist.value = await catalog.getArtist(artistId.value)
    
    if (!artist.value) {
      error.value = 'Artist not found'
      return
    }
    
    // Get track counts for releases if not already loaded
    if (artist.value.releases) {
      for (const release of artist.value.releases) {
        if (!release.trackCount) {
          const tracksSnapshot = await getDocs(
            query(collection(db, 'tracks'), where('releaseId', '==', release.id))
          )
          release.trackCount = tracksSnapshot.size
        }
      }
    }
    
    // Load similar artists (mock for now - would need recommendation engine)
    await loadSimilarArtists()
    
  } catch (err) {
    console.error('Error loading artist:', err)
    error.value = err.message
  } finally {
    isLoading.value = false
  }
}

// Load similar artists
async function loadSimilarArtists() {
  // This is a simple implementation - in production you'd use a recommendation engine
  try {
    const q = query(
      collection(db, 'artists'),
      where('name', '!=', artist.value.name),
      limit(6)
    )
    
    const snapshot = await getDocs(q)
    similarArtists.value = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).slice(0, 5)
    
  } catch (err) {
    console.error('Error loading similar artists:', err)
  }
}

// Player functions
async function playAllTracks() {
  if (!artist.value?.releases) return
  
  // Clear queue
  player.clearQueue()
  
  // Load and add all tracks from all releases
  for (const release of artist.value.releases) {
    const tracks = await catalog.fetchReleaseTracks(release.id)
    tracks.forEach(track => {
      track.albumTitle = release.title
      track.artworkUrl = release.artworkUrl
      player.addToQueue(track)
    })
  }
  
  // Start playing
  if (player.queue.value.length > 0) {
    player.playTrack(player.queue.value[0])
  }
}

async function shufflePlay() {
  await playAllTracks()
  player.toggleShuffle()
}

function playTrack(track) {
  player.playTrack(track)
}

async function playRelease(release) {
  const tracks = await catalog.fetchReleaseTracks(release.id)
  if (tracks.length > 0) {
    player.clearQueue()
    tracks.forEach(track => {
      track.albumTitle = release.title
      track.artworkUrl = release.artworkUrl
      player.addToQueue(track)
    })
    player.playTrack(tracks[0])
  }
}

function addToQueue(track) {
  player.addToQueue(track)
  console.log('Added to queue:', track.title)
}

function isCurrentTrack(track) {
  return player.currentTrack.value?.id === track.id
}

function showTrackMenu(track) {
  console.log('Show menu for:', track)
}

// Actions
function followArtist() {
  isFollowing.value = !isFollowing.value
  console.log('Follow artist:', artist.value.name)
}

function shareArtist() {
  const url = window.location.href
  navigator.clipboard.writeText(url)
  console.log('Link copied to clipboard')
}

// Navigation
function goToRelease(id) {
  router.push(`/releases/${id}`)
}

function goToArtist(id) {
  router.push(`/artists/${id}`)
}

// Formatting
function formatDuration(seconds) {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatYear(date) {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.getFullYear()
}

function formatNumber(num) {
  if (!num) return '0'
  return num.toLocaleString()
}

function handleImageError(e) {
  e.target.src = e.target.classList.contains('artist-image') || 
                  e.target.classList.contains('similar-artist-image')
    ? '/placeholder-artist.png'
    : '/placeholder-album.png'
}

// Watch for route changes
watch(artistId, (newId) => {
  if (newId) {
    loadArtist()
  }
})

onMounted(() => {
  loadArtist()
})
</script>

<template>
  <div class="artist-detail">
    <div class="container">
      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading artist...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-state card">
        <div class="card-body">
          <font-awesome-icon icon="exclamation-circle" class="error-icon" />
          <h3>Artist Not Found</h3>
          <p>{{ error }}</p>
          <router-link to="/catalog" class="btn btn-primary">
            Back to Catalog
          </router-link>
        </div>
      </div>

      <!-- Artist Content -->
      <div v-else-if="artist">
        <!-- Artist Header -->
        <div class="artist-header">
          <div class="artist-image-container">
            <img 
              :src="artist.imageUrl || '/placeholder-artist.png'" 
              :alt="artist.name"
              class="artist-image"
              @error="handleImageError"
            />
            <div class="artist-actions">
              <button @click="playAllTracks" class="btn btn-primary btn-lg">
                <font-awesome-icon icon="play" />
                Play All
              </button>
              <button @click="shufflePlay" class="btn btn-secondary">
                <font-awesome-icon icon="random" />
                Shuffle
              </button>
            </div>
          </div>
          
          <div class="artist-info">
            <div class="artist-type">Artist</div>
            <h1 class="artist-name">{{ artist.name }}</h1>
            
            <div class="artist-stats">
              <div class="stat-item">
                <font-awesome-icon icon="compact-disc" />
                <span>{{ artist.releases?.length || 0 }} releases</span>
              </div>
              <div class="stat-item">
                <font-awesome-icon icon="music" />
                <span>{{ totalTracks }} tracks</span>
              </div>
              <div class="stat-item" v-if="artist.verified">
                <font-awesome-icon icon="check-circle" class="verified-icon" />
                <span>Verified Artist</span>
              </div>
            </div>
            
            <div v-if="artist.profile?.bio" class="artist-bio">
              <p>{{ artist.profile.bio }}</p>
            </div>
            
            <div class="artist-actions-row">
              <button @click="followArtist" class="action-btn" :class="{ active: isFollowing }">
                <font-awesome-icon :icon="isFollowing ? 'check' : 'plus'" />
                {{ isFollowing ? 'Following' : 'Follow' }}
              </button>
              <button @click="shareArtist" class="action-btn">
                <font-awesome-icon icon="share" />
                Share
              </button>
            </div>

            <!-- Artist Links -->
            <div v-if="artist.links?.official || artist.links?.social" class="artist-links">
              <a 
                v-if="artist.links.official" 
                :href="artist.links.official" 
                target="_blank"
                class="link-btn"
              >
                <font-awesome-icon icon="globe" />
                Official Website
              </a>
              <a 
                v-if="artist.links?.social?.spotify" 
                :href="artist.links.social.spotify" 
                target="_blank"
                class="link-btn"
              >
                <font-awesome-icon :icon="['fab', 'spotify']" />
                Spotify
              </a>
              <a 
                v-if="artist.links?.social?.youtube" 
                :href="artist.links.social.youtube" 
                target="_blank"
                class="link-btn"
              >
                <font-awesome-icon :icon="['fab', 'youtube']" />
                YouTube
              </a>
            </div>
          </div>
        </div>

        <!-- Top Tracks -->
        <div v-if="artist.topTracks?.length > 0" class="top-tracks-section">
          <h2>Popular Tracks</h2>
          <div class="tracks-list">
            <div 
              v-for="(track, index) in artist.topTracks" 
              :key="track.id"
              class="track-item"
              :class="{ playing: isCurrentTrack(track) }"
              @click="playTrack(track)"
            >
              <div class="track-number">
                <span v-if="!isCurrentTrack(track)">{{ index + 1 }}</span>
                <font-awesome-icon 
                  v-else 
                  :icon="player.isPlaying.value ? 'pause' : 'play'" 
                  class="playing-icon"
                />
              </div>
              
              <div class="track-info">
                <div class="track-title">{{ track.title }}</div>
                <div class="track-album" v-if="track.albumTitle">
                  {{ track.albumTitle }}
                </div>
              </div>
              
              <div class="track-plays" v-if="track.stats?.playCount">
                <font-awesome-icon icon="play" class="play-icon" />
                {{ formatNumber(track.stats.playCount) }}
              </div>
              
              <div class="track-duration">
                {{ formatDuration(track.duration) }}
              </div>
              
              <div class="track-actions">
                <button @click.stop="addToQueue(track)" class="btn-icon" title="Add to Queue">
                  <font-awesome-icon icon="plus" />
                </button>
                <button @click.stop="showTrackMenu(track)" class="btn-icon" title="More">
                  <font-awesome-icon icon="ellipsis-v" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Discography -->
        <div class="discography-section">
          <div class="section-header">
            <h2>Discography</h2>
            <div class="view-toggle">
              <button 
                @click="discographyView = 'grid'" 
                class="view-btn"
                :class="{ active: discographyView === 'grid' }"
              >
                <font-awesome-icon icon="th" />
              </button>
              <button 
                @click="discographyView = 'list'" 
                class="view-btn"
                :class="{ active: discographyView === 'list' }"
              >
                <font-awesome-icon icon="list" />
              </button>
            </div>
          </div>

          <!-- Grid View -->
          <div v-if="discographyView === 'grid'" class="releases-grid">
            <div 
              v-for="release in sortedReleases" 
              :key="release.id"
              class="release-card"
              @click="goToRelease(release.id)"
            >
              <div class="release-artwork">
                <img 
                  :src="release.artworkUrl || '/placeholder-album.png'" 
                  :alt="release.title"
                  @error="handleImageError"
                />
                <div class="release-overlay">
                  <button @click.stop="playRelease(release)" class="play-btn">
                    <font-awesome-icon icon="play" />
                  </button>
                </div>
              </div>
              <div class="release-details">
                <h4>{{ release.title }}</h4>
                <p class="release-year">{{ formatYear(release.releaseDate) }}</p>
                <p class="release-type">{{ release.releaseType || 'Album' }}</p>
              </div>
            </div>
          </div>

          <!-- List View -->
          <div v-else class="releases-list">
            <div 
              v-for="release in sortedReleases" 
              :key="release.id"
              class="release-list-item"
              @click="goToRelease(release.id)"
            >
              <img 
                :src="release.artworkUrl || '/placeholder-album.png'" 
                :alt="release.title"
                class="release-thumb"
                @error="handleImageError"
              />
              <div class="release-info">
                <h4>{{ release.title }}</h4>
                <div class="release-meta">
                  <span>{{ release.releaseType || 'Album' }}</span>
                  <span>•</span>
                  <span>{{ formatYear(release.releaseDate) }}</span>
                  <span v-if="release.trackCount">•</span>
                  <span v-if="release.trackCount">{{ release.trackCount }} tracks</span>
                </div>
              </div>
              <div class="release-actions">
                <button @click.stop="playRelease(release)" class="btn btn-sm btn-primary">
                  <font-awesome-icon icon="play" />
                  Play
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Similar Artists (if we have this data) -->
        <div v-if="similarArtists?.length > 0" class="similar-artists-section">
          <h2>Similar Artists</h2>
          <div class="artists-grid">
            <div 
              v-for="similar in similarArtists" 
              :key="similar.id"
              class="similar-artist-card"
              @click="goToArtist(similar.id)"
            >
              <img 
                :src="similar.imageUrl || '/placeholder-artist.png'" 
                :alt="similar.name"
                class="similar-artist-image"
                @error="handleImageError"
              />
              <h4>{{ similar.name }}</h4>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.artist-detail {
  padding: var(--space-xl);
  min-height: calc(100vh - 64px);
}

/* Artist Header */
.artist-header {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: var(--space-2xl);
  margin-bottom: var(--space-2xl);
}

@media (max-width: 768px) {
  .artist-header {
    grid-template-columns: 1fr;
  }
  
  .artist-image-container {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
}

.artist-image-container {
  position: sticky;
  top: calc(64px + var(--space-xl));
}

.artist-image {
  width: 250px;
  height: 250px;
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-lg);
  object-fit: cover;
}

.artist-actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
}

.artist-actions .btn {
  flex: 1;
}

.artist-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.artist-type {
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

.artist-name {
  font-size: var(--text-4xl);
  font-weight: var(--font-bold);
  line-height: 1.1;
}

.artist-stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-lg);
  padding: var(--space-md) 0;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.stat-item svg {
  color: var(--color-text-tertiary);
}

.verified-icon {
  color: var(--color-primary) !important;
}

.artist-bio {
  padding: var(--space-lg);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  line-height: var(--leading-relaxed);
}

.artist-actions-row {
  display: flex;
  gap: var(--space-sm);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-lg);
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
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

.artist-links {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.link-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-md);
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  text-decoration: none;
  font-size: var(--text-sm);
  transition: all var(--transition-base);
}

.link-btn:hover {
  background-color: var(--color-bg);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* Top Tracks */
.top-tracks-section {
  margin-bottom: var(--space-2xl);
}

.top-tracks-section h2 {
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-lg);
}

.tracks-list {
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.track-item {
  display: grid;
  grid-template-columns: 40px 1fr auto 80px 100px;
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

.track-album {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.track-plays {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
}

.play-icon {
  font-size: var(--text-xs);
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

/* Discography */
.discography-section {
  margin-bottom: var(--space-2xl);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.section-header h2 {
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
}

.view-toggle {
  display: flex;
  gap: var(--space-xs);
  background-color: var(--color-bg-secondary);
  padding: var(--space-xs);
  border-radius: var(--radius-md);
}

.view-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
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

/* Releases Grid */
.releases-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-lg);
}

.release-card {
  cursor: pointer;
  transition: transform var(--transition-base);
}

.release-card:hover {
  transform: translateY(-4px);
}

.release-artwork {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: var(--space-sm);
  box-shadow: var(--shadow-md);
}

.release-artwork img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.release-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition-base);
}

.release-card:hover .release-overlay {
  opacity: 1;
}

.play-btn {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  background-color: var(--color-primary);
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-base);
}

.play-btn:hover {
  transform: scale(1.1);
  background-color: var(--color-primary-hover);
}

.release-details h4 {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  margin-bottom: var(--space-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.release-year {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  margin-bottom: 2px;
}

.release-type {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

/* Releases List */
.releases-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.release-list-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-base);
}

.release-list-item:hover {
  box-shadow: var(--shadow-md);
  transform: translateX(4px);
}

.release-thumb {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-md);
  object-fit: cover;
  flex-shrink: 0;
}

.release-info {
  flex: 1;
}

.release-info h4 {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  margin-bottom: var(--space-xs);
}

.release-meta {
  display: flex;
  gap: var(--space-sm);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

/* Similar Artists */
.similar-artists-section {
  margin-bottom: var(--space-2xl);
}

.similar-artists-section h2 {
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-lg);
}

.artists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-lg);
}

.similar-artist-card {
  text-align: center;
  cursor: pointer;
  transition: transform var(--transition-base);
}

.similar-artist-card:hover {
  transform: translateY(-4px);
}

.similar-artist-image {
  width: 120px;
  height: 120px;
  margin: 0 auto var(--space-sm);
  border-radius: var(--radius-full);
  object-fit: cover;
  box-shadow: var(--shadow-md);
}

.similar-artist-card h4 {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
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
  .artist-detail {
    padding: var(--space-md);
  }
  
  .artist-name {
    font-size: var(--text-2xl);
  }
  
  .track-item {
    grid-template-columns: 30px 1fr 60px;
  }
  
  .track-plays,
  .track-actions {
    display: none;
  }
  
  .releases-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
  
  .artists-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }
  
  .similar-artist-image {
    width: 80px;
    height: 80px;
  }
}
</style>