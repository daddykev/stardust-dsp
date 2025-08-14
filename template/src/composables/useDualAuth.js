import { ref, computed } from 'vue'
import { auth, db } from '../firebase'
import { 
  onAuthStateChanged, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

// Global reactive auth state
const user = ref(null)
const userProfile = ref(null)
const userType = ref(null) // 'consumer' | 'industry' | 'admin'
const isLoading = ref(true)

// Initialize auth state listener
let unsubscribe = null

export function useDualAuth() {
  // Initialize auth listener if not already initialized
  if (!unsubscribe) {
    unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        user.value = firebaseUser
        
        // Fetch user profile from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
          if (userDoc.exists()) {
            userProfile.value = { id: userDoc.id, ...userDoc.data() }
            
            // Determine user type based on role
            const role = userDoc.data().role
            if (role === 'admin') {
              userType.value = 'admin'
            } else if (role === 'label' || role === 'distributor') {
              userType.value = 'industry'
            } else {
              userType.value = 'consumer'
            }
          } else {
            // Default to consumer for new users
            userProfile.value = {
              id: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              role: 'consumer'
            }
            userType.value = 'consumer'
          }
        } catch (error) {
          console.error('Error fetching user profile:', error)
        }
      } else {
        user.value = null
        userProfile.value = null
        userType.value = null
      }
      isLoading.value = false
    })
  }

  const isAuthenticated = computed(() => !!user.value)
  const isConsumer = computed(() => userType.value === 'consumer')
  const isIndustryUser = computed(() => 
    userType.value === 'industry' || userType.value === 'admin'
  )
  const isAdmin = computed(() => userType.value === 'admin')

  /**
   * Sign up as consumer (listener)
   */
  async function signUpConsumer(email, password, displayName) {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    
    // Create consumer profile
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      uid: userCredential.user.uid,
      email,
      displayName,
      role: 'consumer',
      subscription: {
        type: 'free',
        startDate: serverTimestamp()
      },
      preferences: {
        language: 'en',
        explicitContent: true,
        audioQuality: 'auto',
        downloadQuality: 'high'
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    
    return userCredential.user
  }

  /**
   * Sign up as industry user (label/distributor)
   */
  async function signUpIndustry(email, password, organizationName, type = 'label') {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    
    // Create industry profile
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      uid: userCredential.user.uid,
      email,
      organizationName,
      displayName: organizationName,
      role: type, // 'label' or 'distributor'
      verified: false,
      deliveryCredentials: {
        ftpUsername: organizationName.toLowerCase().replace(/\s+/g, '-'),
        apiKey: generateAPIKey()
      },
      limits: {
        monthlyDeliveries: type === 'label' ? 100 : 1000,
        storageGB: type === 'label' ? 50 : 500
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    
    return userCredential.user
  }

  /**
   * Enhanced sign in that preserves user type
   */
  async function signIn(email, password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    return userCredential.user
  }

  /**
   * Sign out current user
   */
  async function logout() {
    try {
      await signOut(auth)
      user.value = null
      userProfile.value = null
      userType.value = null
    } catch (error) {
      console.error('Logout error:', error)
      throw error
    }
  }

  /**
   * Generate API key for industry users
   */
  function generateAPIKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let key = 'sdsp_'
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return key
  }

  return {
    // State
    user: computed(() => user.value),
    userProfile: computed(() => userProfile.value),
    userType: computed(() => userType.value),
    isLoading: computed(() => isLoading.value),
    
    // Computed
    isAuthenticated,
    isConsumer,
    isIndustryUser,
    isAdmin,
    
    // Methods
    signUpConsumer,
    signUpIndustry,
    signIn,
    logout
  }
}