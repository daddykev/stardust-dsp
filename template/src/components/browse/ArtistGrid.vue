<!-- template/src/components/browse/ArtistGrid.vue -->
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayer } from '../../composables/usePlayer'
import { useSocial } from '../../composables/useSocial'

const props = defineProps({
  artists: {
    type: Array,
    required: true
  },
  size: {
    type: String,
    default: 'medium', // 'small', 'medium', 'large'
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },
  showType: {
    type: Boolean,
    default: true
  },
  showStats: {
    type: Boolean,
    default: true
  },
  showGenres: {
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

const emit = defineEmits(['play', 'follow', 'unfollow'])

const router = useRouter()
const player = usePlayer()
const social = useSocial()

// State
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  artist: null
})

// Methods
function openArtist(artist) {
  router.push(`/artists/${artist.id}`)
}

async function playArtist(artist) {
  emit('play', artist)
  console.log('Playing artist radio:', artist.name)
  // TODO: Load artist's top tracks and play
}

async function toggleFollow(artist) {
  artist.isFollowing = !artist.isFollowing
  
  if (artist.isFollowing) {
    emit('follow', artist)
    await social.followUser(artist.id)
  } else {
    emit('unfollow', artist)
    await social.unfollowUser(artist.id)
  }
}

function startRadio(artist) {
  router.push(`/radio/artist/${artist.id}`)
}

function showOptions(artist, event) {
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    artist
  }
}

// Context menu actions
function playArtistFromMenu() {
  if (contextMenu.value.artist) {
    playArtist(contextMenu.value.artist)
  }
  contextMenu.value.show = false
}

function viewArtist() {
  if (contextMenu.value.artist) {
    openArtist(contextMenu.value.artist)
  }
  contextMenu.value.show = false
}

function viewDiscography() {
  if (contextMenu.value.artist) {
    router.push(`/artists/${contextMenu.value.artist.id}/discography`)
  }
  contextMenu.value.show = false
}

function addToQueue() {
  console.log('Add artist to queue:', contextMenu.value.artist?.name)
  contextMenu.value.show = false
}

function shareArtist() {
  if (contextMenu.value.artist) {
    const url = `${window.location.origin}/artists/${contextMenu.value.artist.id}`
    navigator.clipboard.writeText(url)
  }
  contextMenu.value.show = false
}

async function unfollowArtist() {
  if (contextMenu.value.artist) {
    contextMenu.value.artist.isFollowing = false
    emit('unfollow', contextMenu.value.artist)
    await social.unfollowUser(contextMenu.value.artist.id)
  }
  contextMenu.value.show = false
}

// Utilities
function getArtistType(artist) {
  if (artist.verified) return 'Verified Artist'
  if (artist.type) return artist.type
  return 'Artist'
}

