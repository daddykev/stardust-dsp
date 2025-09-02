<!-- template/src/views/Browse.vue -->
<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCatalog } from '@/composables/useCatalog'
import { usePlayer } from '@/composables/usePlayer'
import { useLibrary } from '@/composables/useLibrary'
import { recommendationsService } from '@/services/recommendations'

const route = useRoute()
const router = useRouter()
const catalog = useCatalog()
const player = usePlayer()
const library = useLibrary()

// State
const activeSection = ref(route.params.category || 'all')
const activeChart = ref('top50')
const newReleasesFilter = ref('all')
const selectedPodcastCategory = ref('All')

// Data
const sections = ref([
  { id: 'all', label: 'All' },
  { id: 'genres', label: 'Genres & Moods' },
  { id: 'new', label: 'New Releases' },
  { id: 'charts', label: 'Charts' },
  { id: 'discover', label: 'Discover' },
  { id: 'podcasts', label: 'Podcasts' }
])

const featuredBanner = ref({
  tag: 'FEATURED PLAYLIST',
  title: 'Today\'s Top Hits',
  description: 'The biggest songs right now. Cover: The Weeknd',
  image: '/featured-banner.jpg'
})

const categories = ref([
  { id: 'pop', name: 'Pop', color: '#FF6B6B', icon: 'music' },
  { id: 'hiphop', name: 'Hip-Hop', color: '#4ECDC4', icon: 'microphone' },
  { id: 'rock', name: 'Rock', color: '#45B7D1', icon: 'guitar' },
  { id: 'electronic', name: 'Electronic', color: '#96CEB4', icon: 'headphones' },
  { id: 'rnb', name: 'R&B', color: '#DDA0DD', icon: 'heart' },
  { id: 'latin', name: 'Latin', color: '#FFD93D', icon: 'fire' },
  { id: 'country', name: 'Country', color: '#6C5CE7', icon: 'hat-cowboy' },
  { id: 'jazz', name: 'Jazz', color: '#FFA07A', icon: 'saxophone' },
  { id: 'classical', name: 'Classical', color: '#98D8C8', icon: 'music' },
  { id: 'metal', name: 'Metal', color: '#2C3E50', icon: 'bolt' },
  { id: 'indie', name: 'Indie', color: '#F39C12', icon: 'compact-disc' },
  { id: 'workout', name: 'Workout', color: '#E74C3C', icon: 'dumbbell' },
  { id: 'chill', name: 'Chill', color: '#3498DB', icon: 'couch' },
  { id: 'party', name: 'Party', color: '#9B59B6', icon: 'glass-cheers' },
  { id: 'focus', name: 'Focus', color: '#1ABC9C', icon: 'brain' },
  { id: 'sleep', name: 'Sleep', color: '#34495E', icon: 'moon' }
])

const personalizedPlaylists = ref([])
const popularGenres = ref([])
const allGenres = ref([
  'Pop', 'Rock', 'Hip-Hop', 'R&B', 'Electronic', 'Country', 
  'Jazz', 'Classical', 'Metal', 'Indie', 'Alternative', 'Latin',
  'Reggae', 'Blues', 'Folk', 'Soul', 'Funk', 'Disco',
  'Punk', 'Reggaeton', 'K-Pop', 'J-Pop', 'Afrobeat', 'Gospel'
])

const moods = ref([
  { 
    id: 'happy', 
    name: 'Happy', 
    description: 'Upbeat and positive vibes',
    icon: 'smile', 
    gradient: 'linear-gradient(135deg, #667eea, #764ba2)' 
  },
  { 
    id: 'sad', 
    name: 'Sad', 
    description: 'Emotional and melancholic',
    icon: 'sad-tear', 
    gradient: 'linear-gradient(135deg, #f093fb, #f5576c)' 
  },
  { 
    id: 'energetic', 
    name: 'Energetic', 
    description: 'High energy and motivation',
    icon: 'bolt', 
    gradient: 'linear-gradient(135deg, #fa709a, #fee140)' 
  },
  { 
    id: 'relaxed', 
    name: 'Relaxed', 
    description: 'Calm and peaceful',
    icon: 'spa', 
    gradient: 'linear-gradient(135deg, #a8edea, #fed6e3)' 
  },
  { 
    id: 'romantic', 
    name: 'Romantic', 
    description: 'Love and romance',
    icon: 'heart', 
    gradient: 'linear-gradient(135deg, #ff9a9e, #fecfef)' 
  },
  { 
    id: 'focused', 
    name: 'Focused', 
    description: 'Concentration and productivity',
    icon: 'brain', 
    gradient: 'linear-gradient(135deg, #6a11cb, #2575fc)' 
  }
])

