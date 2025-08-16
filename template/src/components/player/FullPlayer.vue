<template>
  <transition name="slide-up">
    <div v-if="isOpen" class="full-player" :class="{ minimized: isMinimized }">
      <!-- Background with album art blur -->
      <div class="player-background">
        <img 
          :src="currentTrack?.artworkUrl || '/placeholder-album.png'" 
          :alt="currentTrack?.title"
          @error="handleImageError"
        />
        <div class="background-overlay"></div>
      </div>

      <!-- Player Content -->
      <div class="player-content">
        <!-- Header -->
        <div class="player-header">
          <button @click="minimize" class="btn-icon" title="Minimize">
            <font-awesome-icon icon="chevron-down" />
          </button>
          
          <div class="header-info">
            <span class="now-playing-label">Now Playing</span>
            <span v-if="currentTrack?.albumTitle" class="album-label">
              from {{ currentTrack.albumTitle }}
            </span>
          </div>
          
          <button @click="close" class="btn-icon" title="Close">
            <font-awesome-icon icon="times" />
          </button>
        </div>

        <!-- Main Player Area -->
        <div class="player-main">
          <!-- Left: Artwork & Info -->
          <div class="player-left">
            <div class="artwork-container">
              <img 
                :src="currentTrack?.artworkUrl || '/placeholder-album.png'" 
                :alt="currentTrack?.title"
                class="album-artwork"
                :class="{ spinning: isPlaying && visualizerMode === 'vinyl' }"
                @error="handleImageError"
              />
              
              <!-- Visualizer Overlay -->
              <canvas 
                v-if="visualizerMode === 'bars'"
                ref="visualizer"
                class="visualizer"
              ></canvas>
            </div>
            
            <div class="track-info">
              <h1 class="track-title">{{ currentTrack?.title || 'No track playing' }}</h1>
              <router-link 
                v-if="currentTrack?.artistId"
                :to="`/artists/${currentTrack.artistId}`"
                class="track-artist"
              >
                {{ currentTrack?.artistName }}
              </router-link>
              <span v-else class="track-artist">{{ currentTrack?.artistName || 'Unknown Artist' }}</span>
            </div>

            <!-- Track Actions -->
            <div class="track-actions">
              <button 
                @click="toggleFavorite" 
                class="action-btn"
                :class="{ active: isFavorite }"
                title="Add to favorites"
              >
                <font-awesome-icon :icon="isFavorite ? 'heart' : ['far', 'heart']" />
              </button>
              <button 
                @click="addToPlaylist" 
                class="action-btn"
                title="Add to playlist"
              >
                <font-awesome-icon icon="plus" />
              </button>
              <button 
                @click="share" 
                class="action-btn"
                title="Share"
              >
                <font-awesome-icon icon="share" />
              </button>
              <button 
                @click="showOptions" 
                class="action-btn"
                title="More options"
              >
                <font-awesome-icon icon="ellipsis-h" />
              </button>
            </div>
          </div>

          <!-- Center: Controls -->
          <div class="player-center">
            <!-- Progress Bar -->
            <div class="progress-container">
              <span class="time current-time">{{ formattedCurrentTime }}</span>
              <div 
                class="progress-bar"
                @click="handleSeek"
                @mousedown="startSeeking"
                ref="progressBar"
              >
                <div class="progress-buffered" :style="{ width: bufferedPercent + '%' }"></div>
                <div class="progress-fill" :style="{ width: progress + '%' }">
                  <span class="progress-handle" v-if="isSeeking"></span>
                </div>
              </div>
              <span class="time duration">{{ formattedDuration }}</span>
            </div>

            <!-- Playback Controls -->
            <div class="playback-controls">
              <button 
                @click="toggleShuffle" 
                class="control-btn small"
                :class="{ active: isShuffled }"
                title="Shuffle"
              >
                <font-awesome-icon icon="random" />
              </button>
              
              <button 
                @click="previous" 
                class="control-btn"
                title="Previous"
              >
                <font-awesome-icon icon="step-backward" />
              </button>
              
              <button 
                @click="togglePlay" 
                class="control-btn large play-pause"
                :title="isPlaying ? 'Pause' : 'Play'"
              >
                <font-awesome-icon :icon="isPlaying ? 'pause' : 'play'" />
              </button>
              
              <button 
                @click="next" 
                class="control-btn"
                title="Next"
              >
                <font-awesome-icon icon="step-forward" />
              </button>
              
              <button 
                @click="toggleRepeat" 
                class="control-btn small"
                :class="{ active: repeatMode !== 'off' }"
                title="Repeat"
              >
                <font-awesome-icon 
                  :icon="repeatMode === 'one' ? 'redo' : 'retweet'" 
                />
                <span v-if="repeatMode === 'one'" class="repeat-one">1</span>
              </button>
            </div>

            <!-- Volume Control -->
            <div class="volume-control">
              <button 
                @click="toggleMute" 
                class="control-btn small"
                :title="isMuted ? 'Unmute' : 'Mute'"
              >
                <font-awesome-icon 
                  :icon="isMuted ? 'volume-mute' : volume > 0.5 ? 'volume-up' : 'volume-down'" 
                />
              </button>
              <div class="volume-slider">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  :value="volume * 100"
                  @input="setVolume($event.target.value / 100)"
                  class="slider"
                />
              </div>
              <span class="volume-value">{{ Math.round(volume * 100) }}</span>
            </div>

            <!-- Audio Quality Indicator -->
            <div class="quality-indicator" v-if="streamQuality">
              <span class="quality-badge" :class="streamQuality">
                {{ streamQuality.toUpperCase() }}
              </span>
              <span class="bitrate" v-if="bitrate">{{ bitrate }} kbps</span>
            </div>
          </div>

          <!-- Right: Queue -->
          <div class="player-right">
            <div class="queue-header">
              <h3>Queue</h3>
              <div class="queue-actions">
                <button 
                  @click="clearQueue" 
                  class="btn-text"
                  v-if="queue.length > 0"
                >
                  Clear
                </button>
                <button @click="saveAsPlaylist" class="btn-text">
                  Save
                </button>
              </div>
            </div>
            
            <div class="queue-list" ref="queueList">
              <div v-if="queue.length === 0" class="queue-empty">
                <font-awesome-icon icon="music" />
                <p>Queue is empty</p>
                <router-link to="/catalog" class="btn btn-sm btn-primary">
                  Browse Music
                </router-link>
              </div>
              
              <draggable 
                v-else
                v-model="queue"
                @change="onQueueReorder"
                item-key="id"
                handle=".drag-handle"
              >
                <template #item="{ element: track, index }">
                  <div 
                    class="queue-item"
                    :class="{ 
                      current: index === queueIndex,
                      playing: index === queueIndex && isPlaying 
                    }"
                    @click="playFromQueue(index)"
                  >
                    <span class="drag-handle">
                      <font-awesome-icon icon="grip-vertical" />
                    </span>
                    
                    <img 
                      :src="track.artworkUrl || '/placeholder-album.png'" 
                      :alt="track.title"
                      class="queue-item-artwork"
                      @error="handleImageError"
                    />
                    
                    <div class="queue-item-info">
                      <div class="queue-item-title">{{ track.title }}</div>
                      <div class="queue-item-artist">{{ track.artistName }}</div>
                    </div>
                    
                    <span class="queue-item-duration">
                      {{ formatDuration(track.duration) }}
                    </span>
                    
                    <button 
                      @click.stop="removeFromQueue(index)"
                      class="queue-item-remove"
                      title="Remove from queue"
                    >
                      <font-awesome-icon icon="times" />
                    </button>
                  </div>
                </template>
              </draggable>
            </div>

            <!-- Up Next -->
            <div v-if="upNext" class="up-next">
              <h4>Up Next</h4>
              <div class="up-next-track">
                <img 
                  :src="upNext.artworkUrl || '/placeholder-album.png'" 
                  :alt="upNext.title"
                  @error="handleImageError"
                />
                <div>
                  <div class="up-next-title">{{ upNext.title }}</div>
                  <div class="up-next-artist">{{ upNext.artistName }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Minimized View -->
        <div v-if="isMinimized" class="minimized-player">
          <img 
            :src="currentTrack?.artworkUrl || '/placeholder-album.png'" 
            :alt="currentTrack?.title"
            class="minimized-artwork"
            @error="handleImageError"
          />
          
          <div class="minimized-info">
            <div class="minimized-title">{{ currentTrack?.title }}</div>
            <div class="minimized-artist">{{ currentTrack?.artistName }}</div>
          </div>
          
          <div class="minimized-controls">
            <button @click="previous" class="control-btn small">
              <font-awesome-icon icon="step-backward" />
            </button>
            <button @click="togglePlay" class="control-btn">
              <font-awesome-icon :icon="isPlaying ? 'pause' : 'play'" />
            </button>
            <button @click="next" class="control-btn small">
              <font-awesome-icon icon="step-forward" />
            </button>
          </div>
          
          <div class="minimized-progress">
            <div class="progress-bar-mini">
              <div class="progress-fill" :style="{ width: progress + '%' }"></div>
            </div>
          </div>
          
          <button @click="maximize" class="btn-icon" title="Expand">
            <font-awesome-icon icon="chevron-up" />
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayer } from '../../composables/usePlayer'
import draggable from 'vuedraggable'
import streamingService from '../../services/streaming'

