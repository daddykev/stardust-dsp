<!-- template/src/components/profile/RecentlyPlayedList.vue -->
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayer } from '../../composables/usePlayer'
import { useLibrary } from '../../composables/useLibrary'

const props = defineProps({
  items: {
    type: Array,
    required: true
  },
  showViewToggle: {
    type: Boolean,
    default: true
  },
  defaultView: {
    type: String,
    default: 'list',
    validator: (value) => ['list', 'grid', 'timeline'].includes(value)
  }
})

const emit = defineEmits(['item-removed'])

const router = useRouter()
const player = usePlayer()
const library = useLibrary()

// State
const viewMode = ref(props.defaultView)
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  item: null
})

// Computed
const groupedByDate = computed(() => {
  const groups = {}
  
  props.items.forEach(item => {
    const date = new Date(item.playedAt)
    const dateKey = date.toDateString()
    
    if (!groups[dateKey]) {
      groups[dateKey] = []
    }
    
    groups[dateKey].push(item)
  })
  
  // Sort groups by date (newest first)
  const sortedGroups = {}
  Object.keys(groups)
    .sort((a, b) => new Date(b) - new Date(a))
    .forEach(key => {
      sortedGroups[key] = groups[key]
    })
  
  return sortedGroups
})

// Methods
function openItem(item) {
  const routes = {
    track: `/tracks/${item.id}`,
    album: `/releases/${item.id}`,
    playlist: `/playlists/${item.id}`,
    artist: `/artists/${item.id}`,
    episode: `/episodes/${item.id}`
  }
  
  const route = routes[item.type]
  if (route) {
    router.push(route)
  }
}

function playItem(item) {
  if (item.type === 'track') {
    player.playTrack(item)
  } else if (item.type === 'album' || item.type === 'playlist') {
    // Load and play all tracks
    console.log('Play', item.type, item.id)
  } else if (item.type === 'episode') {
    // Play podcast episode
    console.log('Play episode', item.id)
  }
}

function isPlaying(item) {
  if (item.type === 'track') {
    return player.currentTrack.value?.id === item.id && player.isPlaying.value
  }
  // TODO: Check for album/playlist playing state
  return false
}

async function toggleLike(item) {
  item.isLiked = !item.isLiked
  
  const typeMap = {
    track: 'tracks',
    album: 'albums',
    playlist: 'playlists',
    artist: 'artists'
  }
  
  const collectionType = typeMap[item.type]
  if (!collectionType) return
  
  if (item.isLiked) {
    await library.addFavorite(item.id, collectionType)
  } else {
    await library.removeFavorite(item.id, collectionType)
  }
}

function addToQueue(item) {
  if (item.type === 'track') {
    player.addToQueue(item)
    console.log('Added to queue:', item.title)
  }
}

function showOptions(item, event) {
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    item
  }
}

function playNext(item) {
  if (item.type === 'track') {
    const currentIndex = player.queueIndex.value
    player.queue.value.splice(currentIndex + 1, 0, item)
  }
  contextMenu.value.show = false
}

function addToPlaylist(item) {
  // TODO: Show playlist selector
  console.log('Add to playlist:', item)
  contextMenu.value.show = false
}

function goToArtist(item) {
  if (item.artistId) {
    router.push(`/artists/${item.artistId}`)
  }
  contextMenu.value.show = false
}

function goToAlbum(item) {
  if (item.albumId) {
    router.push(`/releases/${item.albumId}`)
  }
  contextMenu.value.show = false
}

function shareItem(item) {
  const routes = {
    track: `/tracks/${item.id}`,
    album: `/releases/${item.id}`,
    playlist: `/playlists/${item.id}`,
    artist: `/artists/${item.id}`
  }
  
  const path = routes[item.type]
  if (path) {
    const url = `${window.location.origin}${path}`
    navigator.clipboard.writeText(url)
    console.log('Link copied')
  }
  
  contextMenu.value.show = false
}

async function removeFromHistory(item) {
  // TODO: Implement remove from history
  console.log('Remove from history:', item)
  emit('item-removed', item)
  contextMenu.value.show = false
}

// Utility functions
function getPlaceholder(type) {
  const placeholders = {
    track: '/placeholder-track.png',
    album: '/placeholder-album.png',
    playlist: '/placeholder-playlist.png',
    artist: '/placeholder-artist.png',
    episode: '/placeholder-podcast.png'
  }
  return placeholders[type] || '/placeholder.png'
}

