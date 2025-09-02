// template/src/services/recommendations.js
import { db } from '../firebase'
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'

export const recommendationsService = {
  // Get personalized recommendations based on listening history
  async getRecommendations(userId, type = 'tracks') {
    try {
      // Get user's listening history
      const history = await this.getUserHistory(userId)
      
      // Extract patterns (genres, artists, etc.)
      const patterns = this.extractPatterns(history)
      
      // Generate recommendations based on patterns
      const recommendations = await this.generateRecommendations(patterns, type)
      
      return recommendations
    } catch (error) {
      console.error('Error getting recommendations:', error)
      return []
    }
  },

  async getUserHistory(userId) {
    const q = query(
      collection(db, 'plays'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(100)
    )
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  },

  extractPatterns(history) {
    const patterns = {
      genres: {},
      artists: {},
      tempo: [],
      mood: []
    }
    
    // Analyze listening patterns
    history.forEach(play => {
      // Count genres
      if (play.genre) {
        patterns.genres[play.genre] = (patterns.genres[play.genre] || 0) + 1
      }
      
      // Count artists
      if (play.artistId) {
        patterns.artists[play.artistId] = (patterns.artists[play.artistId] || 0) + 1
      }
      
      // Track tempo and mood preferences
      if (play.tempo) patterns.tempo.push(play.tempo)
      if (play.mood) patterns.mood.push(play.mood)
    })
    
    return patterns
  },

  async generateRecommendations(patterns, type) {
    // Get top genres
    const topGenres = Object.entries(patterns.genres)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre]) => genre)
    
    // Query for similar content
    const q = query(
      collection(db, type),
      where('genre', 'in', topGenres),
      orderBy('popularity', 'desc'),
      limit(20)
    )
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  },

  // Generate "Discover Weekly" playlist
  async generateDiscoverWeekly(userId) {
    const recommendations = await this.getRecommendations(userId, 'tracks')
    
    // Mix with some new releases
    const newReleases = await this.getNewReleases()
    
    // Combine and shuffle
    const playlist = [...recommendations.slice(0, 20), ...newReleases.slice(0, 10)]
    return this.shuffle(playlist)
  },

  async getNewReleases() {
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    
    const q = query(
      collection(db, 'tracks'),
      where('releaseDate', '>=', oneWeekAgo),
      orderBy('releaseDate', 'desc'),
      limit(15)
    )
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  },

  shuffle(array) {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }
}