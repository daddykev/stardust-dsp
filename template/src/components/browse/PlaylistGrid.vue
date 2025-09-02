<!-- template/src/components/browse/PlaylistGrid.vue -->
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayer } from '../../composables/usePlayer'
import { useLibrary } from '../../composables/useLibrary'

const props = defineProps({
  playlists: {
    type: Array,
    required: true
  },
  variant: {
    type: String,
    default: 'default', // 'default', 'compact', 'detailed'
    validator: (value) => ['default', 'compact', 'detailed'].includes(value)
  },
  showDescription: {
    type: Boolean,
    default: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  skeletonCount: {
    type: Number,
    default: 12
  },
  emptyMessage: {
    type: String,
    default: 'No playlists to display'
  }
})

const emit = defineEmits(['play', 'like', 'add-to-library'])

const router = useRouter()
const player = usePlayer()
const library = useLibrary()

// State
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  playlist: null
})

// Methods
function getMosaicImages(playlist) {
  const images = []
  if (playlist.tracks) {
    for (let i = 0; i < 4; i++) {
      images.push(playlist.tracks[i]?.artworkUrl || null)
    }
  }
  while (images.length < 4) {
    images.push(null)
  }
  return images
}

function openPlaylist(playlist) {
  router.push(`/playlists/${playlist.id}`)
}

async function playPlaylist(playlist) {
  emit('play', playlist)
  
  if (playlist.tracks?.length > 0) {
    player.clearQueue()
    playlist.tracks.forEach(track => player.addToQueue(track))
    player.playTrack(playlist.tracks[0])
  }
}

async function toggleLike(playlist) {
  playlist.isLiked = !playlist.isLiked
  emit('like', playlist)
  
  if (playlist.isLiked) {
    await library.addFavorite(playlist.id, 'playlists')
  } else {
    await library.removeFavorite(playlist.id, 'playlists')
  }
}

function addToLibrary(playlist) {
  emit('add-to-library', playlist)
  console.log('Add to library:', playlist.title)
}

function sharePlaylist(playlist) {
  const url = `${window.location.origin}/playlists/${playlist.id}`
  navigator.clipboard.writeText(url)
  console.log('Playlist link copied')
}

function showOptions(playlist, event) {
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    playlist
  }
}

// Context menu actions
function playFromMenu() {
  if (contextMenu.value.playlist) {
    playPlaylist(contextMenu.value.playlist)
  }
  contextMenu.value.show = false
}

function playNext() {
  console.log('Play next:', contextMenu.value.playlist?.title)
  contextMenu.value.show = false
}

function addToQueue() {
  if (contextMenu.value.playlist?.tracks) {
    contextMenu.value.playlist.tracks.forEach(track => {
      player.addToQueue(track)
    })
  }
  contextMenu.value.show = false
}

function viewPlaylist() {
  if (contextMenu.value.playlist) {
    openPlaylist(contextMenu.value.playlist)
  }
  contextMenu.value.show = false
}

function followPlaylist() {
  if (contextMenu.value.playlist) {
    toggleLike(contextMenu.value.playlist)
  }
  contextMenu.value.show = false
}

function copyPlaylist() {
  console.log('Copy playlist:', contextMenu.value.playlist?.title)
  contextMenu.value.show = false
}

function shareFromMenu() {
  if (contextMenu.value.playlist) {
    sharePlaylist(contextMenu.value.playlist)
  }
  contextMenu.value.show = false
}

