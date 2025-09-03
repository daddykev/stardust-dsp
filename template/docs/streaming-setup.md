# Streaming Configuration Guide - Stardust DSP

## Overview
This guide covers setting up and configuring the streaming features of Stardust DSP, the consumer-facing music streaming platform that receives content from Stardust Distro and other distributors.

## Architecture Overview

### Stardust DSP Components
- **Frontend Player**: Vue 3 + Howler.js audio engine
- **Streaming API**: Firebase Cloud Functions
- **CDN**: CloudFlare for global content delivery
- **Storage**: Firebase Storage for audio files
- **Analytics**: Real-time play tracking reported back to Stardust Distro
- **Content Source**: Primarily from Stardust Distro via ERN

## Audio Setup for Stardust DSP

### File Preparation

#### Content from Stardust Distro
Stardust Distro delivers audio in these formats:
- **FLAC**: Lossless master files
- **WAV**: Uncompressed audio
- **MP3**: Pre-encoded at 320kbps

#### Stardust DSP Transcoding
Convert Stardust Distro masters for streaming:
```bash
# Convert FLAC from Stardust Distro to streaming formats
ffmpeg -i stardust_distro_master.flac -b:a 320k high_quality.mp3
ffmpeg -i stardust_distro_master.flac -b:a 128k normal_quality.mp3
ffmpeg -i stardust_distro_master.flac -b:a 64k data_saver.mp3
```

#### Adaptive Bitrate Configuration
```json
{
  "qualities": {
    "high": {
      "bitrate": 320,
      "format": "mp3",
      "label": "High Quality",
      "tier": "premium"
    },
    "normal": {
      "bitrate": 128,
      "format": "mp3",
      "label": "Normal Quality",
      "tier": "free"
    },
    "low": {
      "bitrate": 64,
      "format": "mp3",
      "label": "Data Saver",
      "tier": "all"
    }
  }
}
```

### Storage Configuration in Stardust DSP

#### Firebase Storage Rules
```javascript
// storage.rules for Stardust DSP
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Audio files from Stardust Distro
    match /audio/{trackId}/{file} {
      allow read: if request.auth != null;
      allow write: if false; // Only via ingestion from Stardust Distro
    }
    
    // Public images
    match /images/{imageId} {
      allow read: if true;
      allow write: if false; // Only via ingestion
    }
    
    // Stardust Distro deliveries
    match /ingestion/stardust_distro/{file} {
      allow read: if request.auth.token.admin == true;
      allow write: if request.auth.token.distributor == 'stardust_distro';
    }
  }
}
```

#### CDN Setup for Stardust DSP
```javascript
// Configure CDN endpoints for Stardust DSP
const CDN_CONFIG = {
  audio: 'https://cdn.stardust-dsp.com/audio',
  images: 'https://cdn.stardust-dsp.com/images',
  regions: ['us-east', 'eu-west', 'ap-south'],
  cache: {
    audio: '1h',
    images: '7d'
  },
  origin: 'stardust-dsp-storage'
};
```

## Player Implementation in Stardust DSP

### Frontend Setup

#### Install Dependencies
```bash
npm install howler vue3-slider-component
```

