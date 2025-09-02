<!-- template/src/components/browse/TrackList.vue -->
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayer } from '../../composables/usePlayer'
import { useLibrary } from '../../composables/useLibrary'

const props = defineProps({
  tracks: {
    type: Array,
    required: true
  },
  variant: {
    type: String,
    default: 'default', // 'default', 'compact', 'simple', 'detailed'
    validator: (value) => ['default', 'compact', 'simple', 'detailed'].includes(value)
  },
  showHeader: {
    type: Boolean,
    default: true
  },
  showArtwork: {
    type: Boolean,
    default: true
  },
  showAlbum: {
    type: Boolean,
    default: false
  },
  showDateAdded: {
    type: Boolean,
    default: false
  },
  showStats: {
    type: Boolean,
    default: false
  },
  showActions: {
    type: Boolean,
    default: true
  },
  showLikeButton: {
    type: Boolean,
    default: true
  },
  showAddButton: {
    type: Boolean,
    default: false
  },
  numbered: {
    type: Boolean,
    default: false
  },
  compact: {
    type: Boolean,
    default: false
  },
  canRemove: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  },
  emptyMessage: {
    type: String,
    default: 'Try adjusting your search or filters'
  }
})

const emit = defineEmits([
  'play',
  'like',
  'unlike',
  'add-to-playlist',
  'remove',
  'select'
])

const router = useRouter()
const player = usePlayer()
const library = useLibrary()

// State
const selectedTracks = ref([])
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  track: null
})
const trackMenu = ref({
  show: false,
  track: null
})

// Computed
const isPlaying = computed(() => player.isPlaying.value)

// Methods
function isCurrentTrack(track) {
  return player.currentTrack.value?.id === track.id
}

function selectTrack(track, event) {
  if (event.shiftKey && selectedTracks.value.length > 0) {
    // Multi-select with shift
    const lastSelected = selectedTracks.value[selectedTracks.value.length - 1]
    const lastIndex = props.tracks.findIndex(t => t.id === lastSelected)
    const currentIndex = props.tracks.findIndex(t => t.id === track.id)
    
    const start = Math.min(lastIndex, currentIndex)
    const end = Math.max(lastIndex, currentIndex)
    
    for (let i = start; i <= end; i++) {
      if (!selectedTracks.value.includes(props.tracks[i].id)) {
        selectedTracks.value.push(props.tracks[i].id)
      }
    }
  } else if (event.ctrlKey || event.metaKey) {
    // Multi-select with ctrl/cmd
    const index = selectedTracks.value.indexOf(track.id)
    if (index > -1) {
      selectedTracks.value.splice(index, 1)
    } else {
      selectedTracks.value.push(track.id)
    }
  } else {
    // Single select
    selectedTracks.value = [track.id]
  }
  
  emit('select', selectedTracks.value)
}

function playTrack(track) {
  if (track.disabled) return
  
  emit('play', track)
  player.playTrack(track)
}

async function toggleLike(track) {
  track.isLiked = !track.isLiked
  
  if (track.isLiked) {
    emit('like', track)
    await library.addFavorite(track.id, 'tracks')
  } else {
    emit('unlike', track)
    await library.removeFavorite(track.id, 'tracks')
  }
}

function addToPlaylist(track) {
  emit('add-to-playlist', track)
  // TODO: Show playlist selector modal
  console.log('Add to playlist:', track.title)
}

function showTrackMenu(track, event) {
  trackMenu.value = {
    show: true,
    track
  }
}

function showContextMenu(track, event) {
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    track
  }
}

// Context menu actions
function playTrackNow() {
  if (contextMenu.value.track) {
    playTrack(contextMenu.value.track)
  }
  contextMenu.value.show = false
}

function playNext() {
  if (contextMenu.value.track) {
    const currentIndex = player.queueIndex.value
    player.queue.value.splice(currentIndex + 1, 0, contextMenu.value.track)
  }
  contextMenu.value.show = false
}

function addToQueue() {
  if (contextMenu.value.track) {
    player.addToQueue(contextMenu.value.track)
  }
  contextMenu.value.show = false
}

function goToArtist() {
  if (contextMenu.value.track?.artistId) {
    router.push(`/artists/${contextMenu.value.track.artistId}`)
  }
  contextMenu.value.show = false
}

