<!-- template/src/components/browse/ArtistCarousel.vue -->
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayer } from '../../composables/usePlayer'
import { useSocial } from '../../composables/useSocial'

const props = defineProps({
  artists: {
    type: Array,
    required: true
  },
  title: {
    type: String,
    default: ''
  },
  showLoadMore: {
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
  'follow',
  'unfollow',
  'play',
  'load-more'
])

const router = useRouter()
const player = usePlayer()
const social = useSocial()

// Refs
const containerRef = ref(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

// State
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  artist: null
})

// Methods
function scrollLeft() {
  if (containerRef.value) {
    containerRef.value.scrollBy({ 
      left: -300, 
      behavior: 'smooth' 
    })
  }
}

function scrollRight() {
  if (containerRef.value) {
    containerRef.value.scrollBy({ 
      left: 300, 
      behavior: 'smooth' 
    })
  }
}

function updateScrollState() {
  if (!containerRef.value) return
  
  const { scrollLeft, scrollWidth, clientWidth } = containerRef.value
  canScrollLeft.value = scrollLeft > 0
  canScrollRight.value = scrollLeft < scrollWidth - clientWidth - 10
}

function openArtist(artist) {
  router.push(`/artists/${artist.id}`)
}

async function playArtist(artist) {
  emit('play', artist)
  
  // Load artist's top tracks and play
  console.log('Playing artist:', artist.name)
  // TODO: Load artist's top tracks
  // const tracks = await catalog.getArtistTopTracks(artist.id)
  // player.clearQueue()
  // tracks.forEach(track => player.addToQueue(track))
  // if (tracks.length > 0) player.playTrack(tracks[0])
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

function playRadio(artist) {
  console.log('Start radio for:', artist.name)
  router.push(`/radio/artist/${artist.id}`)
}

function shareArtist(artist) {
  const url = `${window.location.origin}/artists/${artist.id}`
  navigator.clipboard.writeText(url)
  console.log('Artist link copied')
  
  // Create share activity
  social.shareContent('artist', artist.id, `Check out ${artist.name}`)
}

function showOptions(artist, event) {
  event.stopPropagation()
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    artist
  }
}

function closeContextMenu() {
  contextMenu.value.show = false
}

// Context menu actions
function playArtistNext(artist) {
  console.log('Play artist next:', artist.name)
  closeContextMenu()
}

function addToQueue(artist) {
  console.log('Add artist to queue:', artist.name)
  closeContextMenu()
}

function goToArtist(artist) {
  router.push(`/artists/${artist.id}`)
  closeContextMenu()
}

function viewDiscography(artist) {
  router.push(`/artists/${artist.id}/discography`)
  closeContextMenu()
}

function startRadio(artist) {
  playRadio(artist)
  closeContextMenu()
}

async function unfollowArtist(artist) {
  artist.isFollowing = false
  emit('unfollow', artist)
  await social.unfollowUser(artist.id)
  closeContextMenu()
}

// Utility functions
function getArtistType(artist) {
  if (artist.type) {
    return artist.type
  }
  if (artist.verified) {
    return 'Verified Artist'
  }
  return 'Artist'
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
  e.target.src = '/placeholder-artist.png'
}

// Lifecycle
onMounted(() => {
  updateScrollState()
  
  // Add global click listener for context menu
  document.addEventListener('click', handleGlobalClick)
  
  // Add resize observer to update scroll state
  if (containerRef.value) {
    const resizeObserver = new ResizeObserver(() => {
      updateScrollState()
    })
    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick)
})

function handleGlobalClick(e) {
  if (!e.target.closest('.context-menu') && !e.target.closest('.action-btn')) {
    closeContextMenu()
  }
}
</script>

