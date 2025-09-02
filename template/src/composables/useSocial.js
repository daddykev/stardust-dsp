// template/src/composables/useSocial.js
import { ref, computed } from 'vue'
import { db, auth } from '../firebase'
import { collection, doc, setDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore'

export function useSocial() {
  const following = ref([])
  const followers = ref([])
  const activities = ref([])

  // Follow a user
  async function followUser(targetUserId) {
    const userId = auth.currentUser?.uid
    if (!userId) return

    const followDoc = {
      followerId: userId,
      followingId: targetUserId,
      timestamp: new Date()
    }

    await setDoc(
      doc(db, 'follows', `${userId}_${targetUserId}`),
      followDoc
    )

    // Create activity
    await createActivity('follow', targetUserId)
  }

  // Unfollow a user
  async function unfollowUser(targetUserId) {
    const userId = auth.currentUser?.uid
    if (!userId) return

    await deleteDoc(
      doc(db, 'follows', `${userId}_${targetUserId}`)
    )
  }

  // Check if following
  async function isFollowing(targetUserId) {
    const userId = auth.currentUser?.uid
    if (!userId) return false

    const docRef = doc(db, 'follows', `${userId}_${targetUserId}`)
    const docSnap = await getDoc(docRef)
    return docSnap.exists()
  }

  // Get followers
  async function getFollowers(userId) {
    const q = query(
      collection(db, 'follows'),
      where('followingId', '==', userId)
    )
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => doc.data())
  }

  // Get following
  async function getFollowing(userId) {
    const q = query(
      collection(db, 'follows'),
      where('followerId', '==', userId)
    )
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => doc.data())
  }

  // Share content
  async function shareContent(contentType, contentId, message = '') {
    const userId = auth.currentUser?.uid
    if (!userId) return

    const shareDoc = {
      userId,
      contentType,
      contentId,
      message,
      timestamp: new Date()
    }

    await setDoc(
      doc(collection(db, 'shares')),
      shareDoc
    )

    // Create activity
    await createActivity('share', contentId, { contentType, message })
  }

  // Create activity
  async function createActivity(type, targetId, metadata = {}) {
    const userId = auth.currentUser?.uid
    if (!userId) return

    const activity = {
      userId,
      type,
      targetId,
      metadata,
      timestamp: new Date()
    }

    await setDoc(
      doc(collection(db, 'activities')),
      activity
    )
  }

  // Get activity feed
  async function getActivityFeed(userId) {
    // Get user's following list
    const followingList = await getFollowing(userId)
    const followingIds = followingList.map(f => f.followingId)
    
    // Include user's own activities
    followingIds.push(userId)

    if (followingIds.length === 0) return []

    // Get activities from followed users
    const q = query(
      collection(db, 'activities'),
      where('userId', 'in', followingIds),
      orderBy('timestamp', 'desc'),
      limit(50)
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  }

  return {
    following,
    followers,
    activities,
    followUser,
    unfollowUser,
    isFollowing,
    getFollowers,
    getFollowing,
    shareContent,
    createActivity,
    getActivityFeed
  }
}