function goToAlbum() {
  if (contextMenu.value.track?.albumId) {
    router.push(`/releases/${contextMenu.value.track.albumId}`)
  }
  contextMenu.value.show = false
}

function showCredits() {
  // TODO: Show credits modal
  console.log('Show credits for:', contextMenu.value.track?.title)
  contextMenu.value.show = false
}

function addToPlaylistMenu() {
  addToPlaylist(contextMenu.value.track)
  contextMenu.value.show = false
}

function toggleLikeContext() {
  if (contextMenu.value.track) {
    toggleLike(contextMenu.value.track)
  }
  contextMenu.value.show = false
}

function shareTrack() {
  if (contextMenu.value.track) {
    const url = `${window.location.origin}/tracks/${contextMenu.value.track.id}`
    navigator.share?.({
      title: contextMenu.value.track.title,
      text: `Listen to ${contextMenu.value.track.title} by ${contextMenu.value.track.artist}`,
      url
    }) || navigator.clipboard.writeText(url)
  }
  contextMenu.value.show = false
}

function copyLink() {
  if (contextMenu.value.track) {
    const url = `${window.location.origin}/tracks/${contextMenu.value.track.id}`
    navigator.clipboard.writeText(url)
    console.log('Link copied')
  }
  contextMenu.value.show = false
}

function removeFromList() {
  if (contextMenu.value.track) {
    emit('remove', contextMenu.value.track)
  }
  contextMenu.value.show = false
}

// Track menu actions
function playFromMenu() {
  if (trackMenu.value.track) {
    playTrack(trackMenu.value.track)
  }
  trackMenu.value.show = false
}

function startRadioFromMenu() {
  if (trackMenu.value.track) {
    router.push(`/radio/track/${trackMenu.value.track.id}`)
  }
  trackMenu.value.show = false
}

function addToQueueFromMenu() {
  if (trackMenu.value.track) {
    player.addToQueue(trackMenu.value.track)
  }
  trackMenu.value.show = false
}

function addToPlaylistFromMenu() {
  if (trackMenu.value.track) {
    addToPlaylist(trackMenu.value.track)
  }
  trackMenu.value.show = false
}

