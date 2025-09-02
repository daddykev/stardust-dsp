<!-- template/src/views/PlaylistDetail.vue -->
<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { usePlayer } from '@/composables/usePlayer'
import { useLibrary } from '@/composables/useLibrary'
import { useSocial } from '@/composables/useSocial'
import { db } from '@/firebase'
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore'
import draggable from 'vuedraggable'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const player = usePlayer()
const library = useLibrary()
const social = useSocial()

// State
const playlistId = ref(route.params.id)
const playlist = ref({})
const ownerProfile = ref({})
const collaborators = ref([])
const isLiked = ref(false)
const searchQuery = ref('')
const sortBy = ref('custom')
const showSortMenu = ref(false)
const selectedTracks = ref([])
const contextMenu = ref({ show: false, x: 0, y: 0, track: null })

// Editing states
const isEditingTitle = ref(false)
const isEditingDescription = ref(false)
const editedTitle = ref('')
const editedDescription = ref('')
const titleInput = ref(null)
const descriptionInput = ref(null)

// Sort options
const sortOptions = [
  { value: 'custom', label: 'Custom Order' },
  { value: 'title', label: 'Title' },
  { value: 'artist', label: 'Artist' },
  { value: 'album', label: 'Album' },
  { value: 'added', label: 'Recently Added' },
  { value: 'duration', label: 'Duration' }
]

// Computed
const isOwner = computed(() => {
  return playlist.value.userId === auth.user.value?.uid
})

const canEdit = computed(() => {
  return isOwner.value || (playlist.value.collaborative && isCollaborator.value)
})

const isCollaborator = computed(() => {
  return collaborators.value.some(c => c.id === auth.user.value?.uid)
})

const isPlaying = computed(() => player.isPlaying.value)

const sortLabel = computed(() => {
  return sortOptions.find(o => o.value === sortBy.value)?.label || 'Custom Order'
})

const filteredTracks = computed({
  get() {
    let tracks = [...(playlist.value.tracks || [])]
    
    // Apply search filter
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      tracks = tracks.filter(track => 
        track.title.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query) ||
        track.albumTitle?.toLowerCase().includes(query)
      )
    }
    
    // Apply sorting
    switch (sortBy.value) {
      case 'title':
        tracks.sort((a, b) => a.title.localeCompare(b.title))
        break
      case 'artist':
        tracks.sort((a, b) => a.artist.localeCompare(b.artist))
        break
      case 'album':
        tracks.sort((a, b) => (a.albumTitle || '').localeCompare(b.albumTitle || ''))
        break
      case 'added':
        tracks.sort((a, b) => b.addedAt - a.addedAt)
        break
      case 'duration':
        tracks.sort((a, b) => b.duration - a.duration)
        break
    }
    
    return tracks
  },
  set(value) {
    playlist.value.tracks = value
  }
})

const totalDuration = computed(() => {
  return playlist.value.tracks?.reduce((sum, track) => sum + (track.duration || 0), 0) || 0
})

// Load playlist data
async function loadPlaylist() {
  try {
    const docRef = doc(db, 'playlists', playlistId.value)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      playlist.value = { id: docSnap.id, ...docSnap.data() }
      
      // Load owner profile
      if (playlist.value.userId) {
        const userDoc = await getDoc(doc(db, 'users', playlist.value.userId))
        if (userDoc.exists()) {
          ownerProfile.value = { id: userDoc.id, ...userDoc.data() }
        }
      }
      
      // Load collaborators
      if (playlist.value.collaborators?.length > 0) {
        const collabPromises = playlist.value.collaborators.map(userId =>
          getDoc(doc(db, 'users', userId))
        )
        const collabDocs = await Promise.all(collabPromises)
        collaborators.value = collabDocs
          .filter(doc => doc.exists())
          .map(doc => ({ id: doc.id, ...doc.data() }))
      }
      
      // Check if liked
      isLiked.value = await library.isFavorite(playlistId.value, 'playlists')
      
      // Set up real-time listener
      setupRealtimeUpdates()
    } else {
      console.error('Playlist not found')
      router.push('/library')
    }
  } catch (error) {
    console.error('Error loading playlist:', error)
  }
}

