// template/src/components/NavBar.vue
<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useDualAuth } from '@/composables/useDualAuth'

const props = defineProps({
  currentTheme: {
    type: String,
    default: 'light'
  }
})

const emit = defineEmits(['toggle-theme'])

const router = useRouter()
const route = useRoute()
const { 
  isAuthenticated, 
  userProfile, 
  userType,
  isAdmin,
  hasBusinessAccess,
  logout 
} = useDualAuth()

// State
const mobileMenuOpen = ref(false)
const userMenuOpen = ref(false)
const isBusinessMode = ref(false)

// Consumer navigation items
const consumerNavItems = [
  { name: 'Home', path: '/home', icon: 'home' },
  { name: 'Browse', path: '/browse', icon: 'compass' },
  { name: 'Search', path: '/search', icon: 'search' },
  { name: 'Library', path: '/library', icon: 'heart' },
  { name: 'Profile', path: '/profile', icon: 'user' }
]

// Business navigation items
const businessNavItems = computed(() => {
  const items = [
    { name: 'Dashboard', path: '/dashboard', icon: 'chart-bar' },
    { name: 'Catalog', path: '/catalog', icon: 'music' },
    { name: 'Ingestion', path: '/ingestion', icon: 'inbox' },
    { name: 'Distributors', path: '/distributors', icon: 'building' },
    { name: 'Settings', path: '/settings', icon: 'cog' }
  ]
  
  // Add admin-only links
  if (isAdmin.value) {
    items.push({ name: 'Users', path: '/admin/users', icon: 'users' })
  }
  
  return items
})

// Computed
const navigationItems = computed(() => {
  if (!isAuthenticated.value) return []
  return isBusinessMode.value ? businessNavItems.value : consumerNavItems
})

const userInitials = computed(() => {
  if (!userProfile.value) return 'U'
  const name = userProfile.value.displayName || userProfile.value.organizationName || ''
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'
})

// Methods
const detectCurrentMode = () => {
  // Admin users should default to business mode
  if (isAdmin.value && !route.path.startsWith('/home') && !route.path.startsWith('/browse')) {
    isBusinessMode.value = true
    return
  }
  
  // Detect based on current route
  const businessPaths = ['/dashboard', '/catalog', '/ingestion', '/distributors', '/analytics', '/settings', '/testing', '/admin']
  isBusinessMode.value = businessPaths.some(path => route.path.startsWith(path))
}

const toggleMode = () => {
  isBusinessMode.value = !isBusinessMode.value
  mobileMenuOpen.value = false
  
  // Navigate to appropriate home page
  if (isBusinessMode.value) {
    router.push('/dashboard')
  } else {
    router.push('/home')
  }
}

const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value
  userMenuOpen.value = false
}

const toggleUserMenu = () => {
  userMenuOpen.value = !userMenuOpen.value
}

const goToSearch = () => {
  router.push('/search')
}

const handleLogin = () => {
  router.push('/login')
  mobileMenuOpen.value = false
}

const handleSignup = () => {
  router.push('/signup')
  mobileMenuOpen.value = false
}

const handleLogout = async () => {
  try {
    await logout()
    router.push('/')
    mobileMenuOpen.value = false
    userMenuOpen.value = false
  } catch (error) {
    console.error('Logout error:', error)
  }
}

const isActiveRoute = (path) => {
  // Check for exact match first
  if (route.path === path) return true
  
  // Special cases for nested routes
  if (path === '/browse' && route.path.startsWith('/browse')) return true
  if (path === '/catalog' && route.path.startsWith('/catalog')) return true
  if (path === '/ingestion' && route.path.startsWith('/ingestion')) return true
  if (path === '/profile' && route.path.startsWith('/profile')) return true
  if (path === '/admin/users' && route.path.startsWith('/admin')) return true
  
  return false
}