const newReleases = ref([])
const hasMoreNewReleases = ref(true)

const charts = ref([
  { id: 'top50', name: 'Top 50', icon: 'globe' },
  { id: 'viral', name: 'Viral 50', icon: 'fire' },
  { id: 'local', name: 'Top Local', icon: 'map-marker-alt' },
  { id: 'global', name: 'Global Top 100', icon: 'world' }
])

const activeChartData = ref({
  name: 'Top 50',
  description: 'The most played tracks right now',
  tracks: []
})

const recommendedArtists = ref([])
const similarItems = ref([])
const featuredShows = ref([])
const latestEpisodes = ref([])

const podcastCategories = ref([
  'All', 'News', 'Comedy', 'True Crime', 'Sports', 
  'Technology', 'Business', 'Health', 'Education', 'Music'
])

// Computed
const filteredNewReleases = computed(() => {
  if (newReleasesFilter.value === 'all') return newReleases.value
  
  if (newReleasesFilter.value === 'albums') {
    return newReleases.value.filter(r => r.type === 'Album')
  }
  
  return newReleases.value.filter(r => r.type === 'Single' || r.type === 'EP')
})

// Methods
async function loadBrowseData() {
  // Load personalized playlists
  personalizedPlaylists.value = await recommendationsService.getRecommendations(auth.user.value?.uid, 'playlists')
  
  // Load new releases
  newReleases.value = await catalog.getNewReleases(20)
  
  // Load chart data
  loadChartData()
  
  // Load recommended artists
  recommendedArtists.value = await recommendationsService.getRecommendations(auth.user.value?.uid, 'artists')
  
  // Load similar items
  similarItems.value = await recommendationsService.getSimilarToTaste(auth.user.value?.uid)
}

async function loadChartData() {
  // Load tracks for active chart
  const chartTracks = await catalog.getChartTracks(activeChart.value)
  activeChartData.value.tracks = chartTracks
}

// Navigation
function browseCategory(category) {
  router.push(`/browse/${category.id}`)
}

function exploreGenre(genre) {
  router.push(`/genre/${genre.id}`)
}

function filterByGenre(genre) {
  router.push(`/search?genre=${genre}`)
}

function browseMood(mood) {
  router.push(`/mood/${mood.id}`)
}

function openPlaylist(playlist) {
  router.push(`/playlists/${playlist.id}`)
}

function openRelease(release) {
  router.push(`/releases/${release.id}`)
}

function openArtist(artist) {
  router.push(`/artists/${artist.id}`)
}

function openShow(show) {
  router.push(`/podcasts/${show.id}`)
}

function openItem(item) {
  const routes = {
    artist: `/artists/${item.id}`,
    album: `/releases/${item.id}`,
    playlist: `/playlists/${item.id}`,
    track: `/tracks/${item.id}`
  }
  router.push(routes[item.type] || '/')
}

// Playback
function playFeatured() {
  console.log('Play featured playlist')
}

function playPlaylist(playlist) {
  console.log('Play playlist:', playlist.id)
}

function playRelease(release) {
  console.log('Play release:', release.id)
}

function playTrack(track) {
  player.playTrack(track)
}

function playChart() {
  if (activeChartData.value.tracks.length > 0) {
    player.clearQueue()
    activeChartData.value.tracks.forEach(track => player.addToQueue(track))
    player.playTrack(activeChartData.value.tracks[0])
  }
}

function playEpisode(episode) {
  console.log('Play episode:', episode.id)
}

// Actions
async function likeRelease(release) {
  release.isLiked = !release.isLiked
  if (release.isLiked) {
    await library.addFavorite(release.id, 'albums')
  } else {
    await library.removeFavorite(release.id, 'albums')
  }
}