function handleImageError(event, type) {
  event.target.src = getPlaceholder(type)
}

function getTypeIcon(type) {
  const icons = {
    track: 'music',
    album: 'compact-disc',
    playlist: 'list',
    artist: 'user',
    episode: 'podcast'
  }
  return icons[type] || 'play'
}

function formatType(type) {
  const types = {
    track: 'Song',
    album: 'Album',
    playlist: 'Playlist',
    artist: 'Artist',
    episode: 'Episode'
  }
  return types[type] || type
}

function getContextIcon(context) {
  const icons = {
    playlist: 'list',
    album: 'compact-disc',
    radio: 'broadcast-tower',
    search: 'search',
    library: 'heart',
    recommendation: 'magic'
  }
  return icons[context] || 'play'
}

function formatContext(context) {
  if (!context) return ''
  
  if (context.type === 'playlist') {
    return `From ${context.name}`
  } else if (context.type === 'album') {
    return `From album`
  } else if (context.type === 'radio') {
    return `From radio`
  } else if (context.type === 'search') {
    return `From search`
  }
  
  return context.name || context.type
}

function formatTime(date) {
  if (!date) return ''
  
  const d = date.toDate ? date.toDate() : new Date(date)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  
  return d.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })
}

function formatTimeOnly(date) {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })
}

function formatRelativeTime(date) {
  if (!date) return ''
  
  const d = date.toDate ? date.toDate() : new Date(date)
  const now = new Date()
  const diff = Math.floor((now - d) / 1000)
  
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  
  return d.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  })
}

function formatDate(dateString) {
  const date = new Date(dateString)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today'
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  } else {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'short', 
      day: 'numeric' 
    })
  }
}

