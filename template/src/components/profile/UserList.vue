<!-- template/src/components/profile/UserList.vue -->
<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../../composables/useAuth'
import { useSocial } from '../../composables/useSocial'

const props = defineProps({
  users: {
    type: Array,
    required: true
  },
  viewMode: {
    type: String,
    default: 'list', // 'list', 'grid'
    validator: (value) => ['list', 'grid'].includes(value)
  },
  emptyIcon: {
    type: String,
    default: 'users'
  },
  emptyTitle: {
    type: String,
    default: 'No users found'
  },
  emptyMessage: {
    type: String,
    default: 'Try adjusting your search or check back later'
  },
  hasMore: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['visit', 'follow', 'unfollow', 'load-more'])

const router = useRouter()
const auth = useAuth()
const social = useSocial()

// State
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  user: null
})

// Methods
function isCurrentUser(user) {
  return user.id === auth.user.value?.uid
}

function visitProfile(user) {
  emit('visit', user)
  router.push(`/profile/${user.id}`)
}

async function toggleFollow(user) {
  user.isFollowing = !user.isFollowing
  
  if (user.isFollowing) {
    emit('follow', user)
    await social.followUser(user.id)
  } else {
    emit('unfollow', user)
    await social.unfollowUser(user.id)
  }
}

function showOptions(user, event) {
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    user
  }
}

// Context menu actions
function visitProfileFromMenu() {
  if (contextMenu.value.user) {
    visitProfile(contextMenu.value.user)
  }
  contextMenu.value.show = false
}

function messageUser() {
  // TODO: Implement messaging
  console.log('Message user:', contextMenu.value.user?.displayName)
  contextMenu.value.show = false
}

function shareProfile() {
  if (contextMenu.value.user) {
    const url = `${window.location.origin}/profile/${contextMenu.value.user.id}`
    navigator.clipboard.writeText(url)
  }
  contextMenu.value.show = false
}

async function unfollowUser() {
  if (contextMenu.value.user) {
    contextMenu.value.user.isFollowing = false
    emit('unfollow', contextMenu.value.user)
    await social.unfollowUser(contextMenu.value.user.id)
  }
  contextMenu.value.show = false
}

function blockUser() {
  // TODO: Implement blocking
  console.log('Block user:', contextMenu.value.user?.displayName)
  contextMenu.value.show = false
}

// Utilities
function formatNumber(num) {
  if (!num) return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

function formatMutualText(mutuals) {
  if (!mutuals || mutuals.length === 0) return ''
  
  if (mutuals.length === 1) {
    return mutuals[0].displayName
  } else if (mutuals.length === 2) {
    return `${mutuals[0].displayName} and ${mutuals[1].displayName}`
  } else {
    const others = mutuals.length - 2
    return `${mutuals[0].displayName}, ${mutuals[1].displayName} and ${others} other${others > 1 ? 's' : ''}`
  }
}

function handleAvatarError(e) {
  e.target.src = '/default-avatar.png'
}

// Global click handler
document.addEventListener('click', (e) => {
  if (!e.target.closest('.context-menu') && !e.target.closest('.options-btn')) {
    contextMenu.value.show = false
  }
})
</script>

<template>
  <div class="user-list">
    <!-- Empty State -->
    <div v-if="!users || users.length === 0" class="empty-state">
      <font-awesome-icon :icon="emptyIcon" />
      <h3>{{ emptyTitle }}</h3>
      <p>{{ emptyMessage }}</p>
    </div>

    <!-- Users Grid/List -->
    <div v-else :class="['users-container', `view-${viewMode}`]">
      <div 
        v-for="user in users" 
        :key="user.id"
        class="user-item"
        @click="visitProfile(user)"
      >
        <!-- Avatar -->
        <div class="user-avatar">
          <img 
            :src="user.avatar || '/default-avatar.png'" 
            :alt="user.displayName"
            @error="handleAvatarError"
          />
          <span v-if="user.verified" class="verified-badge">
            <font-awesome-icon icon="check-circle" />
          </span>
        </div>

        <!-- Info -->
        <div class="user-info">
          <h4 class="user-name">
            {{ user.displayName }}
            <span v-if="user.isArtist" class="artist-badge">Artist</span>
          </h4>
          <p class="user-username">@{{ user.username }}</p>
          
          <p v-if="user.bio" class="user-bio">{{ user.bio }}</p>
          
          <div class="user-stats">
            <span v-if="user.followers" class="stat">
              {{ formatNumber(user.followers) }} followers
            </span>
            <span v-if="user.following" class="stat">
              {{ formatNumber(user.following) }} following
            </span>
            <span v-if="user.trackCount" class="stat">
              {{ user.trackCount }} tracks
            </span>
          </div>

          <!-- Mutual Followers -->
          <div v-if="user.mutualFollowers && user.mutualFollowers.length > 0" class="mutual-followers">
            <div class="mutual-avatars">
              <img 
                v-for="mutual in user.mutualFollowers.slice(0, 3)" 
                :key="mutual.id"
                :src="mutual.avatar || '/default-avatar.png'"
                :alt="mutual.displayName"
                :title="mutual.displayName"
                @error="handleAvatarError"
              />
            </div>
            <span class="mutual-text">
              Followed by {{ formatMutualText(user.mutualFollowers) }}
            </span>
          </div>
        </div>

        <!-- Actions -->
        <div class="user-actions">
          <button 
            v-if="!isCurrentUser(user)"
            @click.stop="toggleFollow(user)" 
            class="follow-btn"
            :class="{ following: user.isFollowing }"
          >
            <font-awesome-icon :icon="user.isFollowing ? 'check' : 'plus'" />
            {{ user.isFollowing ? 'Following' : 'Follow' }}
          </button>
          
          <button 
            @click.stop="showOptions(user, $event)" 
            class="options-btn"
          >
            <font-awesome-icon icon="ellipsis-h" />
          </button>
        </div>
      </div>
    </div>

    <!-- Load More -->
    <div v-if="hasMore" class="load-more">
      <button @click="$emit('load-more')" class="btn btn-secondary">
        Load More
      </button>
    </div>

    <!-- Context Menu -->
    <transition name="fade">
      <div 
        v-if="contextMenu.show" 
        class="context-menu"
        :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
      >
        <button @click="visitProfileFromMenu">
          <font-awesome-icon icon="user" />
          View Profile
        </button>
        <button v-if="!isCurrentUser(contextMenu.user)" @click="messageUser">
          <font-awesome-icon icon="envelope" />
          Send Message
        </button>
        <button @click="shareProfile">
          <font-awesome-icon icon="share" />
          Share Profile
        </button>
        <button v-if="contextMenu.user?.isFollowing" @click="unfollowUser">
          <font-awesome-icon icon="user-minus" />
          Unfollow
        </button>
        <button @click="blockUser" class="danger">
          <font-awesome-icon icon="ban" />
          Block User
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.user-list {
  width: 100%;
}

.empty-state {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-text-secondary);
}

