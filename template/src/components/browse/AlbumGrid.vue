<!-- template/src/components/browse/AlbumGrid.vue -->
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayer } from '../../composables/usePlayer'
import { useLibrary } from '../../composables/useLibrary'
import { useCatalog } from '../../composables/useCatalog'

const props = defineProps({
  albums: {
    type: Array,
    required: true
  },
  layout: {
    type: String,
    default: 'grid', // 'grid', 'compact', 'list'
    validator: (value) => ['grid', 'compact', 'list'].includes(value)
  },
  showType: {
    type: Boolean,
    default: true
  },
  showMeta: {
    type: Boolean,
    default: true
  },
  showStats: {
    type: Boolean,
    default: false
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
    default: 'Try searching for something else'
  }
})

const emit = defineEmits(['play', 'like', 'add-to-library'])

const router = useRouter()
const player = usePlayer()
const library = useLibrary()
const catalog = useCatalog()

// State
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  album: null
})

// Methods
function openAlbum(album) {
  router.push(`/releases/${album.id}`)
}

async function playAlbum(album) {
  emit('play', album)
  
  // Load album tracks and play
  const tracks = await catalog.getAlbumTracks(album.id)
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

async function toggleLike(album) {
  album.isLiked = !album.isLiked
  emit('like', album)
  
  if (album.isLiked) {
    await library.addFavorite(album.id, 'albums')
  } else {
    await library.removeFavorite(album.id, 'albums')
  }
}

function addToLibrary(album) {
  emit('add-to-library', album)
  library.addToLibrary(album.id, 'albums')
}

function shareAlbum(album) {
  const url = `${window.location.origin}/releases/${album.id}`
  navigator.clipboard.writeText(url)
  console.log('Album link copied')
}

function showOptions(album, event) {
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    album
  }
}

// Context menu actions
function playFromMenu() {
  if (contextMenu.value.album) {
    playAlbum(contextMenu.value.album)
  }
  contextMenu.value.show = false
}

function playNext() {
  console.log('Play next:', contextMenu.value.album?.title)
  contextMenu.value.show = false
}

async function shufflePlay() {
  if (contextMenu.value.album) {
    const tracks = await catalog.getAlbumTracks(contextMenu.value.album.id)
    const shuffled = [...tracks].sort(() => Math.random() - 0.5)
    player.clearQueue()
    shuffled.forEach(track => player.addToQueue(track))
    if (shuffled.length > 0) {
      player.playTrack(shuffled[0])
    }
  }
  contextMenu.value.show = false
}

async function addToQueue() {
  if (contextMenu.value.album) {
    const tracks = await catalog.getAlbumTracks(contextMenu.value.album.id)
    tracks.forEach(track => player.addToQueue(track))
  }
  contextMenu.value.show = false
}

function viewAlbum() {
  if (contextMenu.value.album) {
    openAlbum(contextMenu.value.album)
  }
  contextMenu.value.show = false
}

function viewArtist() {
  if (contextMenu.value.album?.artistId) {
    router.push(`/artists/${contextMenu.value.album.artistId}`)
  }
  contextMenu.value.show = false
}

function startRadio() {
  if (contextMenu.value.album) {
    router.push(`/radio/album/${contextMenu.value.album.id}`)
  }
  contextMenu.value.show = false
}

function shareFromMenu() {
  if (contextMenu.value.album) {
    shareAlbum(contextMenu.value.album)
  }
  contextMenu.value.show = false
}

// Utilities
function formatDate(date) {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.getFullYear()
}

function formatDuration(seconds) {
  if (!seconds) return ''
  const mins = Math.floor(seconds / 60)
  return `${mins} min`
}