// Real-time updates for collaborative playlists
function setupRealtimeUpdates() {
  if (!playlist.value.collaborative) return
  
  const docRef = doc(db, 'playlists', playlistId.value)
  onSnapshot(docRef, (doc) => {
    if (doc.exists()) {
      const data = doc.data()
      // Update tracks while preserving local edits
      if (JSON.stringify(data.tracks) !== JSON.stringify(playlist.value.tracks)) {
        playlist.value.tracks = data.tracks
      }
    }
  })
}

// Playlist actions
function playAll() {
  if (!playlist.value.tracks?.length) return
  
  player.clearQueue()
  playlist.value.tracks.forEach(track => player.addToQueue(track))
  player.playTrack(playlist.value.tracks[0])
}

function shufflePlay() {
  if (!playlist.value.tracks?.length) return
  
  player.clearQueue()
  const shuffled = [...playlist.value.tracks].sort(() => Math.random() - 0.5)
  shuffled.forEach(track => player.addToQueue(track))
  player.playTrack(shuffled[0])
}

async function toggleLike() {
  if (isLiked.value) {
    await library.removeFavorite(playlistId.value, 'playlists')
  } else {
    await library.addFavorite(playlistId.value, 'playlists')
  }
  isLiked.value = !isLiked.value
}

function sharePlaylist() {
  const url = window.location.href
  navigator.clipboard.writeText(url)
  console.log('Playlist link copied')
  
  // Also create social activity
  social.shareContent('playlist', playlistId.value)
}

function showOptions() {
  // TODO: Show playlist options menu
  console.log('Show playlist options')
}

// Track actions
function playTrack(track) {
  player.playTrack(track)
}

function isCurrentTrack(track) {
  return player.currentTrack.value?.id === track.id
}

