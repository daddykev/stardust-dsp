<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLibrary } from '../composables/useLibrary'
import { useCatalog } from '../composables/useCatalog'
import { usePlayer } from '../composables/usePlayer'

const router = useRouter()
const library = useLibrary()
const catalog = useCatalog()
const player = usePlayer()

// State
const activeTab = ref('playlists')
const showCreatePlaylist = ref(false)
const showAddToPlaylistModal = ref(false)
const editingPlaylist = ref(null)
const selectedTrackForPlaylist = ref(null)
const favoriteTracks = ref([])
const favoriteAlbums = ref([])
const favoriteArtists = ref([])

const playlistForm = ref({
  title: '',
  description: '',
  public: false,
  collaborative: false
})

// Tabs configuration
const tabs = computed(() => [
  { 
    id: 'playlists', 
    label: 'Playlists', 
    icon: 'list',
    count: library.playlists.value.length 
  },
  { 
    id: 'tracks', 
    label: 'Songs', 
    icon: 'music',
    count: library.favoriteTracks.value.length 
  },
  { 
    id: 'albums', 
    label: 'Albums', 
    icon: 'compact-disc',
    count: library.favoriteAlbums.value.length 
  },
  { 
    id: 'artists', 
    label: 'Artists', 
    icon: 'user',
    count: library.favoriteArtists.value.length 
  },
  { 
    id: 'history', 
    label: 'Recent', 
    icon: 'clock',
    count: library.recentlyPlayed.value.length 
  }
])

// Load favorite items with details
async function loadFavoriteDetails() {
  favoriteTracks.value = await library.getFavoriteItems('tracks')
  favoriteAlbums.value = await library.getFavoriteItems('albums')
  favoriteArtists.value = await library.getFavoriteItems('artists')
}

// Playlist management
function createNewPlaylistForTrack() {
  showAddToPlaylistModal.value = false
  showCreatePlaylist.value = true
}

async function savePlaylist() {
  try {
    if (editingPlaylist.value) {
      await library.updatePlaylist(editingPlaylist.value.id, playlistForm.value)
    } else {
      const newPlaylist = await library.createPlaylist(playlistForm.value)
      
      // If we were adding a track, add it to the new playlist
      if (selectedTrackForPlaylist.value) {
        await library.addToPlaylist(newPlaylist.id, selectedTrackForPlaylist.value)
      }
    }
    
    closePlaylistModal()
  } catch (error) {
    console.error('Error saving playlist:', error)
    alert(error.message)
  }
}

function editPlaylist(playlist) {
  editingPlaylist.value = playlist
  playlistForm.value = {
    title: playlist.title,
    description: playlist.description || '',
    public: playlist.public || false,
    collaborative: playlist.collaborative || false
  }
}

async function deletePlaylist(playlist) {
  if (confirm(`Delete "${playlist.title}"?`)) {
    try {
      await library.deletePlaylist(playlist.id)
    } catch (error) {
      console.error('Error deleting playlist:', error)
      alert('Failed to delete playlist')
    }
  }
}

function closePlaylistModal() {
  showCreatePlaylist.value = false
  editingPlaylist.value = null
  selectedTrackForPlaylist.value = null
  playlistForm.value = {
    title: '',
    description: '',
    public: false,
    collaborative: false
  }
}

// Add to playlist
function showAddToPlaylist(track) {
  selectedTrackForPlaylist.value = track
  showAddToPlaylistModal.value = true
}

async function addTrackToPlaylist(playlistId) {
  try {
    await library.addToPlaylist(playlistId, selectedTrackForPlaylist.value)
    closeAddToPlaylistModal()
    // TODO: Show success toast
  } catch (error) {
    console.error('Error adding to playlist:', error)
    alert(error.message)
  }
}

function closeAddToPlaylistModal() {
  showAddToPlaylistModal.value = false
  selectedTrackForPlaylist.value = null
}

// Remove from favorites
async function removeFromFavorites(item, type) {
  try {
    await library.toggleFavorite(item, type)
    await loadFavoriteDetails() // Reload to update UI
  } catch (error) {
    console.error('Error removing from favorites:', error)
  }
}

// Playback
function playTrack(track) {
  player.playTrack(track)
}

function playAllTracks() {
  if (favoriteTracks.value.length === 0) return
  
  player.clearQueue()
  favoriteTracks.value.forEach(track => player.addToQueue(track))
  player.playTrack(favoriteTracks.value[0])
}

