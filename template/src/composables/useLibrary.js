import { ref, computed, watch } from 'vue'
import { 
  collection, 
  doc, 
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query, 
  where, 
  orderBy, 
  limit,
  getDocs,
  addDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  onSnapshot
} from 'firebase/firestore'
import { db, auth } from '../firebase'
import { useAuth } from './useAuth'

// Global library state
const favorites = ref({
  tracks: [],
  albums: [],
  artists: [],
  playlists: []
})

const playlists = ref([])
const recentlyPlayed = ref([])
const isLoading = ref(false)
const error = ref(null)

// Active subscriptions
let favoritesUnsubscribe = null
let playlistsUnsubscribe = null
let historyUnsubscribe = null

export function useLibrary() {
  const { user } = useAuth()
  
  /**
   * Initialize library data and subscriptions
   */
  async function initLibrary() {
    if (!user.value) {
      clearLibrary()
      return
    }
    
    isLoading.value = true
    error.value = null
    
    try {
      // Set up real-time listeners
      setupFavoritesListener()
      setupPlaylistsListener()
      setupHistoryListener()
      
      // Load initial data
      await Promise.all([
        loadFavorites(),
        loadPlaylists(),
        loadRecentlyPlayed()
      ])
      
    } catch (err) {
      console.error('Error initializing library:', err)
      error.value = err.message
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Clear library data and unsubscribe
   */
  function clearLibrary() {
    favorites.value = {
      tracks: [],
      albums: [],
      artists: [],
      playlists: []
    }
    playlists.value = []
    recentlyPlayed.value = []
    
    // Unsubscribe from listeners
    if (favoritesUnsubscribe) favoritesUnsubscribe()
    if (playlistsUnsubscribe) playlistsUnsubscribe()
    if (historyUnsubscribe) historyUnsubscribe()
  }
  
  /**
   * Set up real-time favorites listener
   */
  function setupFavoritesListener() {
    if (!user.value) return
    
    const favoritesRef = doc(db, 'users', user.value.uid, 'library', 'favorites')
    
    favoritesUnsubscribe = onSnapshot(favoritesRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data()
        favorites.value = {
          tracks: data.tracks || [],
          albums: data.albums || [],
          artists: data.artists || [],
          playlists: data.playlists || []
        }
      }
    })
  }
  
  /**
   * Set up real-time playlists listener
   */
  function setupPlaylistsListener() {
    if (!user.value) return
    
    const q = query(
      collection(db, 'playlists'),
      where('userId', '==', user.value.uid),
      orderBy('updatedAt', 'desc')
    )
    
    playlistsUnsubscribe = onSnapshot(q, (snapshot) => {
      playlists.value = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    })
  }
  
  /**
   * Set up real-time history listener
   */
  function setupHistoryListener() {
    if (!user.value) return
    
    const q = query(
      collection(db, 'users', user.value.uid, 'history'),
      orderBy('playedAt', 'desc'),
      limit(50)
    )
    
    historyUnsubscribe = onSnapshot(q, (snapshot) => {
      recentlyPlayed.value = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    })
  }
  
  /**
   * Load user's favorites
   */
  async function loadFavorites() {
    if (!user.value) return
    
    try {
      const favoritesRef = doc(db, 'users', user.value.uid, 'library', 'favorites')
      const favoritesDoc = await getDoc(favoritesRef)
      
      if (favoritesDoc.exists()) {
        const data = favoritesDoc.data()
        favorites.value = {
          tracks: data.tracks || [],
          albums: data.albums || [],
          artists: data.artists || [],
          playlists: data.playlists || []
        }
      } else {
        // Create favorites document if it doesn't exist
        await setDoc(favoritesRef, {
          tracks: [],
          albums: [],
          artists: [],
          playlists: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      }
    } catch (err) {
      console.error('Error loading favorites:', err)
      throw err
    }
  }
  
  /**
   * Load user's playlists
   */
  async function loadPlaylists() {
    if (!user.value) return
    
    try {
      const q = query(
        collection(db, 'playlists'),
        where('userId', '==', user.value.uid),
        orderBy('updatedAt', 'desc')
      )
      
      const snapshot = await getDocs(q)
      playlists.value = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (err) {
      console.error('Error loading playlists:', err)
      throw err
    }
  }
  
  /**
   * Load recently played tracks
   */
  async function loadRecentlyPlayed() {
    if (!user.value) return
    
    try {
      const q = query(
        collection(db, 'users', user.value.uid, 'history'),
        orderBy('playedAt', 'desc'),
        limit(50)
      )
      
      const snapshot = await getDocs(q)
      recentlyPlayed.value = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (err) {
      console.error('Error loading history:', err)
      throw err
    }
  }
  
  /**
   * Toggle favorite status for an item
   */
  async function toggleFavorite(item, type) {
    if (!user.value) return false
    
    try {
      const favoritesRef = doc(db, 'users', user.value.uid, 'library', 'favorites')
      const isFavorite = checkIsFavorite(item.id, type)
      
      if (isFavorite) {
        // Remove from favorites
        await updateDoc(favoritesRef, {
          [type]: arrayRemove(item.id),
          updatedAt: serverTimestamp()
        })
        
        // Update local state
        favorites.value[type] = favorites.value[type].filter(id => id !== item.id)
        
        return false
      } else {
        // Add to favorites
        await updateDoc(favoritesRef, {
          [type]: arrayUnion(item.id),
          updatedAt: serverTimestamp()
        })
        
        // Update local state
        favorites.value[type].push(item.id)
        
        // Also save item details for quick access
        await setDoc(
          doc(db, 'users', user.value.uid, 'library', `${type}_details`, item.id),
          {
            ...item,
            savedAt: serverTimestamp()
          }
        )
        
        return true
      }
    } catch (err) {
      console.error(`Error toggling favorite ${type}:`, err)
      throw err
    }
  }
  
  /**
   * Check if an item is favorited
   */
  function checkIsFavorite(itemId, type) {
    return favorites.value[type]?.includes(itemId) || false
  }
  
  /**
   * Get favorite items with details
   */
  async function getFavoriteItems(type) {
    if (!user.value) return []
    
    try {
      const itemIds = favorites.value[type] || []
      if (itemIds.length === 0) return []
      
      // Fetch details for each favorite item
      const items = []
      for (const itemId of itemIds) {
        // First try to get from saved details
        const detailDoc = await getDoc(
          doc(db, 'users', user.value.uid, 'library', `${type}_details`, itemId)
        )
        
        if (detailDoc.exists()) {
          items.push({ id: detailDoc.id, ...detailDoc.data() })
        } else {
          // Fallback to main collection
          const itemDoc = await getDoc(doc(db, type, itemId))
          if (itemDoc.exists()) {
            items.push({ id: itemDoc.id, ...itemDoc.data() })
          }
        }
      }
      
      return items
    } catch (err) {
      console.error(`Error fetching favorite ${type}:`, err)
      return []
    }
  }
  
  /**
   * Create a new playlist
   */
  async function createPlaylist(data) {
    if (!user.value) throw new Error('Authentication required')
    
    try {
      const playlistData = {
        userId: user.value.uid,
        title: data.title || 'New Playlist',
        description: data.description || '',
        cover: data.cover || null,
        public: data.public || false,
        collaborative: data.collaborative || false,
        tracks: data.tracks || [],
        followers: 0,
        plays: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
      
      const docRef = await addDoc(collection(db, 'playlists'), playlistData)
      const newPlaylist = { id: docRef.id, ...playlistData }
      
      // Add to local state
      playlists.value.unshift(newPlaylist)
      
      return newPlaylist
    } catch (err) {
      console.error('Error creating playlist:', err)
      throw err
    }
  }
  
  /**
   * Update playlist details
   */
  async function updatePlaylist(playlistId, updates) {
    if (!user.value) throw new Error('Authentication required')
    
    try {
      const playlistRef = doc(db, 'playlists', playlistId)
      
      // Verify ownership
      const playlistDoc = await getDoc(playlistRef)
      if (!playlistDoc.exists() || playlistDoc.data().userId !== user.value.uid) {
        throw new Error('Playlist not found or access denied')
      }
      
      await updateDoc(playlistRef, {
        ...updates,
        updatedAt: serverTimestamp()
      })
      
      // Update local state
      const index = playlists.value.findIndex(p => p.id === playlistId)
      if (index >= 0) {
        playlists.value[index] = { ...playlists.value[index], ...updates }
      }
      
      return true
    } catch (err) {
      console.error('Error updating playlist:', err)
      throw err
    }
  }
  
  /**
   * Delete a playlist
   */
  async function deletePlaylist(playlistId) {
    if (!user.value) throw new Error('Authentication required')
    
    try {
      const playlistRef = doc(db, 'playlists', playlistId)
      
      // Verify ownership
      const playlistDoc = await getDoc(playlistRef)
      if (!playlistDoc.exists() || playlistDoc.data().userId !== user.value.uid) {
        throw new Error('Playlist not found or access denied')
      }
      
      await deleteDoc(playlistRef)
      
      // Remove from local state
      playlists.value = playlists.value.filter(p => p.id !== playlistId)
      
      return true
    } catch (err) {
      console.error('Error deleting playlist:', err)
      throw err
    }
  }
  
  /**
   * Add track to playlist
   */
  async function addToPlaylist(playlistId, track) {
    if (!user.value) throw new Error('Authentication required')
    
    try {
      const playlistRef = doc(db, 'playlists', playlistId)
      
      // Get current playlist
      const playlistDoc = await getDoc(playlistRef)
      if (!playlistDoc.exists()) {
        throw new Error('Playlist not found')
      }
      
      const playlist = playlistDoc.data()
      
      // Check if track already exists
      if (playlist.tracks.some(t => t.id === track.id)) {
        throw new Error('Track already in playlist')
      }
      
      // Add track with metadata
      const trackData = {
        id: track.id,
        title: track.title,
        artistName: track.artistName,
        albumTitle: track.albumTitle,
        duration: track.duration,
        artworkUrl: track.artworkUrl,
        addedAt: serverTimestamp(),
        addedBy: user.value.uid
      }
      
      await updateDoc(playlistRef, {
        tracks: [...playlist.tracks, trackData],
        updatedAt: serverTimestamp()
      })
      
      // Update local state
      const index = playlists.value.findIndex(p => p.id === playlistId)
      if (index >= 0) {
        playlists.value[index].tracks.push(trackData)
      }
      
      return true
    } catch (err) {
      console.error('Error adding to playlist:', err)
      throw err
    }
  }
  
  /**
   * Remove track from playlist
   */
  async function removeFromPlaylist(playlistId, trackId) {
    if (!user.value) throw new Error('Authentication required')
    
    try {
      const playlistRef = doc(db, 'playlists', playlistId)
      
      // Get current playlist
      const playlistDoc = await getDoc(playlistRef)
      if (!playlistDoc.exists()) {
        throw new Error('Playlist not found')
      }
      
      const playlist = playlistDoc.data()
      const updatedTracks = playlist.tracks.filter(t => t.id !== trackId)
      
      await updateDoc(playlistRef, {
        tracks: updatedTracks,
        updatedAt: serverTimestamp()
      })
      
      // Update local state
      const index = playlists.value.findIndex(p => p.id === playlistId)
      if (index >= 0) {
        playlists.value[index].tracks = updatedTracks
      }
      
      return true
    } catch (err) {
      console.error('Error removing from playlist:', err)
      throw err
    }
  }
  
  /**
   * Reorder tracks in playlist
   */
  async function reorderPlaylistTracks(playlistId, tracks) {
    if (!user.value) throw new Error('Authentication required')
    
    try {
      await updateDoc(doc(db, 'playlists', playlistId), {
        tracks,
        updatedAt: serverTimestamp()
      })
      
      // Update local state
      const index = playlists.value.findIndex(p => p.id === playlistId)
      if (index >= 0) {
        playlists.value[index].tracks = tracks
      }
      
      return true
    } catch (err) {
      console.error('Error reordering playlist:', err)
      throw err
    }
  }
  
  /**
   * Add to recently played history
   */
  async function addToHistory(track) {
    if (!user.value) return
    
    try {
      await addDoc(collection(db, 'users', user.value.uid, 'history'), {
        trackId: track.id,
        title: track.title,
        artistName: track.artistName,
        albumTitle: track.albumTitle,
        artworkUrl: track.artworkUrl,
        duration: track.duration,
        playedAt: serverTimestamp()
      })
    } catch (err) {
      console.error('Error adding to history:', err)
    }
  }
  
  // Computed properties
  const favoriteTracks = computed(() => favorites.value.tracks || [])
  const favoriteAlbums = computed(() => favorites.value.albums || [])
  const favoriteArtists = computed(() => favorites.value.artists || [])
  const favoritePlaylists = computed(() => favorites.value.playlists || [])
  const hasLibraryContent = computed(() => 
    favoriteTracks.value.length > 0 ||
    favoriteAlbums.value.length > 0 ||
    favoriteArtists.value.length > 0 ||
    playlists.value.length > 0
  )
  
  // Watch for auth changes
  watch(() => user.value, (newUser) => {
    if (newUser) {
      initLibrary()
    } else {
      clearLibrary()
    }
  }, { immediate: true })
  
  return {
    // State
    favorites,
    playlists,
    recentlyPlayed,
    isLoading,
    error,
    
    // Computed
    favoriteTracks,
    favoriteAlbums,
    favoriteArtists,
    favoritePlaylists,
    hasLibraryContent,
    
    // Methods
    initLibrary,
    clearLibrary,
    toggleFavorite,
    checkIsFavorite,
    getFavoriteItems,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addToPlaylist,
    removeFromPlaylist,
    reorderPlaylistTracks,
    addToHistory
  }
}