#### Stardust DSP Player Component
```vue
<template>
  <div class="stardust-dsp-player">
    <div class="now-playing">
      <img :src="currentTrack?.artwork" :alt="currentTrack?.title" />
      <div class="track-info">
        <h3>{{ currentTrack?.title }}</h3>
        <p>{{ currentTrack?.artist }}</p>
        <span class="source" v-if="currentTrack?.source">
          via {{ currentTrack?.source }}
        </span>
      </div>
    </div>
    
    <audio-visualizer :analyzer="analyzer" />
    
    <div class="controls">
      <button @click="previous">⏮</button>
      <button @click="togglePlay">
        {{ isPlaying ? '⏸' : '▶' }}
      </button>
      <button @click="next">⏭</button>
    </div>
    
    <progress-bar 
      :current="currentTime" 
      :duration="duration"
      @seek="seek"
    />
    
    <div class="player-options">
      <volume-control v-model="volume" />
      <quality-selector 
        v-model="quality" 
        :tier="userTier"
      />
      <queue-manager :queue="queue" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { Howl, Howler } from 'howler';
import { usePlayer } from '@/composables/usePlayer';
import { usePlayTracking } from '@/composables/usePlayTracking';
import { useAnalytics } from '@/services/analytics';

const { 
  currentTrack, 
  isPlaying, 
  queue,
  play,
  pause,
  next,
  previous,
  seek
} = usePlayer();

const { trackPlay } = usePlayTracking();
const { reportToDistributor } = useAnalytics();

// Initialize Howler for Stardust DSP
const sound = ref(null);

watch(currentTrack, (track) => {
  if (track) {
    initializeTrack(track);
    // Report play to source distributor (e.g., Stardust Distro)
    if (track.distributorId) {
      reportToDistributor(track.distributorId, track.id, 'play_start');
    }
  }
});

const initializeTrack = (track) => {
  // Clean up previous sound
  if (sound.value) {
    sound.value.unload();
  }
  
  // Create new Howl instance for Stardust DSP
  sound.value = new Howl({
    src: [track.streamUrl],
    format: ['mp3'],
    autoplay: true,
    volume: volume.value,
    onplay: () => {
      trackPlay(track.id, 'start');
    },
    onend: () => {
      trackPlay(track.id, 'complete');
      // Report completion to Stardust Distro if applicable
      if (track.distributorId === 'stardust_distro') {
        reportToDistributor('stardust_distro', track.id, 'play_complete');
      }
      next();
    },
    onpause: () => {
      trackPlay(track.id, 'pause');
    },
    onseek: () => {
      trackPlay(track.id, 'seek');
    }
  });
};
</script>
```

### Streaming URL Generation in Stardust DSP

#### Secure URL Generation
```javascript
// Cloud Function to generate streaming URLs in Stardust DSP
exports.getStreamUrl = onCall(async (data, context) => {
  const { trackId, quality = 'normal' } = data;
  const userId = context.auth?.uid;
  
  if (!userId) {
    throw new HttpsError('unauthenticated', 'Authentication required for Stardust DSP');
  }
  
  // Check user's subscription tier
  const userTier = await getUserTier(userId);
  if (quality === 'high' && userTier !== 'premium') {
    throw new HttpsError('permission-denied', 'Premium required for high quality');
  }
  
  // Check if track is from Stardust Distro
  const track = await getTrack(trackId);
  const isStardustDistro = track.source === 'stardust_distro';
  
  // Generate signed URL
  const file = bucket.file(`audio/${trackId}/${quality}.mp3`);
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 3600 * 1000, // 1 hour
  });
  
  // Log streaming session for reporting to distributors
  await logStreamingSession(userId, trackId, quality, track.distributorId);
  
  return { 
    url, 
    expires: 3600,
    source: isStardustDistro ? 'stardust_distro' : 'other'
  };
});
```

## Play Tracking for Distributor Reporting

### Analytics Integration for Stardust Distro

#### Track Play Events
```javascript
// composables/usePlayTracking.js in Stardust DSP
import { useAnalytics } from '@/services/analytics';

export const usePlayTracking = () => {
  const { trackPlay: logPlay } = useAnalytics();
  
  let playSession = null;
  let progressInterval = null;
  
  const startTracking = (trackId, releaseId, distributorId) => {
    playSession = {
      trackId,
      releaseId,
      distributorId, // e.g., 'stardust_distro'
      startTime: Date.now(),
      progress: 0
    };
    
    // Update progress every 30 seconds for royalty calculation
    progressInterval = setInterval(() => {
      updateProgress();
    }, 30000);
  };
  
  const updateProgress = () => {
    if (!playSession) return;
    
    const progress = (Date.now() - playSession.startTime) / 1000;
    
    logPlay({
      ...playSession,
      progress,
      event: 'progress'
    });
    
    // Report to Stardust Distro for real-time analytics
    if (playSession.distributorId === 'stardust_distro') {
      reportToStardustDistro(playSession);
    }
  };
  
  const completeTracking = () => {
    if (!playSession) return;
    
    clearInterval(progressInterval);
    
    const duration = (Date.now() - playSession.startTime) / 1000;
    
    logPlay({
      ...playSession,
      duration,
      completed: true,
      event: 'complete'
    });
    
    // Final report to distributor
    if (playSession.distributorId) {
      finalReportToDistributor(playSession);
    }
    
    playSession = null;
  };
  
  return {
    startTracking,
    updateProgress,
    completeTracking
  };
};
```