function formatDuration(seconds) {
  if (!seconds) return ''
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Click outside to close context menu
onMounted(() => {
  document.addEventListener('click', closeContextMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeContextMenu)
})

function closeContextMenu(e) {
  if (!e.target.closest('.context-menu')) {
    contextMenu.value.show = false
  }
}
</script>

<template>
  <div class="recently-played-list">
    <!-- Empty State -->
    <div v-if="!items || items.length === 0" class="empty-state">
      <font-awesome-icon icon="clock" />
      <h3>No recent activity</h3>
      <p>Your recently played tracks, albums, and playlists will appear here</p>
    </div>

    <!-- List View -->
    <div v-else-if="viewMode === 'list'" class="list-view">
      <div 
        v-for="(item, index) in items" 
        :key="`${item.type}-${item.id}-${index}`"
        class="played-item"
        @click="openItem(item)"
      >
        <!-- Artwork -->
        <div class="item-artwork">
          <img 
            :src="item.artworkUrl || getPlaceholder(item.type)" 
            :alt="item.title || item.name"
            @error="handleImageError($event, item.type)"
          />
          <div class="item-overlay">
            <button @click.stop="playItem(item)" class="play-btn">
              <font-awesome-icon :icon="isPlaying(item) ? 'pause' : 'play'" />
            </button>
          </div>
          <div class="item-type-badge">
            <font-awesome-icon :icon="getTypeIcon(item.type)" />
          </div>
        </div>

        <!-- Info -->
        <div class="item-info">
          <h4 class="item-title">{{ item.title || item.name }}</h4>
          <p class="item-subtitle">
            <span class="item-type">{{ formatType(item.type) }}</span>
            <span class="separator">•</span>
            <span class="item-artist">{{ item.artist || item.owner || 'Unknown' }}</span>
          </p>
          <p class="item-context" v-if="item.context">
            <font-awesome-icon :icon="getContextIcon(item.context)" />
            {{ formatContext(item.context) }}
          </p>
        </div>

        <!-- Metadata -->
        <div class="item-metadata">
          <div class="play-time">
            <font-awesome-icon icon="clock" />
            {{ formatTime(item.playedAt) }}
          </div>
          <div v-if="item.duration" class="duration">
            {{ formatDuration(item.duration) }}
          </div>
          <div v-if="item.playCount > 1" class="play-count">
            <font-awesome-icon icon="redo" />
            {{ item.playCount }}x
          </div>
        </div>

        <!-- Actions -->
        <div class="item-actions">
          <button 
            @click.stop="toggleLike(item)" 
            class="action-btn"
            :class="{ liked: item.isLiked }"
          >
            <font-awesome-icon :icon="item.isLiked ? 'heart' : ['far', 'heart']" />
          </button>
          <button @click.stop="addToQueue(item)" class="action-btn">
            <font-awesome-icon icon="plus" />
          </button>
          <button @click.stop="showOptions(item, $event)" class="action-btn">
            <font-awesome-icon icon="ellipsis-h" />
          </button>
        </div>
      </div>
    </div>

    <!-- Grid View -->
    <div v-else-if="viewMode === 'grid'" class="grid-view">
      <div 
        v-for="(item, index) in items" 
        :key="`${item.type}-${item.id}-${index}`"
        class="grid-item card"
        @click="openItem(item)"
      >
        <div class="grid-item-cover">
          <img 
            :src="item.artworkUrl || getPlaceholder(item.type)" 
            :alt="item.title || item.name"
            @error="handleImageError($event, item.type)"
          />
          <div class="grid-overlay">
            <button @click.stop="playItem(item)" class="play-btn">
              <font-awesome-icon :icon="isPlaying(item) ? 'pause' : 'play'" />
            </button>
          </div>
          <div class="type-indicator">
            <font-awesome-icon :icon="getTypeIcon(item.type)" />
          </div>
        </div>
        <div class="grid-item-info">
          <h4>{{ item.title || item.name }}</h4>
          <p>{{ item.artist || item.owner }}</p>
          <span class="played-time">{{ formatRelativeTime(item.playedAt) }}</span>
        </div>
      </div>
    </div>

    <!-- Timeline View -->
    <div v-else-if="viewMode === 'timeline'" class="timeline-view">
      <div 
        v-for="(group, date) in groupedByDate" 
        :key="date"
        class="timeline-group"
      >
        <h3 class="timeline-date">{{ formatDate(date) }}</h3>
        <div class="timeline-items">
          <div 
            v-for="(item, index) in group" 
            :key="`${item.type}-${item.id}-${index}`"
            class="timeline-item"
            @click="openItem(item)"
          >
            <div class="timeline-time">
              {{ formatTimeOnly(item.playedAt) }}
            </div>
            <div class="timeline-connector">
              <div class="timeline-dot" :class="item.type"></div>
              <div v-if="index < group.length - 1" class="timeline-line"></div>
            </div>
            <div class="timeline-content card">
              <div class="timeline-header">
                <img 
                  :src="item.artworkUrl || getPlaceholder(item.type)" 
                  :alt="item.title || item.name"
                  class="timeline-artwork"
                  @error="handleImageError($event, item.type)"
                />
                <div class="timeline-info">
                  <h4>{{ item.title || item.name }}</h4>
                  <p>
                    {{ item.artist || item.owner }}
                    <span class="separator">•</span>
                    <span class="type-label">{{ formatType(item.type) }}</span>
                  </p>
                </div>
                <button @click.stop="playItem(item)" class="timeline-play-btn">
                  <font-awesome-icon :icon="isPlaying(item) ? 'pause' : 'play'" />
                </button>
              </div>
              <div v-if="item.context" class="timeline-context">
                <font-awesome-icon :icon="getContextIcon(item.context)" />
                {{ formatContext(item.context) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- View Mode Toggle -->
    <div v-if="showViewToggle && items.length > 0" class="view-toggle">
      <button 
        @click="viewMode = 'list'" 
        :class="{ active: viewMode === 'list' }"
        title="List view"
      >
        <font-awesome-icon icon="list" />
      </button>
      <button 
        @click="viewMode = 'grid'" 
        :class="{ active: viewMode === 'grid' }"
        title="Grid view"
      >
        <font-awesome-icon icon="grip" />
      </button>
      <button 
        @click="viewMode = 'timeline'" 
        :class="{ active: viewMode === 'timeline' }"
        title="Timeline view"
      >
        <font-awesome-icon icon="stream" />
      </button>
    </div>

    <!-- Context Menu -->
    <div 
      v-if="contextMenu.show" 
      class="context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
      @click="contextMenu.show = false"
    >
      <button @click="playNext(contextMenu.item)">
        <font-awesome-icon icon="play" />
        Play Next
      </button>
      <button @click="addToPlaylist(contextMenu.item)">
        <font-awesome-icon icon="list" />
        Add to Playlist
      </button>
      <button @click="goToArtist(contextMenu.item)">
        <font-awesome-icon icon="user" />
        Go to Artist
      </button>
      <button @click="goToAlbum(contextMenu.item)">
        <font-awesome-icon icon="compact-disc" />
        Go to Album
      </button>
      <button @click="shareItem(contextMenu.item)">
        <font-awesome-icon icon="share" />
        Share
      </button>
      <button @click="removeFromHistory(contextMenu.item)" class="danger">
        <font-awesome-icon icon="times" />
        Remove from History
      </button>
    </div>
  </div>
</template>

<style scoped>
.recently-played-list {
  position: relative;
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

.empty-state h3 {
  margin-bottom: var(--space-sm);
}

/* View Toggle */
.view-toggle {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  gap: var(--space-xs);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--space-xs);
}

.view-toggle button {
  padding: var(--space-sm);
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-base);
}

.view-toggle button.active {
  background: var(--color-primary);
  color: white;
}

/* List View */
.list-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.played-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
}

.played-item:hover {
  background: var(--color-bg-tertiary);
  transform: translateX(4px);
}

.item-artwork {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: var(--radius-md);
  overflow: hidden;
  flex-shrink: 0;
}

.item-artwork img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition-base);
}

