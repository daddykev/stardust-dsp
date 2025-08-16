import { getFunctions, httpsCallable } from 'firebase/functions'
import { getAuth } from 'firebase/auth'
import { db } from '../firebase'
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore'

const functions = getFunctions()

/**
 * Streaming service for secure URL generation and playback tracking
 */
class StreamingService {
  constructor() {
    this.auth = getAuth()
    this.cache = new Map() // Simple in-memory cache for URLs
    this.cacheExpiry = 3600000 // 1 hour in milliseconds
  }

  /**
   * Get secure streaming URL for a track
   */
  async getStreamUrl(trackId, quality = 'auto') {
    // Check cache first
    const cacheKey = `${trackId}-${quality}`
    const cached = this.cache.get(cacheKey)
    
    if (cached && cached.expires > Date.now()) {
      return cached.url
    }
    
    try {
      // Get track details
      const trackDoc = await getDoc(doc(db, 'tracks', trackId))
      if (!trackDoc.exists()) {
        throw new Error('Track not found')
      }
      
      const track = trackDoc.data()
      
      // Check if user has access (subscription, regional restrictions, etc.)
      const hasAccess = await this.verifyAccess(track)
      if (!hasAccess) {
        throw new Error('Access denied')
      }
      
      // Generate secure URL based on quality
      let streamUrl
      
      if (quality === 'auto' && track.streamingUrls?.hls) {
        // Return adaptive streaming manifest
        streamUrl = await this.generateSecureUrl(track.streamingUrls.hls, trackId)
      } else if (track.audioUrl) {
        // Return direct MP3 URL with signature
        streamUrl = await this.generateSecureUrl(track.audioUrl, trackId)
      } else {
        throw new Error('No streaming URL available')
      }
      
      // Cache the URL
      this.cache.set(cacheKey, {
        url: streamUrl,
        expires: Date.now() + this.cacheExpiry
      })
      
      return streamUrl
      
    } catch (error) {
      console.error('Error getting stream URL:', error)
      throw error
    }
  }

  /**
   * Generate secure, time-limited URL
   */
  async generateSecureUrl(originalUrl, trackId) {
    // In production, this would call a Cloud Function to generate signed URLs
    if (import.meta.env.PROD) {
      try {
        const generateUrl = httpsCallable(functions, 'generateStreamUrl')
        const result = await generateUrl({ 
          trackId, 
          originalUrl,
          userId: this.auth.currentUser?.uid 
        })
        return result.data.url
      } catch (error) {
        console.error('Error calling Cloud Function:', error)
        // Fallback to original URL
        return originalUrl
      }
    }
    
    // In development, add a simple token
    const token = btoa(`${trackId}-${Date.now()}-${this.auth.currentUser?.uid}`)
    const separator = originalUrl.includes('?') ? '&' : '?'
    return `${originalUrl}${separator}token=${token}&expires=${Date.now() + this.cacheExpiry}`
  }

  /**
   * Verify user has access to the track
   */
  async verifyAccess(track) {
    const user = this.auth.currentUser
    
    if (!user) {
      return false
    }
    
    // Check subscription status
    const userDoc = await getDoc(doc(db, 'users', user.uid))
    const userData = userDoc.data()
    
    // Free tier restrictions
    if (userData?.subscription?.type === 'free') {
      // Check if track requires premium
      if (track.tier === 'premium') {
        return false
      }
      
      // Check skip limits, etc.
      // ... additional free tier checks
    }
    
    // Check regional restrictions
    if (track.territories && track.territories.length > 0) {
      const userTerritory = userData?.profile?.country || 'US'
      if (!track.territories.includes(userTerritory)) {
        return false
      }
    }
    
    // Check if content is explicit and user has parental controls
    if (track.explicit && userData?.preferences?.explicitContent === false) {
      return false
    }
    
    return true
  }

  /**
   * Get HLS manifest URL
   */
  async getHLSManifest(trackId) {
    return this.getStreamUrl(trackId, 'hls')
  }

  /**
   * Get DASH manifest URL
   */
  async getDASHManifest(trackId) {
    return this.getStreamUrl(trackId, 'dash')
  }

  /**
   * Get download URL (if allowed)
   */
  async getDownloadUrl(trackId, quality = 'high') {
    const user = this.auth.currentUser
    if (!user) throw new Error('Authentication required')
    
    // Check if user can download
    const userDoc = await getDoc(doc(db, 'users', user.uid))
    const userData = userDoc.data()
    
    if (userData?.subscription?.type !== 'premium') {
      throw new Error('Premium subscription required for downloads')
    }
    
    const trackDoc = await getDoc(doc(db, 'tracks', trackId))
    const track = trackDoc.data()
    
    const downloadUrl = track.streamingUrls?.download?.[quality] || track.audioUrl
    if (!downloadUrl) {
      throw new Error('Download not available')
    }
    
    return this.generateSecureUrl(downloadUrl, trackId)
  }

  /**
   * Report playback start
   */
  async reportPlayStart(trackId, context = {}) {
    try {
      const playSession = {
        trackId,
        userId: this.auth.currentUser?.uid,
        startTime: Date.now(),
        context: {
          source: context.source || 'unknown',
          playlistId: context.playlistId,
          albumId: context.albumId,
          artistId: context.artistId
        }
      }
      
      // Store in session storage for tracking
      sessionStorage.setItem(`play-${trackId}`, JSON.stringify(playSession))
      
      // Update play count (optimistically)
      await updateDoc(doc(db, 'tracks', trackId), {
        'stats.playCount': increment(1),
        'stats.lastPlayed': new Date()
      })
      
      return playSession
      
    } catch (error) {
      console.error('Error reporting play start:', error)
    }
  }

  /**
   * Report playback progress/end
   */
  async reportPlayProgress(trackId, duration, completed = false) {
    try {
      const sessionData = sessionStorage.getItem(`play-${trackId}`)
      if (!sessionData) return
      
      const session = JSON.parse(sessionData)
      
      // Only count as a play if listened to 30+ seconds
      if (duration >= 30 || completed) {
        // In production, this would call a Cloud Function
        if (import.meta.env.PROD) {
          const trackPlay = httpsCallable(functions, 'trackPlay')
          await trackPlay({
            trackId,
            duration,
            completed,
            sessionId: session.startTime,
            context: session.context
          })
        }
      }
      
      // Clear session if completed
      if (completed) {
        sessionStorage.removeItem(`play-${trackId}`)
      }
      
    } catch (error) {
      console.error('Error reporting play progress:', error)
    }
  }

  /**
   * Get DRM license (for protected content)
   */
  async getDRMLicense(trackId, challenge) {
    // This would integrate with a DRM provider like Widevine or FairPlay
    try {
      const getLicense = httpsCallable(functions, 'generateLicense')
      const result = await getLicense({ trackId, challenge })
      return result.data.license
    } catch (error) {
      console.error('Error getting DRM license:', error)
      throw error
    }
  }

  /**
   * Clear URL cache
   */
  clearCache() {
    this.cache.clear()
  }
}

// Export singleton instance
export const streamingService = new StreamingService()
export default streamingService