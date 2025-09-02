<!-- template/src/components/profile/ActivityFeed.vue -->
<script setup>
import { useRouter } from 'vue-router'
import { usePlayer } from '../../composables/usePlayer'

const props = defineProps({
  activities: {
    type: Array,
    required: true
  },
  hasMore: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['like', 'comment', 'share', 'load-more'])

const router = useRouter()
const player = usePlayer()

// Activity text mapping
function getActivityText(activity) {
  const actions = {
    'follow': 'started following',
    'like': 'liked',
    'playlist_create': 'created a playlist',
    'playlist_update': 'updated playlist',
    'share': 'shared',
    'listen': 'listened to',
    'release': 'released',
    'comment': 'commented on',
    'review': 'reviewed'
  }
  
  return actions[activity.type] || activity.type
}

// Navigation
function openTarget(activity) {
  if (!activity.target) return
  
  const routes = {
    track: `/tracks/${activity.target.id}`,
    album: `/releases/${activity.target.id}`,
    playlist: `/playlists/${activity.target.id}`,
    artist: `/artists/${activity.target.id}`,
    user: `/profile/${activity.target.id}`
  }
  
  const route = routes[activity.target.type]
  if (route) {
    router.push(route)
  }
}

// Playback
function playTarget(target) {
  if (target.type === 'track') {
    player.playTrack(target)
  } else {
    console.log('Play:', target.type, target.id)
  }
}

// Actions
function likeActivity(activity) {
  activity.isLiked = !activity.isLiked
  activity.likeCount = (activity.likeCount || 0) + (activity.isLiked ? 1 : -1)
  emit('like', activity)
}

function commentActivity(activity) {
  emit('comment', activity)
}

function shareActivity(activity) {
  emit('share', activity)
}

// Utilities
function formatTime(timestamp) {
  if (!timestamp) return ''
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  const now = new Date()
  const diff = Math.floor((now - date) / 1000)
  
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  })
}

function formatNumber(num) {
  if (!num) return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  return `${mins} min`
}

function handleAvatarError(e) {
  e.target.src = '/default-avatar.png'
}

function handleTargetImageError(e) {
  e.target.src = '/placeholder-album.png'
}
</script>

<template>
  <div class="activity-feed">
    <!-- Empty State -->
    <div v-if="!activities || activities.length === 0" class="empty-state">
      <font-awesome-icon icon="stream" />
      <h3>No activity yet</h3>
      <p>When you and the people you follow do things, they'll show up here</p>
    </div>

    <!-- Activity List -->
    <div v-else class="activity-list">
      <div 
        v-for="activity in activities" 
        :key="activity.id"
        class="activity-item"
      >
        <!-- User Avatar -->
        <router-link 
          :to="`/profile/${activity.userId}`" 
          class="activity-avatar"
        >
          <img 
            :src="activity.userAvatar || '/default-avatar.png'" 
            :alt="activity.userName"
            @error="handleAvatarError"
          />
        </router-link>

        <!-- Activity Content -->
        <div class="activity-content">
          <!-- Activity Header -->
          <div class="activity-header">
            <router-link 
              :to="`/profile/${activity.userId}`" 
              class="user-link"
            >
              {{ activity.userName }}
            </router-link>
            <span class="activity-action">{{ getActivityText(activity) }}</span>
            <span class="activity-time">{{ formatTime(activity.timestamp) }}</span>
          </div>

          <!-- Activity Target -->
          <div v-if="activity.target" class="activity-target" @click="openTarget(activity)">
            <img 
              v-if="activity.target.image"
              :src="activity.target.image" 
              :alt="activity.target.name"
              class="target-image"
              @error="handleTargetImageError"
            />
            <div class="target-info">
              <h4>{{ activity.target.name }}</h4>
              <p>{{ activity.target.subtitle }}</p>
            </div>
            <button 
              v-if="activity.target.playable"
              @click.stop="playTarget(activity.target)" 
              class="play-btn"
            >
              <font-awesome-icon icon="play" />
            </button>
          </div>

          <!-- Activity Message -->
          <p v-if="activity.message" class="activity-message">
            {{ activity.message }}
          </p>

          <!-- Activity Stats -->
          <div v-if="activity.stats" class="activity-stats">
            <span v-if="activity.stats.plays" class="stat">
              <font-awesome-icon icon="play" />
              {{ formatNumber(activity.stats.plays) }} plays
            </span>
            <span v-if="activity.stats.likes" class="stat">
              <font-awesome-icon icon="heart" />
              {{ formatNumber(activity.stats.likes) }}
            </span>
            <span v-if="activity.stats.duration" class="stat">
              <font-awesome-icon icon="clock" />
              {{ formatDuration(activity.stats.duration) }}
            </span>
          </div>

          <!-- Activity Actions -->
          <div class="activity-actions">
            <button 
              @click="likeActivity(activity)" 
              class="action-btn"
              :class="{ liked: activity.isLiked }"
            >
              <font-awesome-icon :icon="activity.isLiked ? 'heart' : ['far', 'heart']" />
              <span v-if="activity.likeCount">{{ activity.likeCount }}</span>
            </button>
            
            <button 
              @click="commentActivity(activity)" 
              class="action-btn"
            >
              <font-awesome-icon :icon="['far', 'comment']" />
              <span v-if="activity.commentCount">{{ activity.commentCount }}</span>
            </button>
            
            <button 
              @click="shareActivity(activity)" 
              class="action-btn"
            >
              <font-awesome-icon icon="share" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Load More -->
    <div v-if="hasMore" class="load-more">
      <button @click="$emit('load-more')" class="btn btn-secondary">
        Load More Activity
      </button>
    </div>
  </div>
</template>

<style scoped>
.activity-feed {
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

.activity-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.activity-item {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-lg);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  transition: all var(--transition-base);
}

.activity-item:hover {
  background: var(--color-bg-tertiary);
}

.activity-avatar {
  flex-shrink: 0;
}

.activity-avatar img {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  object-fit: cover;
}

.activity-content {
  flex: 1;
  min-width: 0;
}

.activity-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
  flex-wrap: wrap;
}

.user-link {
  font-weight: var(--font-semibold);
  color: var(--color-text-primary);
  text-decoration: none;
}

.user-link:hover {
  text-decoration: underline;
}

.activity-action {
  color: var(--color-text-secondary);
}

.activity-time {
  margin-left: auto;
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
}

.activity-target {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  margin: var(--space-md) 0;
  cursor: pointer;
  transition: all var(--transition-base);
}

.activity-target:hover {
  transform: translateX(4px);
}

.target-image {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-sm);
  object-fit: cover;
}

.target-info {
  flex: 1;
  min-width: 0;
}

.target-info h4 {
  font-weight: var(--font-medium);
  margin-bottom: var(--space-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.target-info p {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.play-btn {
  width: 40px;
  height: 40px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform var(--transition-base);
}

.play-btn:hover {
  transform: scale(1.1);
}

.activity-message {
  margin: var(--space-md) 0;
  line-height: 1.6;
}

.activity-stats {
  display: flex;
  gap: var(--space-lg);
  margin: var(--space-md) 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.stat {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.activity-actions {
  display: flex;
  gap: var(--space-lg);
  margin-top: var(--space-md);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: color var(--transition-base);
  font-size: var(--text-sm);
}

.action-btn:hover {
  color: var(--color-text-primary);
}

.action-btn.liked {
  color: var(--color-primary);
}

.load-more {
  text-align: center;
  margin-top: var(--space-xl);
}
</style>