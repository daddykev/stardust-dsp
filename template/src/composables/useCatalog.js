import { ref, computed } from 'vue'
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  doc,
  getDoc,
  onSnapshot,
  startAfter,
  Timestamp
} from 'firebase/firestore'
import { db } from '../firebase'

export function useCatalog() {
  const releases = ref([])
  const tracks = ref([])
  const artists = ref([])
  const albums = ref([])
  const isLoading = ref(false)
  const error = ref(null)
  
  // Pagination
  const lastDoc = ref(null)
  const hasMore = ref(true)

  /**
   * Fetch all releases (for catalog browse)
   */
  async function fetchAllReleases(limitCount = 100) {
    isLoading.value = true
    error.value = null
    
    try {
      console.log('Fetching releases with status = active...')
      
      // First, let's check if there are ANY releases
      const allReleasesSnapshot = await getDocs(collection(db, 'releases'))
      console.log(`Total releases in database: ${allReleasesSnapshot.size}`)
      
      // Check status distribution
      const statusCounts = {}
      allReleasesSnapshot.docs.forEach(doc => {
        const data = doc.data()
        const status = data.status || 'undefined'
        statusCounts[status] = (statusCounts[status] || 0) + 1
      })
      console.log('Release status distribution:', statusCounts)
      
      // Now fetch active releases with correct field path
      const q = query(
        collection(db, 'releases'),
        where('status', '==', 'active'),
        orderBy('ingestion.processedAt', 'desc'),
        limit(limitCount)
      )
      
      const snapshot = await getDocs(q)
      console.log(`Found ${snapshot.size} active releases`)
      
      releases.value = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      // Store last document for pagination
      if (snapshot.docs.length > 0) {
        lastDoc.value = snapshot.docs[snapshot.docs.length - 1]
        hasMore.value = snapshot.docs.length === limitCount
      }
      
      return releases.value
    } catch (err) {
      console.error('Error fetching releases:', err)
      error.value = err.message
      
      // If the error is about the index, try without ordering
      if (err.message.includes('index')) {
        console.log('Index error, trying without orderBy...')
        try {
          const simpleQuery = query(
            collection(db, 'releases'),
            where('status', '==', 'active'),
            limit(limitCount)
          )
          
          const snapshot = await getDocs(simpleQuery)
          console.log(`Found ${snapshot.size} active releases (without ordering)`)
          
          releases.value = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          
          // Sort in memory
          releases.value.sort((a, b) => {
            const aDate = a.ingestion?.processedAt?.toMillis() || 0
            const bDate = b.ingestion?.processedAt?.toMillis() || 0
            return bDate - aDate
          })
          
          return releases.value
        } catch (fallbackErr) {
          console.error('Fallback query also failed:', fallbackErr)
        }
      }
      
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch more releases (pagination)
   */
  async function fetchMoreReleases(limitCount = 50) {
    if (!hasMore.value || !lastDoc.value) return []
    
    isLoading.value = true
    
    try {
      const q = query(
        collection(db, 'releases'),
        where('status', '==', 'active'),
        orderBy('ingestion.processedAt', 'desc'),
        startAfter(lastDoc.value),
        limit(limitCount)
      )
      
      const snapshot = await getDocs(q)
      const moreReleases = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      releases.value = [...releases.value, ...moreReleases]
      
      if (snapshot.docs.length > 0) {
        lastDoc.value = snapshot.docs[snapshot.docs.length - 1]
        hasMore.value = snapshot.docs.length === limitCount
      } else {
        hasMore.value = false
      }
      
      return moreReleases
    } catch (err) {
      console.error('Error fetching more releases:', err)
      error.value = err.message
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get new releases (needed by Home.vue)
   */
  async function getNewReleases(limitCount = 8) {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const q = query(
        collection(db, 'releases'),
        where('status', '==', 'active'),
        where('ingestion.processedAt', '>=', Timestamp.fromDate(thirtyDaysAgo)),
        orderBy('ingestion.processedAt', 'desc'),
        limit(limitCount)
      )
      
      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (err) {
      console.error('Error fetching new releases:', err)
      
      // Fallback: just get recent releases
      try {
        const fallbackQuery = query(
          collection(db, 'releases'),
          where('status', '==', 'active'),
          limit(limitCount)
        )
        
        const snapshot = await getDocs(fallbackQuery)
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      } catch (fallbackErr) {
        console.error('Fallback query also failed:', fallbackErr)
        return []
      }
    }
  }
  
  /**
   * Get trending tracks (needed by Home.vue)
   */
  async function getTrendingTracks(limitCount = 10) {
    try {
      // For now, just get tracks with highest play count
      // In production, this would use analytics data
      const q = query(
        collection(db, 'tracks'),
        orderBy('stats.playCount', 'desc'),
        limit(limitCount)
      )
      
      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (err) {
      console.error('Error fetching trending tracks:', err)
      
      // Fallback: just get recent tracks
      try {
        const fallbackQuery = query(
          collection(db, 'tracks'),
          limit(limitCount)
        )
        
        const snapshot = await getDocs(fallbackQuery)
        return snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      } catch (fallbackErr) {
        console.error('Fallback query also failed:', fallbackErr)
        return []
      }
    }
  }

  /**
   * Fetch all tracks
   */
  async function fetchAllTracks(limitCount = 500) {
    isLoading.value = true
    error.value = null
    
    try {
      const q = query(
        collection(db, 'tracks'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      )
      
      const snapshot = await getDocs(q)
      tracks.value = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      return tracks.value
    } catch (err) {
      console.error('Error fetching tracks:', err)
      error.value = err.message
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch tracks for a specific release
   */
  async function fetchReleaseTracks(releaseId) {
    try {
      const q = query(
        collection(db, 'tracks'),
        where('releaseId', '==', releaseId),
        orderBy('trackNumber', 'asc')
      )
      
      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    } catch (err) {
      console.error('Error fetching release tracks:', err)
      
      // Fallback without ordering if index doesn't exist
      try {
        const fallbackQuery = query(
          collection(db, 'tracks'),
          where('releaseId', '==', releaseId)
        )
        
        const snapshot = await getDocs(fallbackQuery)
        const tracks = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        
        // Sort in memory
        tracks.sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0))
        
        return tracks
      } catch (fallbackErr) {
        console.error('Fallback query also failed:', fallbackErr)
        return []
      }
    }
  }

  /**
   * Fetch all artists
   */
  async function fetchAllArtists(limitCount = 200) {
    isLoading.value = true
    error.value = null
    
    try {
      const q = query(
        collection(db, 'artists'),
        orderBy('name', 'asc'),
        limit(limitCount)
      )
      
      const snapshot = await getDocs(q)
      artists.value = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      // Calculate stats for each artist
      for (const artist of artists.value) {
        // Get unique releases for this artist
        if (artist.releases && Array.isArray(artist.releases)) {
          // Releases array already contains unique release IDs
          artist.stats = {
            ...artist.stats,
            releaseCount: artist.releases.length
          }
        } else {
          // Fallback: count releases by artist name
          const releasesQuery = query(
            collection(db, 'releases'),
            where('metadata.displayArtist', '==', artist.name),
            where('status', '==', 'active')
          )
          const releasesSnapshot = await getDocs(releasesQuery)
          artist.stats = {
            ...artist.stats,
            releaseCount: releasesSnapshot.size
          }
        }
        
        // Count tracks
        const tracksQuery = query(
          collection(db, 'tracks'),
          where('metadata.displayArtist', '==', artist.name)
        )
        const tracksSnapshot = await getDocs(tracksQuery)
        artist.stats = {
          ...artist.stats,
          trackCount: tracksSnapshot.size
        }
      }
      
      return artists.value
    } catch (err) {
      console.error('Error fetching artists:', err)
      error.value = err.message
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Search across catalog
   */
  async function searchCatalog(searchQuery, searchType = 'all') {
    if (!searchQuery || searchQuery.length < 2) return []
    
    isLoading.value = true
    const results = {
      releases: [],
      tracks: [],
      artists: []
    }
    
    try {
      const queryLower = searchQuery.toLowerCase()
      
      // Search releases
      if (searchType === 'all' || searchType === 'releases') {
        const releasesSnapshot = await getDocs(collection(db, 'releases'))
        results.releases = releasesSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(r => 
            r.title?.toLowerCase().includes(queryLower) ||
            r.artistName?.toLowerCase().includes(queryLower) ||
            r.metadata?.title?.toLowerCase().includes(queryLower) ||
            r.metadata?.displayArtist?.toLowerCase().includes(queryLower)
          )
      }
      
      // Search tracks
      if (searchType === 'all' || searchType === 'tracks') {
        const tracksSnapshot = await getDocs(collection(db, 'tracks'))
        results.tracks = tracksSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(t => 
            t.title?.toLowerCase().includes(queryLower) ||
            t.artistName?.toLowerCase().includes(queryLower) ||
            t.metadata?.title?.toLowerCase().includes(queryLower) ||
            t.metadata?.displayArtist?.toLowerCase().includes(queryLower) ||
            t.isrc?.toLowerCase().includes(queryLower)
          )
      }
      
      // Search artists
      if (searchType === 'all' || searchType === 'artists') {
        const artistsSnapshot = await getDocs(collection(db, 'artists'))
        results.artists = artistsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(a => a.name?.toLowerCase().includes(queryLower))
      }
      
      return results
    } catch (err) {
      console.error('Error searching catalog:', err)
      error.value = err.message
      return results
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Search with filters
   */
  async function search(searchQuery, filters = {}) {
    return searchCatalog(searchQuery, 'all')
  }

  /**
   * Get release by ID
   */
  async function getRelease(releaseId) {
    try {
      const releaseDoc = await getDoc(doc(db, 'releases', releaseId))
      if (!releaseDoc.exists()) {
        throw new Error('Release not found')
      }
      
      const release = { id: releaseDoc.id, ...releaseDoc.data() }
      
      // Get tracks
      release.tracks = await fetchReleaseTracks(releaseId)
      
      return release
    } catch (err) {
      console.error('Error fetching release:', err)
      error.value = err.message
      return null
    }
  }

  /**
   * Get artist by ID
   */
  async function getArtist(artistId) {
    try {
      const artistDoc = await getDoc(doc(db, 'artists', artistId))
      if (!artistDoc.exists()) {
        throw new Error('Artist not found')
      }
      
      const artist = { id: artistDoc.id, ...artistDoc.data() }
      
      // Get artist's releases
      try {
        const releasesQuery = query(
          collection(db, 'releases'),
          where('metadata.displayArtist', '==', artist.name),
          where('status', '==', 'active'),
          orderBy('ingestion.processedAt', 'desc')
        )
        
        const releasesSnapshot = await getDocs(releasesQuery)
        artist.releases = releasesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      } catch (err) {
        console.error('Error fetching artist releases:', err)
        // Fallback without ordering
        const fallbackQuery = query(
          collection(db, 'releases'),
          where('metadata.displayArtist', '==', artist.name),
          where('status', '==', 'active')
        )
        
        const releasesSnapshot = await getDocs(fallbackQuery)
        artist.releases = releasesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      }
      
      // Get top tracks
      try {
        const tracksQuery = query(
          collection(db, 'tracks'),
          where('metadata.displayArtist', '==', artist.name),
          orderBy('stats.playCount', 'desc'),
          limit(10)
        )
        
        const tracksSnapshot = await getDocs(tracksQuery)
        artist.topTracks = tracksSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      } catch (err) {
        console.error('Error fetching top tracks:', err)
        // Fallback: just get some tracks
        const fallbackQuery = query(
          collection(db, 'tracks'),
          where('metadata.displayArtist', '==', artist.name),
          limit(10)
        )
        
        const tracksSnapshot = await getDocs(fallbackQuery)
        artist.topTracks = tracksSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      }
      
      return artist
    } catch (err) {
      console.error('Error fetching artist:', err)
      error.value = err.message
      return null
    }
  }

  /**
   * Get track by ID
   */
  async function getTrack(trackId) {
    try {
      const trackDoc = await getDoc(doc(db, 'tracks', trackId))
      if (!trackDoc.exists()) {
        throw new Error('Track not found')
      }
      
      const track = { id: trackDoc.id, ...trackDoc.data() }
      
      // Get release info if available
      if (track.releaseId) {
        const releaseDoc = await getDoc(doc(db, 'releases', track.releaseId))
        if (releaseDoc.exists()) {
          track.release = { id: releaseDoc.id, ...releaseDoc.data() }
        }
      }
      
      return track
    } catch (err) {
      console.error('Error fetching track:', err)
      error.value = err.message
      return null
    }
  }

  return {
    // State
    releases,
    tracks,
    artists,
    albums,
    isLoading,
    error,
    hasMore,
    
    // Methods
    fetchAllReleases,
    fetchMoreReleases,
    fetchAllTracks,
    fetchReleaseTracks,
    fetchAllArtists,
    searchCatalog,
    search,
    getRelease,
    getArtist,
    getTrack,
    
    // New methods for Home.vue
    getNewReleases,
    getTrendingTracks
  }
}