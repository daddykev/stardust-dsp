// template/src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { auth } from '../firebase'
import { onAuthStateChanged } from 'firebase/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // ==========================================
    // PUBLIC ROUTES (No authentication required)
    // ==========================================
    {
      path: '/',
      name: 'splash',
      component: () => import('../views/public/SplashPage.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/public/Login.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('../views/public/Signup.vue'),
      meta: { requiresAuth: false }
    },

    // ==========================================
    // CONSUMER ROUTES (Main user experience)
    // ==========================================
    {
      path: '/home',
      name: 'home',
      component: () => import('../views/consumer/Home.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/browse',
      name: 'browse',
      component: () => import('../views/consumer/Browse.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/browse/:category',
      name: 'browse-category',
      component: () => import('../views/consumer/Browse.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/search',
      name: 'search',
      component: () => import('../views/consumer/Search.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/library',
      name: 'library',
      component: () => import('../views/consumer/Library.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/profile',
      name: 'profile-current',
      component: () => import('../views/consumer/Profile.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/profile/:id',
      name: 'profile',
      component: () => import('../views/consumer/Profile.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/artists/:id',
      name: 'artist',
      component: () => import('../views/consumer/Artist.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/releases/:id',
      name: 'release-detail',
      component: () => import('../views/consumer/ReleaseDetail.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/albums/:id',
      name: 'album-detail',
      component: () => import('../views/consumer/ReleaseDetail.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/playlists/:id',
      name: 'playlist-detail',
      component: () => import('../views/consumer/PlaylistDetail.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/playlists/:id/edit',
      name: 'playlist-edit',
      component: () => import('../views/consumer/PlaylistDetail.vue'),
      meta: { requiresAuth: true, editMode: true }
    },

    // Radio routes (part of consumer experience)
    {
      path: '/radio/artist/:id',
      name: 'artist-radio',
      component: () => import('../views/consumer/Home.vue'), // Or create Radio.vue
      meta: { requiresAuth: true }
    },
    {
      path: '/radio/track/:id',
      name: 'track-radio',
      component: () => import('../views/consumer/Home.vue'), // Or create Radio.vue
      meta: { requiresAuth: true }
    },
    {
      path: '/radio/album/:id',
      name: 'album-radio',
      component: () => import('../views/consumer/Home.vue'), // Or create Radio.vue
      meta: { requiresAuth: true }
    },

    // Discovery routes
    {
      path: '/genre/:id',
      name: 'genre',
      component: () => import('../views/consumer/Browse.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/mood/:id',
      name: 'mood',
      component: () => import('../views/consumer/Browse.vue'),
      meta: { requiresAuth: true }
    },

    // ==========================================
    // BUSINESS ROUTES (Label/distributor features)
    // ==========================================
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../views/business/Dashboard.vue'),
      meta: { requiresAuth: true, requiresBusinessAccess: true }
    },
    {
      path: '/catalog',
      name: 'catalog',
      component: () => import('../views/business/Catalog.vue'),
      meta: { requiresAuth: true, requiresBusinessAccess: true }
    },
    {
      path: '/distributors',
      name: 'distributors',
      component: () => import('../views/business/Distributors.vue'),
      meta: { requiresAuth: true, requiresBusinessAccess: true }
    },
    {
      path: '/ingestion',
      name: 'ingestion',
      component: () => import('../views/business/Ingestion.vue'),
      meta: { requiresAuth: true, requiresBusinessAccess: true }
    },
    {
      path: '/ingestion/:id',
      name: 'ingestion-detail',
      component: () => import('../views/business/IngestionDetail.vue'),
      meta: { requiresAuth: true, requiresBusinessAccess: true }
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/business/Settings.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/testing',
      name: 'testing',
      component: () => import('../views/business/Testing.vue'),
      meta: { requiresAuth: true, requiresBusinessAccess: true }
    },
    {
      path: '/admin/users',
      name: 'userAdmin',
      component: () => import('../views/business/UserAdmin.vue'),
      meta: { requiresAuth: true, requiresAdmin: true }
    },    

    // Business management routes
    {
      path: '/business',
      redirect: '/dashboard'
    },
    {
      path: '/manage',
      redirect: '/dashboard'
    },

    // ==========================================
    // FALLBACK ROUTES
    // ==========================================
    {
      path: '/account',
      redirect: '/profile'
    },
    {
      path: '/music',
      redirect: '/browse'
    },
    {
      path: '/tracks/:id',
      name: 'track-detail',
      redirect: to => `/releases/${to.params.id}` // Or create dedicated track view
    },
    
    // 404 catch-all route (must be last)
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/public/SplashPage.vue'), // Or create NotFound.vue
      meta: { requiresAuth: false }
    }
  ]
})

// ==========================================
// NAVIGATION GUARDS
// ==========================================

// Auth state management
let isAuthReady = false
let currentUser = null

// Wait for auth to be ready
onAuthStateChanged(auth, (user) => {
  currentUser = user
  isAuthReady = true
})

// Main navigation guard
router.beforeEach(async (to, from, next) => {
  // Wait for auth to be ready on initial load
  if (!isAuthReady) {
    await new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        currentUser = user
        isAuthReady = true
        unsubscribe()
        resolve()
      })
    })
  }

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const requiresBusinessAccess = to.matched.some(record => record.meta.requiresBusinessAccess)
  const isPublicRoute = to.matched.some(record => record.meta.requiresAuth === false)

  // Redirect authenticated users away from login/signup
  if (currentUser && (to.name === 'login' || to.name === 'signup')) {
    next('/home')
    return
  }

  // Handle routes that require authentication
  if (requiresAuth && !currentUser) {
    // Store intended destination
    localStorage.setItem('redirectAfterLogin', to.fullPath)
    next('/login')
    return
  }

  // Handle business access requirements
  if (requiresBusinessAccess && currentUser) {
    // Check if user has business access
    // You might want to check user roles/claims here
    const hasBusinessAccess = await checkBusinessAccess(currentUser)
    
    if (!hasBusinessAccess) {
      next('/home') // Redirect to consumer home
      return
    }
  }

  // Root path handling
  if (to.path === '/') {
    if (currentUser) {
      // Check if user has business access to determine default landing
      const hasBusinessAccess = await checkBusinessAccess(currentUser)
      next(hasBusinessAccess ? '/dashboard' : '/home')
    } else {
      next() // Show splash page
    }
    return
  }

  // Proceed with navigation
  next()
})

// Helper function to check business access
async function checkBusinessAccess(user) {
  if (!user) return false
  
  try {
    // Method 1: Check custom claims
    const idTokenResult = await user.getIdTokenResult()
    if (idTokenResult.claims.businessAccess || idTokenResult.claims.admin) {
      return true
    }
    
    // Method 2: Check Firestore for user role
    // const userDoc = await getDoc(doc(db, 'users', user.uid))
    // const userData = userDoc.data()
    // return userData?.role === 'business' || userData?.role === 'admin'
    
    // Method 3: Check if user has any releases in catalog (is an artist/label)
    // const catalogQuery = query(collection(db, 'releases'), where('userId', '==', user.uid), limit(1))
    // const snapshot = await getDocs(catalogQuery)
    // return !snapshot.empty
    
    // For now, you might want to check localStorage or a simple flag
    return localStorage.getItem('userType') === 'business'
  } catch (error) {
    console.error('Error checking business access:', error)
    return false
  }
}

// After successful login, check for redirect
router.afterEach((to, from) => {
  if (to.name === 'home' || to.name === 'dashboard') {
    const redirectPath = localStorage.getItem('redirectAfterLogin')
    if (redirectPath) {
      localStorage.removeItem('redirectAfterLogin')
      router.push(redirectPath)
    }
  }
})

export default router