function formatNumber(num) {
  if (!num) return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

function handleImageError(e) {
  e.target.src = '/placeholder-artist.png'
}

// Global click handler
document.addEventListener('click', (e) => {
  if (!e.target.closest('.context-menu') && !e.target.closest('.action-btn')) {
    contextMenu.value.show = false
  }
})
</script>

<template>
  <div class="artist-grid" :class="[`size-${size}`, { 'loading': loading }]">
    <!-- Loading State -->
    <div v-if="loading" class="loading-grid">
      <div v-for="i in skeletonCount" :key="i" class="skeleton-artist">
        <div class="skeleton skeleton-image"></div>
        <div class="skeleton skeleton-name"></div>
        <div class="skeleton skeleton-info"></div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!artists || artists.length === 0" class="empty-state">
      <font-awesome-icon icon="users" />
      <h3>No artists found</h3>
      <p>{{ emptyMessage }}</p>
    </div>

    <!-- Artists Grid -->
    <div v-else class="artists-container">
      <div 
        v-for="artist in artists" 
        :key="artist.id"
        class="artist-item"
        @click="openArtist(artist)"
      >
        <!-- Artist Image -->
        <div class="artist-image-wrapper">
          <img 
            :src="artist.imageUrl || '/placeholder-artist.png'" 
            :alt="artist.name"
            class="artist-image"
            @error="handleImageError"
          />
          <div class="artist-overlay">
            <button 
              @click.stop="playArtist(artist)" 
              class="play-btn"
              title="Play artist radio"
            >
              <font-awesome-icon icon="play" />
            </button>
          </div>
          <div v-if="artist.verified" class="verified-badge" title="Verified Artist">
            <font-awesome-icon icon="check-circle" />
          </div>
          <div v-if="artist.isFollowing" class="following-indicator">
            <font-awesome-icon icon="check" />
          </div>
        </div>

        <!-- Artist Info -->
        <div class="artist-info">
          <h4 class="artist-name">{{ artist.name }}</h4>
          
          <p v-if="showType" class="artist-type">
            {{ getArtistType(artist) }}
          </p>
          
          <p v-if="showStats" class="artist-stats">
            <span v-if="artist.followers">
              {{ formatNumber(artist.followers) }} followers
            </span>
            <span v-else-if="artist.monthlyListeners">
              {{ formatNumber(artist.monthlyListeners) }} listeners
            </span>
          </p>

          <div v-if="showGenres && artist.genres?.length > 0" class="artist-genres">
            <span 
              v-for="(genre, index) in artist.genres.slice(0, 2)" 
              :key="index"
              class="genre-tag"
            >
              {{ genre }}
            </span>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="artist-actions">
          <button 
            @click.stop="toggleFollow(artist)" 
            class="action-btn follow-btn"
            :class="{ following: artist.isFollowing }"
            :title="artist.isFollowing ? 'Unfollow' : 'Follow'"
          >
            <font-awesome-icon :icon="artist.isFollowing ? 'user-check' : 'user-plus'" />
          </button>
          
          <button 
            @click.stop="startRadio(artist)" 
            class="action-btn"
            title="Start radio"
          >
            <font-awesome-icon icon="broadcast-tower" />
          </button>
          
          <button 
            @click.stop="showOptions(artist, $event)" 
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
        <button @click="playArtistFromMenu">
          <font-awesome-icon icon="play" />
          Play Artist Radio
        </button>
        <button @click="viewArtist">
          <font-awesome-icon icon="user" />
          View Artist
        </button>
        <button @click="viewDiscography">
          <font-awesome-icon icon="compact-disc" />
          View Discography
        </button>
        <button @click="addToQueue">
          <font-awesome-icon icon="plus" />
          Add to Queue
        </button>
        <button @click="shareArtist">
          <font-awesome-icon icon="share" />
          Share
        </button>
        <button v-if="contextMenu.artist?.isFollowing" @click="unfollowArtist">
          <font-awesome-icon icon="user-minus" />
          Unfollow
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.artist-grid {
  width: 100%;
}

/* Grid Container */
.artists-container {
  display: grid;
  gap: var(--space-lg);
}

/* Size variants */
.size-small .artists-container {
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--space-md);
}

.size-medium .artists-container {
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
}

.size-large .artists-container {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-xl);
}

/* Artist Item */
.artist-item {
  text-align: center;
  cursor: pointer;
  transition: transform var(--transition-base);
  position: relative;
}

.artist-item:hover {
  transform: translateY(-4px);
}

/* Artist Image */
.artist-image-wrapper {
  position: relative;
  margin-bottom: var(--space-md);
}

.artist-image {
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--radius-full);
  object-fit: cover;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all var(--transition-base);
}

.artist-item:hover .artist-image {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.artist-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition-base);
}

.artist-item:hover .artist-overlay {
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

.verified-badge {
  position: absolute;
  bottom: 5px;
  right: 5px;
  width: 28px;
  height: 28px;
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid var(--color-surface);
  font-size: var(--text-sm);
}

.following-indicator {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 24px;
  height: 24px;
  background: var(--color-success);
  color: white;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
}

/* Size adjustments */
.size-small .play-btn {
  width: 40px;
  height: 40px;
  font-size: var(--text-md);
}

.size-small .verified-badge {
  width: 20px;
  height: 20px;
  font-size: var(--text-xs);
}

.size-large .play-btn {
  width: 64px;
  height: 64px;
  font-size: var(--text-xl);
}

/* Artist Info */
.artist-info {
  padding: 0 var(--space-sm);
}

.artist-name {
  font-size: var(--text-md);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artist-type {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  margin-bottom: var(--space-xs);
}

.artist-stats {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
}

.artist-genres {
  display: flex;
  gap: var(--space-xs);
  justify-content: center;
  flex-wrap: wrap;
  margin-top: var(--space-sm);
}

.genre-tag {
  padding: 2px 8px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

/* Actions */
.artist-actions {
  position: absolute;
  top: var(--space-sm);
  left: var(--space-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.artist-item:hover .artist-actions {
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

.follow-btn.following {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

/* Loading State */
.loading-grid {
  display: grid;
  gap: var(--space-lg);
}

.size-small .loading-grid {
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
}

.size-medium .loading-grid {
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
}

.size-large .loading-grid {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.skeleton-artist {
  text-align: center;
}

.skeleton {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.skeleton-image {
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--radius-full);
  margin-bottom: var(--space-md);
}

.skeleton-name {
  height: 20px;
  width: 80%;
  margin: 0 auto var(--space-xs);
}

.skeleton-info {
  height: 16px;
  width: 60%;
  margin: 0 auto;
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
  .artist-actions {
    opacity: 1;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    border-radius: var(--radius-md);
    padding: var(--space-xs);
  }

  .size-large .artists-container {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
}
</style>