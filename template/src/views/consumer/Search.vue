<!-- template/src/views/Search.vue -->
<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCatalog } from '@/composables/useCatalog'
import { useDebounce } from '@/composables/useDebounce'
import TrackList from '@/components/browse/TrackList.vue'
import ArtistGrid from '@/components/browse/ArtistGrid.vue'
import AlbumGrid from '@/components/browse/AlbumGrid.vue'
import PlaylistGrid from '@/components/browse/PlaylistGrid.vue'

const router = useRouter()
const catalog = useCatalog()

// State
const searchQuery = ref('')
const searchInputRef = ref(null)
const activeTab = ref('all')
const showFilters = ref(false)
const searchPerformed = ref(false)
const topResult = ref(null)
const recentSearches = ref([])

const results = ref({
  tracks: [],
  artists: [],
  albums: [],
  playlists: []
})

const filters = ref({
  genres: [],
  releaseDate: '',
  duration: { min: 0, max: 600 },
  explicit: true,
  verified: false
})

const genres = ref([
  'Pop', 'Rock', 'Hip-Hop', 'R&B', 'Electronic', 'Country', 
  'Jazz', 'Classical', 'Metal', 'Indie', 'Alternative', 'Latin'
])

const browseCategories = ref([
  { id: 'new-releases', name: 'New Releases', color: '#8B1538', image: '/cat-new.jpg' },
  { id: 'charts', name: 'Charts', color: '#DC148C', image: '/cat-charts.jpg' },
  { id: 'discover', name: 'Discover', color: '#1E3264', image: '/cat-discover.jpg' },
  { id: 'live', name: 'Live Events', color: '#E8115B', image: '/cat-live.jpg' },
  { id: 'podcasts', name: 'Podcasts', color: '#006450', image: '/cat-podcasts.jpg' },
  { id: 'moods', name: 'Mood', color: '#477D95', image: '/cat-mood.jpg' },
  { id: 'party', name: 'Party', color: '#AF2896', image: '/cat-party.jpg' },
  { id: 'focus', name: 'Focus', color: '#503750', image: '/cat-focus.jpg' }
])

// Computed
const searchTabs = computed(() => [
  { id: 'all', label: 'All', count: null },
  { id: 'tracks', label: 'Songs', count: results.value.tracks.length },
  { id: 'artists', label: 'Artists', count: results.value.artists.length },
  { id: 'albums', label: 'Albums', count: results.value.albums.length },
  { id: 'playlists', label: 'Playlists', count: results.value.playlists.length }
])

const activeFiltersCount = computed(() => {
  let count = 0
  if (filters.value.genres.length) count += filters.value.genres.length
  if (filters.value.releaseDate) count++
  if (!filters.value.explicit) count++
  return count
})

const hasResults = computed(() => {
  return results.value.tracks.length > 0 ||
         results.value.artists.length > 0 ||
         results.value.albums.length > 0 ||
         results.value.playlists.length > 0
})

// Debounced search
const debouncedSearch = useDebounce(async () => {
  if (!searchQuery.value) {
    clearResults()
    return
  }

  searchPerformed.value = true
  
  // Save to recent searches
  addRecentSearch(searchQuery.value)
  
  // Perform search with filters
  const searchResults = await catalog.search(searchQuery.value, filters.value)
  
  results.value = searchResults
  
  // Determine top result
  determineTopResult()
}, 300)

// Methods
function performSearch() {
  debouncedSearch()
}

function clearSearch() {
  searchQuery.value = ''
  clearResults()
  searchPerformed.value = false
}

function clearResults() {
  results.value = {
    tracks: [],
    artists: [],
    albums: [],
    playlists: []
  }
  topResult.value = null
}

function determineTopResult() {
  // Simple algorithm to determine most relevant result
  if (results.value.artists.length > 0) {
    topResult.value = {
      ...results.value.artists[0],
      type: 'Artist'
    }
  } else if (results.value.albums.length > 0) {
    topResult.value = {
      ...results.value.albums[0],
      type: 'Album'
    }
  } else if (results.value.tracks.length > 0) {
    topResult.value = {
      ...results.value.tracks[0],
      type: 'Song'
    }
  }
}

function applyFilters() {
  performSearch()
  showFilters.value = false
}