.played-item:hover .item-overlay {
  opacity: 1;
}

.play-btn {
  width: 32px;
  height: 32px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.item-type-badge {
  position: absolute;
  top: var(--space-xs);
  right: var(--space-xs);
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-title {
  font-weight: var(--font-medium);
  margin-bottom: var(--space-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.separator {
  opacity: 0.5;
}

.item-context {
  margin-top: var(--space-xs);
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.item-metadata {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-xs);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.play-time,
.play-count {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.item-actions {
  display: flex;
  gap: var(--space-xs);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.played-item:hover .item-actions {
  opacity: 1;
}

.action-btn {
  padding: var(--space-sm);
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: color var(--transition-base);
}

.action-btn:hover {
  color: var(--color-text-primary);
}

.action-btn.liked {
  color: var(--color-primary);
}

/* Grid View */
.grid-view {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-lg);
  padding-top: var(--space-xl);
}

.grid-item {
  cursor: pointer;
  transition: transform var(--transition-base);
}

.grid-item:hover {
  transform: translateY(-4px);
}

.grid-item-cover {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-bottom: var(--space-md);
}

.grid-item-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.grid-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition-base);
}

.grid-item:hover .grid-overlay {
  opacity: 1;
}

.type-indicator {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  padding: var(--space-xs);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
}

.grid-item-info h4 {
  font-size: var(--text-md);
  margin-bottom: var(--space-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.grid-item-info p {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.played-time {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

/* Timeline View */
.timeline-view {
  padding-top: var(--space-xl);
}

.timeline-group {
  margin-bottom: var(--space-xl);
}

.timeline-date {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-lg);
  color: var(--color-text-secondary);
}

.timeline-items {
  position: relative;
}

.timeline-item {
  display: grid;
  grid-template-columns: 80px 40px 1fr;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.timeline-time {
  text-align: right;
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
  padding-top: var(--space-sm);
}

.timeline-connector {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.timeline-dot {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  margin-top: var(--space-sm);
}

.timeline-dot.album {
  background: var(--color-success);
}

.timeline-dot.playlist {
  background: var(--color-info);
}

.timeline-dot.episode {
  background: var(--color-warning);
}

.timeline-line {
  width: 2px;
  flex: 1;
  background: var(--color-border);
  margin-top: var(--space-sm);
}

.timeline-content {
  padding: var(--space-md);
  cursor: pointer;
  transition: transform var(--transition-base);
}

.timeline-content:hover {
  transform: translateX(4px);
}

.timeline-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  margin-bottom: var(--space-sm);
}

.timeline-artwork {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  object-fit: cover;
}

.timeline-info {
  flex: 1;
}

.timeline-info h4 {
  font-weight: var(--font-medium);
  margin-bottom: var(--space-xs);
}

.timeline-info p {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.type-label {
  opacity: 0.7;
}

.timeline-play-btn {
  width: 36px;
  height: 36px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--transition-base);
}

.timeline-content:hover .timeline-play-btn {
  opacity: 1;
}

.timeline-context {
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding-left: calc(48px + var(--space-md));
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
}

.context-menu button:hover {
  background: var(--color-bg-secondary);
}

.context-menu button.danger {
  color: var(--color-error);
}

/* Responsive */
@media (max-width: 768px) {
  .item-metadata {
    display: none;
  }
  
  .item-actions {
    opacity: 1;
  }
  
  .grid-view {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
  
  .timeline-item {
    grid-template-columns: 60px 30px 1fr;
  }
}
</style>