<template>
  <div class="artist-carousel">
    <div class="carousel-header" v-if="title">
      <h3>{{ title }}</h3>
      <div class="carousel-controls">
        <button 
          @click="scrollLeft" 
          class="carousel-btn prev"
          :disabled="!canScrollLeft"
        >
          <font-awesome-icon icon="chevron-left" />
        </button>
        <button 
          @click="scrollRight" 
          class="carousel-btn next"
          :disabled="!canScrollRight"
        >
          <font-awesome-icon icon="chevron-right" />
        </button>
      </div>
    </div>

    <div 
      class="carousel-container" 
      ref="containerRef"
      @scroll="updateScrollState"
    >
      <div class="carousel-track">
        <div 
          v-for="artist in artists" 
          :key="artist.id"
          class="artist-card"
          @click="openArtist(artist)"
        >
          <!-- Artist Image -->
          <div class="artist-image-container">
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
            <div v-if="artist.verified" class="verified-badge">
              <font-awesome-icon icon="check-circle" />
            </div>
          </div>

          <!-- Artist Info -->
          <div class="artist-info">
            <h4 class="artist-name">{{ artist.name }}</h4>
            <p class="artist-type">{{ getArtistType(artist) }}</p>
            
            <div class="artist-stats">
              <span v-if="artist.followers" class="follower-count">
                {{ formatNumber(artist.followers) }} followers
              </span>
              <span v-else-if="artist.monthlyListeners" class="listener-count">
                {{ formatNumber(artist.monthlyListeners) }} monthly listeners
              </span>
            </div>

            <!-- Genres -->
            <div v-if="artist.genres && artist.genres.length > 0" class="artist-genres">
              <span 
                v-for="(genre, index) in artist.genres.slice(0, 2)" 
                :key="index"
                class="genre-tag"
              >
                {{ genre }}
              </span>
              <span v-if="artist.genres.length > 2" class="more-genres">
                +{{ artist.genres.length - 2 }}
              </span>
            </div>

            <!-- Follow Button -->
            <button 
              @click.stop="toggleFollow(artist)" 
              class="follow-btn"
              :class="{ following: artist.isFollowing }"
            >
              <font-awesome-icon :icon="artist.isFollowing ? 'check' : 'plus'" />
              {{ artist.isFollowing ? 'Following' : 'Follow' }}
            </button>
          </div>

          <!-- Quick Actions -->
          <div class="artist-actions">
            <button 
              @click.stop="playRadio(artist)" 
              class="action-btn"
              title="Artist radio"
            >
              <font-awesome-icon icon="broadcast-tower" />
            </button>
            <button 
              @click.stop="shareArtist(artist)" 
              class="action-btn"
              title="Share"
            >
              <font-awesome-icon icon="share" />
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

        <!-- Load More Card -->
        <div 
          v-if="showLoadMore" 
          class="artist-card load-more-card"
          @click="$emit('load-more')"
        >
          <div class="load-more-content">
            <font-awesome-icon icon="arrow-right" />
            <span>View All</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Context Menu -->
    <transition name="fade">
      <div 
        v-if="contextMenu.show" 
        class="context-menu"
        :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
        @click="closeContextMenu"
      >
        <button @click="playArtistNext(contextMenu.artist)">
          <font-awesome-icon icon="play" />
          Play Next
        </button>
        <button @click="addToQueue(contextMenu.artist)">
          <font-awesome-icon icon="plus" />
          Add to Queue
        </button>
        <button @click="goToArtist(contextMenu.artist)">
          <font-awesome-icon icon="user" />
          View Artist
        </button>
        <button @click="viewDiscography(contextMenu.artist)">
          <font-awesome-icon icon="compact-disc" />
          View Discography
        </button>
        <button @click="startRadio(contextMenu.artist)">
          <font-awesome-icon icon="broadcast-tower" />
          Start Radio
        </button>
        <button @click="shareArtist(contextMenu.artist)">
          <font-awesome-icon icon="share" />
          Share
        </button>
        <button v-if="contextMenu.artist.isFollowing" @click="unfollowArtist(contextMenu.artist)">
          <font-awesome-icon icon="user-minus" />
          Unfollow
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.artist-carousel {
  position: relative;
}

/* Header */
.carousel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.carousel-header h3 {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
}

.carousel-controls {
  display: flex;
  gap: var(--space-sm);
}

.carousel-btn {
  width: 36px;
  height: 36px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-base);
}

.carousel-btn:hover:not(:disabled) {
  background: var(--color-bg-tertiary);
  transform: scale(1.1);
}

.carousel-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Container */
.carousel-container {
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.carousel-container::-webkit-scrollbar {
  display: none;
}

.carousel-track {
  display: flex;
  gap: var(--space-lg);
  padding: var(--space-sm) 0;
}

/* Artist Card */
.artist-card {
  flex: 0 0 180px;
  text-align: center;
  cursor: pointer;
  transition: transform var(--transition-base);
  position: relative;
}

.artist-card:hover {
  transform: translateY(-4px);
}

/* Compact variant */
.artist-carousel.compact .artist-card {
  flex: 0 0 140px;
}

/* Detailed variant */
.artist-carousel.detailed .artist-card {
  flex: 0 0 220px;
}

/* Artist Image */
.artist-image-container {
  position: relative;
  margin-bottom: var(--space-md);
}

.artist-image {
  width: 160px;
  height: 160px;
  border-radius: var(--radius-full);
  object-fit: cover;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all var(--transition-base);
}

.artist-card:hover .artist-image {
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

.artist-card:hover .artist-overlay {
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
  bottom: 0;
  right: 10px;
  width: 28px;
  height: 28px;
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid var(--color-surface);
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
  margin-bottom: var(--space-sm);
}

.artist-stats {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
}

/* Genres */
.artist-genres {
  display: flex;
  gap: var(--space-xs);
  justify-content: center;
  margin-bottom: var(--space-md);
  min-height: 24px;
}

.genre-tag {
  padding: 2px 8px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.more-genres {
  padding: 2px 8px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

/* Follow Button */
.follow-btn {
  padding: var(--space-sm) var(--space-md);
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-base);
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
}

.follow-btn:hover {
  transform: scale(1.05);
}

.follow-btn.following {
  background: transparent;
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.follow-btn.following:hover {
  background: var(--color-bg-secondary);
}

/* Quick Actions */
.artist-actions {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.artist-card:hover .artist-actions {
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

/* Load More Card */
.load-more-card {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  min-height: 280px;
  transition: all var(--transition-base);
}

.load-more-card:hover {
  background: var(--color-bg-tertiary);
}

.load-more-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  color: var(--color-text-secondary);
}

.load-more-content svg {
  font-size: 2rem;
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
  .carousel-controls {
    display: none;
  }
  
  .artist-card {
    flex: 0 0 140px;
  }
  
  .artist-image {
    width: 120px;
    height: 120px;
  }
  
  .artist-actions {
    opacity: 1;
    background: rgba(255, 255, 255, 0.9);
    border-radius: var(--radius-md);
    padding: var(--space-xs);
  }
}

/* Variants */
.compact .artist-image {
  width: 120px;
  height: 120px;
}

.compact .artist-name {
  font-size: var(--text-sm);
}

.compact .artist-genres,
.compact .artist-type {
  display: none;
}

.detailed .artist-image {
  width: 200px;
  height: 200px;
}

.detailed .artist-info {
  padding: 0 var(--space-md);
}

.detailed .artist-name {
  font-size: var(--text-lg);
}

.detailed .artist-stats {
  font-size: var(--text-md);
  margin-bottom: var(--space-md);
}
</style>