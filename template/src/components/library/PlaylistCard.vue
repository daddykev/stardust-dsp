<!-- template/src/components/library/PlaylistCard.vue -->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../../composables/useAuth'
import { usePlayer } from '../../composables/usePlayer'
import { useLibrary } from '../../composables/useLibrary'

const props = defineProps({
  playlist: {
    type: Object,
    required: true
  },
  showOwner: {
    type: Boolean,
    default: true
  },
  showActions: {
    type: Boolean,
    default: false
  },
  showUpdated: {
    type: Boolean,
    default: false
  },
  variant: {
    type: String,
    default: 'default', // 'default', 'compact', 'detailed'
    validator: (value) => ['default', 'compact', 'detailed'].includes(value)
  }
})

const emit = defineEmits([
  'play',
  'edit',
  'delete',
  'like',
  'share',
  'download'
])

const router = useRouter()
const auth = useAuth()
const player = usePlayer()
const library = useLibrary()

// State
const contextMenuVisible = ref(false)
const isLiked = ref(false)
const isDownloaded = ref(false)

// Computed
const canEdit = computed(() => {
  return props.playlist.userId === auth.user.value?.uid ||
         (props.playlist.collaborative && props.playlist.collaborators?.includes(auth.user.value?.uid))
})

const canDelete = computed(() => {
  return props.playlist.userId === auth.user.value?.uid
})

const isPlaying = computed(() => {
  return player.currentPlaylistId?.value === props.playlist.id && player.isPlaying.value
})

const coverTracks = computed(() => {
  // Get up to 4 tracks for mosaic
  const tracks = props.playlist.tracks?.slice(0, 4) || []
  // Fill with empty slots if less than 4
  while (tracks.length < 4) {
    tracks.push(null)
  }
  return tracks
})

// Methods
function openPlaylist() {
  router.push(`/playlists/${props.playlist.id}`)
}

async function playPlaylist() {
  if (isPlaying.value) {
    player.pause()
  } else {
    emit('play', props.playlist)
    
    // Load and play playlist tracks
    if (props.playlist.tracks?.length > 0) {
      player.clearQueue()
      props.playlist.tracks.forEach(track => player.addToQueue(track))
      player.playTrack(props.playlist.tracks[0])
      player.currentPlaylistId.value = props.playlist.id
    }
  }
}

function editPlaylist() {
  emit('edit', props.playlist)
  router.push(`/playlists/${props.playlist.id}/edit`)
}

async function deletePlaylist() {
  if (confirm(`Delete "${props.playlist.title}"? This action cannot be undone.`)) {
    emit('delete', props.playlist)
    await library.deletePlaylist(props.playlist.id)
  }
  contextMenuVisible.value = false
}

async function toggleLike() {
  isLiked.value = !isLiked.value
  emit('like', props.playlist, isLiked.value)
  
  if (isLiked.value) {
    await library.addFavorite(props.playlist.id, 'playlists')
  } else {
    await library.removeFavorite(props.playlist.id, 'playlists')
  }
}

async function toggleDownload() {
  isDownloaded.value = !isDownloaded.value
  emit('download', props.playlist, isDownloaded.value)
  
  // TODO: Implement offline download
  console.log('Download playlist:', props.playlist.title)
}

function sharePlaylist() {
  emit('share', props.playlist)
  const url = `${window.location.origin}/playlists/${props.playlist.id}`
  navigator.clipboard.writeText(url)
  console.log('Playlist link copied')
}

function showOptions() {
  contextMenuVisible.value = !contextMenuVisible.value
}

function playNext() {
  // Add playlist to queue after current track
  if (props.playlist.tracks?.length > 0) {
    const currentIndex = player.queueIndex.value
    props.playlist.tracks.forEach((track, index) => {
      player.queue.value.splice(currentIndex + index + 1, 0, track)
    })
  }
  contextMenuVisible.value = false
}

function addToQueue() {
  // Add playlist to end of queue
  if (props.playlist.tracks?.length > 0) {
    props.playlist.tracks.forEach(track => player.addToQueue(track))
  }
  contextMenuVisible.value = false
}

function copyLink() {
  const url = `${window.location.origin}/playlists/${props.playlist.id}`
  navigator.clipboard.writeText(url)
  console.log('Link copied')
  contextMenuVisible.value = false
}