.empty-state svg {
  font-size: 3rem;
  margin-bottom: var(--space-lg);
  opacity: 0.5;
}

/* List View */
.users-container.view-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.view-list .user-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-base);
}

.view-list .user-item:hover {
  background: var(--color-bg-tertiary);
  transform: translateX(4px);
}

/* Grid View */
.users-container.view-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--space-lg);
}

.view-grid .user-item {
  padding: var(--space-lg);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  text-align: center;
  cursor: pointer;
  transition: all var(--transition-base);
}

.view-grid .user-item:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

/* Avatar */
.user-avatar {
  position: relative;
  flex-shrink: 0;
}

.view-list .user-avatar img {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-full);
  object-fit: cover;
}

.view-grid .user-avatar img {
  width: 100px;
  height: 100px;
  border-radius: var(--radius-full);
  object-fit: cover;
  margin: 0 auto var(--space-md);
}

.verified-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 20px;
  height: 20px;
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-surface);
  font-size: var(--text-xs);
}

.view-grid .verified-badge {
  width: 24px;
  height: 24px;
  right: calc(50% - 50px);
}

/* Info */
.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-xs);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.view-grid .user-name {
  justify-content: center;
}

.artist-badge {
  padding: 2px 6px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.user-username {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
}

.user-bio {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.user-stats {
  display: flex;
  gap: var(--space-md);
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}

.view-grid .user-stats {
  justify-content: center;
  margin-bottom: var(--space-md);
}

/* Mutual Followers */
.mutual-followers {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.mutual-avatars {
  display: flex;
}

.mutual-avatars img {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  border: 2px solid var(--color-surface);
  margin-left: -8px;
}

.mutual-avatars img:first-child {
  margin-left: 0;
}

.mutual-text {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

/* Actions */
.user-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.view-grid .user-actions {
  justify-content: center;
}

.follow-btn {
  padding: var(--space-sm) var(--space-md);
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-base);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.follow-btn:hover {
  transform: scale(1.05);
}

.follow-btn.following {
  background: transparent;
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

.options-btn {
  padding: var(--space-sm);
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: color var(--transition-base);
}

.options-btn:hover {
  color: var(--color-text-primary);
}

/* Context Menu */
.context-menu {
  position: fixed;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 1000;
  min-width: 200px;
  padding: var(--space-xs);
}

.context-menu button {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-base);
  border-radius: var(--radius-sm);
}

.context-menu button:hover {
  background: var(--color-bg-secondary);
}

.context-menu button.danger {
  color: var(--color-error);
}

/* Load More */
.load-more {
  text-align: center;
  margin-top: var(--space-xl);
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>