import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import SplashPage from '../views/SplashPage.vue'
import Login from '../views/Login.vue'
import Signup from '../views/Signup.vue'
import Dashboard from '../views/Dashboard.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: SplashPage
    },
    {
      path: '/login',
      name: 'login',
      component: Login,
      meta: { requiresGuest: true }
    },
    {
      path: '/signup',
      name: 'signup',
      component: Signup,
      meta: { requiresGuest: true }
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: Dashboard,
      meta: { requiresAuth: true }
    },
    // Catch-all route - redirect to home
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

// Navigation guard for protected routes
router.beforeEach(async (to, from, next) => {
  const { isAuthenticated, isLoading } = useAuth()
  
  // Wait for auth state to be determined
  if (isLoading.value) {
    // Wait for auth state to load
    await new Promise(resolve => {
      const unwatch = setInterval(() => {
        const { isLoading: loading } = useAuth()
        if (!loading.value) {
          clearInterval(unwatch)
          resolve()
        }
      }, 50)
    })
  }
  
  const { isAuthenticated: isAuth } = useAuth()
  
  if (to.meta.requiresAuth && !isAuth.value) {
    // Redirect to login if trying to access protected route
    next('/login')
  } else if (to.meta.requiresGuest && isAuth.value) {
    // Redirect to dashboard if trying to access guest-only route (login/signup)
    next('/dashboard')
  } else {
    next()
  }
})

export default router