async function makeCollaborative() {
  // TODO: Implement collaborative toggle
  console.log('Make collaborative')
  contextMenuVisible.value = false
}

async function changePrivacy() {
  // TODO: Implement privacy toggle
  console.log('Change privacy')
  contextMenuVisible.value = false
}

// Utility functions
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

function formatDuration(seconds) {
  if (!seconds) return '0 min'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours} hr ${minutes} min`
  }
  return `${minutes} min`
}

function formatRelativeTime(date) {
  if (!date) return ''
  
  const d = date.toDate ? date.toDate() : new Date(date)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000) // Difference in seconds
  
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`
  if (diff < 2592000) return `${Math.floor(diff / 604800)} weeks ago`
  if (diff < 31536000) return `${Math.floor(diff / 2592000)} months ago`
  return `${Math.floor(diff / 31536000)} years ago`
}

function handleImageError(e) {
  e.target.src = '/placeholder-album.png'
}

// Load initial state
onMounted(async () => {
  isLiked.value = await library.isFavorite(props.playlist.id, 'playlists')
  isDownloaded.value = props.playlist.downloaded || false
})

// Click outside to close context menu
onMounted(() => {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.playlist-card')) {
      contextMenuVisible.value = false
    }
  })
})
</script>

<template>
  <div class="playlist-card" @click="openPlaylist">
    <!-- Cover -->
    <div class="playlist-cover">
      <div v-if="playlist.coverUrl" class="cover-image">
        <img 
          :src="playlist.coverUrl" 
          :alt="playlist.title"
          @error="handleImageError"
        />
      </div>
      <div v-else class="cover-mosaic">
        <div 
          v-for="(track, index) in coverTracks" 
          :key="index"
          class="mosaic-tile"
        >
          <img 
            v-if="track?.artworkUrl"
            :src="track.artworkUrl" 
            :alt="track.title"
            @error="handleImageError"
          />
          <div v-else class="mosaic-placeholder">
            <font-awesome-icon icon="music" />
          </div>
        </div>
      </div>

      <!-- Overlay -->
      <div class="playlist-overlay">
        <button 
          @click.stop="playPlaylist" 
          class="play-btn"
          :title="isPlaying ? 'Pause' : 'Play'"
        >
          <font-awesome-icon :icon="isPlaying ? 'pause' : 'play'" />
        </button>
      </div>

      <!-- Badges -->
      <div class="playlist-badges">
        <span v-if="playlist.collaborative" class="badge collaborative">
          <font-awesome-icon icon="users" />
        </span>
        <span v-if="playlist.public" class="badge public">
          <font-awesome-icon icon="globe" />
        </span>
        <span v-if="playlist.downloaded" class="badge downloaded">
          <font-awesome-icon icon="download" />
        </span>
      </div>

      <!-- Track Count -->
      <div v-if="playlist.trackCount" class="track-count">
        {{ playlist.trackCount }} songs
      </div>
    </div>

    <!-- Info -->
    <div class="playlist-info">
      <h4 class="playlist-title">{{ playlist.title || 'Untitled Playlist' }}</h4>
      
      <p v-if="playlist.description" class="playlist-description">
        {{ playlist.description }}
      </p>
      
      <div class="playlist-meta">
        <span v-if="showOwner && playlist.owner" class="playlist-owner">
          By {{ playlist.owner.displayName || 'Unknown' }}
        </span>
        
        <span v-if="playlist.followers" class="playlist-followers">
          <font-awesome-icon icon="heart" />
          {{ formatNumber(playlist.followers) }}
        </span>

        <span v-if="playlist.duration" class="playlist-duration">
          {{ formatDuration(playlist.duration) }}
        </span>
      </div>

      <div v-if="showUpdated && playlist.updatedAt" class="playlist-updated">
        Updated {{ formatRelativeTime(playlist.updatedAt) }}
      </div>
    </div>

    <!-- Actions -->
    <div v-if="showActions" class="playlist-actions">
      <button 
        v-if="canEdit"
        @click.stop="editPlaylist" 
        class="action-btn"
        title="Edit playlist"
      >
        <font-awesome-icon icon="edit" />
      </button>
      
      <button 
        @click.stop="toggleLike" 
        class="action-btn"
        :class="{ liked: isLiked }"
        :title="isLiked ? 'Unlike' : 'Like'"
      >
        <font-awesome-icon :icon="isLiked ? 'heart' : ['far', 'heart']" />
      </button>
      
      <button 
        @click.stop="toggleDownload" 
        class="action-btn"
        :class="{ downloaded: playlist.downloaded }"
        title="Download for offline"
      >
        <font-awesome-icon icon="download" />
      </button>
      
      <button 
        @click.stop="sharePlaylist" 
        class="action-btn"
        title="Share playlist"
      >
        <font-awesome-icon icon="share" />
      </button>
      
      <button 
        @click.stop="showOptions" 
        class="action-btn"
        title="More options"
      >
        <font-awesome-icon icon="ellipsis-h" />
      </button>
    </div>

    <!-- Context Menu -->
    <transition name="fade">
      <div 
        v-if="contextMenuVisible" 
        class="context-menu"
        @click.stop
      >
        <button @click="playNext">
          <font-awesome-icon icon="play" />
          Play Next
        </button>
        <button @click="addToQueue">
          <font-awesome-icon icon="plus" />
          Add to Queue
        </button>
        <button @click="copyLink">
          <font-awesome-icon icon="link" />
          Copy Link
        </button>
        <button v-if="canEdit" @click="makeCollaborative">
          <font-awesome-icon icon="users" />
          Make Collaborative
        </button>
        <button v-if="canEdit" @click="changePrivacy">
          <font-awesome-icon :icon="playlist.public ? 'lock' : 'globe'" />
          Make {{ playlist.public ? 'Private' : 'Public' }}
        </button>
        <button v-if="canDelete" @click="deletePlaylist" class="danger">
          <font-awesome-icon icon="trash" />
          Delete Playlist
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.playlist-card {
  position: relative;
  cursor: pointer;
  transition: transform var(--transition-base);
}