async function playPlaylist(playlist) {
  if (!playlist.tracks || playlist.tracks.length === 0) return
  
  player.clearQueue()
  playlist.tracks.forEach(track => player.addToQueue(track))
  player.playTrack(playlist.tracks[0])
}

async function playAlbum(album) {
  const tracks = await catalog.fetchReleaseTracks(album.id)
  if (tracks.length > 0) {
    player.clearQueue()
    tracks.forEach(track => {
      track.albumTitle = album.title
      track.artworkUrl = album.artworkUrl
      player.addToQueue(track)
    })
    player.playTrack(tracks[0])
  }
}

function isCurrentTrack(track) {
  return player.currentTrack.value?.id === track.id
}

// Navigation
function viewPlaylist(playlist) {
  router.push(`/playlists/${playlist.id}`)
}

function viewAlbum(album) {
  router.push(`/releases/${album.id}`)
}

function viewArtist(artist) {
  router.push(`/artists/${artist.id}`)
}

// History
function clearHistory() {
  if (confirm('Clear all listening history?')) {
    // TODO: Implement clear history
    console.log('Clear history')
  }
}

// Utilities
function getPlaylistCover(playlist) {
  if (playlist.cover) return playlist.cover
  if (playlist.tracks?.length > 0 && playlist.tracks[0].artworkUrl) {
    return playlist.tracks[0].artworkUrl
  }
  return '/placeholder-album.png'
}

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

function handleImageError(e) {
  e.target.src = e.target.classList.contains('artist-image') 
    ? '/placeholder-artist.png'
    : '/placeholder-album.png'
}

onMounted(() => {
  loadFavoriteDetails()
})
</script>