function resetFilters() {
  filters.value = {
    genres: [],
    releaseDate: '',
    duration: { min: 0, max: 600 },
    explicit: true,
    verified: false
  }
  performSearch()
}

function openTopResult() {
  if (!topResult.value) return
  
  switch (topResult.value.type) {
    case 'Artist':
      router.push(`/artists/${topResult.value.id}`)
      break
    case 'Album':
      router.push(`/releases/${topResult.value.id}`)
      break
    case 'Song':
      // Play the track
      break
  }
}

function browseCategory(category) {
  router.push(`/browse/${category.id}`)
}

function addRecentSearch(query) {
  const existing = recentSearches.value.findIndex(s => s.query === query)
  if (existing > -1) {
    recentSearches.value.splice(existing, 1)
  }
  
  recentSearches.value.unshift({
    id: Date.now(),
    query,
    timestamp: new Date()
  })
  
  // Keep only last 10 searches
  recentSearches.value = recentSearches.value.slice(0, 10)
  
  // Save to localStorage
  localStorage.setItem('recentSearches', JSON.stringify(recentSearches.value))
}

function removeRecentSearch(search) {
  const index = recentSearches.value.findIndex(s => s.id === search.id)
  if (index > -1) {
    recentSearches.value.splice(index, 1)
    localStorage.setItem('recentSearches', JSON.stringify(recentSearches.value))
  }
}