async function likeTrack(track) {
  track.isLiked = !track.isLiked
  if (track.isLiked) {
    await library.addFavorite(track.id, 'tracks')
  } else {
    await library.removeFavorite(track.id, 'tracks')
  }
}

function addToQueue(track) {
  player.addToQueue(track)
}

function showTrackOptions(track) {
  console.log('Show options for:', track.title)
}

async function followArtist(artist) {
  artist.isFollowing = !artist.isFollowing
  // TODO: Implement follow logic
}

function followChart() {
  console.log('Follow chart playlist')
}

function followShow(show) {
  console.log('Follow show:', show.id)
}

// Utility functions
function refreshPersonalized() {
  loadBrowseData()
}

function loadMoreNewReleases() {
  console.log('Load more new releases')
  // TODO: Implement pagination
}

function startRadio() {
  router.push('/radio')
}

function discoverWeekly() {
  router.push('/playlist/discover-weekly')
}

function releaseRadar() {
  router.push('/playlist/release-radar')
}

function timeCapsule() {
  router.push('/playlist/time-capsule')
}

function filterPodcasts(category) {
  selectedPodcastCategory.value = category
  // TODO: Filter podcasts
}

function getRankClass(index) {
  if (index === 0) return 'gold'
  if (index === 1) return 'silver'
  if (index === 2) return 'bronze'
  return ''
}

function getChangeClass(change) {
  if (change > 0) return 'up'
  if (change < 0) return 'down'
  return 'stable'
}

