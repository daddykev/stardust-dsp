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
  onSnapshot
} from 'firebase/firestore'
import { db } from '../firebase'

export function useCatalog() {
  const releases = ref([])
  const tracks = ref([])
  const artists = ref([])
  const albums = ref([])
  const isLoading = ref(false)
  const error = ref(null)

  /**
   * Fetch new releases
   */
  async function fetchNewReleases(limitCount = 20) {
    isLoading.value = true
    error.value = null
    
    try {
      const q = query(
        collection(db, 'releases'),
        where('status', '==', 'active'),
        orderBy('releaseDate', 'desc'),
        limit(limitCount)
      )
      
      const snapshot = await getDocs(q)
      releases.value = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      return releases.value
    } catch (err) {
      console.error('Error fetching new releases:', err)
      error.value = err.message
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch top tracks
   */
  async function fetchTopTracks(limitCount = 50) {
    isLoading.value = true
    error.value = null
    
    try {
      const q = query(
        collection(db, 'tracks'),
        orderBy('stats.playCount', 'desc'),
        limit(limitCount)
      )
      
      const snapshot = await getDocs(q)
      tracks.value = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      return tracks.value
    } catch (err) {
      console.error('Error fetching top tracks:', err)
      error.value = err.message
      return []
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch release details with tracks
   */
  async function fetchRelease(releaseId) {
    isLoading.value = true
    error.value = null
    
    try {
      // Get release
      const releaseDoc = await getDoc(doc(db, 'releases', releaseId))
      if (!releaseDoc.exists()) {
        throw new Error('Release not found')
      }
      
      const release = { id: releaseDoc.id, ...releaseDoc.data() }
      
      // Get tracks for this release
      const tracksQuery = query(
        collection(db, 'tracks'),
        where('releaseId', '==', releaseId),
        orderBy('trackNumber', 'asc')
      )
      
      const tracksSnapshot = await getDocs(tracksQuery)
      release.tracks = tracksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      return release
    } catch (err) {
      console.error('Error fetching release:', err)
      error.value = err.message
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch artist details
   */
  async function fetchArtist(artistId) {
    isLoading.value = true
    error.value = null
    
    try {
      const artistDoc = await getDoc(doc(db, 'artists', artistId))
      if (!artistDoc.exists()) {
        throw new Error('Artist not found')
      }
      
      const artist = { id: artistDoc.id, ...artistDoc.data() }
      
      // Get artist's releases
      const releasesQuery = query(
        collection(db, 'releases'),
        where('artistName', '==', artist.name),
        orderBy('releaseDate', 'desc')
      )
      
      const releasesSnapshot = await getDocs(releasesQuery)
      artist.releases = releasesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      // Get top tracks
      const tracksQuery = query(
        collection(db, 'tracks'),
        where('artistName', '==', artist.name),
        orderBy('stats.playCount', 'desc'),
        limit(10)
      )
      
      const tracksSnapshot = await getDocs(tracksQuery)
      artist.topTracks = tracksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      
      return artist
    } catch (err) {
      console.error('Error fetching artist:', err)
      error.value = err.message
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Subscribe to real-time updates for a release
   */
  function subscribeToRelease(releaseId, callback) {
    const unsubscribe = onSnapshot(
      doc(db, 'releases', releaseId),
      (doc) => {
        if (doc.exists()) {
          callback({ id: doc.id, ...doc.data() })
        }
      },
      (err) => {
        console.error('Subscription error:', err)
        error.value = err.message
      }
    )
    
    return unsubscribe
  }

  return {
    // State
    releases,
    tracks,
    artists,
    albums,
    isLoading,
    error,
    
    // Methods
    fetchNewReleases,
    fetchTopTracks,
    fetchRelease,
    fetchArtist,
    subscribeToRelease
  }
}