function clearRecentSearches() {
  recentSearches.value = []
  localStorage.removeItem('recentSearches')
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Load recent searches on mount
onMounted(() => {
  searchInputRef.value?.focus()
  
  const saved = localStorage.getItem('recentSearches')
  if (saved) {
    recentSearches.value = JSON.parse(saved)
  }
})

// Watch for route query params
watch(() => router.currentRoute.value.query.q, (query) => {
  if (query) {
    searchQuery.value = query
    performSearch()
  }
})
</script>

<template>
  <div class="search-page">
    <!-- Search Header -->
    <div class="search-header">
      <div class="search-input-wrapper">
        <font-awesome-icon icon="search" class="search-icon" />
        <input 
          v-model="searchQuery"
          @input="performSearch"
          type="text"
          placeholder="Search for songs, artists, albums, playlists..."
          class="search-input"
          ref="searchInputRef"
        />
        <button v-if="searchQuery" @click="clearSearch" class="clear-btn">
          <font-awesome-icon icon="times" />
        </button>
      </div>
    </div>

    <!-- Filter Bar -->
    <div v-if="searchQuery" class="filter-bar">
      <div class="filter-tabs">
        <button 
          v-for="tab in searchTabs" 
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="['tab', { active: activeTab === tab.id }]"
        >
          {{ tab.label }}
          <span v-if="tab.count" class="count">{{ tab.count }}</span>
        </button>
      </div>

      <button @click="showFilters = !showFilters" class="btn-filter">
        <font-awesome-icon icon="filter" />
        Filters
        <span v-if="activeFiltersCount" class="filter-badge">{{ activeFiltersCount }}</span>
      </button>
    </div>

    <!-- Advanced Filters Panel -->
    <transition name="slide-down">
      <div v-if="showFilters && searchQuery" class="filters-panel">
        <div class="filter-group">
          <h4>Genre</h4>
          <div class="filter-options">
            <label v-for="genre in genres" :key="genre" class="checkbox-label">
              <input 
                type="checkbox" 
                v-model="filters.genres"
                :value="genre"
              />
              {{ genre }}
            </label>
          </div>
        </div>

        <div class="filter-group">
          <h4>Release Date</h4>
          <select v-model="filters.releaseDate" class="form-select">
            <option value="">Any time</option>
            <option value="day">Last 24 hours</option>
            <option value="week">Last week</option>
            <option value="month">Last month</option>
            <option value="year">Last year</option>
            <option value="custom">Custom range</option>
          </select>
        </div>

        <div class="filter-group">
          <h4>Duration</h4>
          <div class="range-slider">
            <input 
              type="range" 
              v-model="filters.duration.min" 
              min="0" 
              max="600"
              class="slider"
            />
            <span>{{ formatDuration(filters.duration.min) }} - {{ formatDuration(filters.duration.max) }}</span>
            <input 
              type="range" 
              v-model="filters.duration.max" 
              min="0" 
              max="600"
              class="slider"
            />
          </div>
        </div>

        <div class="filter-group">
          <h4>Explicit Content</h4>
          <label class="toggle-label">
            <input type="checkbox" v-model="filters.explicit" />
            <span>Include explicit content</span>
          </label>
        </div>

        <div class="filter-actions">
          <button @click="resetFilters" class="btn btn-secondary">Reset</button>
          <button @click="applyFilters" class="btn btn-primary">Apply Filters</button>
        </div>
      </div>
    </transition>

    <!-- Browse Categories (when no search) -->
    <div v-if="!searchQuery" class="browse-section">
      <h2>Browse All</h2>
      <div class="category-grid">
        <div 
          v-for="category in browseCategories" 
          :key="category.id"
          class="category-card"
          :style="{ backgroundColor: category.color }"
          @click="browseCategory(category)"
        >
          <h3>{{ category.name }}</h3>
          <img :src="category.image" :alt="category.name" />
        </div>
      </div>
    </div>

    <!-- Search Results -->
    <div v-if="searchQuery" class="search-results">
      <!-- Top Result -->
      <div v-if="topResult && activeTab === 'all'" class="top-result-section">
        <h2>Top Result</h2>
        <div class="top-result-card card" @click="openTopResult">
          <img :src="topResult.image || '/placeholder.png'" :alt="topResult.name" />
          <div class="top-result-info">
            <h3>{{ topResult.name }}</h3>
            <div class="top-result-meta">
              <span class="badge">{{ topResult.type }}</span>
              <span v-if="topResult.verified" class="verified">
                <font-awesome-icon icon="check-circle" />
              </span>
            </div>
          </div>
          <button class="play-btn btn-circle">
            <font-awesome-icon icon="play" />
          </button>
        </div>
      </div>

      <!-- All Results -->
      <div v-if="activeTab === 'all'" class="all-results">
        <!-- Songs Section -->
        <div v-if="results.tracks.length" class="result-section">
          <div class="section-header">
            <h2>Songs</h2>
            <button @click="activeTab = 'tracks'" class="see-all">See all</button>
          </div>
          <TrackList :tracks="results.tracks.slice(0, 5)" />
        </div>

        <!-- Artists Section -->
        <div v-if="results.artists.length" class="result-section">
          <div class="section-header">
            <h2>Artists</h2>
            <button @click="activeTab = 'artists'" class="see-all">See all</button>
          </div>
          <ArtistGrid :artists="results.artists.slice(0, 6)" />
        </div>

        <!-- Albums Section -->
        <div v-if="results.albums.length" class="result-section">
          <div class="section-header">
            <h2>Albums</h2>
            <button @click="activeTab = 'albums'" class="see-all">See all</button>
          </div>
          <AlbumGrid :albums="results.albums.slice(0, 6)" />
        </div>

        <!-- Playlists Section -->
        <div v-if="results.playlists.length" class="result-section">
          <div class="section-header">
            <h2>Playlists</h2>
            <button @click="activeTab = 'playlists'" class="see-all">See all</button>
          </div>
          <PlaylistGrid :playlists="results.playlists.slice(0, 6)" />
        </div>
      </div>

      <!-- Specific Tab Results -->
      <div v-else-if="activeTab === 'tracks'" class="tab-results">
        <h2>Songs</h2>
        <TrackList :tracks="results.tracks" :show-album="true" :show-actions="true" />
      </div>

      <div v-else-if="activeTab === 'artists'" class="tab-results">
        <h2>Artists</h2>
        <ArtistGrid :artists="results.artists" />
      </div>

      <div v-else-if="activeTab === 'albums'" class="tab-results">
        <h2>Albums</h2>
        <AlbumGrid :albums="results.albums" />
      </div>

      <div v-else-if="activeTab === 'playlists'" class="tab-results">
        <h2>Playlists</h2>
        <PlaylistGrid :playlists="results.playlists" />
      </div>

      <!-- No Results -->
      <div v-if="searchPerformed && !hasResults" class="no-results">
        <font-awesome-icon icon="search" />
        <h3>No results found for "{{ searchQuery }}"</h3>
        <p>Try searching with different keywords or adjusting your filters</p>
      </div>
    </div>

    <!-- Recent Searches -->
    <div v-if="!searchQuery && recentSearches.length" class="recent-searches">
      <div class="section-header">
        <h2>Recent Searches</h2>
        <button @click="clearRecentSearches" class="btn-text">Clear all</button>
      </div>
      <div class="recent-list">
        <div 
          v-for="search in recentSearches" 
          :key="search.id"
          class="recent-item"
          @click="searchQuery = search.query; performSearch()"
        >
          <font-awesome-icon icon="clock" />
          <span>{{ search.query }}</span>
          <button @click.stop="removeRecentSearch(search)" class="remove-btn">
            <font-awesome-icon icon="times" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-page {
  padding: var(--space-lg);
  max-width: 1400px;
  margin: 0 auto;
}

/* Search header */
.search-header {
  margin-bottom: var(--space-lg);
}

.search-input-wrapper {
  position: relative;
  max-width: 600px;
}

.search-icon {
  position: absolute;
  left: var(--space-md);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-secondary);
}