function formatNumber(num) {
  if (!num) return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

function handleImageError(e) {
  e.target.src = '/placeholder-album.png'
}

// Global click handler
document.addEventListener('click', (e) => {
  if (!e.target.closest('.context-menu') && !e.target.closest('.action-btn')) {
    contextMenu.value.show = false
  }
})
</script>

<template>
  <div class="album-grid" :class="[`layout-${layout}`, { loading }]">
    <!-- Loading State -->
    <div v-if="loading" class="loading-grid">
      <div v-for="i in skeletonCount" :key="i" class="skeleton-album">
        <div class="skeleton skeleton-cover"></div>
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-artist"></div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!albums || albums.length === 0" class="empty-state">
      <font-awesome-icon icon="compact-disc" />
      <h3>No albums found</h3>
      <p>{{ emptyMessage }}</p>
    </div>

    <!-- Albums Grid -->
    <div v-else class="albums-container">
      <div 
        v-for="album in albums" 
        :key="album.id"
        class="album-item"
        @click="openAlbum(album)"
      >
        <!-- Album Cover -->
        <div class="album-cover-wrapper">
          <img 
            :src="album.artworkUrl || '/placeholder-album.png'" 
            :alt="album.title"
            class="album-cover"
            @error="handleImageError"
          />
          
          <div class="album-overlay">
            <button 
              @click.stop="playAlbum(album)" 
              class="play-btn"
              title="Play album"
            >
              <font-awesome-icon icon="play" />
            </button>
          </div>

          <!-- Badges -->
          <div v-if="album.isNew" class="album-badge new">NEW</div>
          <div v-else-if="album.isExclusive" class="album-badge exclusive">EXCLUSIVE</div>
          <div v-else-if="album.isDeluxe" class="album-badge deluxe">DELUXE</div>

          <!-- Type Indicator -->
          <div v-if="showType" class="album-type">
            {{ album.type || 'Album' }}
          </div>
        </div>

        <!-- Album Info -->
        <div class="album-info">
          <h4 class="album-title">{{ album.title }}</h4>
          
          <router-link 
            v-if="album.artistId"
            :to="`/artists/${album.artistId}`"
            class="album-artist"
            @click.stop
          >
            {{ album.artist }}
          </router-link>
          <span v-else class="album-artist">{{ album.artist }}</span>

          <div v-if="showMeta" class="album-meta">
            <span v-if="album.releaseDate" class="release-date">
              {{ formatDate(album.releaseDate) }}
            </span>
            <span v-if="album.trackCount" class="track-count">
              {{ album.trackCount }} tracks
            </span>
            <span v-if="album.duration" class="duration">
              {{ formatDuration(album.duration) }}
            </span>
          </div>

          <div v-if="showStats" class="album-stats">
            <span v-if="album.playCount" class="play-count">
              <font-awesome-icon icon="play" />
              {{ formatNumber(album.playCount) }}
            </span>
            <span v-if="album.rating" class="rating">
              <font-awesome-icon icon="star" />
              {{ album.rating.toFixed(1) }}
            </span>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="album-actions">
          <button 
            @click.stop="toggleLike(album)" 
            class="action-btn"
            :class="{ liked: album.isLiked }"
            title="Like album"
          >
            <font-awesome-icon :icon="album.isLiked ? 'heart' : ['far', 'heart']" />
          </button>
          
          <button 
            @click.stop="addToLibrary(album)" 
            class="action-btn"
            title="Add to library"
          >
            <font-awesome-icon icon="plus" />
          </button>
          
          <button 
            @click.stop="shareAlbum(album)" 
            class="action-btn"
            title="Share"
          >
            <font-awesome-icon icon="share" />
          </button>
          
          <button 
            @click.stop="showOptions(album, $event)" 
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
        <button @click="shufflePlay">
          <font-awesome-icon icon="random" />
          Shuffle Play
        </button>
        <button @click="addToQueue">
          <font-awesome-icon icon="plus" />
          Add to Queue
        </button>
        <button @click="viewAlbum">
          <font-awesome-icon icon="compact-disc" />
          View Album
        </button>
        <button @click="viewArtist">
          <font-awesome-icon icon="user" />
          View Artist
        </button>
        <button @click="startRadio">
          <font-awesome-icon icon="broadcast-tower" />
          Start Radio
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
.album-grid {
  width: 100%;
}

/* Grid Container */
.albums-container {
  display: grid;
  gap: var(--space-lg);
}

/* Layout variants */
.layout-grid .albums-container {
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.layout-compact .albums-container {
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-md);
}

.layout-list .albums-container {
  grid-template-columns: 1fr;
  gap: var(--space-sm);
}

/* Album Item */
.album-item {
  cursor: pointer;
  transition: transform var(--transition-base);
  position: relative;
}

.layout-grid .album-item:hover,
.layout-compact .album-item:hover {
  transform: translateY(-4px);
}

.layout-list .album-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
}

.layout-list .album-item:hover {
  background: var(--color-bg-tertiary);
}

/* Album Cover */
.album-cover-wrapper {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-bg-secondary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: box-shadow var(--transition-base);
}

.layout-grid .album-cover-wrapper,
.layout-compact .album-cover-wrapper {
  aspect-ratio: 1;
  margin-bottom: var(--space-md);
}

.layout-list .album-cover-wrapper {
  width: 80px;
  height: 80px;
  flex-shrink: 0;
}

.album-item:hover .album-cover-wrapper {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.album-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Overlay */
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

.album-item:hover .album-overlay {
  opacity: 1;
}

.play-btn {
  width: 48px;
  height: 48px;
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

.layout-list .play-btn {
  width: 36px;
  height: 36px;
  font-size: var(--text-md);
}

/* Badges */
.album-badge {
  position: absolute;
  top: var(--space-sm);
  left: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  color: white;
}

.album-badge.new {
  background: var(--color-success);
}

.album-badge.exclusive {
  background: var(--color-primary);
}

.album-badge.deluxe {
  background: var(--color-warning);
}

/* Type Indicator */
.album-type {
  position: absolute;
  bottom: var(--space-sm);
  right: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  backdrop-filter: blur(10px);
}

/* Album Info */
.album-info {
  padding: 0 var(--space-xs);
}

.layout-list .album-info {
  flex: 1;
  min-width: 0;
  padding: 0;
}

.album-title {
  font-size: var(--text-md);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album-artist {
  display: block;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: var(--space-xs);
}

.album-artist:hover {
  text-decoration: underline;
  color: var(--color-text-primary);
}

.album-meta {
  display: flex;
  gap: var(--space-md);
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-top: var(--space-xs);
}

.album-stats {
  display: flex;
  gap: var(--space-md);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-top: var(--space-xs);
}

.album-stats span {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

/* Compact layout adjustments */
.layout-compact .album-title {
  font-size: var(--text-sm);
}

.layout-compact .album-artist {
  font-size: var(--text-xs);
}

.layout-compact .album-meta,
.layout-compact .album-stats {
  display: none;
}

/* Actions */
.album-actions {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  display: flex;
  gap: var(--space-xs);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.album-item:hover .album-actions {
  opacity: 1;
}

.layout-list .album-actions {
  position: static;
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

.layout-grid .loading-grid {
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.layout-compact .loading-grid {
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}

.skeleton-album {
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
  height: 18px;
  width: 80%;
  border-radius: var(--radius-sm);
  margin-bottom: var(--space-xs);
}

.skeleton-artist {
  height: 14px;
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
  .album-actions {
    opacity: 1;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    border-radius: var(--radius-md);
    padding: var(--space-xs);
  }

  .layout-grid .albums-container {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }

  .layout-list .album-cover-wrapper {
    width: 60px;
    height: 60px;
  }
}
</style>