function formatDate(date) {
  if (!date) return ''
  const d = date.toDate ? date.toDate() : new Date(date)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes} min`
}

function formatNumber(num) {
  if (!num) return '0'
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

// Watch route changes
watch(() => route.params.category, (category) => {
  if (category) {
    activeSection.value = category
  }
})

// Load data on mount
onMounted(() => {
  loadBrowseData()
})
</script>

<template>
  <div class="browse-page">
    <!-- Page Header -->
    <div class="browse-header">
      <h1>Browse</h1>
      <div class="browse-nav">
        <button 
          v-for="section in sections" 
          :key="section.id"
          @click="activeSection = section.id"
          :class="['nav-btn', { active: activeSection === section.id }]"
        >
          {{ section.label }}
        </button>
      </div>
    </div>

    <!-- All Categories -->
    <div v-if="activeSection === 'all'" class="browse-all">
      <!-- Featured Section -->
      <section class="featured-section">
        <div class="featured-banner" :style="{ backgroundImage: `url(${featuredBanner.image})` }">
          <div class="featured-content">
            <span class="featured-tag">{{ featuredBanner.tag }}</span>
            <h2>{{ featuredBanner.title }}</h2>
            <p>{{ featuredBanner.description }}</p>
            <button @click="playFeatured" class="btn btn-primary btn-lg">
              <font-awesome-icon icon="play" />
              Play Now
            </button>
          </div>
        </div>
      </section>

      <!-- Browse Categories Grid -->
      <section class="categories-section">
        <h2>Browse All</h2>
        <div class="categories-grid">
          <div 
            v-for="category in categories" 
            :key="category.id"
            class="category-card"
            :style="{ backgroundColor: category.color }"
            @click="browseCategory(category)"
          >
            <h3>{{ category.name }}</h3>
            <img v-if="category.image" :src="category.image" :alt="category.name" />
            <font-awesome-icon v-else :icon="category.icon" class="category-icon" />
          </div>
        </div>
      </section>

      <!-- Made For You -->
      <section class="personalized-section">
        <div class="section-header">
          <h2>Made For You</h2>
          <button @click="refreshPersonalized" class="btn-text">
            <font-awesome-icon icon="sync" />
            Refresh
          </button>
        </div>
        <div class="playlist-grid">
          <div 
            v-for="playlist in personalizedPlaylists" 
            :key="playlist.id"
            class="playlist-card card"
            @click="openPlaylist(playlist)"
          >
            <div class="playlist-cover">
              <img :src="playlist.cover || '/placeholder-playlist.png'" :alt="playlist.title" />
              <div class="playlist-overlay">
                <button @click.stop="playPlaylist(playlist)" class="play-btn">
                  <font-awesome-icon icon="play" />
                </button>
              </div>
            </div>
            <div class="playlist-info">
              <h4>{{ playlist.title }}</h4>
              <p>{{ playlist.description }}</p>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Genres Section -->
    <div v-if="activeSection === 'genres'" class="genres-section">
      <h2>Genres & Moods</h2>
      
      <!-- Popular Genres -->
      <div class="genre-categories">
        <div 
          v-for="genre in popularGenres" 
          :key="genre.id"
          class="genre-card"
          :style="{ backgroundImage: `url(${genre.image})` }"
          @click="exploreGenre(genre)"
        >
          <div class="genre-overlay">
            <h3>{{ genre.name }}</h3>
            <span>{{ genre.trackCount }} tracks</span>
          </div>
        </div>
      </div>

      <!-- All Genres Grid -->
      <h3>All Genres</h3>
      <div class="all-genres-grid">
        <button 
          v-for="genre in allGenres" 
          :key="genre"
          @click="filterByGenre(genre)"
          class="genre-tag"
        >
          {{ genre }}
        </button>
      </div>

      <!-- Mood Categories -->
      <h3>Browse by Mood</h3>
      <div class="mood-grid">
        <div 
          v-for="mood in moods" 
          :key="mood.id"
          class="mood-card"
          :style="{ background: mood.gradient }"
          @click="browseMood(mood)"
        >
          <font-awesome-icon :icon="mood.icon" />
          <h4>{{ mood.name }}</h4>
          <p>{{ mood.description }}</p>
        </div>
      </div>
    </div>

    <!-- New Releases Section -->
    <div v-if="activeSection === 'new'" class="new-releases-section">
      <div class="section-header">
        <h2>New Releases</h2>
        <div class="filter-controls">
          <select v-model="newReleasesFilter" class="form-select">
            <option value="all">All Releases</option>
            <option value="albums">Albums</option>
            <option value="singles">Singles & EPs</option>
          </select>
        </div>
      </div>

      <div class="releases-grid">
        <div 
          v-for="release in filteredNewReleases" 
          :key="release.id"
          class="release-card card"
          @click="openRelease(release)"
        >
          <div class="release-cover">
            <img :src="release.artworkUrl || '/placeholder-album.png'" :alt="release.title" />
            <div class="release-badge">NEW</div>
            <div class="release-overlay">
              <button @click.stop="playRelease(release)" class="play-btn">
                <font-awesome-icon icon="play" />
              </button>
              <button @click.stop="likeRelease(release)" class="like-btn">
                <font-awesome-icon :icon="release.isLiked ? 'heart' : ['far', 'heart']" />
              </button>
            </div>
          </div>
          <div class="release-info">
            <h4>{{ release.title }}</h4>
            <router-link :to="`/artists/${release.artistId}`" class="artist-link">
              {{ release.artist }}
            </router-link>
            <div class="release-meta">
              <span class="release-type">{{ release.type }}</span>
              <span class="release-date">{{ formatDate(release.releaseDate) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Load More -->
      <div v-if="hasMoreNewReleases" class="load-more">
        <button @click="loadMoreNewReleases" class="btn btn-secondary">
          Load More
        </button>
      </div>
    </div>

    <!-- Charts Section -->
    <div v-if="activeSection === 'charts'" class="charts-section">
      <h2>Charts</h2>
      
      <!-- Chart Categories -->
      <div class="chart-tabs">
        <button 
          v-for="chart in charts" 
          :key="chart.id"
          @click="activeChart = chart.id"
          :class="['chart-tab', { active: activeChart === chart.id }]"
        >
          <font-awesome-icon :icon="chart.icon" />
          {{ chart.name }}
        </button>
      </div>

      <!-- Active Chart -->
      <div class="chart-content">
        <div class="chart-header">
          <h3>{{ activeChartData.name }}</h3>
          <p>{{ activeChartData.description }}</p>
          <div class="chart-actions">
            <button @click="playChart" class="btn btn-primary">
              <font-awesome-icon icon="play" />
              Play Top 50
            </button>
            <button @click="followChart" class="btn btn-secondary">
              <font-awesome-icon icon="plus" />
              Follow Playlist
            </button>
          </div>
        </div>

        <!-- Chart Tracks -->
        <div class="chart-tracks">
          <div 
            v-for="(track, index) in activeChartData.tracks" 
            :key="track.id"
            class="chart-track"
            @click="playTrack(track)"
          >
            <div class="track-rank" :class="getRankClass(index)">
              <span class="rank-number">{{ index + 1 }}</span>
              <span class="rank-change" :class="getChangeClass(track.change)">
                <font-awesome-icon v-if="track.change > 0" icon="arrow-up" />
                <font-awesome-icon v-else-if="track.change < 0" icon="arrow-down" />
                <font-awesome-icon v-else icon="minus" />
                <span v-if="track.change !== 0">{{ Math.abs(track.change) }}</span>
              </span>
            </div>
            
            <img 
              :src="track.artworkUrl || '/placeholder-album.png'" 
              :alt="track.title"
              class="track-artwork"
            />
            
            <div class="track-info">
              <h4>{{ track.title }}</h4>
              <p>{{ track.artist }}</p>
            </div>
            
            <div class="track-stats">
              <span class="plays">
                <font-awesome-icon icon="play" />
                {{ formatNumber(track.plays) }}
              </span>
            </div>
            
            <div class="track-actions">
              <button @click.stop="addToQueue(track)" class="btn-icon">
                <font-awesome-icon icon="plus" />
              </button>
              <button @click.stop="likeTrack(track)" class="btn-icon">
                <font-awesome-icon :icon="track.isLiked ? 'heart' : ['far', 'heart']" />
              </button>
              <button @click.stop="showTrackOptions(track)" class="btn-icon">
                <font-awesome-icon icon="ellipsis-h" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Discover Section -->
    <div v-if="activeSection === 'discover'" class="discover-section">
      <h2>Discover</h2>
      
      <!-- Discovery Tools -->
      <div class="discovery-tools">
        <div class="tool-card" @click="startRadio">
          <div class="tool-icon" style="background: linear-gradient(135deg, #667eea, #764ba2)">
            <font-awesome-icon icon="broadcast-tower" />
          </div>
          <h3>Song Radio</h3>
          <p>Start radio from a song</p>
        </div>
        
        <div class="tool-card" @click="discoverWeekly">
          <div class="tool-icon" style="background: linear-gradient(135deg, #f093fb, #f5576c)">
            <font-awesome-icon icon="calendar" />
          </div>
          <h3>Discover Weekly</h3>
          <p>Your weekly mixtape</p>
        </div>
        
        <div class="tool-card" @click="releaseRadar">
          <div class="tool-icon" style="background: linear-gradient(135deg, #4facfe, #00f2fe)">
            <font-awesome-icon icon="radar" />
          </div>
          <h3>Release Radar</h3>
          <p>New music Friday</p>
        </div>
        
        <div class="tool-card" @click="timeCapsule">
          <div class="tool-icon" style="background: linear-gradient(135deg, #43e97b, #38f9d7)">
            <font-awesome-icon icon="history" />
          </div>
          <h3>Time Capsule</h3>
          <p>Songs from your past</p>
        </div>
      </div>

      <!-- Recommended Artists -->
      <div class="recommended-section">
        <h3>Recommended Artists</h3>
        <div class="artists-carousel">
          <div 
            v-for="artist in recommendedArtists" 
            :key="artist.id"
            class="artist-card"
            @click="openArtist(artist)"
          >
            <img 
              :src="artist.imageUrl || '/placeholder-artist.png'" 
              :alt="artist.name"
              class="artist-image"
            />
            <h4>{{ artist.name }}</h4>
            <p>{{ formatNumber(artist.followers) }} followers</p>
            <button @click.stop="followArtist(artist)" class="btn btn-sm" :class="artist.isFollowing ? 'btn-secondary' : 'btn-primary'">
              {{ artist.isFollowing ? 'Following' : 'Follow' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Similar To Your Taste -->
      <div class="similar-section">
        <h3>Similar to Your Taste</h3>
        <div class="similar-grid">
          <div 
            v-for="item in similarItems" 
            :key="item.id"
            class="similar-item"
            @click="openItem(item)"
          >
            <img :src="item.image || '/placeholder.png'" :alt="item.name" />
            <div class="similar-info">
              <h4>{{ item.name }}</h4>
              <p>{{ item.type }} • {{ item.description }}</p>
              <div class="match-indicator">
                <div class="match-bar" :style="{ width: item.matchPercent + '%' }"></div>
                <span>{{ item.matchPercent }}% match</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Podcasts Section -->
    <div v-if="activeSection === 'podcasts'" class="podcasts-section">
      <h2>Podcasts</h2>
      
      <!-- Podcast Categories -->
      <div class="podcast-categories">
        <button 
          v-for="category in podcastCategories" 
          :key="category"
          @click="filterPodcasts(category)"
          :class="['category-btn', { active: selectedPodcastCategory === category }]"
        >
          {{ category }}
        </button>
      </div>

      <!-- Featured Shows -->
      <h3>Featured Shows</h3>
      <div class="shows-grid">
        <div 
          v-for="show in featuredShows" 
          :key="show.id"
          class="show-card card"
          @click="openShow(show)"
        >
          <img :src="show.cover || '/placeholder-podcast.png'" :alt="show.title" />
          <div class="show-info">
            <h4>{{ show.title }}</h4>
            <p class="show-author">{{ show.author }}</p>
            <p class="show-description">{{ show.description }}</p>
            <button @click.stop="followShow(show)" class="btn btn-sm btn-primary">
              <font-awesome-icon icon="plus" />
              Follow
            </button>
          </div>
        </div>
      </div>

      <!-- Latest Episodes -->
      <h3>Latest Episodes</h3>
      <div class="episodes-list">
        <div 
          v-for="episode in latestEpisodes" 
          :key="episode.id"
          class="episode-item"
          @click="playEpisode(episode)"
        >
          <img :src="episode.showCover || '/placeholder-podcast.png'" :alt="episode.showTitle" />
          <div class="episode-info">
            <h4>{{ episode.title }}</h4>
            <p class="episode-show">{{ episode.showTitle }}</p>
            <div class="episode-meta">
              <span>{{ formatDate(episode.publishDate) }}</span>
              <span>•</span>
              <span>{{ formatDuration(episode.duration) }}</span>
            </div>
            <p class="episode-description">{{ episode.description }}</p>
          </div>
          <button @click.stop="playEpisode(episode)" class="play-episode-btn">
            <font-awesome-icon icon="play-circle" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.browse-page {
  padding: var(--space-lg);
  max-width: 1400px;
  margin: 0 auto;
}

/* Header */
.browse-header {
  margin-bottom: var(--space-xl);
}

.browse-header h1 {
  font-size: var(--text-3xl);
  margin-bottom: var(--space-lg);
}

.browse-nav {
  display: flex;
  gap: var(--space-md);
  border-bottom: 1px solid var(--color-border);
  overflow-x: auto;
}

.nav-btn {
  padding: var(--space-md) 0;
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  position: relative;
  white-space: nowrap;
  transition: color var(--transition-base);
}

.nav-btn.active {
  color: var(--color-text-primary);
}

.nav-btn.active::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-primary);
}

/* Featured Section */
.featured-banner {
  height: 300px;
  border-radius: var(--radius-lg);
  background-size: cover;
  background-position: center;
  position: relative;
  margin-bottom: var(--space-xl);
  overflow: hidden;
}

.featured-content {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--space-xl);
  background: linear-gradient(transparent, rgba(0,0,0,0.8));
  color: white;
}

.featured-tag {
  display: inline-block;
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  text-transform: uppercase;
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-sm);
}

.featured-content h2 {
  font-size: var(--text-3xl);
  margin-bottom: var(--space-sm);
}

.featured-content p {
  margin-bottom: var(--space-lg);
  opacity: 0.9;
}

/* Categories Grid */
.categories-section h2 {
  margin-bottom: var(--space-lg);
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.category-card {
  aspect-ratio: 1;
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: transform var(--transition-base);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.category-card:hover {
  transform: scale(1.05);
}

.category-card h3 {
  color: white;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  position: relative;
  z-index: 1;
}

.category-card img {
  position: absolute;
  bottom: -10px;
  right: -10px;
  width: 80px;
  height: 80px;
  transform: rotate(25deg);
  opacity: 0.9;
}

.category-icon {
  position: absolute;
  bottom: 10px;
  right: 10px;
  font-size: 3rem;
  color: rgba(255, 255, 255, 0.3);
}

/* Playlist Grid */
.playlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-lg);
}

.playlist-card {
  cursor: pointer;
  transition: transform var(--transition-base);
}

.playlist-card:hover {
  transform: translateY(-4px);
}

.playlist-cover {
  position: relative;
  margin-bottom: var(--space-md);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.playlist-cover img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.playlist-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition-base);
}

.playlist-card:hover .playlist-overlay {
  opacity: 1;
}

.play-btn {
  width: 48px;
  height: 48px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--transition-base);
}

.play-btn:hover {
  transform: scale(1.1);
}

.playlist-info h4 {
  font-size: var(--text-md);
  margin-bottom: var(--space-xs);
}

.playlist-info p {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* Genres Section */
.genre-categories {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.genre-card {
  height: 150px;
  border-radius: var(--radius-lg);
  background-size: cover;
  background-position: center;
  position: relative;
  cursor: pointer;
  overflow: hidden;
  transition: transform var(--transition-base);
}

.genre-card:hover {
  transform: scale(1.05);
}

.genre-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(transparent, rgba(0,0,0,0.8));
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: var(--space-md);
  color: white;
}

.genre-overlay h3 {
  font-size: var(--text-xl);
  margin-bottom: var(--space-xs);
}

.all-genres-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-bottom: var(--space-xl);
}

.genre-tag {
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-secondary);
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all var(--transition-base);
}

.genre-tag:hover {
  background: var(--color-primary);
  color: white;
}

/* Mood Grid */
.mood-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-lg);
}

.mood-card {
  padding: var(--space-lg);
  border-radius: var(--radius-lg);
  color: white;
  text-align: center;
  cursor: pointer;
  transition: transform var(--transition-base);
}

.mood-card:hover {
  transform: scale(1.05);
}

.mood-card svg {
  font-size: 2rem;
  margin-bottom: var(--space-md);
}

.mood-card h4 {
  margin-bottom: var(--space-sm);
}

.mood-card p {
  font-size: var(--text-sm);
  opacity: 0.9;
}

/* New Releases */
.releases-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.release-card {
  cursor: pointer;
  transition: transform var(--transition-base);
}

.release-card:hover {
  transform: translateY(-4px);
}

.release-cover {
  position: relative;
  margin-bottom: var(--space-md);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.release-cover img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.release-badge {
  position: absolute;
  top: var(--space-sm);
  left: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
}

.release-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.release-card:hover .release-overlay {
  opacity: 1;
}

.like-btn {
  width: 40px;
  height: 40px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
}

.release-info h4 {
  font-size: var(--text-md);
  margin-bottom: var(--space-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.artist-link {
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: var(--text-sm);
}

.artist-link:hover {
  text-decoration: underline;
}

.release-meta {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-xs);
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

/* Charts */
.chart-tabs {
  display: flex;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
  overflow-x: auto;
}

.chart-tab {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-secondary);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-base);
}

.chart-tab.active {
  background: var(--color-primary);
  color: white;
}

.chart-header {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  margin-bottom: var(--space-lg);
}

.chart-header h3 {
  font-size: var(--text-xl);
  margin-bottom: var(--space-sm);
}

.chart-header p {
  color: var(--color-text-secondary);
  margin-bottom: var(--space-lg);
}

.chart-actions {
  display: flex;
  gap: var(--space-md);
}

.chart-tracks {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.chart-track {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
}

.chart-track:hover {
  background: var(--color-bg-tertiary);
  transform: translateX(4px);
}

.track-rank {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 50px;
}

.rank-number {
  font-size: var(--text-lg);
  font-weight: var(--font-bold);
}

.track-rank.gold .rank-number {
  color: #FFD700;
}

.track-rank.silver .rank-number {
  color: #C0C0C0;
}

.track-rank.bronze .rank-number {
  color: #CD7F32;
}

.rank-change {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: var(--text-xs);
}

.rank-change.up {
  color: var(--color-success);
}

.rank-change.down {
  color: var(--color-error);
}

.rank-change.stable {
  color: var(--color-text-tertiary);
}

.track-artwork {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  object-fit: cover;
}

.track-info {
  flex: 1;
}

.track-info h4 {
  font-size: var(--text-md);
  margin-bottom: var(--space-xs);
}

.track-info p {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.track-stats {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.track-actions {
  display: flex;
  gap: var(--space-sm);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.chart-track:hover .track-actions {
  opacity: 1;
}

/* Discover Section */
.discovery-tools {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.tool-card {
  text-align: center;
  padding: var(--space-lg);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: transform var(--transition-base);
}

.tool-card:hover {
  transform: translateY(-4px);
}

.tool-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto var(--space-md);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: white;
}

.tool-card h3 {
  margin-bottom: var(--space-sm);
}

.tool-card p {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

/* Artists Carousel */
.artists-carousel {
  display: flex;
  gap: var(--space-lg);
  overflow-x: auto;
  padding: var(--space-sm);
  margin-bottom: var(--space-xl);
}

.artist-card {
  flex: 0 0 160px;
  text-align: center;
  cursor: pointer;
}

.artist-image {
  width: 120px;
  height: 120px;
  border-radius: var(--radius-full);
  object-fit: cover;
  margin: 0 auto var(--space-md);
}

.artist-card h4 {
  margin-bottom: var(--space-xs);
}

.artist-card p {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-md);
}

/* Similar Section */
.similar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-lg);
}

.similar-item {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
}

.similar-item:hover {
  background: var(--color-bg-tertiary);
}

.similar-item img {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-md);
  object-fit: cover;
}

.similar-info {
  flex: 1;
}

.similar-info h4 {
  margin-bottom: var(--space-xs);
}

.similar-info p {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
}

.match-indicator {
  position: relative;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-full);
  height: 20px;
  overflow: hidden;
}

.match-bar {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-full);
}

.match-indicator span {
  position: relative;
  z-index: 1;
  display: block;
  text-align: center;
  font-size: var(--text-xs);
  line-height: 20px;
}

/* Podcasts */
.podcast-categories {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
  overflow-x: auto;
}

.category-btn {
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-secondary);
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-base);
}

.category-btn.active {
  background: var(--color-primary);
  color: white;
}

.shows-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.show-card {
  text-align: center;
  cursor: pointer;
}

.show-card img {
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  margin-bottom: var(--space-md);
}

.show-info h4 {
  font-size: var(--text-md);
  margin-bottom: var(--space-xs);
}

.show-author {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-sm);
}

.show-description {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  margin-bottom: var(--space-md);
}

.episodes-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.episode-item {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
}

.episode-item:hover {
  background: var(--color-bg-tertiary);
}

.episode-item img {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-md);
  object-fit: cover;
}

.episode-info {
  flex: 1;
}

.episode-info h4 {
  margin-bottom: var(--space-xs);
}

.episode-show {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-xs);
}

.episode-meta {
  display: flex;
  gap: var(--space-sm);
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-bottom: var(--space-sm);
}

.episode-description {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.play-episode-btn {
  align-self: center;
  background: none;
  border: none;
  font-size: 2rem;
  color: var(--color-primary);
  cursor: pointer;
  transition: transform var(--transition-base);
}

.play-episode-btn:hover {
  transform: scale(1.1);
}

/* Load More */
.load-more {
  text-align: center;
  margin-top: var(--space-xl);
}

/* Section Headers */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.filter-controls {
  display: flex;
  gap: var(--space-md);
}

.form-select {
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
}

/* Responsive */
@media (max-width: 768px) {
  .categories-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }
  
  .releases-grid,
  .shows-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
  
  .chart-track {
    flex-wrap: wrap;
  }
  
  .track-stats,
  .track-actions {
    display: none;
  }
}
</style>