.search-input {
  width: 100%;
  padding: var(--space-md) var(--space-xl);
  padding-left: calc(var(--space-xl) + 20px);
  font-size: var(--text-lg);
  background: var(--color-bg-secondary);
  border: 2px solid transparent;
  border-radius: var(--radius-full);
  transition: all var(--transition-base);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
  background: var(--color-surface);
}

.clear-btn {
  position: absolute;
  right: var(--space-md);
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--space-sm);
}

/* Filter bar */
.filter-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.filter-tabs {
  display: flex;
  gap: var(--space-md);
}

.tab {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  transition: all var(--transition-base);
}

.tab.active {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.tab .count {
  margin-left: var(--space-xs);
  font-size: var(--text-sm);
  opacity: 0.8;
}

.btn-filter {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-secondary);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.filter-badge {
  background: var(--color-primary);
  color: white;
  padding: 2px 6px;
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
}

/* Filters panel */
.filters-panel {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  margin-bottom: var(--space-lg);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-lg);
}

.filter-group h4 {
  margin-bottom: var(--space-sm);
  font-size: var(--text-sm);
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.filter-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
}

.filter-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}

/* Browse categories */
.browse-section h2 {
  margin-bottom: var(--space-lg);
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-lg);
}

.category-card {
  aspect-ratio: 1;
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: transform var(--transition-base);
}

.category-card:hover {
  transform: scale(1.05);
}

.category-card h3 {
  color: white;
  font-size: var(--text-xl);
  position: relative;
  z-index: 1;
}

.category-card img {
  position: absolute;
  bottom: -10px;
  right: -10px;
  width: 100px;
  height: 100px;
  transform: rotate(25deg);
  opacity: 0.8;
}

/* Search results */
.top-result-section {
  margin-bottom: var(--space-xl);
}

.top-result-card {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-lg);
  cursor: pointer;
  position: relative;
}

.top-result-card img {
  width: 120px;
  height: 120px;
  border-radius: var(--radius-md);
  object-fit: cover;
}

.top-result-info {
  flex: 1;
}

.top-result-info h3 {
  font-size: var(--text-2xl);
  margin-bottom: var(--space-sm);
}

.top-result-meta {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.verified {
  color: var(--color-primary);
}

.play-btn {
  position: absolute;
  bottom: var(--space-md);
  right: var(--space-md);
  width: 48px;
  height: 48px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transform: scale(0.9);
  transition: all var(--transition-base);
}

.top-result-card:hover .play-btn {
  opacity: 1;
  transform: scale(1);
}

/* Result sections */
.result-section {
  margin-bottom: var(--space-xl);
}

.all-results {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

/* Recent searches */
.recent-searches {
  margin-top: var(--space-xl);
}

.recent-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.recent-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-base);
}

.recent-item:hover {
  background: var(--color-bg-tertiary);
}

.recent-item span {
  flex: 1;
}

.remove-btn {
  background: none;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--transition-base);
}

.recent-item:hover .remove-btn {
  opacity: 1;
}

/* No results */
.no-results {
  text-align: center;
  padding: var(--space-xl);
  color: var(--color-text-secondary);
}

.no-results svg {
  font-size: 3rem;
  margin-bottom: var(--space-lg);
  opacity: 0.5;
}

/* Transitions */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>