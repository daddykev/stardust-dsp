<template>
  <div class="catalog-page">
    <div class="container">
      <!-- Page Header -->
      <div class="page-header">
        <h1>Music Catalog</h1>
        <p class="page-subtitle">Browse releases ingested through DDEX deliveries</p>
      </div>

      <!-- Search Bar -->
      <div class="search-section">
        <div class="search-box">
          <font-awesome-icon icon="search" class="search-icon" />
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Search for albums, artists, or tracks..."
            @input="handleSearch"
            class="search-input"
          />
          <button v-if="searchQuery" @click="clearSearch" class="clear-btn">
            <font-awesome-icon icon="times" />
          </button>
        </div>
      </div>

      <!-- Quick Stats -->
      <div class="catalog-stats">
        <div class="stat-badge">
          <font-awesome-icon icon="compact-disc" />
          <span>{{ stats.releases }} Releases</span>
        </div>
        <div class="stat-badge">
          <font-awesome-icon icon="music" />
          <span>{{ stats.tracks }} Tracks</span>
        </div>
        <div class="stat-badge">
          <font-awesome-icon icon="user" />
          <span>{{ stats.artists }} Artists</span>
        </div>
        <div class="stat-badge">
          <font-awesome-icon icon="clock" />
          <span>Updated {{ lastUpdated }}</span>
        </div>
      </div>

      <!-- Filter Tabs -->
      <div class="filter-tabs">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          @click="activeTab = tab.id"
          class="tab-btn"
          :class="{ active: activeTab === tab.id }"
        >
          {{ tab.label }}
          <span class="tab-count">{{ tab.count }}</span>
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading catalog...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="!hasContent" class="empty-state card">
        <div class="card-body">
          <font-awesome-icon icon="inbox" class="empty-icon" />
          <h3>No Content Yet</h3>
          <p>Your catalog is empty. Content will appear here after successful ingestion.</p>
          <router-link to="/ingestion" class="btn btn-primary">
            View Ingestion Pipeline
          </router-link>
        </div>
      </div>

      <!-- Content Grid -->
      <div v-else>
        <!-- Releases Tab -->
        <div v-if="activeTab === 'releases'" class="content-grid">
          <div 
            v-for="release in filteredReleases" 
            :key="release.id"
            class="release-card card card-hover"
            @click="viewRelease(release)"
          >
            <div class="release-artwork">
              <img 
                :src="getArtworkUrl(release)" 
                :alt="getReleaseTitle(release)"
                @error="handleImageError"
              />
              <div class="release-overlay">
                <button class="play-btn" @click.stop="playRelease(release)">
                  <font-awesome-icon icon="play" />
                </button>
              </div>
            </div>
            <div class="release-info">
              <h3 class="release-title">{{ getReleaseTitle(release) }}</h3>
              <p class="release-artist">{{ getReleaseArtist(release) }}</p>
              <div class="release-meta">
                <span class="release-type">{{ getReleaseType(release) }}</span>
                <span class="release-date">{{ formatDate(getReleaseDate(release)) }}</span>
              </div>
              <div class="release-stats">
                <span><font-awesome-icon icon="music" /> {{ getReleaseTrackCount(release) }} tracks</span>
                <span v-if="release.metadata?.duration">{{ formatDuration(release.metadata.duration) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tracks Tab -->
        <div v-if="activeTab === 'tracks'" class="tracks-list">
          <table class="tracks-table">
            <thead>
              <tr>
                <th class="col-play"></th>
                <th class="col-title">Title</th>
                <th class="col-artist">Artist</th>
                <th class="col-album">Album</th>
                <th class="col-duration">Duration</th>
                <th class="col-isrc">ISRC</th>
                <th class="col-actions"></th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="track in filteredTracks" 
                :key="track.id"
                class="track-row"
                :class="{ playing: isCurrentTrack(track) }"
                @click="playTrack(track)"
              >
                <td class="col-play">
                  <button class="play-btn-sm" @click.stop="playTrack(track)">
                    <font-awesome-icon 
                      :icon="isCurrentTrack(track) && player.isPlaying.value ? 'pause' : 'play'" 
                    />
                  </button>
                </td>
                <td class="col-title">
                  <div class="track-title-cell">
                    <span class="track-name">{{ getTrackTitle(track) }}</span>
                    <span v-if="track.metadata?.version" class="track-version">{{ track.metadata.version }}</span>
                  </div>
                </td>
                <td class="col-artist">{{ getTrackArtist(track) }}</td>
                <td class="col-album">
                  <router-link 
                    v-if="track.releaseId" 
                    :to="`/releases/${track.releaseId}`"
                    class="album-link"
                    @click.stop
                  >
                    {{ track.albumTitle || getAlbumTitle(track) }}
                  </router-link>
                  <span v-else>{{ track.albumTitle || '-' }}</span>
                </td>
                <td class="col-duration">{{ formatDuration(getTrackDuration(track)) }}</td>
                <td class="col-isrc">
                  <code>{{ track.isrc }}</code>
                </td>
                <td class="col-actions">
                  <button class="btn-icon" title="Add to Queue" @click.stop="addToQueue(track)">
                    <font-awesome-icon icon="plus" />
                  </button>
                  <button class="btn-icon" title="More Options" @click.stop="showTrackMenu(track)">
                    <font-awesome-icon icon="ellipsis-v" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Artists Tab -->
        <div v-if="activeTab === 'artists'" class="artists-grid">
          <div 
            v-for="artist in filteredArtists" 
            :key="artist.id"
            class="artist-card card card-hover"
            @click="viewArtist(artist)"
          >
            <div class="artist-image">
              <img 
                :src="artist.profile?.image || '/placeholder-artist.png'" 
                :alt="artist.name"
                @error="handleImageError"
              />
            </div>
            <div class="artist-info">
              <h3 class="artist-name">{{ artist.name }}</h3>
              <div class="artist-stats">
                <span>{{ artist.stats?.releaseCount || artist.releaseCount || 0 }} releases</span>
                <span>{{ artist.stats?.trackCount || artist.trackCount || 0 }} tracks</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="hasContent && totalPages > 1" class="pagination">
        <button 
          @click="currentPage--" 
          :disabled="currentPage === 1"
          class="btn btn-secondary"
        >
          <font-awesome-icon icon="chevron-left" />
          Previous
        </button>
        <span class="page-info">Page {{ currentPage }} of {{ totalPages }}</span>
        <button 
          @click="currentPage++" 
          :disabled="currentPage === totalPages"
          class="btn btn-secondary"
        >
          Next
          <font-awesome-icon icon="chevron-right" />
        </button>
      </div>
    </div>

    <!-- Mini Player (shows when track is playing) -->
    <transition name="slide-up">
      <div v-if="player.currentTrack.value" class="mini-player">
        <div class="mini-player-content container">
          <div class="track-info">
            <img 
              :src="getTrackArtwork(player.currentTrack.value)" 
              :alt="getTrackTitle(player.currentTrack.value)"
              class="track-artwork"
            />
            <div class="track-details">
              <h4>{{ getTrackTitle(player.currentTrack.value) }}</h4>
              <p>{{ getTrackArtist(player.currentTrack.value) }}</p>
            </div>
          </div>
          
          <div class="player-controls">
            <button @click="player.previous()" class="control-btn">
              <font-awesome-icon icon="step-backward" />
            </button>
            <button @click="player.togglePlay()" class="control-btn play-pause">
              <font-awesome-icon :icon="player.isPlaying.value ? 'pause' : 'play'" />
            </button>
            <button @click="player.next()" class="control-btn">
              <font-awesome-icon icon="step-forward" />
            </button>
          </div>
          
          <div class="progress-section">
            <span class="time">{{ player.formattedCurrentTime.value }}</span>
            <div class="progress-bar" @click="handleSeek">
              <div class="progress-fill" :style="{ width: player.progress.value + '%' }"></div>
            </div>
            <span class="time">{{ player.formattedDuration.value }}</span>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCatalog } from '../composables/useCatalog'
import { usePlayer } from '../composables/usePlayer'

const router = useRouter()
const catalog = useCatalog()
const player = usePlayer()

// State
const searchQuery = ref('')
const activeTab = ref('releases')
const currentPage = ref(1)
const itemsPerPage = 24
const isLoading = ref(true)
const stats = ref({
  releases: 0,
  tracks: 0,
  artists: 0
})

// Tab configuration
const tabs = computed(() => [
  { id: 'releases', label: 'Releases', count: stats.value.releases },
  { id: 'tracks', label: 'Tracks', count: stats.value.tracks },
  { id: 'artists', label: 'Artists', count: stats.value.artists }
])

// Data accessor helper functions - handle nested structure from ingestion
function getReleaseTitle(release) {
  return release?.metadata?.title || release?.title || 'Unknown Title'
}

function getReleaseArtist(release) {
  return release?.metadata?.displayArtist || release?.artistName || 'Unknown Artist'
}

function getReleaseType(release) {
  return release?.metadata?.releaseType || release?.releaseType || 'Album'
}

function getReleaseDate(release) {
  return release?.metadata?.releaseDate || release?.releaseDate
}

function getReleaseTrackCount(release) {
  return release?.metadata?.totalTracks || release?.trackCount || release?.trackIds?.length || 0
}

function getArtworkUrl(release) {
  return release?.assets?.coverArt?.url || 
         release?.assets?.coverArt || 
         release?.artworkUrl || 
         '/placeholder-album.png'
}

function getTrackTitle(track) {
  return track?.metadata?.title || track?.title || 'Unknown Track'
}

function getTrackArtist(track) {
  return track?.metadata?.displayArtist || track?.artistName || 'Unknown Artist'
}

function getTrackDuration(track) {
  return track?.metadata?.duration || track?.duration || 0
}

function getTrackArtwork(track) {
  return track?.artworkUrl || track?.audio?.artwork || '/placeholder-album.png'
}

function getAlbumTitle(track) {
  // This would need to be looked up from the release
  return track?.albumTitle || 'Unknown Album'
}

// Computed
const hasContent = computed(() => {
  return stats.value.releases > 0 || stats.value.tracks > 0 || stats.value.artists > 0
})

const filteredReleases = computed(() => {
  let releases = catalog.releases.value
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    releases = releases.filter(r => {
      const title = getReleaseTitle(r).toLowerCase()
      const artist = getReleaseArtist(r).toLowerCase()
      const label = (r?.metadata?.label || '').toLowerCase()
      return title.includes(query) || artist.includes(query) || label.includes(query)
    })
  }
  return paginateItems(releases)
})