// Click outside handler for user menu
const handleClickOutside = (event) => {
  const userMenuEl = document.querySelector('.user-menu')
  if (userMenuEl && !userMenuEl.contains(event.target)) {
    userMenuOpen.value = false
  }
}

// Watch for user type changes (e.g., when admin logs in)
watch(userType, (newType) => {
  if (newType === 'admin' && route.path === '/') {
    isBusinessMode.value = true
    router.push('/dashboard')
  }
})

// Watch for route changes
watch(route, detectCurrentMode)

// Lifecycle
onMounted(() => {
  detectCurrentMode()
  
  // Set business mode by default for admin users
  if (isAdmin.value) {
    isBusinessMode.value = true
  }
  
  document.addEventListener('click', handleClickOutside)
})
</script>

<template>
  <nav class="navbar">
    <div class="container">
      <div class="navbar-content">
        <!-- Logo -->
        <router-link :to="isAuthenticated ? (isBusinessMode ? '/dashboard' : '/home') : '/'" class="navbar-brand">
          <div class="logo">
            <font-awesome-icon icon="headphones" />
          </div>
          <span class="brand-text">Stardust DSP</span>
        </router-link>

        <!-- Desktop Navigation -->
        <div class="navbar-nav desktop-only" v-if="navigationItems.length > 0">
          <router-link 
            v-for="item in navigationItems" 
            :key="item.path"
            :to="item.path"
            class="nav-link"
            :class="{ active: isActiveRoute(item.path) }"
          >
            <font-awesome-icon :icon="item.icon" class="nav-icon" />
            {{ item.name }}
          </router-link>
        </div>

        <!-- Desktop Actions -->
        <div class="navbar-actions desktop-only">
          <!-- Mode Switcher (if user has both access) -->
          <div v-if="isAuthenticated && hasBusinessAccess" class="mode-switcher">
            <button 
              @click="toggleMode" 
              class="btn-mode"
              :title="`Switch to ${isBusinessMode ? 'Music' : 'Business'}`"
            >
              <font-awesome-icon :icon="isBusinessMode ? 'music' : 'briefcase'" />
              <span class="mode-label">{{ isBusinessMode ? 'Music' : 'Business' }}</span>
            </button>
          </div>

          <!-- Search (Consumer mode only) -->
          <button 
            v-if="isAuthenticated && !isBusinessMode" 
            @click="goToSearch" 
            class="btn-icon"
            aria-label="Search"
          >
            <font-awesome-icon icon="search" />
          </button>

          <!-- Theme Toggle -->
          <button @click="$emit('toggle-theme')" class="btn-icon" aria-label="Toggle theme">
            <font-awesome-icon :icon="currentTheme === 'light' ? 'moon' : 'sun'" />
          </button>

          <!-- Auth Buttons / User Menu -->
          <template v-if="!isAuthenticated">
            <button @click="handleLogin" class="btn btn-secondary btn-sm">
              Sign In
            </button>
            <button @click="handleSignup" class="btn btn-primary btn-sm">
              Get Started
            </button>
          </template>
          <template v-else>
            <div class="user-menu">
              <button class="user-avatar" @click="toggleUserMenu" :title="userProfile?.displayName || 'User Menu'">
                <span v-if="!userProfile?.avatar">{{ userInitials }}</span>
                <img v-else :src="userProfile.avatar" :alt="userProfile.displayName" />
              </button>
              
              <!-- User Dropdown -->
              <transition name="dropdown">
                <div v-if="userMenuOpen" class="user-dropdown">
                  <div class="dropdown-header">
                    <div class="user-info">
                      <strong>{{ userProfile?.displayName || 'User' }}</strong>
                      <span>{{ userProfile?.email }}</span>
                    </div>
                  </div>
                  <div class="dropdown-divider"></div>
                  <router-link 
                    v-if="!isBusinessMode" 
                    to="/profile" 
                    class="dropdown-item"
                    @click="userMenuOpen = false"
                  >
                    <font-awesome-icon icon="user" />
                    Your Profile
                  </router-link>
                  <router-link 
                    v-if="!isBusinessMode" 
                    to="/library" 
                    class="dropdown-item"
                    @click="userMenuOpen = false"
                  >
                    <font-awesome-icon icon="heart" />
                    Your Library
                  </router-link>
                  <router-link 
                    to="/settings" 
                    class="dropdown-item"
                    @click="userMenuOpen = false"
                  >
                    <font-awesome-icon icon="cog" />
                    Settings
                  </router-link>
                  <div class="dropdown-divider"></div>
                  <button @click="handleLogout" class="dropdown-item">
                    <font-awesome-icon icon="sign-out-alt" />
                    Sign Out
                  </button>
                </div>
              </transition>
            </div>
          </template>
        </div>

        <!-- Mobile Menu Button -->
        <button @click="toggleMobileMenu" class="mobile-menu-btn mobile-only" aria-label="Toggle menu">
          <font-awesome-icon :icon="mobileMenuOpen ? 'times' : 'bars'" />
        </button>
      </div>
    </div>

    <!-- Mobile Menu -->
    <transition name="slide">
      <div v-if="mobileMenuOpen" class="mobile-menu mobile-only">
        <div class="container">
          <!-- Mode Switcher Mobile -->
          <div v-if="isAuthenticated && hasBusinessAccess" class="mobile-mode-switcher">
            <button @click="toggleMode" class="btn btn-secondary btn-block">
              <font-awesome-icon :icon="isBusinessMode ? 'music' : 'briefcase'" />
              Switch to {{ isBusinessMode ? 'Music' : 'Business' }}
            </button>
          </div>
          
          <div class="mobile-nav" v-if="navigationItems.length > 0">
            <router-link 
              v-for="item in navigationItems" 
              :key="item.path"
              :to="item.path"
              class="mobile-nav-link"
              :class="{ active: isActiveRoute(item.path) }"
              @click="mobileMenuOpen = false"
            >
              <font-awesome-icon :icon="item.icon" class="nav-icon" />
              {{ item.name }}
            </router-link>
          </div>
          
          <div class="mobile-actions">
            <button @click="$emit('toggle-theme')" class="btn btn-secondary btn-sm">
              <font-awesome-icon :icon="currentTheme === 'light' ? 'moon' : 'sun'" />
              {{ currentTheme === 'light' ? 'Dark Mode' : 'Light Mode' }}
            </button>
            
            <template v-if="!isAuthenticated">
              <button @click="handleLogin" class="btn btn-secondary">
                Sign In
              </button>
              <button @click="handleSignup" class="btn btn-primary">
                Get Started
              </button>
            </template>
            <template v-else>
              <router-link 
                v-if="!isBusinessMode" 
                to="/profile" 
                class="btn btn-secondary"
                @click="mobileMenuOpen = false"
              >
                <font-awesome-icon icon="user" />
                Your Profile
              </router-link>
              <button @click="handleLogout" class="btn btn-secondary">
                <font-awesome-icon icon="sign-out-alt" />
                Sign Out
              </button>
            </template>
          </div>
        </div>
      </div>
    </transition>
  </nav>
