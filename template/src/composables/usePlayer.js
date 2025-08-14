import { ref, computed, watch } from 'vue'
import { Howl, Howler } from 'howler'

// Global player state
const currentTrack = ref(null)
const queue = ref([])
const queueIndex = ref(0)
const isPlaying = ref(false)
const isPaused = ref(false)
const isLoading = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)
const isMuted = ref(false)
const repeatMode = ref('off') // 'off' | 'one' | 'all'
const isShuffled = ref(false)

// Audio instance
let howl = null
let progressInterval = null

export function usePlayer() {
  /**
   * Load and play a track
   */
  async function playTrack(track, addToQueue = true) {
    // Stop current track
    if (howl) {
      howl.unload()
    }
    
    isLoading.value = true
    currentTrack.value = track
    
    // Add to queue if not already there
    if (addToQueue && !queue.value.find(t => t.id === track.id)) {
      queue.value.push(track)
      queueIndex.value = queue.value.length - 1
    }
    
    // Create new Howl instance
    howl = new Howl({
      src: [track.audioUrl || track.streamingUrls?.hls],
      html5: true,
      volume: volume.value,
      onload: () => {
        isLoading.value = false
        duration.value = howl.duration()
      },
      onplay: () => {
        isPlaying.value = true
        isPaused.value = false
        startProgressTracking()
      },
      onpause: () => {
        isPaused.value = true
        stopProgressTracking()
      },
      onstop: () => {
        isPlaying.value = false
        isPaused.value = false
        currentTime.value = 0
        stopProgressTracking()
      },
      onend: () => {
        handleTrackEnd()
      },
      onerror: (id, error) => {
        console.error('Playback error:', error)
        isLoading.value = false
        isPlaying.value = false
      }
    })
    
    // Start playback
    howl.play()
  }

  /**
   * Play/pause toggle
   */
  function togglePlay() {
    if (!howl) return
    
    if (isPlaying.value) {
      pause()
    } else {
      play()
    }
  }

  /**
   * Play current track
   */
  function play() {
    if (!howl) return
    howl.play()
  }

  /**
   * Pause current track
   */
  function pause() {
    if (!howl) return
    howl.pause()
  }

  /**
   * Stop playback
   */
  function stop() {
    if (!howl) return
    howl.stop()
  }

  /**
   * Skip to next track
   */
  function next() {
    if (queue.value.length === 0) return
    
    let nextIndex = queueIndex.value + 1
    
    if (nextIndex >= queue.value.length) {
      if (repeatMode.value === 'all') {
        nextIndex = 0
      } else {
        return
      }
    }
    
    queueIndex.value = nextIndex
    playTrack(queue.value[nextIndex], false)
  }

  /**
   * Skip to previous track
   */
  function previous() {
    if (queue.value.length === 0) return
    
    // If more than 3 seconds in, restart current track
    if (currentTime.value > 3) {
      seek(0)
      return
    }
    
    let prevIndex = queueIndex.value - 1
    
    if (prevIndex < 0) {
      if (repeatMode.value === 'all') {
        prevIndex = queue.value.length - 1
      } else {
        prevIndex = 0
      }
    }
    
    queueIndex.value = prevIndex
    playTrack(queue.value[prevIndex], false)
  }

  /**
   * Seek to specific time
   */
  function seek(time) {
    if (!howl) return
    howl.seek(time)
    currentTime.value = time
  }

  /**
   * Set volume (0-1)
   */
  function setVolume(val) {
    volume.value = Math.max(0, Math.min(1, val))
    if (howl) {
      howl.volume(volume.value)
    }
    Howler.volume(volume.value)
  }

  /**
   * Toggle mute
   */
  function toggleMute() {
    isMuted.value = !isMuted.value
    if (howl) {
      howl.mute(isMuted.value)
    }
    Howler.mute(isMuted.value)
  }

  /**
   * Set repeat mode
   */
  function setRepeatMode(mode) {
    repeatMode.value = mode
  }

  /**
   * Toggle shuffle
   */
  function toggleShuffle() {
    isShuffled.value = !isShuffled.value
    
    if (isShuffled.value) {
      // Shuffle remaining tracks in queue
      const currentTrackItem = queue.value[queueIndex.value]
      const beforeCurrent = queue.value.slice(0, queueIndex.value)
      const afterCurrent = queue.value.slice(queueIndex.value + 1)
      
      // Shuffle after current
      for (let i = afterCurrent.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [afterCurrent[i], afterCurrent[j]] = [afterCurrent[j], afterCurrent[i]]
      }
      
      queue.value = [...beforeCurrent, currentTrackItem, ...afterCurrent]
    }
  }

  /**
   * Add track to queue
   */
  function addToQueue(track) {
    queue.value.push(track)
  }

  /**
   * Remove track from queue
   */
  function removeFromQueue(index) {
    if (index === queueIndex.value) {
      // If removing current track, play next
      next()
    }
    
    queue.value.splice(index, 1)
    
    // Adjust queue index if needed
    if (index < queueIndex.value) {
      queueIndex.value--
    }
  }

  /**
   * Clear queue
   */
  function clearQueue() {
    queue.value = []
    queueIndex.value = 0
    stop()
  }

  /**
   * Handle track end
   */
  function handleTrackEnd() {
    if (repeatMode.value === 'one') {
      // Replay current track
      playTrack(currentTrack.value, false)
    } else {
      // Play next track
      next()
    }
  }

  /**
   * Start progress tracking
   */
  function startProgressTracking() {
    stopProgressTracking()
    progressInterval = setInterval(() => {
      if (howl && isPlaying.value) {
        currentTime.value = howl.seek()
      }
    }, 100)
  }

  /**
   * Stop progress tracking
   */
  function stopProgressTracking() {
    if (progressInterval) {
      clearInterval(progressInterval)
      progressInterval = null
    }
  }

  // Computed properties
  const progress = computed(() => {
    if (duration.value === 0) return 0
    return (currentTime.value / duration.value) * 100
  })

  const formattedCurrentTime = computed(() => formatTime(currentTime.value))
  const formattedDuration = computed(() => formatTime(duration.value))

  /**
   * Format seconds to mm:ss
   */
  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  return {
    // State
    currentTrack,
    queue,
    queueIndex,
    isPlaying,
    isPaused,
    isLoading,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffled,
    
    // Computed
    progress,
    formattedCurrentTime,
    formattedDuration,
    
    // Methods
    playTrack,
    togglePlay,
    play,
    pause,
    stop,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    setRepeatMode,
    toggleShuffle,
    addToQueue,
    removeFromQueue,
    clearQueue
  }
}