const router = useRouter()
const player = usePlayer()

// Component state
const isOpen = ref(false)
const isMinimized = ref(false)
const isFavorite = ref(false)
const isSeeking = ref(false)
const visualizerMode = ref('none') // 'none', 'bars', 'vinyl'
const streamQuality = ref('high')
const bitrate = ref(320)
const bufferedPercent = ref(0)

// Refs
const progressBar = ref(null)
const queueList = ref(null)
const visualizer = ref(null)

// Computed from player composable
const currentTrack = computed(() => player.currentTrack.value)
const queue = computed({
  get: () => player.queue.value,
  set: (value) => player.queue.value = value
})
const queueIndex = computed(() => player.queueIndex.value)
const isPlaying = computed(() => player.isPlaying.value)
const isPaused = computed(() => player.isPaused.value)
const currentTime = computed(() => player.currentTime.value)
const duration = computed(() => player.duration.value)
const progress = computed(() => player.progress.value)
const volume = computed(() => player.volume.value)
const isMuted = computed(() => player.isMuted.value)
const repeatMode = computed(() => player.repeatMode.value)
const isShuffled = computed(() => player.isShuffled.value)
const formattedCurrentTime = computed(() => player.formattedCurrentTime.value)
const formattedDuration = computed(() => player.formattedDuration.value)