const filteredTracks = computed(() => {
  let tracks = catalog.tracks.value
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    tracks = tracks.filter(t => {
      const title = getTrackTitle(t).toLowerCase()
      const artist = getTrackArtist(t).toLowerCase()
      const isrc = (t?.isrc || '').toLowerCase()
      return title.includes(query) || artist.includes(query) || isrc.includes(query)
    })
  }
  return paginateItems(tracks)
})

const filteredArtists = computed(() => {
  let artists = catalog.artists.value
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    artists = artists.filter(a => 
      a.name?.toLowerCase().includes(query)
    )
  }
  return paginateItems(artists)
})

const totalPages = computed(() => {
  let total = 0
  if (activeTab.value === 'releases') total = catalog.releases.value.length
  else if (activeTab.value === 'tracks') total = catalog.tracks.value.length
  else if (activeTab.value === 'artists') total = catalog.artists.value.length
  return Math.ceil(total / itemsPerPage)
})

const lastUpdated = computed(() => {
  // Get the most recent update
  const now = new Date()
  return 'just now' // This would be calculated from actual data
})

// Methods
async function loadCatalog() {
  isLoading.value = true
  try {
    // Load all catalog data
    await Promise.all([
      catalog.fetchAllReleases(),
      catalog.fetchAllTracks(),
      catalog.fetchAllArtists()
    ])
    
    // Update stats
    stats.value = {
      releases: catalog.releases.value.length,
      tracks: catalog.tracks.value.length,
      artists: catalog.artists.value.length
    }
  } catch (error) {
    console.error('Error loading catalog:', error)
  } finally {
    isLoading.value = false
  }
}

