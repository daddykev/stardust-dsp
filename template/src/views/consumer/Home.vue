<!-- template/src/views/Home.vue -->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useLibrary } from '../composables/useLibrary'
import { useCatalog } from '../composables/useCatalog'
import { usePlayer } from '../composables/usePlayer'
import AlbumCarousel from '../components/browse/AlbumCarousel.vue'
import ArtistCarousel from '../components/browse/ArtistCarousel.vue'
import TrackList from '../components/browse/TrackList.vue'

const router = useRouter()
const auth = useAuth()
const library = useLibrary()
const catalog = useCatalog()
const player = usePlayer()

// State
const recentItems = ref([])
const recommendedPlaylists = ref([])
const newReleases = ref([])
const trendingTracks = ref([])
const followedArtists = ref([])
const discoverWeekly = ref({})
const selectedGenre = ref('All')
const trendingGenres = ref(['All', 'Pop', 'Rock', 'Hip-Hop', 'Electronic', 'R&B'])

const moods = ref([
  { id: 'chill', name: 'Chill', icon: 'couch', color: '#4A90E2' },
  { id: 'workout', name: 'Workout', icon: 'dumbbell', color: '#E94B3C' },
  { id: 'focus', name: 'Focus', icon: 'brain', color: '#6B5B95' },
  { id: 'party', name: 'Party', icon: 'glass-cheers', color: '#F7786B' },
  { id: 'sleep', name: 'Sleep', icon: 'moon', color: '#034F84' },
  { id: 'romance', name: 'Romance', icon: 'heart', color: '#F18973' }
])

// Computed
const userName = computed(() => auth.user.value?.displayName || 'there')
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
})

const subtitle = computed(() => {
  const day = new Date().getDay()
  if (day === 1) return "It's Monday! Here's your Discover Weekly"
  if (day === 5) return "It's Friday! Check out new releases"
  return 'Pick up where you left off'
})

// Load personalized content
async function loadHomeContent() {
  // Load recently played
  recentItems.value = await library.getRecentlyPlayed(6)
  
  // Generate recommendations (placeholder)
  recommendedPlaylists.value = await generateRecommendations()
  
  // Load new releases
  newReleases.value = await catalog.getNewReleases(8)
  
  // Load trending
  trendingTracks.value = await catalog.getTrendingTracks(10)
  
  // Load followed artists
  followedArtists.value = await library.getFollowedArtists(10)
  
  // Generate Discover Weekly
  discoverWeekly.value = await generateDiscoverWeekly()
}

// Recommendation engine (placeholder)
async function generateRecommendations() {
  // TODO: Implement ML-based recommendations
  return [
    {
      id: 'daily-mix-1',
      title: 'Daily Mix 1',
      description: 'Based on your recent listening',
      coverUrl: '/placeholder-playlist.png'
    },
    {
      id: 'release-radar',
      title: 'Release Radar',
      description: 'New music from artists you follow',
      coverUrl: '/placeholder-playlist.png'
    },
    {
      id: 'time-capsule',
      title: 'Time Capsule',
      description: 'Songs you loved a year ago',
      coverUrl: '/placeholder-playlist.png'
    }
  ]
}

async function generateDiscoverWeekly() {
  // TODO: Implement weekly discovery playlist generation
  return {
    trackCount: 30,
    duration: '2hr 15min',
    tracks: []
  }
}

// Actions
function shufflePlay() {
  // Play random selection from user's library
  library.shuffleLibrary()
}

function resumeListening() {
  if (player.currentTrack.value) {
    player.play()
  } else if (recentItems.value.length > 0) {
    playItem(recentItems.value[0])
  }
}

function playItem(item) {
  if (item.type === 'track') {
    player.playTrack(item)
  } else if (item.type === 'album') {
    router.push(`/releases/${item.id}`)
  } else if (item.type === 'playlist') {
    router.push(`/playlists/${item.id}`)
  }
}

function playPlaylist(playlist) {
  router.push(`/playlists/${playlist.id}`)
}

function playAlbum(album) {
  router.push(`/releases/${album.id}`)
}

function likeAlbum(album) {
  library.addFavorite(album.id, 'albums')
}

function refreshRecommendations() {
  loadHomeContent()
}

function filterTrending(genre) {
  selectedGenre.value = genre
  // TODO: Filter trending tracks by genre
}

function playDiscoverWeekly() {
  // TODO: Load and play Discover Weekly playlist
  console.log('Playing Discover Weekly')
}

function browseMood(mood) {
  router.push(`/browse/mood/${mood.id}`)
}

onMounted(() => {
  loadHomeContent()
})
</script>