const upNext = computed(() => {
  if (queue.value.length > queueIndex.value + 1) {
    return queue.value[queueIndex.value + 1]
  }
  return null
})

// Player controls
function togglePlay() {
  player.togglePlay()
}

function play() {
  player.play()
}

function pause() {
  player.pause()
}

function next() {
  player.next()
}

function previous() {
  player.previous()
}

function setVolume(value) {
  player.setVolume(value)
}

function toggleMute() {
  player.toggleMute()
}

function toggleRepeat() {
  const modes = ['off', 'all', 'one']
  const currentIndex = modes.indexOf(repeatMode.value)
  const nextMode = modes[(currentIndex + 1) % modes.length]
  player.setRepeatMode(nextMode)
}

function toggleShuffle() {
  player.toggleShuffle()
}

function clearQueue() {
  if (confirm('Clear the entire queue?')) {
    player.clearQueue()
  }
}

function removeFromQueue(index) {
  player.removeFromQueue(index)
}

function playFromQueue(index) {
  player.queueIndex.value = index
  player.playTrack(queue.value[index], false)
}

// Seeking
function handleSeek(e) {
  if (!progressBar.value) return
  
  const rect = progressBar.value.getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  const seekTime = percent * duration.value
  player.seek(seekTime)
}

function startSeeking(e) {
  isSeeking.value = true
  document.addEventListener('mousemove', handleSeeking)
  document.addEventListener('mouseup', stopSeeking)
}