.playlist-card:hover {
  transform: translateY(-4px);
}

/* Cover */
.playlist-cover {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: var(--space-md);
  background: var(--color-bg-secondary);
}

.cover-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Mosaic layout for playlists without custom covers */
.cover-mosaic {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  width: 100%;
  height: 100%;
}

.mosaic-tile {
  position: relative;
  overflow: hidden;
  background: var(--color-bg-tertiary);
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
  font-size: 1.5rem;
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

.playlist-card:hover .playlist-overlay {
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
  background: var(--color-primary);
}

.badge.public {
  background: var(--color-success);
}

.badge.downloaded {
  background: var(--color-info);
}

/* Track count */
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

/* Info */
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
  -webkit-box-orient: vertical;
}

.playlist-meta {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.playlist-owner {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playlist-followers {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.playlist-updated {
  margin-top: var(--space-xs);
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

/* Actions */
.playlist-actions {
  display: flex;
  gap: var(--space-xs);
  margin-top: var(--space-sm);
  padding: 0 var(--space-xs);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.playlist-card:hover .playlist-actions {
  opacity: 1;
}

.action-btn {
  padding: var(--space-xs);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-base);
  font-size: var(--text-sm);
}

.action-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.action-btn.liked {
  color: var(--color-primary);
  background: var(--color-primary-light);
  border-color: var(--color-primary);
}

.action-btn.downloaded {
  color: var(--color-success);
  background: var(--color-success-light);
  border-color: var(--color-success);
}

/* Context Menu */
.context-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: var(--space-xs);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 100;
  min-width: 200px;
  overflow: hidden;
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
  font-size: var(--text-sm);
}

.context-menu button:hover {
  background: var(--color-bg-secondary);
}

.context-menu button.danger {
  color: var(--color-error);
}

/* Variants */
.playlist-card.compact .playlist-cover {
  margin-bottom: var(--space-sm);
}

.playlist-card.compact .playlist-info {
  padding: 0;
}

.playlist-card.compact .playlist-title {
  font-size: var(--text-sm);
}

.playlist-card.compact .playlist-description,
.playlist-card.compact .playlist-updated,
.playlist-card.compact .playlist-actions {
  display: none;
}

.playlist-card.detailed .playlist-cover {
  margin-bottom: var(--space-lg);
}

.playlist-card.detailed .playlist-title {
  font-size: var(--text-lg);
  margin-bottom: var(--space-md);
}

.playlist-card.detailed .playlist-actions {
  opacity: 1;
  margin-top: var(--space-md);
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
  }
  
  .playlist-meta {
    flex-wrap: wrap;
  }
}
</style>