function selectTrack(track, event) {
  if (event.shiftKey && selectedTracks.value.length > 0) {
    // Multi-select with shift
    const tracks = filteredTracks.value
    const lastSelected = selectedTracks.value[selectedTracks.value.length - 1]
    const lastIndex = tracks.findIndex(t => t.id === lastSelected)
    const currentIndex = tracks.findIndex(t => t.id === track.id)
    
    const start = Math.min(lastIndex, currentIndex)
    const end = Math.max(lastIndex, currentIndex)
    
    for (let i = start; i <= end; i++) {
      if (!selectedTracks.value.includes(tracks[i].id)) {
        selectedTracks.value.push(tracks[i].id)
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
}

async function removeTrack(track) {
  if (!canEdit.value) return
  
  const index = playlist.value.tracks.findIndex(t => t.id === track.id)
  if (index > -1) {
    playlist.value.tracks.splice(index, 1)
    await savePlaylist()
  }
}

function toggleTrackLike(track) {
  // TODO: Implement track like
  track.isLiked = !track.isLiked
}

function showTrackOptions(track) {
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    track
  }
}

// Editing functions
function startEditingTitle() {
  if (!isOwner.value) return
  isEditingTitle.value = true
  editedTitle.value = playlist.value.title
  setTimeout(() => titleInput.value?.focus(), 0)
}

async function saveTitle() {
  if (editedTitle.value && editedTitle.value !== playlist.value.title) {
    playlist.value.title = editedTitle.value
    await savePlaylist()
  }
  isEditingTitle.value = false
}

function cancelEditingTitle() {
  isEditingTitle.value = false
  editedTitle.value = ''
}

function startEditingDescription() {
  if (!isOwner.value) return
  isEditingDescription.value = true
  editedDescription.value = playlist.value.description || ''
  setTimeout(() => descriptionInput.value?.focus(), 0)
}

async function saveDescription() {
  if (editedDescription.value !== playlist.value.description) {
    playlist.value.description = editedDescription.value
    await savePlaylist()
  }
  isEditingDescription.value = false
}

function cancelEditingDescription() {
  isEditingDescription.value = false
  editedDescription.value = ''
}

function changeCover() {
  // TODO: Implement cover upload
  console.log('Change playlist cover')
}

// Save playlist changes
async function savePlaylist() {
  if (!canEdit.value) return
  
  try {
    const docRef = doc(db, 'playlists', playlistId.value)
    await updateDoc(docRef, {
      title: playlist.value.title,
      description: playlist.value.description,
      tracks: playlist.value.tracks,
      updatedAt: new Date()
    })
  } catch (error) {
    console.error('Error saving playlist:', error)
  }
}

// Reorder tracks
async function onReorder(event) {
  if (!canEdit.value) return
  
  // Tracks are already reordered by draggable
  await savePlaylist()
}

// Sort functions
function setSortBy(value) {
  sortBy.value = value
  showSortMenu.value = false
}

// Navigation
function browseSongs() {
  router.push('/browse')
}

function importFromLibrary() {
  // TODO: Show import from library modal
  console.log('Import from library')
}

function importPlaylist() {
  // TODO: Show import playlist modal
  console.log('Import playlist')
}

function inviteCollaborator() {
  // TODO: Show invite collaborator modal
  console.log('Invite collaborator')
}

function viewProfile(userId) {
  router.push(`/profile/${userId}`)
}

// Context menu actions
function addToQueue() {
  if (contextMenu.value.track) {
    player.addToQueue(contextMenu.value.track)
  }
  contextMenu.value.show = false
}

function addToPlaylist() {
  // TODO: Show add to playlist modal
  console.log('Add to playlist')
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

function share() {
  // TODO: Share track
  console.log('Share track')
  contextMenu.value.show = false
}

function removeFromPlaylist() {
  if (contextMenu.value.track) {
    removeTrack(contextMenu.value.track)
  }
  contextMenu.value.show = false
}

// Utility functions
function formatDuration(seconds) {
  if (!seconds) return '0 min'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours} hr ${minutes} min`
  }
  return `${minutes} min`
}

function formatTrackDuration(seconds) {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatDate(date) {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
  })
}

function handleImageError(e) {
  e.target.src = '/placeholder-album.png'
}

// Click outside to close context menu
onMounted(() => {
  loadPlaylist()
  
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.context-menu')) {
      contextMenu.value.show = false
    }
  })
})

// Clean up
onUnmounted(() => {
  document.removeEventListener('click', () => {})
})
</script>

<template>
  <div class="playlist-detail-page">
    <!-- Playlist Header -->
    <div class="playlist-header">
      <div class="playlist-cover-section">
        <div class="playlist-cover" @click="isOwner && changeCover()">
          <img 
            v-if="playlist.coverUrl" 
            :src="playlist.coverUrl" 
            :alt="playlist.title"
            @error="handleImageError"
          />
          <div v-else class="playlist-cover-placeholder">
            <font-awesome-icon icon="music" />
          </div>
          <div v-if="isOwner" class="cover-overlay">
            <font-awesome-icon icon="camera" />
            <span>Change Cover</span>
          </div>
        </div>
      </div>

      <div class="playlist-info">
        <div class="playlist-type">
          <span class="badge">Playlist</span>
          <span v-if="playlist.public" class="badge public">Public</span>
          <span v-if="playlist.collaborative" class="badge collab">Collaborative</span>
        </div>

        <h1 
          v-if="!isEditingTitle"
          @click="isOwner && startEditingTitle()"
          :class="{ editable: isOwner }"
        >
          {{ playlist.title || 'Untitled Playlist' }}
        </h1>
        <input 
          v-else
          v-model="editedTitle"
          @blur="saveTitle"
          @keyup.enter="saveTitle"
          @keyup.esc="cancelEditingTitle"
          class="title-input"
          ref="titleInput"
        />

        <p 
          v-if="!isEditingDescription"
          @click="isOwner && startEditingDescription()"
          :class="['playlist-description', { editable: isOwner }]"
        >
          {{ playlist.description || (isOwner ? 'Add a description' : '') }}
        </p>
        <textarea 
          v-else
          v-model="editedDescription"
          @blur="saveDescription"
          @keyup.esc="cancelEditingDescription"
          class="description-input"
          ref="descriptionInput"
          rows="3"
        />

        <div class="playlist-meta">
          <router-link :to="`/profile/${playlist.userId}`" class="playlist-owner">
            <img 
              :src="ownerProfile.avatar || '/default-avatar.png'" 
              :alt="ownerProfile.displayName"
              class="owner-avatar"
            />
            {{ ownerProfile.displayName }}
          </router-link>
          <span class="separator">•</span>
          <span>{{ playlist.tracks?.length || 0 }} songs</span>
          <span class="separator">•</span>
          <span>{{ formatDuration(totalDuration) }}</span>
        </div>

        <div class="playlist-actions">
          <button @click="playAll" class="btn btn-primary btn-lg">
            <font-awesome-icon icon="play" />
            Play
          </button>
          <button @click="shufflePlay" class="btn btn-secondary btn-lg">
            <font-awesome-icon icon="random" />
            Shuffle
          </button>
          <button 
            @click="toggleLike" 
            class="btn btn-icon btn-lg"
            :class="{ liked: isLiked }"
          >
            <font-awesome-icon :icon="isLiked ? 'heart' : ['far', 'heart']" />
          </button>
          <button @click="sharePlaylist" class="btn btn-icon btn-lg">
            <font-awesome-icon icon="share" />
          </button>
          <button @click="showOptions" class="btn btn-icon btn-lg">
            <font-awesome-icon icon="ellipsis-h" />
          </button>
        </div>

        <!-- Collaborators -->
        <div v-if="playlist.collaborative && collaborators.length > 0" class="collaborators">
          <h4>Collaborators</h4>
          <div class="collaborator-list">
            <div 
              v-for="user in collaborators" 
              :key="user.id"
              class="collaborator"
              @click="viewProfile(user.id)"
            >
              <img :src="user.avatar || '/default-avatar.png'" :alt="user.displayName" />
              <span class="tooltip">{{ user.displayName }}</span>
            </div>
            <button v-if="isOwner" @click="inviteCollaborator" class="add-collaborator">
              <font-awesome-icon icon="plus" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Search/Filter Bar -->
    <div class="playlist-controls">
      <div class="search-box">
        <font-awesome-icon icon="search" />
        <input 
          v-model="searchQuery"
          type="text"
          placeholder="Search in playlist..."
        />
      </div>
      <div class="sort-controls">
        <button @click="showSortMenu = !showSortMenu" class="btn-sort">
          <font-awesome-icon icon="sort" />
          {{ sortLabel }}
        </button>
        <div v-if="showSortMenu" class="sort-menu">
          <button 
            v-for="option in sortOptions" 
            :key="option.value"
            @click="setSortBy(option.value)"
            :class="{ active: sortBy === option.value }"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Track List -->
    <div class="playlist-tracks">
      <!-- Headers -->
      <div class="track-list-header">
        <div class="track-number">#</div>
        <div class="track-title">Title</div>
        <div class="track-album">Album</div>
        <div class="track-date">Date Added</div>
        <div class="track-duration">
          <font-awesome-icon icon="clock" />
        </div>
        <div class="track-actions"></div>
      </div>

      <!-- Tracks -->
      <draggable 
        v-model="filteredTracks"
        @change="onReorder"
        item-key="id"
        :disabled="!canEdit"
        handle=".drag-handle"
      >
        <template #item="{ element: track, index }">
          <div 
            class="track-item"
            :class="{ 
              playing: isCurrentTrack(track),
              selected: selectedTracks.includes(track.id)
            }"
            @click="selectTrack(track, $event)"
            @dblclick="playTrack(track)"
          >
            <div class="track-number">
              <span v-if="canEdit" class="drag-handle">
                <font-awesome-icon icon="grip-vertical" />
              </span>
              <span v-if="!isCurrentTrack(track)" class="track-index">
                {{ index + 1 }}
              </span>
              <font-awesome-icon 
                v-else 
                :icon="isPlaying ? 'pause' : 'play'"
                class="playing-icon"
              />
            </div>
            
            <div class="track-title">
              <img 
                :src="track.artworkUrl || '/placeholder-album.png'" 
                :alt="track.title"
                class="track-artwork"
              />
              <div class="track-info">
                <div class="track-name">{{ track.title }}</div>
                <div class="track-artist">{{ track.artist }}</div>
              </div>
            </div>
            
            <div class="track-album">
              <router-link 
                v-if="track.albumId"
                :to="`/releases/${track.albumId}`"
                class="album-link"
              >
                {{ track.albumTitle }}
              </router-link>
            </div>
            
            <div class="track-date">
              {{ formatDate(track.addedAt) }}
            </div>
            
            <div class="track-duration">
              {{ formatTrackDuration(track.duration) }}
            </div>
            
            <div class="track-actions">
              <button 
                @click.stop="toggleTrackLike(track)" 
                class="btn-icon-sm"
                :class="{ liked: track.isLiked }"
              >
                <font-awesome-icon :icon="track.isLiked ? 'heart' : ['far', 'heart']" />
              </button>
              <button 
                @click.stop="showTrackOptions(track)" 
                class="btn-icon-sm"
              >
                <font-awesome-icon icon="ellipsis-h" />
              </button>
              <button 
                v-if="canEdit"
                @click.stop="removeTrack(track)" 
                class="btn-icon-sm remove"
              >
                <font-awesome-icon icon="times" />
              </button>
            </div>
          </div>
        </template>
      </draggable>

      <!-- Empty State -->
      <div v-if="!playlist.tracks || playlist.tracks.length === 0" class="empty-playlist">
        <font-awesome-icon icon="music" />
        <h3>This playlist is empty</h3>
        <p v-if="isOwner">Start adding songs to build your perfect playlist</p>
        <button v-if="isOwner" @click="browseSongs" class="btn btn-primary">
          Browse Songs
        </button>
      </div>

      <!-- No Results -->
      <div v-else-if="searchQuery && filteredTracks.length === 0" class="no-results">
        <p>No tracks match "{{ searchQuery }}"</p>
      </div>
    </div>

    <!-- Add Songs Section (for owners/collaborators) -->
    <div v-if="canEdit" class="add-songs-section">
      <h3>Add Songs</h3>
      <div class="add-songs-actions">
        <button @click="browseSongs" class="btn btn-secondary">
          <font-awesome-icon icon="search" />
          Find Songs
        </button>
        <button @click="importFromLibrary" class="btn btn-secondary">
          <font-awesome-icon icon="heart" />
          From Liked Songs
        </button>
        <button @click="importPlaylist" class="btn btn-secondary">
          <font-awesome-icon icon="list" />
          Import Playlist
        </button>
      </div>
    </div>

    <!-- Context Menu -->
    <div 
      v-if="contextMenu.show" 
      class="context-menu"
      :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
      @click="contextMenu.show = false"
    >
      <button @click="addToQueue">
        <font-awesome-icon icon="plus" />
        Add to Queue
      </button>
      <button @click="addToPlaylist">
        <font-awesome-icon icon="list" />
        Add to Playlist
      </button>
      <button @click="goToArtist">
        <font-awesome-icon icon="user" />
        Go to Artist
      </button>
      <button @click="goToAlbum">
        <font-awesome-icon icon="compact-disc" />
        Go to Album
      </button>
      <button @click="share">
        <font-awesome-icon icon="share" />
        Share
      </button>
      <button v-if="canEdit" @click="removeFromPlaylist" class="danger">
        <font-awesome-icon icon="trash" />
        Remove from Playlist
      </button>
    </div>
  </div>
</template>

<style scoped>
.playlist-detail-page {
  padding: var(--space-lg);
  max-width: 1400px;
  margin: 0 auto;
}

/* Header */
.playlist-header {
  display: flex;
  gap: var(--space-xl);
  margin-bottom: var(--space-xl);
  padding: var(--space-xl);
  background: linear-gradient(180deg, var(--color-bg-secondary), transparent);
  border-radius: var(--radius-lg);
}

.playlist-cover-section {
  flex-shrink: 0;
}

.playlist-cover {
  width: 232px;
  height: 232px;
  border-radius: var(--radius-md);
  overflow: hidden;
  position: relative;
  cursor: pointer;
  box-shadow: 0 4px 60px rgba(0, 0, 0, 0.5);
}

.playlist-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.playlist-cover-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 4rem;
  color: white;
}

.cover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  color: white;
  opacity: 0;
  transition: opacity var(--transition-base);
}

.playlist-cover:hover .cover-overlay {
  opacity: 1;
}

.playlist-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.playlist-type {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.badge {
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  text-transform: uppercase;
  font-weight: var(--font-semibold);
}

.badge.public {
  background: var(--color-success);
  color: white;
}

.badge.collab {
  background: var(--color-primary);
  color: white;
}

.playlist-info h1 {
  font-size: var(--text-4xl);
  font-weight: var(--font-bold);
  margin-bottom: var(--space-md);
  cursor: text;
}

.playlist-info h1.editable:hover {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-sm);
  padding: var(--space-xs);
  margin: -var(--space-xs);
}

.title-input {
  font-size: var(--text-4xl);
  font-weight: var(--font-bold);
  background: var(--color-bg-secondary);
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-sm);
  padding: var(--space-xs);
  margin: -var(--space-xs);
  width: 100%;
}

.playlist-description {
  color: var(--color-text-secondary);
  margin-bottom: var(--space-md);
  cursor: text;
  min-height: 1.5em;
}

.playlist-description.editable:hover {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-sm);
  padding: var(--space-xs);
  margin: -var(--space-xs);
}

.description-input {
  width: 100%;
  background: var(--color-bg-secondary);
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-sm);
  padding: var(--space-sm);
  resize: none;
  font-family: inherit;
}

.playlist-meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.playlist-owner {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  color: inherit;
  text-decoration: none;
  font-weight: var(--font-medium);
}

.playlist-owner:hover {
  text-decoration: underline;
}

.owner-avatar {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
}

.separator {
  opacity: 0.5;
}

.playlist-actions {
  display: flex;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.btn-lg {
  padding: var(--space-sm) var(--space-lg);
}

.btn-icon.liked {
  color: var(--color-primary);
}

/* Collaborators */
.collaborators h4 {
  font-size: var(--text-sm);
  text-transform: uppercase;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
}

.collaborator-list {
  display: flex;
  gap: var(--space-sm);
}

.collaborator {
  position: relative;
  cursor: pointer;
}

.collaborator img {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  border: 2px solid var(--color-surface);
}

.collaborator:hover .tooltip {
  opacity: 1;
  transform: translateY(0);
}

.tooltip {
  position: absolute;
  bottom: -28px;
  left: 50%;
  transform: translateX(-50%) translateY(5px);
  background: var(--color-bg-tertiary);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  white-space: nowrap;
  opacity: 0;
  transition: all var(--transition-base);
  pointer-events: none;
}

.add-collaborator {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  border: 2px dashed var(--color-border);
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Controls */
.playlist-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.search-box {
  position: relative;
  width: 300px;
}

.search-box svg {
  position: absolute;
  left: var(--space-md);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-secondary);
}

.search-box input {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  padding-left: calc(var(--space-md) + 20px);
  background: var(--color-bg-secondary);
  border: none;
  border-radius: var(--radius-md);
}

.sort-controls {
  position: relative;
}

.btn-sort {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-secondary);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.sort-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: var(--space-xs);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 10;
}

.sort-menu button {
  display: block;
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-base);
}

.sort-menu button:hover {
  background: var(--color-bg-secondary);
}

.sort-menu button.active {
  color: var(--color-primary);
  font-weight: var(--font-medium);
}

/* Track list */
.playlist-tracks {
  margin-bottom: var(--space-xl);
}

.track-list-header {
  display: grid;
  grid-template-columns: 40px 4fr 2fr 1.5fr 80px 100px;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--text-xs);
  text-transform: uppercase;
  color: var(--color-text-secondary);
  letter-spacing: 0.1em;
}

.track-item {
  display: grid;
  grid-template-columns: 40px 4fr 2fr 1.5fr 80px 100px;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm);
  transition: background var(--transition-base);
  cursor: pointer;
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

.track-number {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
}

.drag-handle {
  cursor: move;
  opacity: 0;
  transition: opacity var(--transition-base);
}

.track-item:hover .drag-handle {
  opacity: 1;
}

.track-item:hover .track-index {
  display: none;
}

.track-item:hover .drag-handle {
  display: block;
}

.playing-icon {
  color: var(--color-primary);
}

.track-title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.track-artwork {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  object-fit: cover;
}

.track-info {
  overflow: hidden;
}

.track-name {
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
  display: flex;
  align-items: center;
  overflow: hidden;
}

.album-link {
  color: var(--color-text-secondary);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album-link:hover {
  text-decoration: underline;
}

.track-date {
  display: flex;
  align-items: center;
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.track-duration {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.track-actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.track-item:hover .track-actions {
  opacity: 1;
}

.btn-icon-sm {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--space-xs);
  transition: color var(--transition-base);
}

.btn-icon-sm:hover {
  color: var(--color-text-primary);
}

.btn-icon-sm.liked {
  color: var(--color-primary);
}

.btn-icon-sm.remove:hover {
  color: var(--color-error);
}

/* Empty states */
.empty-playlist,
.no-results {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-text-secondary);
}

.empty-playlist svg {
  font-size: 3rem;
  margin-bottom: var(--space-lg);
  opacity: 0.5;
}

.empty-playlist h3 {
  margin-bottom: var(--space-sm);
}

/* Add songs section */
.add-songs-section {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.add-songs-section h3 {
  margin-bottom: var(--space-md);
}

.add-songs-actions {
  display: flex;
  gap: var(--space-md);
}

/* Context menu */
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
  .playlist-header {
    flex-direction: column;
    text-align: center;
  }
  
  .playlist-cover {
    margin: 0 auto;
  }
  
  .track-list-header,
  .track-item {
    grid-template-columns: 40px 1fr 80px;
  }
  
  .track-album,
  .track-date,
  .track-actions {
    display: none;
  }
}
</style>