function handleSeeking(e) {
  if (!isSeeking.value || !progressBar.value) return
  
  const rect = progressBar.value.getBoundingClientRect()
  const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const seekTime = percent * duration.value
  player.seek(seekTime)
}

function stopSeeking() {
  isSeeking.value = false
  document.removeEventListener('mousemove', handleSeeking)
  document.removeEventListener('mouseup', stopSeeking)
}

// Queue management
function onQueueReorder() {
  // Queue has been reordered via drag-and-drop
  console.log('Queue reordered')
}

// Track actions
function toggleFavorite() {
  isFavorite.value = !isFavorite.value
  // TODO: Save to user's favorites
  console.log('Toggle favorite:', currentTrack.value?.title)
}

function addToPlaylist() {
  // TODO: Show playlist selector
  console.log('Add to playlist:', currentTrack.value?.title)
}

function share() {
  if (currentTrack.value) {
    const url = `${window.location.origin}/tracks/${currentTrack.value.id}`
    navigator.clipboard.writeText(url)
    console.log('Track link copied')
  }
}

function showOptions() {
  // TODO: Show context menu
  console.log('Show options for:', currentTrack.value?.title)
}

function saveAsPlaylist() {
  // TODO: Save current queue as playlist
  console.log('Save queue as playlist')
}

// Player UI controls
function open() {
  isOpen.value = true
  isMinimized.value = false
}

function close() {
  isOpen.value = false
  isMinimized.value = false
}

function minimize() {
  isMinimized.value = true
}

function maximize() {
  isMinimized.value = false
}

// Utilities
function formatDuration(seconds) {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function handleImageError(e) {
  e.target.src = '/placeholder-album.png'
}

// Setup visualizer (basic implementation)
function setupVisualizer() {
  if (!visualizer.value || visualizerMode.value !== 'bars') return
  
  const canvas = visualizer.value
  const ctx = canvas.getContext('2d')
  
  // Simple animated bars (would connect to Web Audio API in production)
  function draw() {
    if (visualizerMode.value !== 'bars' || !isPlaying.value) return
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    const barCount = 32
    const barWidth = canvas.width / barCount
    
    for (let i = 0; i < barCount; i++) {
      const height = Math.random() * canvas.height * 0.7
      const x = i * barWidth
      const y = canvas.height - height
      
      ctx.fillStyle = `hsla(${200 + i * 2}, 70%, 50%, 0.8)`
      ctx.fillRect(x, y, barWidth - 2, height)
    }
    
    requestAnimationFrame(draw)
  }
  
  draw()
}

// Watch for track changes to load secure URL
watch(currentTrack, async (track) => {
  if (track?.id) {
    try {
      // Get secure streaming URL
      const secureUrl = await streamingService.getStreamUrl(track.id)
      // Update the player's audio source
      // This would be integrated with the player composable
      console.log('Loaded secure URL for:', track.title)
      
      // Report play start
      await streamingService.reportPlayStart(track.id, {
        source: 'full-player'
      })
    } catch (error) {
      console.error('Error loading stream URL:', error)
    }
  }
})

// Auto-scroll to current track in queue
watch([queueIndex, isOpen], () => {
  if (isOpen.value && queueList.value) {
    nextTick(() => {
      const currentItem = queueList.value.querySelector('.queue-item.current')
      if (currentItem) {
        currentItem.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
  }
})

// Watch player state
watch(() => player.currentTrack.value, (track) => {
  if (track) {
    open()
  }
})

// Keyboard shortcuts
function handleKeyboard(e) {
  if (!isOpen.value) return
  
  switch(e.key) {
    case ' ':
      e.preventDefault()
      togglePlay()
      break
    case 'ArrowLeft':
      e.preventDefault()
      player.seek(Math.max(0, currentTime.value - 10))
      break
    case 'ArrowRight':
      e.preventDefault()
      player.seek(Math.min(duration.value, currentTime.value + 10))
      break
    case 'ArrowUp':
      e.preventDefault()
      setVolume(Math.min(1, volume.value + 0.1))
      break
    case 'ArrowDown':
      e.preventDefault()
      setVolume(Math.max(0, volume.value - 0.1))
      break
    case 'n':
      next()
      break
    case 'p':
      previous()
      break
    case 'm':
      toggleMute()
      break
    case 'r':
      toggleRepeat()
      break
    case 's':
      toggleShuffle()
      break
    case 'Escape':
      minimize()
      break
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyboard)
  setupVisualizer()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyboard)
})

// Expose methods for parent components
defineExpose({
  open,
  close,
  minimize,
  maximize
})
</script>

<style scoped>
.full-player {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100vh;
  z-index: 200;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg);
  transition: transform var(--transition-base);
}

.full-player.minimized {
  height: 80px;
}

/* Background */
.player-background {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
}

.player-background img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(50px);
  opacity: 0.3;
  transform: scale(1.2);
}