</template>

<style scoped>
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: var(--z-dropdown);
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  backdrop-filter: blur(10px);
  background-color: rgba(255, 255, 255, 0.95);
}

[data-theme="dark"] .navbar {
  background-color: rgba(45, 45, 45, 0.95);
}

.navbar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  text-decoration: none;
  color: var(--color-heading);
  font-weight: var(--font-semibold);
  font-size: var(--text-lg);
}

.logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background-color: var(--color-primary);
  color: white;
  font-size: 18px;
  flex-shrink: 0;
}

.brand-text {
  white-space: nowrap;
}

.navbar-nav {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.nav-link {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-md);
  color: var(--color-text-secondary);
  text-decoration: none;
  border-radius: var(--radius-md);
  transition: all var(--transition-base);
  font-weight: var(--font-medium);
}

.nav-icon {
  font-size: 0.875rem;
}

.nav-link:hover {
  color: var(--color-text);
  background-color: var(--color-bg-secondary);
}

.nav-link.active {
  color: var(--color-primary);
  background-color: var(--color-primary-light);
}

.navbar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

/* Mode Switcher */
.mode-switcher {
  margin-right: var(--space-sm);
  padding-right: var(--space-sm);
  border-right: 1px solid var(--color-border);
}

.btn-mode {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-md);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  color: var(--color-text);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--transition-base);
}