<template>
  <div class="library-page">
    <div class="container">
      <!-- Page Header -->
      <div class="page-header">
        <h1>Your Library</h1>
        <p class="page-subtitle">Your saved music and playlists</p>
      </div>

      <!-- Library Tabs -->
      <div class="library-tabs">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          @click="activeTab = tab.id"
          class="tab-btn"
          :class="{ active: activeTab === tab.id }"
        >
          <font-awesome-icon :icon="tab.icon" />
          <span>{{ tab.label }}</span>
          <span v-if="tab.count > 0" class="tab-count">{{ tab.count }}</span>
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="library.isLoading.value" class="loading-state">
        <div class="spinner"></div>
        <p>Loading your library...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="!library.hasLibraryContent.value" class="empty-state card">
        <div class="card-body">
          <font-awesome-icon icon="bookmark" class="empty-icon" />
          <h3>Your Library is Empty</h3>
          <p>Start building your library by saving your favorite music</p>
          <router-link to="/catalog" class="btn btn-primary">
            Explore Music
          </router-link>
        </div>
      </div>

      <!-- Content -->
      <div v-else>
        <!-- Playlists Tab -->
        <div v-if="activeTab === 'playlists'" class="playlists-section">
          <div class="section-header">
            <h2>Playlists</h2>
            <button @click="showCreatePlaylist = true" class="btn btn-primary">
              <font-awesome-icon icon="plus" />
              New Playlist
            </button>
          </div>

          <div v-if="library.playlists.value.length === 0" class="empty-tab">
            <p>No playlists yet</p>
            <button @click="showCreatePlaylist = true" class="btn btn-secondary">
              Create Your First Playlist
            </button>
          </div>

          <div v-else class="playlists-grid">
            <div 
              v-for="playlist in library.playlists.value" 
              :key="playlist.id"
              class="playlist-card card card-hover"
              @click="viewPlaylist(playlist)"
            >
              <div class="playlist-cover">
                <img 
                  :src="getPlaylistCover(playlist)" 
                  :alt="playlist.title"
                  @error="handleImageError"
                />
                <div class="playlist-overlay">
                  <button @click.stop="playPlaylist(playlist)" class="play-btn">
                    <font-awesome-icon icon="play" />
                  </button>
                </div>
              </div>
              <div class="playlist-info">
                <h3>{{ playlist.title }}</h3>
                <p>{{ playlist.tracks?.length || 0 }} tracks</p>
                <div class="playlist-meta">
                  <span v-if="playlist.public" class="badge public">Public</span>
                  <span v-if="playlist.collaborative" class="badge collab">Collaborative</span>
                </div>
              </div>
              <div class="playlist-actions">
                <button @click.stop="editPlaylist(playlist)" class="btn-icon">
                  <font-awesome-icon icon="edit" />
                </button>
                <button @click.stop="deletePlaylist(playlist)" class="btn-icon">
                  <font-awesome-icon icon="trash" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Favorite Tracks Tab -->
        <div v-if="activeTab === 'tracks'" class="tracks-section">
          <div class="section-header">
            <h2>Favorite Tracks</h2>
            <button v-if="favoriteTracks.length > 0" @click="playAllTracks" class="btn btn-primary">
              <font-awesome-icon icon="play" />
              Play All
            </button>
          </div>

          <div v-if="favoriteTracks.length === 0" class="empty-tab">
            <p>No favorite tracks yet</p>
          </div>

          <div v-else class="tracks-list">
            <div 
              v-for="(track, index) in favoriteTracks" 
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
              
              <img 
                :src="track.artworkUrl || '/placeholder-album.png'" 
                :alt="track.title"
                class="track-artwork"
                @error="handleImageError"
              />
              
              <div class="track-info">
                <div class="track-title">{{ track.title }}</div>
                <div class="track-artist">{{ track.artistName }}</div>
              </div>
              
              <div class="track-album">
                <router-link 
                  v-if="track.releaseId"
                  :to="`/releases/${track.releaseId}`"
                  @click.stop
                >
                  {{ track.albumTitle }}
                </router-link>
                <span v-else>{{ track.albumTitle }}</span>
              </div>
              
              <div class="track-duration">
                {{ formatDuration(track.duration) }}
              </div>
              
              <div class="track-actions">
                <button @click.stop="removeFromFavorites(track, 'tracks')" class="btn-icon">
                  <font-awesome-icon icon="heart-broken" />
                </button>
                <button @click.stop="showAddToPlaylist(track)" class="btn-icon">
                  <font-awesome-icon icon="plus" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Favorite Albums Tab -->
        <div v-if="activeTab === 'albums'" class="albums-section">
          <div class="section-header">
            <h2>Favorite Albums</h2>
          </div>

          <div v-if="favoriteAlbums.length === 0" class="empty-tab">
            <p>No favorite albums yet</p>
          </div>

          <div v-else class="albums-grid">
            <div 
              v-for="album in favoriteAlbums" 
              :key="album.id"
              class="album-card card card-hover"
              @click="viewAlbum(album)"
            >
              <div class="album-artwork">
                <img 
                  :src="album.artworkUrl || '/placeholder-album.png'" 
                  :alt="album.title"
                  @error="handleImageError"
                />
                <div class="album-overlay">
                  <button @click.stop="playAlbum(album)" class="play-btn">
                    <font-awesome-icon icon="play" />
                  </button>
                </div>
              </div>
              <div class="album-info">
                <h4>{{ album.title }}</h4>
                <p>{{ album.artistName }}</p>
                <span class="album-year">{{ formatYear(album.releaseDate) }}</span>
              </div>
              <button @click.stop="removeFromFavorites(album, 'albums')" class="remove-btn">
                <font-awesome-icon icon="times" />
              </button>
            </div>
          </div>
        </div>

        <!-- Favorite Artists Tab -->
        <div v-if="activeTab === 'artists'" class="artists-section">
          <div class="section-header">
            <h2>Favorite Artists</h2>
          </div>

          <div v-if="favoriteArtists.length === 0" class="empty-tab">
            <p>No favorite artists yet</p>
          </div>

          <div v-else class="artists-grid">
            <div 
              v-for="artist in favoriteArtists" 
              :key="artist.id"
              class="artist-card card card-hover"
              @click="viewArtist(artist)"
            >
              <div class="artist-image">
                <img 
                  :src="artist.imageUrl || '/placeholder-artist.png'" 
                  :alt="artist.name"
                  @error="handleImageError"
                />
              </div>
              <div class="artist-info">
                <h4>{{ artist.name }}</h4>
                <p>{{ artist.releaseCount || 0 }} releases</p>
              </div>
              <button @click.stop="removeFromFavorites(artist, 'artists')" class="remove-btn">
                <font-awesome-icon icon="times" />
              </button>
            </div>
          </div>
        </div>

        <!-- Recently Played Tab -->
        <div v-if="activeTab === 'history'" class="history-section">
          <div class="section-header">
            <h2>Recently Played</h2>
            <button v-if="library.recentlyPlayed.value.length > 0" @click="clearHistory" class="btn btn-secondary">
              Clear History
            </button>
          </div>

          <div v-if="library.recentlyPlayed.value.length === 0" class="empty-tab">
            <p>No listening history yet</p>
          </div>

          <div v-else class="history-list">
            <div 
              v-for="item in library.recentlyPlayed.value" 
              :key="item.id"
              class="history-item"
              @click="playTrack(item)"
            >
              <img 
                :src="item.artworkUrl || '/placeholder-album.png'" 
                :alt="item.title"
                class="history-artwork"
                @error="handleImageError"
              />
              <div class="history-info">
                <div class="history-title">{{ item.title }}</div>
                <div class="history-artist">{{ item.artistName }}</div>
                <div class="history-time">{{ formatTime(item.playedAt) }}</div>
              </div>
              <button @click.stop="playTrack(item)" class="btn-icon">
                <font-awesome-icon icon="play" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Playlist Modal -->
    <transition name="modal">
      <div v-if="showCreatePlaylist || editingPlaylist" class="modal-overlay" @click.self="closePlaylistModal">
        <div class="modal-content">
          <div class="modal-header">
            <h3>{{ editingPlaylist ? 'Edit Playlist' : 'Create New Playlist' }}</h3>
            <button @click="closePlaylistModal" class="btn-icon">
              <font-awesome-icon icon="times" />
            </button>
          </div>
          
          <form @submit.prevent="savePlaylist" class="modal-body">
            <div class="form-group">
              <label class="form-label">Playlist Name</label>
              <input 
                v-model="playlistForm.title" 
                type="text" 
                class="form-input"
                placeholder="My Awesome Playlist"
                required
              />
            </div>
            
            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea 
                v-model="playlistForm.description" 
                class="form-textarea"
                placeholder="Describe your playlist..."
                rows="3"
              ></textarea>
            </div>
            
            <div class="form-group">
              <label class="form-checkbox">
                <input v-model="playlistForm.public" type="checkbox" />
                <span>Make playlist public</span>
              </label>
            </div>
            
            <div class="form-group">
              <label class="form-checkbox">
                <input v-model="playlistForm.collaborative" type="checkbox" />
                <span>Allow others to add tracks (collaborative)</span>
              </label>
            </div>
          </form>
          
          <div class="modal-footer">
            <button @click="closePlaylistModal" class="btn btn-secondary">
              Cancel
            </button>
            <button @click="savePlaylist" class="btn btn-primary">
              {{ editingPlaylist ? 'Save Changes' : 'Create Playlist' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Add to Playlist Modal -->
    <transition name="modal">
      <div v-if="showAddToPlaylistModal" class="modal-overlay" @click.self="closeAddToPlaylistModal">
        <div class="modal-content small">
          <div class="modal-header">
            <h3>Add to Playlist</h3>
            <button @click="closeAddToPlaylistModal" class="btn-icon">
              <font-awesome-icon icon="times" />
            </button>
          </div>
          
          <div class="modal-body">
            <div class="playlist-selector">
              <button @click="createNewPlaylistForTrack" class="playlist-option new">
                <font-awesome-icon icon="plus" />
                <span>Create New Playlist</span>
              </button>
              
              <div 
                v-for="playlist in library.playlists.value" 
                :key="playlist.id"
                @click="addTrackToPlaylist(playlist.id)"
                class="playlist-option"
              >
                <img 
                  :src="getPlaylistCover(playlist)" 
                  :alt="playlist.title"
                  @error="handleImageError"
                />
                <div class="playlist-option-info">
                  <h4>{{ playlist.title }}</h4>
                  <p>{{ playlist.tracks?.length || 0 }} tracks</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.library-page {
  padding: var(--space-xl);
  min-height: calc(100vh - 64px);
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

/* Library Tabs */
.library-tabs {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-xl);
  border-bottom: 2px solid var(--color-border);
  overflow-x: auto;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-lg);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-secondary);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-base);
  margin-bottom: -2px;
  white-space: nowrap;
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
  min-width: 20px;
  text-align: center;
}