.background-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(var(--color-bg-rgb), 0.9),
    rgba(var(--color-bg-rgb), 0.95)
  );
}

/* Content */
.player-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Header */
.player-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-lg);
  border-bottom: 1px solid var(--color-border);
  background-color: rgba(var(--color-surface-rgb), 0.8);
  backdrop-filter: blur(10px);
}

.header-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
}

.now-playing-label {
  font-size: var(--text-xs);
  text-transform: uppercase;
  color: var(--color-text-tertiary);
  letter-spacing: 0.1em;
}

.album-label {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

/* Main Player Area */
.player-main {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  gap: var(--space-xl);
  padding: var(--space-xl);
  overflow: hidden;
}

/* Left Section */
.player-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
}

.artwork-container {
  position: relative;
  width: 280px;
  height: 280px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}

.album-artwork {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.album-artwork.spinning {
  animation: spin 20s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.visualizer {
  position: absolute;
  inset: 0;
  opacity: 0.7;
}

.track-info {
  text-align: center;
}

.track-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  margin-bottom: var(--space-sm);
}

.track-artist {
  font-size: var(--text-lg);
  color: var(--color-text-secondary);
  text-decoration: none;
}

.track-artist:hover {
  color: var(--color-primary);
  text-decoration: underline;
}

.track-actions {
  display: flex;
  gap: var(--space-sm);
}

.action-btn {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background-color: rgba(var(--color-surface-rgb), 0.8);
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-base);
}

.action-btn:hover {
  background-color: var(--color-surface);
  transform: scale(1.1);
}

.action-btn.active {
  background-color: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

/* Center Section */
.player-center {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-xl);
  padding: var(--space-xl) 0;
}

.progress-container {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.time {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  min-width: 45px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-full);
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.progress-buffered {
  position: absolute;
  height: 100%;
  background-color: var(--color-border);
  opacity: 0.5;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-secondary));
  border-radius: var(--radius-full);
  position: relative;
}

.progress-handle {
  position: absolute;
  right: -6px;
  top: -3px;
  width: 12px;
  height: 12px;
  background-color: white;
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-md);
}

.playback-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-lg);
}

.control-btn {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  border: none;
  background-color: rgba(var(--color-surface-rgb), 0.8);
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-base);
}

.control-btn:hover {
  background-color: var(--color-surface);
  transform: scale(1.05);
}

.control-btn.small {
  width: 36px;
  height: 36px;
  font-size: var(--text-sm);
}

.control-btn.large {
  width: 64px;
  height: 64px;
  font-size: 1.5rem;
}

.control-btn.play-pause {
  background-color: var(--color-primary);
  color: white;
}

.control-btn.play-pause:hover {
  background-color: var(--color-primary-hover);
  transform: scale(1.1);
}

.control-btn.active {
  color: var(--color-primary);
}

.repeat-one {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 8px;
  font-weight: var(--font-bold);
}

.volume-control {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  justify-content: center;
}

.volume-slider {
  width: 120px;
}

.slider {
  width: 100%;
  height: 4px;
  border-radius: var(--radius-full);
  background-color: var(--color-bg-secondary);
  outline: none;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full);
  background-color: var(--color-primary);
  cursor: pointer;
}

.slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full);
  background-color: var(--color-primary);
  cursor: pointer;
  border: none;
}

.volume-value {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  min-width: 30px;
}

.quality-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  justify-content: center;
  margin-top: var(--space-md);
}

.quality-badge {
  padding: var(--space-xs) var(--space-sm);
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.quality-badge.high {
  background-color: var(--color-success);
  color: white;
}

.bitrate {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

/* Right Section - Queue */
.player-right {
  display: flex;
  flex-direction: column;
  background-color: rgba(var(--color-surface-rgb), 0.5);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  overflow: hidden;
}

.queue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.queue-header h3 {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
}

.queue-actions {
  display: flex;
  gap: var(--space-sm);
}

.btn-text {
  background: none;
  border: none;
  color: var(--color-primary);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.btn-text:hover {
  text-decoration: underline;
}

.queue-list {
  flex: 1;
  overflow-y: auto;
  margin-bottom: var(--space-lg);
}

.queue-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--color-text-tertiary);
}

.queue-empty svg {
  font-size: 2rem;
  margin-bottom: var(--space-md);
}

.queue-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
}

.queue-item:hover {
  background-color: var(--color-bg-secondary);
}

.queue-item.current {
  background-color: var(--color-primary-light);
}

.queue-item.playing {
  background-color: var(--color-primary-light);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

.drag-handle {
  color: var(--color-text-tertiary);
  cursor: move;
  opacity: 0;
  transition: opacity var(--transition-base);
}

.queue-item:hover .drag-handle {
  opacity: 1;
}

.queue-item-artwork {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  object-fit: cover;
}

.queue-item-info {
  flex: 1;
  min-width: 0;
}

.queue-item-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-item-artist {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-item-duration {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.queue-item-remove {
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  opacity: 0;
  transition: all var(--transition-base);
}

.queue-item:hover .queue-item-remove {
  opacity: 1;
}

.queue-item-remove:hover {
  color: var(--color-error);
}

.up-next {
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.up-next h4 {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
}

.up-next-track {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.up-next-track img {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  object-fit: cover;
}

.up-next-title {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}

.up-next-artist {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

/* Minimized Player */
.minimized-player {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-md) var(--space-lg);
  height: 80px;
  background-color: var(--color-surface);
  border-top: 1px solid var(--color-border);
}

.minimized-artwork {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  object-fit: cover;
}

.minimized-info {
  flex: 1;
  min-width: 0;
}

.minimized-title {
  font-weight: var(--font-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.minimized-artist {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.minimized-controls {
  display: flex;
  gap: var(--space-sm);
}

.minimized-progress {
  width: 200px;
}

.progress-bar-mini {
  height: 3px;
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar-mini .progress-fill {
  height: 100%;
  background-color: var(--color-primary);
}

/* Utility */
.btn-icon {
  width: 36px;
  height: 36px;
  border: none;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  transition: all var(--transition-base);
}

.btn-icon:hover {
  background-color: var(--color-bg-secondary);
  color: var(--color-text);
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
@media (max-width: 1024px) {
  .player-main {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr auto;
  }
  
  .player-left {
    flex-direction: row;
    justify-content: center;
  }
  
  .artwork-container {
    width: 150px;
    height: 150px;
  }
  
  .player-right {
    position: absolute;
    right: 0;
    top: 80px;
    bottom: 0;
    width: 300px;
    border-radius: 0;
    transform: translateX(100%);
    transition: transform var(--transition-base);
  }
  
  .player-right.open {
    transform: translateX(0);
  }
}

@media (max-width: 768px) {
  .player-main {
    padding: var(--space-md);
  }
  
  .player-left {
    flex-direction: column;
  }
  
  .player-right {
    width: 100%;
  }
  
  .minimized-progress {
    display: none;
  }
}

/* CSS Variables for RGB values (add to themes.css) */
:root {
  --color-bg-rgb: 255, 255, 255;
  --color-surface-rgb: 255, 255, 255;
}

[data-theme="dark"] {
  --color-bg-rgb: 26, 26, 26;
  --color-surface-rgb: 45, 45, 45;
}
</style>