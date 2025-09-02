<!-- template/src/views/Profile.vue -->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useProfile } from '../composables/useProfile'
import PlaylistCard from '../components/library/PlaylistCard.vue'
import RecentlyPlayedList from '../components/profile/RecentlyPlayedList.vue'
import UserList from '../components/profile/UserList.vue'
import ActivityFeed from '../components/profile/ActivityFeed.vue'
import EditProfileModal from '../components/profile/EditProfileModal.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const profileService = useProfile()

// State
const userId = ref(route.params.id || auth.user.value?.uid)
const profile = ref({})
const stats = ref({
  followers: 0,
  following: 0,
  playlists: 0
})
const activeTab = ref('playlists')
const isFollowing = ref(false)
const showEditModal = ref(false)

const publicPlaylists = ref([])
const recentlyPlayed = ref([])
const followingList = ref([])
const followersList = ref([])
const activities = ref([])

// Computed
const isOwnProfile = computed(() => {
  return userId.value === auth.user.value?.uid
})

const tabs = computed(() => {
  const baseTabs = [
    { id: 'playlists', label: 'Playlists' },
    { id: 'activity', label: 'Activity' }
  ]
  
  if (isOwnProfile.value || !profile.value.privateProfile) {
    baseTabs.push(
      { id: 'recent', label: 'Recently Played' },
      { id: 'following', label: 'Following' },
      { id: 'followers', label: 'Followers' }
    )
  }
  
  return baseTabs
})

// Load profile data
async function loadProfile() {
  profile.value = await profileService.getProfile(userId.value)
  stats.value = await profileService.getProfileStats(userId.value)
  
  if (!isOwnProfile.value) {
    isFollowing.value = await profileService.isFollowing(userId.value)
  }
  
  loadTabData()
}

async function loadTabData() {
  switch (activeTab.value) {
    case 'playlists':
      publicPlaylists.value = await profileService.getPublicPlaylists(userId.value)
      break
    case 'recent':
      recentlyPlayed.value = await profileService.getRecentlyPlayed(userId.value)
      break
    case 'following':
      followingList.value = await profileService.getFollowing(userId.value)
      break
    case 'followers':
      followersList.value = await profileService.getFollowers(userId.value)
      break
    case 'activity':
      activities.value = await profileService.getActivity(userId.value)
      break
  }
}

// Actions
function editProfile() {
  showEditModal.value = true
}

async function saveProfile(updatedProfile) {
  await profileService.updateProfile(updatedProfile)
  profile.value = updatedProfile
  showEditModal.value = false
}

async function changeAvatar() {
  // TODO: Implement avatar upload
  console.log('Change avatar')
}

async function changeCover() {
  // TODO: Implement cover upload
  console.log('Change cover')
}

async function toggleFollow() {
  if (isFollowing.value) {
    await profileService.unfollow(userId.value)
  } else {
    await profileService.follow(userId.value)
  }
  isFollowing.value = !isFollowing.value
  stats.value.followers += isFollowing.value ? 1 : -1
}

function shareProfile() {
  const url = window.location.href
  navigator.clipboard.writeText(url)
  console.log('Profile link copied')
}

function showOptions() {
  // TODO: Show profile options menu
  console.log('Show options')
}

function createPlaylist() {
  router.push('/playlists/new')
}

function playPlaylist(playlist) {
  router.push(`/playlists/${playlist.id}`)
}

function editPlaylist(playlist) {
  router.push(`/playlists/${playlist.id}/edit`)
}

function visitProfile(user) {
  router.push(`/profile/${user.id}`)
}

onMounted(() => {
  loadProfile()
})
</script>