<template>
  <div class="home-page">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-content">
        <h1>{{ greeting }}, {{ userName }}</h1>
        <p class="subtitle">{{ subtitle }}</p>
      </div>
      <div class="quick-actions">
        <button @click="shufflePlay" class="btn btn-primary">
          <font-awesome-icon icon="random" />
          Shuffle My Music
        </button>
        <button @click="resumeListening" class="btn btn-secondary">
          <font-awesome-icon icon="play" />
          Resume Listening
        </button>
      </div>
    </section>

    <!-- Recently Played -->
    <section class="section recently-played-section">
      <div class="section-header">
        <h2>Jump Back In</h2>
        <router-link to="/library?tab=history" class="see-all">See all</router-link>
      </div>
      <div class="recent-grid">
        <div 
          v-for="item in recentItems" 
          :key="item.id"
          class="recent-item card-hover"
          @click="playItem(item)"
        >
          <img :src="item.artworkUrl || '/placeholder-album.png'" :alt="item.title" />
          <div class="recent-info">
            <h4>{{ item.title }}</h4>
            <p>{{ item.type }}</p>
          </div>
          <button class="play-btn">
            <font-awesome-icon icon="play-circle" />
          </button>
        </div>
      </div>
    </section>

    <!-- Recommendations -->
    <section class="section recommendations-section">
      <div class="section-header">
        <h2>Made For You</h2>
        <button @click="refreshRecommendations" class="btn-text">
          <font-awesome-icon icon="sync" />
          Refresh
        </button>
      </div>
      <div class="playlist-carousel">
        <div 
          v-for="playlist in recommendedPlaylists" 
          :key="playlist.id"
          class="playlist-card card"
        >
          <div class="playlist-cover" :style="{ backgroundImage: `url(${playlist.coverUrl})` }">
            <div class="playlist-overlay">
              <h3>{{ playlist.title }}</h3>
              <p>{{ playlist.description }}</p>
            </div>
          </div>
          <button @click="playPlaylist(playlist)" class="btn btn-primary btn-block">
            Play Now
          </button>
        </div>
      </div>
    </section>

    <!-- New Releases -->
    <section class="section new-releases-section">
      <div class="section-header">
        <h2>New Releases</h2>
        <router-link to="/browse/new" class="see-all">See all</router-link>
      </div>
      <AlbumCarousel :albums="newReleases" @play="playAlbum" @like="likeAlbum" />
    </section>

    <!-- Trending Now -->
    <section class="section trending-section">
      <div class="section-header">
        <h2>Trending Now</h2>
        <div class="filter-pills">
          <button 
            v-for="genre in trendingGenres" 
            :key="genre"
            @click="filterTrending(genre)"
            :class="['pill', { active: selectedGenre === genre }]"
          >
            {{ genre }}
          </button>
        </div>
      </div>
      <TrackList :tracks="trendingTracks" :show-stats="true" />
    </section>

    <!-- Your Artists -->
    <section class="section artists-section">
      <div class="section-header">
        <h2>Your Artists</h2>
        <router-link to="/library?tab=artists" class="see-all">See all</router-link>
      </div>
      <ArtistCarousel :artists="followedArtists" />
    </section>

    <!-- Discover Weekly -->
    <section class="section discover-section">
      <div class="discover-banner card">
        <div class="discover-content">
          <h2>Discover Weekly</h2>
          <p>Your weekly mixtape of fresh music. Updated every Monday.</p>
          <div class="discover-stats">
            <span><font-awesome-icon icon="music" /> {{ discoverWeekly.trackCount }} songs</span>
            <span><font-awesome-icon icon="clock" /> {{ discoverWeekly.duration }}</span>
          </div>
        </div>
        <button @click="playDiscoverWeekly" class="btn btn-primary btn-lg">
          <font-awesome-icon icon="play" />
          Play Now
        </button>
      </div>
    </section>

    <!-- Mood & Activities -->
    <section class="section mood-section">
      <div class="section-header">
        <h2>Music for every mood</h2>
      </div>
      <div class="mood-grid">
        <div 
          v-for="mood in moods" 
          :key="mood.id"
          class="mood-card"
          :style="{ backgroundColor: mood.color }"
          @click="browseMood(mood)"
        >
          <font-awesome-icon :icon="mood.icon" />
          <h3>{{ mood.name }}</h3>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Home page styles using CSS variables */
.home-page {
  padding: var(--space-lg);
  max-width: 1400px;
  margin: 0 auto;
}

.hero-section {
  margin-bottom: var(--space-xl);
  padding: var(--space-xl);
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  border-radius: var(--radius-lg);
  color: white;
}

.hero-content h1 {
  font-size: var(--text-3xl);
  margin-bottom: var(--space-sm);
}

.subtitle {
  opacity: 0.9;
  margin-bottom: var(--space-lg);
}

.quick-actions {
  display: flex;
  gap: var(--space-md);
}

.section {
  margin-bottom: var(--space-xl);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.see-all {
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: var(--text-sm);
}

.see-all:hover {
  text-decoration: underline;
}

.recent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-md);
}

.recent-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
}

.recent-item:hover {
  background: var(--color-bg-tertiary);
}

.recent-item img {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
}

.recent-info {
  flex: 1;
}

.recent-info h4 {
  font-size: var(--text-sm);
  margin-bottom: var(--space-xs);
}

.recent-info p {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.play-btn {
  opacity: 0;
  transition: opacity var(--transition-base);
}

.recent-item:hover .play-btn {
  opacity: 1;
}

/* Carousel styles */
.playlist-carousel {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--space-lg);
}

.playlist-card {
  overflow: hidden;
}

.playlist-cover {
  height: 250px;
  background-size: cover;
  background-position: center;
  position: relative;
}

.playlist-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--space-md);
  background: linear-gradient(transparent, rgba(0,0,0,0.8));
  color: white;
}

/* Filter pills */
.filter-pills {
  display: flex;
  gap: var(--space-sm);
}

.pill {
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-full);
  background: var(--color-bg-secondary);
  border: none;
  cursor: pointer;
  transition: all var(--transition-base);
}

.pill.active {
  background: var(--color-primary);
  color: white;
}

/* Discover banner */
.discover-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-xl);
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.discover-stats {
  display: flex;
  gap: var(--space-lg);
  margin-top: var(--space-md);
  opacity: 0.9;
}

/* Mood grid */
.mood-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-md);
}

.mood-card {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  border-radius: var(--radius-lg);
  color: white;
  cursor: pointer;
  transition: transform var(--transition-base);
}

.mood-card:hover {
  transform: scale(1.05);
}

.mood-card svg {
  font-size: 2rem;
}
</style>