function paginateItems(items) {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return items.slice(start, end)
}

function handleSearch() {
  currentPage.value = 1 // Reset to first page on search
}

function clearSearch() {
  searchQuery.value = ''
  currentPage.value = 1
}

function viewRelease(release) {
  router.push(`/releases/${release.id}`)
}

function viewArtist(artist) {
  router.push(`/artists/${artist.id}`)
}

async function playRelease(release) {
  // Load tracks for this release and start playing
  const tracks = await catalog.fetchReleaseTracks(release.id)
  if (tracks.length > 0) {
    // Add all tracks to queue
    player.clearQueue()
    tracks.forEach(track => {
      // Ensure track has necessary metadata
      track.albumTitle = getReleaseTitle(release)
      track.artworkUrl = getArtworkUrl(release)
      // Set audio URL from nested structure
      if (track.audio?.original) {
        track.audioUrl = track.audio.original
      }
      player.addToQueue(track)
    })
    // Play first track
    player.playTrack(tracks[0])
  }
}

function playTrack(track) {
  // Ensure track has audio URL from nested structure
  if (track.audio?.original) {
    track.audioUrl = track.audio.original
  }
  player.playTrack(track)
}

function addToQueue(track) {
  // Ensure track has audio URL from nested structure
  if (track.audio?.original) {
    track.audioUrl = track.audio.original
  }
  player.addToQueue(track)
  // TODO: Show toast notification
  console.log('Added to queue:', getTrackTitle(track))
}

