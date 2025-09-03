// template/src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { auth, db } from '@/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

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
let userRole = null

// Wait for auth to be ready
onAuthStateChanged(auth, async (user) => {
  currentUser = user
  
  if (user) {
    // Fetch user role from Firestore
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      if (userDoc.exists()) {
        userRole = userDoc.data().role || userDoc.data().userType || 'consumer'
      }
    } catch (error) {
      console.error('Error fetching user role:', error)
      userRole = 'consumer'
    }
  } else {
    userRole = null
  }
  
  isAuthReady = true
})

// Main navigation guard
router.beforeEach(async (to, from, next) => {
  // Wait for auth to be ready
  if (!isAuthReady) {
    await new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        currentUser = user
        if (user) {
          const userDoc = await getDoc(doc(db, 'users', user.uid))
          userRole = userDoc.exists() ? 
            (userDoc.data().role || userDoc.data().userType || 'consumer') : 
            'consumer'
        }
        isAuthReady = true
        unsubscribe()
        resolve()
      })
    })
  }

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const requiresBusinessAccess = to.matched.some(record => record.meta.requiresBusinessAccess)
  const requiresAdmin = to.matched.some(record => record.meta.requiresAdmin)

  // Redirect authenticated users away from login/signup
  if (currentUser && (to.name === 'login' || to.name === 'signup')) {
    // Admin users go to dashboard, others to home
    next(userRole === 'admin' ? '/dashboard' : '/home')
    return
  }

  // Handle routes that require authentication
  if (requiresAuth && !currentUser) {
    localStorage.setItem('redirectAfterLogin', to.fullPath)
    next('/login')
    return
  }

  // Check admin access
  if (requiresAdmin && userRole !== 'admin') {
    next('/home')
    return
  }

  // Check business access
  if (requiresBusinessAccess) {
    const hasBusinessAccess = ['admin', 'label', 'distributor'].includes(userRole)
    if (!hasBusinessAccess) {
      next('/home')
      return
    }
  }

  // Root path handling
  if (to.path === '/') {
    if (currentUser) {
      // Admin users default to dashboard
      if (userRole === 'admin') {
        next('/dashboard')
      } else if (['label', 'distributor'].includes(userRole)) {
        next('/dashboard')
      } else {
        next('/home')
      }
    } else {
      next() // Show splash page
    }
    return
  }

  next()
})

export default router