.tab-btn.active .tab-count {
  background-color: var(--color-primary-light);
  color: var(--color-primary);
}

/* Section Headers */
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

/* Empty States */
.empty-tab {
  text-align: center;
  padding: var(--space-3xl);
  color: var(--color-text-secondary);
}

/* Playlists Grid */
.playlists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-lg);
}

.playlist-card {
  position: relative;
  cursor: pointer;
  overflow: hidden;
}

.playlist-cover {
  position: relative;
  aspect-ratio: 1;
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: var(--space-sm);
}

.playlist-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.playlist-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition-base);
}

.playlist-card:hover .playlist-overlay {
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

.playlist-info {
  padding: var(--space-sm);
}

.playlist-info h3 {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playlist-info p {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
}

.playlist-meta {
  display: flex;
  gap: var(--space-xs);
}

.badge {
  padding: 2px var(--space-xs);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.badge.public {
  background-color: var(--color-primary-light);
  color: var(--color-primary);
}

.badge.collab {
  background-color: var(--color-success);
  color: white;
}

.playlist-actions {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  display: flex;
  gap: var(--space-xs);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.playlist-card:hover .playlist-actions {
  opacity: 1;
}

/* Tracks List */
.tracks-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
}

.track-item {
  display: grid;
  grid-template-columns: 30px 48px 1fr auto 100px 80px;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background-color var(--transition-base);
}

.track-item:hover {
  background-color: var(--color-bg-secondary);
}

.track-item.playing {
  background-color: var(--color-primary-light);
}

.track-number {
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
}

.playing-icon {
  color: var(--color-primary);
}

.track-artwork {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  object-fit: cover;
}

.track-info {
  min-width: 0;
}

.track-title {
  font-weight: var(--font-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-artist {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-album {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.track-album a {
  color: inherit;
  text-decoration: none;
}

.track-album a:hover {
  color: var(--color-primary);
  text-decoration: underline;
}

.track-duration {
  text-align: right;
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.track-actions {
  display: flex;
  gap: var(--space-xs);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.track-item:hover .track-actions {
  opacity: 1;
}

/* Albums Grid */
.albums-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-lg);
}

.album-card {
  position: relative;
  cursor: pointer;
}

.album-artwork {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: var(--space-sm);
  box-shadow: var(--shadow-md);
}

.album-artwork img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.album-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition-base);
}

.album-card:hover .album-overlay {
  opacity: 1;
}

.album-info h4 {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album-info p {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album-year {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.remove-btn {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: all var(--transition-base);
}

.album-card:hover .remove-btn,
.artist-card:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  background-color: var(--color-error);
}

/* Artists Grid */
.artists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-lg);
}

.artist-card {
  position: relative;
  text-align: center;
  cursor: pointer;
  padding: var(--space-md);
}

.artist-image {
  width: 100px;
  height: 100px;
  margin: 0 auto var(--space-sm);
  border-radius: var(--radius-full);
  overflow: hidden;
  background-color: var(--color-bg-secondary);
}

.artist-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.artist-info h4 {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-xs);
}

.artist-info p {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

/* History List */
.history-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.history-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
}

.history-item:hover {
  box-shadow: var(--shadow-sm);
  transform: translateX(4px);
}

.history-artwork {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  object-fit: cover;
}

.history-info {
  flex: 1;
  min-width: 0;
}

.history-title {
  font-weight: var(--font-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-artist {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-time {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

/* Playlist Selector */
.playlist-selector {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  max-height: 400px;
  overflow-y: auto;
}

.playlist-option {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background-color var(--transition-base);
}

.playlist-option:hover {
  background-color: var(--color-bg-secondary);
}

.playlist-option.new {
  background-color: var(--color-primary-light);
  color: var(--color-primary);
  justify-content: center;
  padding: var(--space-md);
  font-weight: var(--font-medium);
}

.playlist-option img {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  object-fit: cover;
}

.playlist-option-info h4 {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  margin-bottom: 2px;
}

.playlist-option-info p {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

/* Utilities */
.btn-icon {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-base);
}

.btn-icon:hover {
  background-color: var(--color-bg-secondary);
  color: var(--color-text);
}

/* Modal */
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
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-content.small {
  max-width: 400px;
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
  .library-page {
    padding: var(--space-md);
  }
  
  .library-tabs {
    gap: 0;
  }
  
  .tab-btn {
    padding: var(--space-sm) var(--space-md);
    font-size: var(--text-sm);
  }
  
  .playlists-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
  
  .albums-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
  
  .artists-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }
  
  .track-item {
    grid-template-columns: 30px 40px 1fr 60px;
  }
  
  .track-album,
  .track-actions {
    display: none;
  }
}
</style>