function isCurrentTrack(track) {
  return player.currentTrack.value?.id === track.id
}

function showTrackMenu(track) {
  // TODO: Implement context menu
  console.log('Show menu for:', track)
}

function formatDate(date) {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
}

function formatDuration(seconds) {
  if (!seconds) return '-'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function handleImageError(e) {
  e.target.src = '/placeholder-album.png'
}

function handleSeek(e) {
  const progressBar = e.currentTarget
  const clickX = e.offsetX
  const width = progressBar.offsetWidth
  const percentage = clickX / width
  const seekTime = percentage * player.duration.value
  player.seek(seekTime)
}

// Watch for tab changes
watch(activeTab, () => {
  currentPage.value = 1
})

onMounted(() => {
  loadCatalog()
})
</script>

<style scoped>
.catalog-page {
  padding: var(--space-xl);
  min-height: calc(100vh - 64px);
  padding-bottom: 100px; /* Space for mini player */
}

.page-header {
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

/* Search Section */
.search-section {
  margin-bottom: var(--space-lg);
}

.search-box {
  position: relative;
  max-width: 600px;
}

.search-icon {
  position: absolute;
  left: var(--space-md);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-tertiary);
}

.search-input {
  width: 100%;
  padding: var(--space-md) var(--space-xl);
  padding-left: calc(var(--space-xl) + 20px);
  font-size: var(--text-lg);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-full);
  background-color: var(--color-surface);
  transition: all var(--transition-base);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.clear-btn {
  position: absolute;
  right: var(--space-md);
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  border: none;
  background-color: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-base);
}

.clear-btn:hover {
  background-color: var(--color-border);
  color: var(--color-text);
}

/* Catalog Stats */
.catalog-stats {
  display: flex;
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
  flex-wrap: wrap;
}

.stat-badge {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.stat-badge svg {
  color: var(--color-primary);
}

/* Filter Tabs */
.filter-tabs {
  display: flex;
  gap: var(--space-sm);
  border-bottom: 2px solid var(--color-border);
  margin-bottom: var(--space-xl);
}

.tab-btn {
  padding: var(--space-sm) var(--space-lg);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-secondary);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-base);
  margin-bottom: -2px;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.tab-btn:hover {
  color: var(--color-text);
}

.tab-btn.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.tab-count {
  padding: 2px var(--space-xs);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  min-width: 24px;
  text-align: center;
}

.tab-btn.active .tab-count {
  background-color: var(--color-primary-light);
  color: var(--color-primary);
}

/* Content Grid */
.content-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-lg);
  margin-bottom: var(--space-xl);
}

/* Release Card */
.release-card {
  cursor: pointer;
  overflow: hidden;
  transition: all var(--transition-base);
}

.release-artwork {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  background-color: var(--color-bg-secondary);
}

.release-artwork img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.release-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: var(--space-md);
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
  box-shadow: var(--shadow-lg);
}

.play-btn:hover {
  transform: scale(1.1);
  background-color: var(--color-primary-hover);
}

.release-info {
  padding: var(--space-md);
}