// Utilities
function formatNumber(num) {
  if (!num) return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

function formatDuration(seconds) {
  if (!seconds) return ''
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours} hr ${minutes} min`
  }
  return `${minutes} min`
}

function handleCoverError(e) {
  e.target.src = '/placeholder-playlist.png'
}

function handleMosaicError(e) {
  e.target.parentElement.innerHTML = '<svg>...</svg>' // Replace with icon
}

// Global click handler
document.addEventListener('click', (e) => {
  if (!e.target.closest('.context-menu') && !e.target.closest('.action-btn')) {
    contextMenu.value.show = false
  }
})
</script>

<template>
  <div class="playlist-grid" :class="[`variant-${variant}`, { loading }]">
    <!-- Loading State -->
    <div v-if="loading" class="loading-grid">
      <div v-for="i in skeletonCount" :key="i" class="skeleton-playlist">
        <div class="skeleton skeleton-cover"></div>
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-description"></div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!playlists || playlists.length === 0" class="empty-state">
      <font-awesome-icon icon="list" />
      <h3>No playlists found</h3>
      <p>{{ emptyMessage }}</p>
    </div>

    <!-- Playlists Grid -->
    <div v-else class="playlists-container">
      <div 
        v-for="playlist in playlists" 
        :key="playlist.id"
        class="playlist-item"
        @click="openPlaylist(playlist)"
      >
        <!-- Playlist Cover -->
        <div class="playlist-cover-wrapper">
          <div v-if="playlist.coverUrl" class="playlist-cover">
            <img 
              :src="playlist.coverUrl" 
              :alt="playlist.title"
              @error="handleCoverError"
            />
          </div>
          <div v-else class="playlist-mosaic">
            <div 
              v-for="(image, index) in getMosaicImages(playlist)" 
              :key="index"
              class="mosaic-tile"
            >
              <img 
                v-if="image"
                :src="image" 
                alt=""
                @error="handleMosaicError"
              />
              <div v-else class="mosaic-placeholder">
                <font-awesome-icon icon="music" />
              </div>
            </div>
          </div>

          <div class="playlist-overlay">
            <button 
              @click.stop="playPlaylist(playlist)" 
              class="play-btn"
              title="Play playlist"
            >
              <font-awesome-icon icon="play" />
            </button>
          </div>

          <!-- Badges -->
          <div class="playlist-badges">
            <span v-if="playlist.collaborative" class="badge collaborative" title="Collaborative playlist">
              <font-awesome-icon icon="users" />
            </span>
            <span v-if="playlist.public" class="badge public" title="Public playlist">
              <font-awesome-icon icon="globe" />
            </span>
            <span v-if="playlist.featured" class="badge featured" title="Featured playlist">
              <font-awesome-icon icon="star" />
            </span>
            <span v-if="playlist.official" class="badge official" title="Official playlist">
              <font-awesome-icon icon="check-circle" />
            </span>
          </div>

          <div v-if="playlist.trackCount" class="track-count">
            {{ playlist.trackCount }} songs
          </div>
        </div>

        <!-- Playlist Info -->
        <div class="playlist-info">
          <h4 class="playlist-title">{{ playlist.title || 'Untitled Playlist' }}</h4>
          
          <p v-if="playlist.description && showDescription" class="playlist-description">
            {{ playlist.description }}
          </p>
          
          <div class="playlist-meta">
            <router-link 
              v-if="playlist.owner"
              :to="`/profile/${playlist.owner.id}`"
              class="playlist-owner"
              @click.stop
            >
              By {{ playlist.owner.displayName }}
            </router-link>
            
            <span v-if="playlist.followers" class="playlist-followers">
              <font-awesome-icon icon="heart" />
              {{ formatNumber(playlist.followers) }}
            </span>
            
            <span v-if="playlist.duration" class="playlist-duration">
              {{ formatDuration(playlist.duration) }}
            </span>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="playlist-actions">
          <button 
            @click.stop="toggleLike(playlist)" 
            class="action-btn"
            :class="{ liked: playlist.isLiked }"
            title="Like playlist"
          >
            <font-awesome-icon :icon="playlist.isLiked ? 'heart' : ['far', 'heart']" />
          </button>
          
          <button 
            @click.stop="addToLibrary(playlist)" 
            class="action-btn"
            title="Add to library"
          >
            <font-awesome-icon icon="plus" />
          </button>
          
          <button 
            @click.stop="sharePlaylist(playlist)" 
            class="action-btn"
            title="Share"
          >
            <font-awesome-icon icon="share" />
          </button>
          
          <button 
            @click.stop="showOptions(playlist, $event)" 
            class="action-btn"
            title="More options"
          >
            <font-awesome-icon icon="ellipsis-h" />
          </button>
        </div>
      </div>
    </div>

    <!-- Context Menu -->
    <transition name="fade">
      <div 
        v-if="contextMenu.show" 
        class="context-menu"
        :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
      >
        <button @click="playFromMenu">
          <font-awesome-icon icon="play" />
          Play
        </button>
        <button @click="playNext">
          <font-awesome-icon icon="play" />
          Play Next
        </button>
        <button @click="addToQueue">
          <font-awesome-icon icon="plus" />
          Add to Queue
        </button>
        <button @click="viewPlaylist">
          <font-awesome-icon icon="list" />
          View Playlist
        </button>
        <button @click="followPlaylist">
          <font-awesome-icon icon="heart" />
          Follow Playlist
        </button>
        <button @click="copyPlaylist">
          <font-awesome-icon icon="copy" />
          Copy Playlist
        </button>
        <button @click="shareFromMenu">
          <font-awesome-icon icon="share" />
          Share
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.playlist-grid {
  width: 100%;
}

/* Grid Container */
.playlists-container {
  display: grid;
  gap: var(--space-lg);
}

/* Variants */
.variant-default .playlists-container {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.variant-compact .playlists-container {
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--space-md);
}

.variant-detailed .playlists-container {
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--space-xl);
}

/* Playlist Item */
.playlist-item {
  cursor: pointer;
  transition: transform var(--transition-base);
  position: relative;
}

.playlist-item:hover {
  transform: translateY(-4px);
}

/* Playlist Cover */
.playlist-cover-wrapper {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: var(--space-md);
  background: var(--color-bg-secondary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: box-shadow var(--transition-base);
}

.playlist-item:hover .playlist-cover-wrapper {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.playlist-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Mosaic Layout */
.playlist-mosaic {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  width: 100%;
  height: 100%;
}

.mosaic-tile {
  position: relative;
  overflow: hidden;
}

.mosaic-tile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mosaic-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  color: white;
}

/* Overlay */
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

.playlist-item:hover .playlist-overlay {
  opacity: 1;
}

.play-btn {
  width: 56px;
  height: 56px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: var(--text-lg);
  transition: transform var(--transition-base);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.play-btn:hover {
  transform: scale(1.1);
}

/* Badges */
.playlist-badges {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  display: flex;
  gap: var(--space-xs);
}

.badge {
  padding: var(--space-xs);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  backdrop-filter: blur(10px);
}

.badge.collaborative {
  background: var(--color-info);
}

.badge.featured {
  background: var(--color-warning);
}

.badge.official {
  background: var(--color-primary);
}

/* Track Count */
.track-count {
  position: absolute;
  bottom: var(--space-sm);
  left: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  backdrop-filter: blur(10px);
}

/* Playlist Info */
.playlist-info {
  padding: 0 var(--space-xs);
}

.playlist-title {
  font-size: var(--text-md);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playlist-description {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.variant-compact .playlist-description {
  display: none;
}

.playlist-meta {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.playlist-owner {
  color: inherit;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playlist-owner:hover {
  text-decoration: underline;
}

.playlist-followers {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

/* Actions */
.playlist-actions {
  position: absolute;
  top: var(--space-sm);
  left: var(--space-sm);
  display: flex;
  gap: var(--space-xs);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.playlist-item:hover .playlist-actions {
  opacity: 1;
}

.action-btn {
  width: 32px;
  height: 32px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-base);
  color: var(--color-text-secondary);
}

.action-btn:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  transform: scale(1.1);
}

.action-btn.liked {
  color: var(--color-primary);
  background: var(--color-primary-light);
  border-color: var(--color-primary);
}

/* Loading State */
.loading-grid {
  display: grid;
  gap: var(--space-lg);
}

.variant-default .loading-grid {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.variant-compact .loading-grid {
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
}

.skeleton-playlist {
  display: flex;
  flex-direction: column;
}

.skeleton {
  background: var(--color-bg-secondary);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.skeleton-cover {
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  margin-bottom: var(--space-md);
}

.skeleton-title {
  height: 20px;
  width: 80%;
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-xs);
}

.skeleton-description {
  height: 16px;
  width: 60%;
  border-radius: var(--radius-sm);
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-text-secondary);
}

.empty-state svg {
  font-size: 3rem;
  margin-bottom: var(--space-lg);
  opacity: 0.5;
}

/* Context Menu */
.context-menu {
  position: fixed;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 1000;
  min-width: 200px;
  padding: var(--space-xs);
}

.context-menu button {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-base);
  border-radius: var(--radius-sm);
}

.context-menu button:hover {
  background: var(--color-bg-secondary);
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .playlist-actions {
    opacity: 1;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    border-radius: var(--radius-md);
    padding: var(--space-xs);
  }

  .variant-detailed .playlists-container {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  }
}
</style>