.btn-mode:hover {
  background: var(--color-bg-tertiary);
  transform: translateY(-1px);
}

.mode-label {
  font-size: 0.7rem;
  display: none;
}

@media (min-width: 1024px) {
  .mode-label {
    display: inline;
  }
}

/* Button Icons */
.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  border: none;
  background-color: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-base);
  font-size: 1.125rem;
}

.btn-icon:hover {
  background-color: var(--color-bg-secondary);
  color: var(--color-text);
}

/* User Menu */
.user-menu {
  position: relative;
}

.user-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  background-color: var(--color-primary);
  color: white;
  border: none;
  cursor: pointer;
  font-weight: var(--font-semibold);
  transition: all var(--transition-base);
  overflow: hidden;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-avatar:hover {
  transform: scale(1.05);
}

/* User Dropdown */
.user-dropdown {
  position: absolute;
  top: calc(100% + var(--space-sm));
  right: 0;
  min-width: 240px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  z-index: 1000;
}

.dropdown-header {
  padding: var(--space-md);
  background: var(--color-bg-secondary);
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.user-info strong {
  font-weight: var(--font-semibold);
}

.user-info span {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.dropdown-divider {
  height: 1px;
  background: var(--color-border);
  margin: 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  background: none;
  border: none;
  color: var(--color-text);
  text-decoration: none;
  text-align: left;
  cursor: pointer;
  transition: all var(--transition-base);
}

.dropdown-item:hover {
  background: var(--color-bg-secondary);
}

/* Mobile Menu */
.mobile-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  background-color: transparent;
  color: var(--color-text);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all var(--transition-base);
  font-size: 1.25rem;
}

.mobile-menu-btn:hover {
  background-color: var(--color-bg-secondary);
}

.mobile-menu {
  position: fixed;
  top: 64px;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  overflow-y: auto;
}

.mobile-mode-switcher {
  padding: var(--space-md) 0;
  border-bottom: 1px solid var(--color-border);
}

.mobile-nav {
  padding: var(--space-md) 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.mobile-nav-link {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  color: var(--color-text);
  text-decoration: none;
  border-radius: var(--radius-md);
  transition: all var(--transition-base);
}

.mobile-nav-link:hover {
  background-color: var(--color-bg-secondary);
}

.mobile-nav-link.active {
  color: var(--color-primary);
  background-color: var(--color-primary-light);
}

.mobile-actions {
  padding: var(--space-md) 0;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.mobile-actions .btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  justify-content: center;
}

.btn-block {
  width: 100%;
  justify-content: center;
}

/* Responsive visibility utilities */
.desktop-only {
  display: flex;
}

.mobile-only {
  display: none;
}

@media (max-width: 768px) {
  .desktop-only {
    display: none;
  }
  
  .mobile-only {
    display: flex;
  }
  
  .mobile-menu.mobile-only {
    display: block;
  }
}

/* Transitions */
.slide-enter-active,
.slide-leave-active {
  transition: transform var(--transition-base), opacity var(--transition-base);
}

.slide-enter-from {
  transform: translateY(-10px);
  opacity: 0;
}

.slide-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: transform var(--transition-base), opacity var(--transition-base);
}

.dropdown-enter-from {
  transform: translateY(-10px);
  opacity: 0;
}

.dropdown-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}
</style>