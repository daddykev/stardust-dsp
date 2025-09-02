// template/src/composables/useProfile.js
import { ref, computed } from 'vue'
import { db, auth, storage } from '../firebase'
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs 
} from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'

export function useProfile() {
  const profile = ref(null)
  const loading = ref(false)
  const error = ref(null)

  // Get user profile
  async function getProfile(userId) {
    loading.value = true
    error.value = null

    try {
      const docRef = doc(db, 'users', userId)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() }
      } else {
        // Create default profile if doesn't exist
        const defaultProfile = {
          displayName: 'User',
          username: `user_${userId.substring(0, 8)}`,
          avatar: '/default-avatar.png',
          createdAt: new Date(),
          followers: 0,
          following: 0
        }

        await setDoc(docRef, defaultProfile)
        return { id: userId, ...defaultProfile }
      }
    } catch (err) {
      console.error('Error getting profile:', err)
      error.value = err.message
      return null
    } finally {
      loading.value = false
    }
  }

  // Update profile
  async function updateProfile(profileData) {
    loading.value = true
    error.value = null

    try {
      const userId = auth.currentUser?.uid
      if (!userId) throw new Error('Not authenticated')

      const docRef = doc(db, 'users', userId)
      await updateDoc(docRef, {
        ...profileData,
        updatedAt: new Date()
      })

      profile.value = profileData
      return true
    } catch (err) {
      console.error('Error updating profile:', err)
      error.value = err.message
      return false
    } finally {
      loading.value = false
    }
  }

  // Check username availability
  async function checkUsernameAvailability(username) {
    try {
      const q = query(
        collection(db, 'users'),
        where('username', '==', username),
        limit(1)
      )
      
      const snapshot = await getDocs(q)
      return snapshot.empty
    } catch (err) {
      console.error('Error checking username:', err)
      return false
    }
  }

  // Upload avatar
  async function uploadAvatar(file) {
    const userId = auth.currentUser?.uid
    if (!userId) throw new Error('Not authenticated')

    const fileRef = storageRef(storage, `avatars/${userId}/${Date.now()}_${file.name}`)
    const snapshot = await uploadBytes(fileRef, file)
    return await getDownloadURL(snapshot.ref)
  }

  // Upload cover image
  async function uploadCover(file) {
    const userId = auth.currentUser?.uid
    if (!userId) throw new Error('Not authenticated')

    const fileRef = storageRef(storage, `covers/${userId}/${Date.now()}_${file.name}`)
    const snapshot = await uploadBytes(fileRef, file)
    return await getDownloadURL(snapshot.ref)
  }

  // Get profile stats
  async function getProfileStats(userId) {
    try {
      // Get follower count
      const followersQuery = query(
        collection(db, 'follows'),
        where('followingId', '==', userId)
      )
      const followersSnapshot = await getDocs(followersQuery)
      const followers = followersSnapshot.size

      // Get following count
      const followingQuery = query(
        collection(db, 'follows'),
        where('followerId', '==', userId)
      )
      const followingSnapshot = await getDocs(followingQuery)
      const following = followingSnapshot.size

      // Get playlist count
      const playlistsQuery = query(
        collection(db, 'playlists'),
        where('userId', '==', userId),
        where('public', '==', true)
      )
      const playlistsSnapshot = await getDocs(playlistsQuery)
      const playlists = playlistsSnapshot.size

      return {
        followers,
        following,
        playlists
      }
    } catch (err) {
      console.error('Error getting profile stats:', err)
      return {
        followers: 0,
        following: 0,
        playlists: 0
      }
    }
  }

  // Get public playlists
  async function getPublicPlaylists(userId) {
    try {
      const q = query(
        collection(db, 'playlists'),
        where('userId', '==', userId),
        where('public', '==', true),
        orderBy('updatedAt', 'desc')
      )
      
      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    } catch (err) {
      console.error('Error getting playlists:', err)
      return []
    }
  }

  // Get recently played
  async function getRecentlyPlayed(userId, limitCount = 20) {
    try {
      const q = query(
        collection(db, 'plays'),
        where('userId', '==', userId),
        orderBy('playedAt', 'desc'),
        limit(limitCount)
      )
      
      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    } catch (err) {
      console.error('Error getting recently played:', err)
      return []
    }
  }

  // Get followers
  async function getFollowers(userId) {
    try {
      const q = query(
        collection(db, 'follows'),
        where('followingId', '==', userId),
        orderBy('timestamp', 'desc')
      )
      
      const snapshot = await getDocs(q)
      const followerIds = snapshot.docs.map(doc => doc.data().followerId)
      
      // Get user details
      const users = []
      for (const id of followerIds) {
        const user = await getProfile(id)
        if (user) users.push(user)
      }
      
      return users
    } catch (err) {
      console.error('Error getting followers:', err)
      return []
    }
  }

  // Get following
  async function getFollowing(userId) {
    try {
      const q = query(
        collection(db, 'follows'),
        where('followerId', '==', userId),
        orderBy('timestamp', 'desc')
      )
      
      const snapshot = await getDocs(q)
      const followingIds = snapshot.docs.map(doc => doc.data().followingId)
      
      // Get user details
      const users = []
      for (const id of followingIds) {
        const user = await getProfile(id)
        if (user) users.push(user)
      }
      
      return users
    } catch (err) {
      console.error('Error getting following:', err)
      return []
    }
  }

  // Get activity
  async function getActivity(userId, limitCount = 50) {
    try {
      const q = query(
        collection(db, 'activities'),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      )
      
      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    } catch (err) {
      console.error('Error getting activity:', err)
      return []
    }
  }

  // Check if following
  async function isFollowing(targetUserId) {
    const userId = auth.currentUser?.uid
    if (!userId) return false

    try {
      const docRef = doc(db, 'follows', `${userId}_${targetUserId}`)
      const docSnap = await getDoc(docRef)
      return docSnap.exists()
    } catch (err) {
      console.error('Error checking follow status:', err)
      return false
    }
  }

  return {
    profile,
    loading,
    error,
    getProfile,
    updateProfile,
    checkUsernameAvailability,
    uploadAvatar,
    uploadCover,
    getProfileStats,
    getPublicPlaylists,
    getRecentlyPlayed,
    getFollowers,
    getFollowing,
    getActivity,
    isFollowing
  }
}