.release-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.release-artist {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  margin-bottom: var(--space-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.release-meta {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.release-type {
  padding: 2px var(--space-xs);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-sm);
}

.release-stats {
  display: flex;
  gap: var(--space-md);
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

/* Tracks Table */
.tracks-list {
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: var(--space-xl);
}

.tracks-table {
  width: 100%;
  border-collapse: collapse;
}

.tracks-table th {
  text-align: left;
  padding: var(--space-sm) var(--space-md);
  background-color: var(--color-bg-secondary);
  font-weight: var(--font-medium);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-border);
}

.track-row {
  cursor: pointer;
  transition: background-color var(--transition-base);
}

.track-row:hover {
  background-color: var(--color-bg-secondary);
}

.track-row.playing {
  background-color: var(--color-primary-light);
}

.track-row td {
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border-light);
}

.col-play {
  width: 40px;
}

.play-btn-sm {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  border: none;
  background-color: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-base);
}

.play-btn-sm:hover {
  background-color: var(--color-primary-light);
  color: var(--color-primary);
}

.track-title-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.track-name {
  font-weight: var(--font-medium);
}

.track-version {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.album-link {
  color: var(--color-text);
  text-decoration: none;
}

.album-link:hover {
  color: var(--color-primary);
  text-decoration: underline;
}

.col-isrc code {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  background-color: var(--color-bg-secondary);
  padding: 2px var(--space-xs);
  border-radius: var(--radius-sm);
}

.col-actions {
  width: 100px;
  text-align: right;
}

.btn-icon {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--transition-base);
  margin-left: var(--space-xs);
}

.btn-icon:hover {
  background-color: var(--color-bg-secondary);
  color: var(--color-text);
}

/* Artists Grid */
.artists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.artist-card {
  text-align: center;
  cursor: pointer;
  padding: var(--space-lg);
}

.artist-image {
  width: 120px;
  height: 120px;
  margin: 0 auto var(--space-md);
  border-radius: var(--radius-full);
  overflow: hidden;
  background-color: var(--color-bg-secondary);
}

.artist-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.artist-name {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-xs);
}

.artist-stats {
  display: flex;
  justify-content: center;
  gap: var(--space-md);
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

/* Mini Player */
.mini-player {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: var(--color-surface);
  border-top: 1px solid var(--color-border);
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.mini-player-content {
  display: flex;
  align-items: center;
  gap: var(--space-xl);
  padding: var(--space-md);
}

.track-info {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex: 0 0 300px;
}

.track-artwork {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  object-fit: cover;
}

.track-details h4 {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  margin-bottom: 2px;
}

.track-details p {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.player-controls {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.control-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  border: none;
  background-color: transparent;
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-base);
}

.control-btn:hover {
  background-color: var(--color-bg-secondary);
}

.control-btn.play-pause {
  width: 40px;
  height: 40px;
  background-color: var(--color-primary);
  color: white;
}

.control-btn.play-pause:hover {
  background-color: var(--color-primary-hover);
}

.progress-section {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.progress-bar {
  flex: 1;
  height: 4px;
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-full);
  cursor: pointer;
  position: relative;
}

.progress-fill {
  height: 100%;
  background-color: var(--color-primary);
  border-radius: var(--radius-full);
  transition: width 0.1s linear;
}

.time {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  min-width: 40px;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-lg);
  margin-top: var(--space-xl);
}

.page-info {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: var(--space-3xl);
}

.empty-icon {
  font-size: 4rem;
  color: var(--color-border);
  margin-bottom: var(--space-lg);
}

/* Loading State */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-3xl);
  color: var(--color-text-secondary);
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

/* Transitions */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform var(--transition-base);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}

/* Responsive */
@media (max-width: 768px) {
  .catalog-page {
    padding: var(--space-md);
  }
  
  .content-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
  
  .tracks-table {
    font-size: var(--text-sm);
  }
  
  .col-album,
  .col-isrc {
    display: none;
  }
  
  .artists-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }
  
  .artist-image {
    width: 80px;
    height: 80px;
  }
  
  .mini-player-content {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-md);
  }
  
  .track-info {
    flex: 1;
  }
  
  .progress-section {
    order: -1;
  }
}
</style>