// Utility functions
function formatDuration(seconds) {
  if (!seconds) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatDate(date) {
  if (!date) return '—'
  const d = date.toDate ? date.toDate() : new Date(date)
  const now = new Date()
  const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24))
  
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff} days ago`
  if (diff < 30) return `${Math.floor(diff / 7)} weeks ago`
  
  return d.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  })
}

function formatNumber(num) {
  if (!num) return '0'
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

function handleImageError(e) {
  e.target.src = '/placeholder-album.png'
}

// Click outside handlers
onMounted(() => {
  document.addEventListener('click', handleGlobalClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick)
})

function handleGlobalClick(e) {
  if (!e.target.closest('.context-menu') && !e.target.closest('.track-item')) {
    contextMenu.value.show = false
  }
}
</script>

<template>
  <div class="track-list" :class="[`variant-${variant}`, { compact, numbered }]">
    <!-- Header (optional) -->
    <div v-if="showHeader" class="track-list-header">
      <div class="header-number">#</div>
      <div class="header-title">Title</div>
      <div v-if="showAlbum" class="header-album">Album</div>
      <div v-if="showDateAdded" class="header-date">Date Added</div>
      <div v-if="showStats" class="header-stats">
        <font-awesome-icon icon="chart-line" />
      </div>
      <div class="header-duration">
        <font-awesome-icon icon="clock" />
      </div>
      <div v-if="showActions" class="header-actions"></div>
    </div>

    <!-- Tracks -->
    <div class="tracks-container">
      <div 
        v-for="(track, index) in tracks" 
        :key="track.id"
        class="track-item"
        :class="{ 
          playing: isCurrentTrack(track),
          selected: selectedTracks.includes(track.id),
          disabled: track.disabled
        }"
        @click="selectTrack(track, $event)"
        @dblclick="playTrack(track)"
        @contextmenu.prevent="showContextMenu(track, $event)"
      >
        <!-- Track Number / Play State -->
        <div class="track-number">
          <span v-if="!isCurrentTrack(track)" class="number">
            {{ numbered ? index + 1 : '' }}
          </span>
          <font-awesome-icon 
            v-else 
            :icon="isPlaying ? 'volume-up' : 'pause'"
            class="playing-icon"
          />
          <button 
            v-if="!numbered"
            @click.stop="playTrack(track)" 
            class="play-hover-btn"
          >
            <font-awesome-icon :icon="isCurrentTrack(track) && isPlaying ? 'pause' : 'play'" />
          </button>
        </div>

        <!-- Track Info -->
        <div class="track-title">
          <img 
            v-if="showArtwork"
            :src="track.artworkUrl || '/placeholder-album.png'" 
            :alt="track.title"
            class="track-artwork"
            @error="handleImageError"
          />
          <div class="track-info">
            <div class="track-name" :class="{ explicit: track.explicit }">
              {{ track.title }}
              <span v-if="track.explicit" class="explicit-badge">E</span>
              <span v-if="track.featured" class="featured-label">
                feat. {{ track.featured }}
              </span>
            </div>
            <div class="track-artist">
              <router-link 
                v-if="track.artistId"
                :to="`/artists/${track.artistId}`"
                class="artist-link"
                @click.stop
              >
                {{ track.artist }}
              </router-link>
              <span v-else>{{ track.artist }}</span>
            </div>
          </div>
        </div>

        <!-- Album -->
        <div v-if="showAlbum" class="track-album">
          <router-link 
            v-if="track.albumId"
            :to="`/releases/${track.albumId}`"
            class="album-link"
            @click.stop
          >
            {{ track.albumTitle }}
          </router-link>
          <span v-else>{{ track.albumTitle || '—' }}</span>
        </div>

        <!-- Date Added -->
        <div v-if="showDateAdded" class="track-date">
          {{ formatDate(track.addedAt) }}
        </div>

        <!-- Stats -->
        <div v-if="showStats" class="track-stats">
          <div v-if="track.playCount" class="play-count">
            <font-awesome-icon icon="play" />
            {{ formatNumber(track.playCount) }}
          </div>
          <div v-if="track.popularity" class="popularity">
            <div class="popularity-bar">
              <div 
                class="popularity-fill" 
                :style="{ width: track.popularity + '%' }"
              ></div>
            </div>
          </div>
        </div>

        <!-- Duration -->
        <div class="track-duration">
          {{ formatDuration(track.duration) }}
        </div>

        <!-- Actions -->
        <div v-if="showActions" class="track-actions">
          <button 
            v-if="showLikeButton"
            @click.stop="toggleLike(track)" 
            class="action-btn like-btn"
            :class="{ liked: track.isLiked }"
            :title="track.isLiked ? 'Remove from Liked Songs' : 'Add to Liked Songs'"
          >
            <font-awesome-icon :icon="track.isLiked ? 'heart' : ['far', 'heart']" />
          </button>
          
          <button 
            v-if="showAddButton"
            @click.stop="addToPlaylist(track)" 
            class="action-btn"
            title="Add to playlist"
          >
            <font-awesome-icon icon="plus" />
          </button>
          
          <button 
            @click.stop="showTrackMenu(track, $event)" 
            class="action-btn"
            title="More options"
          >
            <font-awesome-icon icon="ellipsis-h" />
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="loading-tracks">
        <div v-for="i in 5" :key="i" class="skeleton-track">
          <div class="skeleton skeleton-number"></div>
          <div class="skeleton skeleton-artwork"></div>
          <div class="skeleton-info">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-artist"></div>
          </div>
          <div class="skeleton skeleton-duration"></div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="!loading && tracks.length === 0" class="empty-tracks">
        <font-awesome-icon icon="music" />
        <h3>No tracks found</h3>
        <p>{{ emptyMessage }}</p>
      </div>
    </div>

    <!-- Context Menu -->
    <transition name="fade">
      <div 
        v-if="contextMenu.show" 
        class="context-menu"
        :style="{ 
          top: contextMenu.y + 'px', 
          left: contextMenu.x + 'px' 
        }"
      >
        <button @click="playTrackNow">
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
        <hr />
        <button @click="goToArtist">
          <font-awesome-icon icon="user" />
          Go to Artist
        </button>
        <button @click="goToAlbum">
          <font-awesome-icon icon="compact-disc" />
          Go to Album
        </button>
        <button @click="showCredits">
          <font-awesome-icon icon="info-circle" />
          Show Credits
        </button>
        <hr />
        <button @click="addToPlaylistMenu">
          <font-awesome-icon icon="list" />
          Add to Playlist
        </button>
        <button @click="toggleLikeContext">
          <font-awesome-icon :icon="contextMenu.track?.isLiked ? 'heart-broken' : 'heart'" />
          {{ contextMenu.track?.isLiked ? 'Remove from Liked Songs' : 'Add to Liked Songs' }}
        </button>
        <hr />
        <button @click="shareTrack">
          <font-awesome-icon icon="share" />
          Share
        </button>
        <button @click="copyLink">
          <font-awesome-icon icon="link" />
          Copy Song Link
        </button>
        <button v-if="canRemove" @click="removeFromList" class="danger">
          <font-awesome-icon icon="times" />
          Remove from Playlist
        </button>
      </div>
    </transition>

    <!-- Track Menu Modal -->
    <transition name="modal">
      <div 
        v-if="trackMenu.show" 
        class="track-menu-modal"
        @click="trackMenu.show = false"
      >
        <div class="track-menu-content" @click.stop>
          <div class="track-menu-header">
            <img 
              :src="trackMenu.track?.artworkUrl || '/placeholder-album.png'" 
              :alt="trackMenu.track?.title"
              class="menu-artwork"
            />
            <div class="menu-info">
              <h3>{{ trackMenu.track?.title }}</h3>
              <p>{{ trackMenu.track?.artist }}</p>
            </div>
            <button @click="trackMenu.show = false" class="close-btn">
              <font-awesome-icon icon="times" />
            </button>
          </div>
          
          <div class="track-menu-actions">
            <button @click="playFromMenu" class="menu-action">
              <font-awesome-icon icon="play-circle" />
              <span>Play Now</span>
            </button>
            <button @click="startRadioFromMenu" class="menu-action">
              <font-awesome-icon icon="broadcast-tower" />
              <span>Start Radio</span>
            </button>
            <button @click="addToQueueFromMenu" class="menu-action">
              <font-awesome-icon icon="plus-circle" />
              <span>Add to Queue</span>
            </button>
            <button @click="addToPlaylistFromMenu" class="menu-action">
              <font-awesome-icon icon="list" />
              <span>Add to Playlist</span>
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.track-list {
  width: 100%;
}

/* Header */
.track-list-header {
  display: grid;
  grid-template-columns: 50px 4fr 2fr 1.5fr 100px 120px;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--text-xs);
  text-transform: uppercase;
  color: var(--color-text-tertiary);
  letter-spacing: 0.1em;
  position: sticky;
  top: 0;
  background: var(--color-surface);
  z-index: 10;
}

.variant-compact .track-list-header,
.variant-simple .track-list-header {
  display: none;
}

.header-stats {
  text-align: center;
}

/* Tracks Container */
.tracks-container {
  position: relative;
}

/* Track Item */
.track-item {
  display: grid;
  grid-template-columns: 50px 4fr 2fr 1.5fr 100px 120px;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  transition: all var(--transition-base);
  cursor: pointer;
  align-items: center;
}

.track-item:hover {
  background: var(--color-bg-secondary);
}

.track-item.playing {
  background: var(--color-primary-light);
}

.track-item.selected {
  background: var(--color-bg-tertiary);
}

.track-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Compact variant */
.variant-compact .track-item {
  grid-template-columns: 50px 1fr 60px;
  padding: var(--space-xs) var(--space-sm);
}

.variant-compact .track-album,
.variant-compact .track-date,
.variant-compact .track-stats {
  display: none;
}

/* Simple variant */
.variant-simple .track-item {
  grid-template-columns: 40px 1fr 50px;
  padding: var(--space-xs);
}

.variant-simple .track-album,
.variant-simple .track-date,
.variant-simple .track-stats,
.variant-simple .track-actions {
  display: none;
}

/* Track Number */
.track-number {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  position: relative;
}

.number {
  font-size: var(--text-sm);
}

.playing-icon {
  color: var(--color-primary);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.play-hover-btn {
  position: absolute;
  background: none;
  border: none;
  color: var(--color-text-primary);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--transition-base);
}

.track-item:hover .number {
  opacity: 0;
}

.track-item:hover .play-hover-btn {
  opacity: 1;
}

/* Track Title */
.track-title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
}

.track-artwork {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  object-fit: cover;
  flex-shrink: 0;
}

.track-info {
  min-width: 0;
  flex: 1;
}

.track-name {
  font-weight: var(--font-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 2px;
}

.explicit-badge {
  display: inline-block;
  padding: 1px 4px;
  background: var(--color-text-tertiary);
  color: var(--color-surface);
  border-radius: var(--radius-xs);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  margin-left: var(--space-xs);
  vertical-align: middle;
}

.featured-label {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.track-artist {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artist-link {
  color: inherit;
  text-decoration: none;
}

.artist-link:hover {
  text-decoration: underline;
}

/* Track Album */
.track-album {
  overflow: hidden;
}

.album-link {
  color: var(--color-text-secondary);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

.album-link:hover {
  text-decoration: underline;
  color: var(--color-text-primary);
}

/* Track Date */
.track-date {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

/* Track Stats */
.track-stats {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
}

.play-count {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.popularity-bar {
  width: 60px;
  height: 4px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.popularity-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-full);
}

/* Track Duration */
.track-duration {
  text-align: center;
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

/* Track Actions */
.track-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-xs);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.track-item:hover .track-actions {
  opacity: 1;
}

.action-btn {
  padding: var(--space-xs);
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-base);
  border-radius: var(--radius-sm);
}

.action-btn:hover {
  color: var(--color-text-primary);
  background: var(--color-bg-tertiary);
}

.like-btn.liked {
  color: var(--color-primary);
}

/* Loading State */
.loading-tracks {
  padding: var(--space-md);
}

.skeleton-track {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) 0;
}

.skeleton {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-sm);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.skeleton-number {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
}

.skeleton-artwork {
  width: 40px;
  height: 40px;
}

.skeleton-info {
  flex: 1;
}

.skeleton-title {
  width: 200px;
  height: 16px;
  margin-bottom: var(--space-xs);
}

.skeleton-artist {
  width: 120px;
  height: 14px;
}

.skeleton-duration {
  width: 40px;
  height: 14px;
}

/* Empty State */
.empty-tracks {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-text-secondary);
}

.empty-tracks svg {
  font-size: 3rem;
  margin-bottom: var(--space-lg);
  opacity: 0.5;
}

.empty-tracks h3 {
  margin-bottom: var(--space-sm);
}

/* Context Menu */
.context-menu {
  position: fixed;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 1000;
  min-width: 220px;
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
  font-size: var(--text-sm);
}

.context-menu button:hover {
  background: var(--color-bg-secondary);
}

.context-menu button.danger {
  color: var(--color-error);
}

.context-menu hr {
  margin: var(--space-xs) 0;
  border: none;
  border-top: 1px solid var(--color-border);
}

/* Track Menu Modal */
.track-menu-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.track-menu-content {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  width: 400px;
  max-width: 90vw;
  padding: var(--space-lg);
}

.track-menu-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.menu-artwork {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-md);
  object-fit: cover;
}

.menu-info {
  flex: 1;
}

.menu-info h3 {
  font-size: var(--text-lg);
  margin-bottom: var(--space-xs);
}

.menu-info p {
  color: var(--color-text-secondary);
}

.close-btn {
  padding: var(--space-sm);
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: color var(--transition-base);
}

.close-btn:hover {
  color: var(--color-text-primary);
}

.track-menu-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-md);
}

.menu-action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: var(--color-bg-secondary);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
}

.menu-action:hover {
  background: var(--color-bg-tertiary);
  transform: translateY(-2px);
}

.menu-action svg {
  font-size: var(--text-xl);
  color: var(--color-primary);
}

.menu-action span {
  font-size: var(--text-sm);
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

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .track-menu-content,
.modal-leave-active .track-menu-content {
  transition: transform 0.3s ease;
}

.modal-enter-from .track-menu-content {
  transform: scale(0.9);
}

.modal-leave-to .track-menu-content {
  transform: scale(0.9);
}

/* Responsive */
@media (max-width: 768px) {
  .track-list-header {
    grid-template-columns: 40px 1fr 50px;
  }
  
  .track-item {
    grid-template-columns: 40px 1fr 50px;
  }
  
  .header-album,
  .header-date,
  .header-stats,
  .track-album,
  .track-date,
  .track-stats {
    display: none;
  }
  
  .track-actions {
    opacity: 1;
  }
  
  .track-artwork {
    width: 32px;
    height: 32px;
  }
}
</style>