### Real-time Analytics Dashboard
```javascript
// Monitor streaming metrics in Stardust DSP
const streamingMetrics = {
  concurrent_streams: 0,
  total_plays_today: 0,
  unique_listeners: new Set(),
  popular_tracks: new Map(),
  distributor_breakdown: {
    stardust_distro: 0,
    other_distributors: 0
  },
  
  trackPlay(userId, trackId, distributorId) {
    this.concurrent_streams++;
    this.total_plays_today++;
    this.unique_listeners.add(userId);
    
    const plays = this.popular_tracks.get(trackId) || 0;
    this.popular_tracks.set(trackId, plays + 1);
    
    // Track by distributor
    if (distributorId === 'stardust_distro') {
      this.distributor_breakdown.stardust_distro++;
    } else {
      this.distributor_breakdown.other_distributors++;
    }
  },
  
  trackStop(userId, trackId) {
    this.concurrent_streams--;
  }
};
```

## Content Management from Stardust Distro

### Catalog Sync
```javascript
// Sync catalog from Stardust Distro to Stardust DSP
const syncStardustDistroCatalog = async () => {
  const response = await fetch('https://api.stardust-distro.com/catalog/changes', {
    headers: {
      'Authorization': `Bearer ${STARDUST_DISTRO_API_KEY}`
    }
  });
  
  const changes = await response.json();
  
  for (const change of changes) {
    switch (change.type) {
      case 'new_release':
        await ingestRelease(change.ernUrl);
        break;
      case 'update':
        await updateRelease(change.releaseId, change.updates);
        break;
      case 'takedown':
        await removeRelease(change.releaseId);
        break;
    }
  }
};

// Schedule hourly sync
setInterval(syncStardustDistroCatalog, 3600000);
```

## Performance Optimization

### Preloading from CDN
```javascript
// Preload next track in Stardust DSP
const preloadNext = () => {
  const nextTrack = queue[currentIndex + 1];
  if (nextTrack) {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = `${CDN_CONFIG.audio}/${nextTrack.id}/normal.mp3`;
  }
};
```

### Caching Strategy for Stardust DSP
```javascript
// Service Worker for offline playback in Stardust DSP
self.addEventListener('fetch', event => {
  if (event.request.url.includes('/audio/')) {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            // Track cache hit for analytics
            logCacheHit(event.request.url);
            return response;
          }
          
          return fetch(event.request).then(response => {
            // Cache successful responses
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open('stardust-dsp-audio-v1').then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          });
        })
    );
  }
});
```

## Troubleshooting Stardust DSP Streaming

### Common Issues

**Content from Stardust Distro Not Playing**
- Verify ingestion completed successfully
- Check ERN processing status
- Ensure audio files were transferred
- Validate streaming URLs

**Poor Streaming Quality**
- Check CDN configuration
- Verify transcoding settings
- Monitor bandwidth usage
- Test different quality levels

**Analytics Not Reporting to Stardust Distro**
- Verify API credentials
- Check webhook configuration
- Review DSR generation logs
- Test reporting pipeline

### Debug Tools
```javascript
// Enable debug logging for Stardust DSP
window.STARDUST_DSP_DEBUG = true;

// Monitor player events
player.on('all', (event, data) => {
  console.log(`Stardust DSP Player Event: ${event}`, data);
});

// Track content source
player.on('play', (track) => {
  console.log(`Playing from: ${track.source || 'unknown'}`);
  if (track.source === 'stardust_distro') {
    console.log('Content delivered via Stardust Distro');
  }
});
```

## Support
- Stardust DSP Streaming: streaming@stardust-dsp.com
- Stardust Distro Integration: integration@stardust-distro.com
- API Documentation: https://docs.stardust-dsp.com/streaming
- Community Forum: https://forum.stardust-dsp.com