<template>
  <div class="profile-page">
    <!-- Profile Header -->
    <div class="profile-header">
      <div class="profile-cover" :style="{ backgroundImage: `url(${profile.coverImage})` }">
        <button @click="changeCover" class="change-cover-btn">
          <font-awesome-icon icon="camera" />
          Change Cover
        </button>
      </div>
      
      <div class="profile-info">
        <div class="profile-avatar">
          <img :src="profile.avatar || '/default-avatar.png'" :alt="profile.displayName" />
          <button @click="changeAvatar" class="change-avatar-btn">
            <font-awesome-icon icon="camera" />
          </button>
        </div>
        
        <div class="profile-details">
          <h1>{{ profile.displayName }}</h1>
          <p class="profile-username">@{{ profile.username }}</p>
          <p class="profile-bio">{{ profile.bio }}</p>
          
          <div class="profile-stats">
            <div class="stat">
              <span class="stat-value">{{ stats.followers }}</span>
              <span class="stat-label">Followers</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ stats.following }}</span>
              <span class="stat-label">Following</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ stats.playlists }}</span>
              <span class="stat-label">Playlists</span>
            </div>
          </div>
          
          <div class="profile-actions">
            <button v-if="!isOwnProfile" @click="toggleFollow" class="btn" :class="isFollowing ? 'btn-secondary' : 'btn-primary'">
              {{ isFollowing ? 'Following' : 'Follow' }}
            </button>
            <button v-if="isOwnProfile" @click="editProfile" class="btn btn-secondary">
              <font-awesome-icon icon="edit" />
              Edit Profile
            </button>
            <button @click="shareProfile" class="btn btn-icon">
              <font-awesome-icon icon="share" />
            </button>
            <button @click="showOptions" class="btn btn-icon">
              <font-awesome-icon icon="ellipsis-h" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Profile Tabs -->
    <div class="profile-tabs">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        @click="activeTab = tab.id"
        :class="['tab', { active: activeTab === tab.id }]"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      <!-- Public Playlists -->
      <div v-if="activeTab === 'playlists'" class="playlists-section">
        <div class="section-header">
          <h2>Public Playlists</h2>
          <button v-if="isOwnProfile" @click="createPlaylist" class="btn btn-sm btn-primary">
            <font-awesome-icon icon="plus" />
            Create Playlist
          </button>
        </div>
        
        <div class="playlists-grid">
          <PlaylistCard 
            v-for="playlist in publicPlaylists" 
            :key="playlist.id"
            :playlist="playlist"
            @play="playPlaylist"
            @edit="editPlaylist"
          />
        </div>
      </div>

      <!-- Recently Played -->
      <div v-if="activeTab === 'recent'" class="recent-section">
        <h2>Recently Played</h2>
        <RecentlyPlayedList :items="recentlyPlayed" />
      </div>

      <!-- Following -->
      <div v-if="activeTab === 'following'" class="following-section">
        <h2>Following</h2>
        <UserList :users="followingList" @visit="visitProfile" />
      </div>

      <!-- Followers -->
      <div v-if="activeTab === 'followers'" class="followers-section">
        <h2>Followers</h2>
        <UserList :users="followersList" @visit="visitProfile" />
      </div>

      <!-- Activity -->
      <div v-if="activeTab === 'activity'" class="activity-section">
        <h2>Recent Activity</h2>
        <ActivityFeed :activities="activities" />
      </div>
    </div>

    <!-- Edit Profile Modal -->
    <EditProfileModal 
      v-if="showEditModal"
      :profile="profile"
      @save="saveProfile"
      @close="showEditModal = false"
    />
  </div>
</template>

<style scoped>
/* Profile styles following the design system */
.profile-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-lg);
}

.profile-header {
  margin-bottom: var(--space-xl);
}

.profile-cover {
  height: 300px;
  background-size: cover;
  background-position: center;
  border-radius: var(--radius-lg);
  position: relative;
  margin-bottom: -50px;
}

.change-cover-btn {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.profile-info {
  display: flex;
  gap: var(--space-xl);
  padding: 0 var(--space-xl);
}

.profile-avatar {
  position: relative;
  z-index: 1;
}

.profile-avatar img {
  width: 150px;
  height: 150px;
  border-radius: var(--radius-full);
  border: 4px solid var(--color-surface);
}

.change-avatar-btn {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 40px;
  height: 40px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-details {
  flex: 1;
  padding-top: 60px;
}

.profile-details h1 {
  font-size: var(--text-3xl);
  margin-bottom: var(--space-xs);
}

.profile-username {
  color: var(--color-text-secondary);
  margin-bottom: var(--space-md);
}

.profile-bio {
  margin-bottom: var(--space-lg);
  line-height: 1.6;
}

.profile-stats {
  display: flex;
  gap: var(--space-xl);
  margin-bottom: var(--space-lg);
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
}

.stat-label {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.profile-actions {
  display: flex;
  gap: var(--space-md);
}

/* Tabs */
.profile-tabs {
  display: flex;
  gap: var(--space-lg);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--space-xl);
}

.tab {
  padding: var(--space-md) 0;
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  position: relative;
  transition: color var(--transition-base);
}

.tab.active {
  color: var(--color-text-primary);
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-primary);
}

/* Content sections */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.playlists-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-lg);
}
</style>