# Stardust DSP - Blueprint

## Project Overview

Stardust DSP is an open-source, npm-installable Digital Service Provider (streaming platform) that receives DDEX ERN deliveries, processes them into a searchable catalog, and provides a complete music streaming experience. Part of the Stardust Ecosystem alongside DDEX Workbench and Stardust Distro.

### Vision
Enable anyone to launch a DDEX-compliant streaming service in minutes, from testing environments for labels to fully-featured platforms for emerging markets.

### Core Value Propositions
- **Instant Streaming Platform**: Deploy a functional DSP with one command
- **DDEX-Native Ingestion**: Built to receive and process ERN deliveries seamlessly
- **Complete Streaming Stack**: Catalog, search, playback, and user management included
- **Test Environment Ready**: Perfect for labels to test their Stardust Distro deployments
- **White-Label Capable**: Fully customizable for any brand or market

### Official App Build
**URL**: [https://stardust-dsp.org](https://stardust-dsp.org)

## Development Status

**Alpha Release - v0.8.0** (September 2025)

### ✅ Phase 1: Foundation - COMPLETE
- Full Vue 3 application with routing and views
- Firebase integration (Auth, Firestore, Storage)
- Professional CSS architecture with theming
- Functional CLI tool with all core commands
- Unified authentication strategy
- Template system ready for project generation

### ✅ Phase 2: Ingestion Pipeline - COMPLETE
- Direct pipeline architecture with scheduled processing
- ERN receiver with HTTP endpoint and file transfer support
- XML parser with comprehensive ERN 4.3 support
- DDEX Workbench validation integration
- Asset processor with MD5 validation
- Acknowledgment generation system
- Transaction-based locking for concurrency control
- File transfer job system with retry logic
- Distributor management interface
- Ingestion monitoring dashboard with real-time updates
- Integration with Stardust Distro

### ✅ Phase 3: Core Streaming - COMPLETE
- Catalog browsing with search and filtering
- Release and Artist detail pages with full metadata
- Audio playback with Howler.js and queue management
- Full player component with visualizations and controls
- Secure streaming URL generation with access control
- User library system with favorites and playlists
- Real-time dashboard with platform statistics
- Complete set of composables for state management

### ✅ Phase 4: Testing Suite - COMPLETE
- Comprehensive platform testing framework
- System health tests for all Firebase services
- Ingestion pipeline testing with delivery simulation
- Catalog operations and query performance tests
- Real-time test execution with detailed logging
- Performance benchmarking for critical paths
- Test result export and health score calculation
- Integration testing for Stardust Distro deliveries
- MD5 validation and file transfer verification
- DDEX Workbench API integration testing

### ✅ Phase 5: Consumer Features - COMPLETE
- Enhanced browse interface with discovery sections and mood playlists
- Advanced search with multi-faceted filters and recent searches
- Complete playlist management with drag-and-drop reordering
- Comprehensive favorites system for tracks, albums, and artists
- User profiles with followers, activity feeds, and customization
- Social features including follow/unfollow and content sharing
- Recommendation engine with personalized suggestions
- Recently played history with automatic tracking
- Personalized home page with time-based greetings
- Follow artist functionality with discography access
- Collaborative playlists with multi-user editing
- Real-time data synchronization across all features
- 7 new consumer views (Home, Browse, Search, Library, Profile, PlaylistDetail, Artist)
- 4 new composables (useLibrary, useSocial, useProfile, useDebounce)
- 10+ new UI components for browsing and discovery
- Recommendation service with pattern-based suggestions

### 📅 Upcoming Phases
- Phase 6: Analytics & Reporting (Weeks 21-24) - UP NEXT
- Phase 7: Polish & Launch (Weeks 25-28)

## Technical Architecture

### Platform Stack
- **Frontend**: Vue 3 (Composition API) + Vite
- **Backend**: Firebase (Firestore, Functions, Storage, Auth)
- **Streaming**: Firebase Storage + CDN with adaptive bitrate
- **Search**: Algolia or Typesense integration
- **Ingestion**: Cloud Functions for ERN processing
- **Analytics**: Firebase Analytics + custom DSR generation
- **CLI**: Node.js CLI for project scaffolding
- **Package Manager**: npm for distribution

### Deployment Model
```bash
# One-command deployment
npx create-stardust-dsp my-streaming-service
cd my-streaming-service
npm run deploy

# Streaming platform live at https://my-streaming-service.app
```

### Architecture Patterns
- **Direct Pipeline Processing**: Monolithic async functions for reliable processing
- **Scheduled Queue Processing**: Time-based processing of pending deliveries
- **Transaction-Based Locking**: Prevents concurrent processing of same delivery
- **File Transfer Jobs**: Separate handling of large file transfers with retry logic
- **CDN-First**: Global content delivery for low latency
- **Progressive Web App**: Offline playback capability

### Processing Status Flow
```
received → pending → waiting_for_files → files_ready → parsing → 
validating → processing_releases → completed (or failed/cancelled)
```

### Key Architectural Decisions
1. **Direct over Pub/Sub**: Chosen for simplicity, debuggability, and cost efficiency
2. **Scheduled Functions**: Reliable processing without complex queuing
3. **MD5 Validation**: Ensures file integrity during transfers
4. **Lock-Based Concurrency**: Simple, effective prevention of race conditions

## Technical Documentation

For detailed technical specifications, see:
- **DDEX Standards**: [`src/docs/DDEX.md`](../main/template/src/docs/DDEX.md) - Complete DDEX implementation standards

## Project Structure

```
stardust-dsp/
├── cli/                          # CLI tool for scaffolding
│   ├── bin/                      # Executable scripts
│   │   └── stardust-dsp.js       # Main CLI entry ✅
│   ├── commands/                 # CLI commands
│   │   ├── create.js             # Create new project ✅
│   │   ├── init.js               # Initialize Firebase ✅
│   │   ├── deploy.js             # Deploy platform ✅
│   │   ├── configure.js          # Configure ingestion ✅
│   │   ├── dev.js                # Development server ✅
│   │   └── deliveries.js         # Manage deliveries ✅
│   ├── templates/                # Project templates
│   │   └── default/              # Full streaming platform ❌
│   └── package.json              # CLI dependencies ✅
├── template/                     # Default project template
│   ├── dist/                     # Build output (git-ignored)
│   ├── docs/                     # Documentation
│   │   ├── api-reference.md      # API docs ❌
│   │   ├── customization.md      # Theming guide ❌
│   │   ├── DDEX.md               # Unified implementation standards ✅
│   │   ├── dsr-reporting.md      # DSR guide ❌
│   │   ├── getting-started.md    # Quick start guide ❌
│   │   ├── ingestion-guide.md    # ERN ingestion ❌
│   │   └── streaming-setup.md    # Streaming config ❌
│   ├── functions/                # Cloud Functions
│   │   ├── ingestion/            # ERN processing
│   │   │   ├── receiver.js       # Receive deliveries ✅
│   │   │   ├── parser.js         # Parse ERN XML ✅
│   │   │   ├── validator.js      # Validate via Workbench ✅
│   │   │   ├── processor.js      # Process release ✅
│   │   │   └── notifier.js       # Send confirmations ✅
│   │   ├── catalog/              # Catalog operations
│   │   │   ├── releases.js       # Release management ❌
│   │   │   ├── tracks.js         # Track operations ❌
│   │   │   ├── artists.js        # Artist profiles ❌
│   │   │   └── search.js         # Search indexing ❌
│   │   ├── streaming/            # Streaming operations
│   │   │   ├── auth.js           # Stream authorization ❌
│   │   │   ├── delivery.js       # Content delivery ❌
│   │   │   ├── transcoding.js    # Audio processing ❌
│   │   │   └── analytics.js      # Play tracking ❌
│   │   ├── reporting/            # DSR generation
│   │   │   ├── usage.js          # Track usage ❌
│   │   │   ├── dsr.js            # Generate DSR ❌
│   │   │   └── delivery.js       # Send reports ❌
│   │   ├── admin/                # Admin operations
│   │   │   ├── deliveries.js     # Manage deliveries ❌
│   │   │   ├── moderation.js     # Content moderation ❌
│   │   │   └── analytics.js      # Platform analytics ❌
│   │   ├── utils/                # Utilities
│   │   ├── index.js              # Function exports ✅
│   │   └── package.json          # Dependencies ✅
│   ├── public/                   # Static assets ✅
│   │   └── index.html            # HTML template ✅
│   ├── src/                      # Vue application
│   │   ├── assets/               # Design system CSS architecture
│   │   │   ├── main.css          # Entry point importing all stylesheets ✅
│   │   │   ├── base.css          # CSS reset, normalization, base typography ✅
│   │   │   ├── themes.css        # CSS custom properties, light/dark themes ✅
│   │   │   └── components.css    # Reusable component & utility classes ✅
│   │   ├── components/           # UI components
│   │   │   ├── browse/           # Browse & discovery
│   │   │   │   ├── AlbumCarousel.vue  # Scrollable carousel of album covers ✅
│   │   │   │   ├── AlbumGrid.vue  # Grid layout of album covers ✅
│   │   │   │   ├── ArtistCarousel.vue # Scrollable carousel of artist profiles ✅
│   │   │   │   ├── ArtistGrid.vue  # Grid layout of artist profiles ✅
│   │   │   │   ├── PlaylistGrid.vue  # User and curated playlists ✅
│   │   │   │   └── TrackList.vue  # Track listing ✅
│   │   │   ├── library/          # User library
│   │   │   │   └── PlaylistCard.vue  # A single playlist card ✅
│   │   │   ├── player/           # Music player
│   │   │   │   └── FullPlayer.vue  # Full player view ✅
│   │   │   ├── profile/          # 
│   │   │   │   ├── ActivityFeed.vue  # Chronological feed of user activities ✅
│   │   │   │   ├── EditProfileModal.vue  # Modal to edit user profile ✅
│   │   │   │   ├── RecentlyPlayedList.vue  # Recently played tracks with timestamps ✅
│   │   │   │   └── UserList.vue  # A list of users for following ✅
│   │   │   └── NavBar.vue        # Main nav component ✅
│   │   ├── composables/          # Vue composables
│   │   │   ├── useAuth.js        # Basic authentication ✅
│   │   │   ├── useCatalog.js     # Catalog operations ✅
│   │   │   ├── useDebounce.js    # Input handling for search fields ✅
│   │   │   ├── useDualAuth.js    # Dual auth model ✅
│   │   │   ├── useLibrary.js     # Library management ✅
│   │   │   ├── usePlayer.js      # Audio playback ✅
│   │   │   ├── useProfile.js     # Manages user profile data ✅
│   │   │   └── useSocial.js      # Handles social features ✅
│   │   ├── router/               # Vue Router
│   │   │   └── index.js          # Route definitions ✅
│   │   ├── services/             # API services
│   │   │   └── streaming.js      # Streaming service ✅
│   │   ├── views/                # Page views
│   │   │   ├── business/
│   │   │   │   ├── Catalog.vue       # Browse catalog ✅
│   │   │   │   ├── Dashboard.vue     # User dashboard ✅
│   │   │   │   ├── Distributors.vue  # Distributor management ✅
│   │   │   │   ├── Ingestion.vue     # Ingestion monitoring ✅
│   │   │   │   ├── IngestionDetail.vue  # Delivery details ✅
│   │   │   │   ├── Settings.vue      # Account configuration ✅
│   │   │   │   └── Testing.vue       # Testing Suite ✅
│   │   │   ├── consumer/
│   │   │   │   ├── Artist.vue        # Artist profile pages ✅
│   │   │   │   ├── Browser.vue       # Music discovery interface ✅
│   │   │   │   ├── Home.vue          # Personalized dashboard recommended tracks, user library ✅
│   │   │   │   ├── Library.vue       # User library ✅
│   │   │   │   ├── Login.vue         # Login page ✅
│   │   │   │   ├── PlaylistDetail.vue  # Playlist view showing track list ✅
│   │   │   │   ├── Profile.vue       # User profile page with listening stats ✅
│   │   │   │   ├── ReleaseDetail.vue # Release/Album details ✅
│   │   │   │   └── Search.vue        # Search results ✅
│   │   │   ├── public/
│   │   │   │   ├── Login.vue         # Login page ✅
│   │   │   │   ├── Signup.vue        # Signup page ✅
│   │   │   │   └── SplashPage.vue    # Landing page ✅
│   │   ├── App.vue               # Root component ✅
│   │   ├── firebase.js           # Firebase initialization ✅
│   │   └── main.js               # Entry point ✅
│   ├── .env                      # Environment variables (git-ignored) ✅
│   ├── .env.example              # Environment template ✅
│   ├── .gitignore                # Git ignore ✅
│   ├── firebase.json             # Firebase config ✅
│   ├── firestore.indexes.json    # Database indexes ✅
│   ├── firestore.rules           # Firestore rules ✅
│   ├── index.html                # HTML app entry ✅
│   ├── jsconfig.json             # JavaScript config ✅
│   ├── package.json              # Project dependencies ✅
│   ├── storage.rules             # Cloud storage rules ✅
│   └── vite.config.js            # Vite configuration ✅
├── blueprint.md                  # This document ✅
├── LICENSE                       # MIT License ✅
└── README.md                     # Project README ✅
```

### Files Created and Deployed:
✅ = File exists and is functional
❌ = File not yet created
📝 = File partially created or needs implementation

### **Summary of Current Status:**
- **Core App (template/)**: 65% complete - All Phase 3 features complete
- **CLI Tool**: ✅ 100% complete - All commands created and functional
- **Services**: 25% complete - Streaming service implemented
- **Components**: 15% complete - NavBar and FullPlayer created
- **Composables**: ✅ 100% complete - All composables implemented (useAuth, useDualAuth, useCatalog, usePlayer, useLibrary)
- **Views**: 79% complete - 11 of 14 views created (including all Phase 3 views)
- **Functions**: ✅ 100% complete - All ingestion Cloud Functions deployed and working
- **Documentation**: 5% complete - blueprint exists
- **Testing**: ✅ 100% complete - Comprehensive testing suite with 20+ automated tests across system, ingestion, catalog, and performance categories

## Core Features

### 1. ERN Ingestion Pipeline

#### Delivery Reception
```typescript
interface DeliveryEndpoints {
  FTP: {
    path: '/deliveries/{sender}/',
    auth: 'credentials'
  },
  API: {
    endpoint: 'POST /api/deliveries',
    auth: 'Bearer token'
  },
  CloudStorage: {
    bucket: 'deliveries',
    triggers: 'automatic'
  }
}
```

#### Processing Pipeline
```javascript
// Direct Pipeline Architecture - No Pub/Sub
exports.processDeliveryPipeline = async (deliveryId) => {
  const db = admin.firestore();
  const deliveryRef = db.collection('deliveries').doc(deliveryId);
  
  try {
    // Transaction-based locking to prevent concurrent processing
    const delivery = await db.runTransaction(async (transaction) => {
      const deliveryDoc = await transaction.get(deliveryRef);
      const data = deliveryDoc.data();
      
      // Check if locked or already processed
      if (data.processing?.locked && 
          (Date.now() - data.processing.lockedAt.toMillis()) < 600000) {
        return null; // Skip if locked
      }
      
      // Lock for processing
      transaction.update(deliveryRef, {
        'processing.locked': true,
        'processing.lockedAt': admin.firestore.FieldValue.serverTimestamp()
      });
      
      return data;
    });
    
    if (!delivery) return;
    
    // STEP 1: Check/wait for file transfers if needed
    if (delivery.audioFiles?.length > 0 || delivery.imageFiles?.length > 0) {
      if (!delivery.files?.transferredAt) {
        // Create file transfer job if not exists
        await createFileTransferJob(deliveryId, delivery);
        return; // Let scheduled function handle transfer
      }
    }
    
    // STEP 2: Parse ERN directly
    const parseResult = await parseERN(deliveryId, delivery.ernXml);
    
    // STEP 3: Validate with DDEX Workbench
    const validationResult = await validateERN(
      deliveryId, 
      parseResult.ernData,
      parseResult.ernVersion
    );
    
    if (!validationResult.valid) {
      throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
    }
    
    // STEP 4: Process releases and assets
    await deliveryRef.update({
      'processing.status': 'processing_releases'
    });
    
    const processedReleases = await processReleases(
      deliveryId,
      parseResult.releases,
      delivery
    );
    
    // STEP 5: Complete and acknowledge
    await deliveryRef.update({
      'processing.status': 'completed',
      'processing.completedAt': admin.firestore.FieldValue.serverTimestamp(),
      'processing.releases': processedReleases,
      'processing.locked': false
    });
    
    // Generate acknowledgment
    await generateAcknowledgment(deliveryId, processedReleases);
    
  } catch (error) {
    // Handle errors with detailed tracking
    await deliveryRef.update({
      'processing.status': 'failed',
      'processing.error': error.message,
      'processing.locked': false
    });
    
    await generateErrorAcknowledgment(deliveryId, error);
    throw error;
  }
};

// Scheduled processing - runs every minute
exports.processPendingDeliveries = onSchedule({
  schedule: "* * * * *",
  maxInstances: 5
}, async () => {
  const pendingDeliveries = await db.collection('deliveries')
    .where('processing.status', 'in', ['pending', 'received', 'files_ready'])
    .orderBy('processing.receivedAt', 'asc')
    .limit(5)
    .get();
  
  for (const doc of pendingDeliveries.docs) {
    await processDeliveryPipeline(doc.id);
  }
});
```

#### Asset Processing
```javascript
// File Transfer with MD5 Validation
async function transferDeliveryFiles(deliveryId) {
  const transfer = await db.collection('fileTransfers').doc(deliveryId).get();
  const { audioFiles, imageFiles, distributorId } = transfer.data();
  
  const transferredFiles = { audio: [], images: [] };
  
  // Transfer and validate each file
  for (const sourceUrl of audioFiles) {
    const response = await axios({
      method: 'GET',
      url: sourceUrl,
      responseType: 'arraybuffer'
    });
    
    const buffer = Buffer.from(response.data);
    const calculatedMD5 = calculateMD5(buffer);
    
    // Validate against expected MD5 from ERN if available
    const expectedMD5 = getExpectedMD5FromERN(deliveryId, sourceUrl);
    const md5Valid = expectedMD5 ? calculatedMD5 === expectedMD5 : null;
    
    // Store in DSP storage
    const storagePath = `deliveries/${distributorId}/${deliveryId}/audio/${fileName}`;
    await bucket.file(storagePath).save(buffer);
    
    transferredFiles.audio.push({
      originalUrl: sourceUrl,
      storagePath,
      md5Hash: calculatedMD5,
      md5Valid
    });
  }
  
  // Update delivery with transferred files
  await db.collection('deliveries').doc(deliveryId).update({
    'files.transferred': transferredFiles,
    'files.transferredAt': admin.firestore.FieldValue.serverTimestamp(),
    'processing.status': 'files_ready'
  });
  
  // Trigger processing now that files are ready
  await processDeliveryPipeline(deliveryId);
}
```

### 2. Music Catalog

#### Catalog Structure
```typescript
interface CatalogStructure {
  releases: Release[];
  tracks: Track[];
  artists: Artist[];
  albums: Album[];
  
  // Relationships
  artistAlbums: Map<ArtistId, AlbumId[]>;
  albumTracks: Map<AlbumId, TrackId[]>;
  
  // Search indices
  searchIndex: SearchDocument[];
}
```

#### Smart Enrichment
```javascript
// Automatic metadata enrichment
async function enrichRelease(release) {
  // Generate color palette from artwork
  release.artwork.palette = await extractColors(release.artwork.url);
  
  // Create artist profiles if new
  for (const artist of release.artists) {
    await createOrUpdateArtist(artist);
  }
  
  // Link related content
  release.related = await findRelatedReleases(release);
  
  return release;
}
```

### 3. Streaming Infrastructure

#### Adaptive Bitrate Streaming
```javascript
// HLS/DASH manifest generation
class StreamingService {
  async getStreamUrl(trackId, quality = 'auto') {
    const track = await getTrack(trackId);
    
    if (quality === 'auto') {
      // Return adaptive manifest
      return {
        hls: `${CDN_URL}/${trackId}/master.m3u8`,
        dash: `${CDN_URL}/${trackId}/manifest.mpd`
      };
    }
    
    // Return specific quality
    return `${CDN_URL}/${trackId}/${quality}.mp3`;
  }
}
```

#### Offline Playback
```javascript
// Progressive Web App with offline support
const offlineCache = {
  name: 'stardust-dsp-offline-v1',
  urls: [
    '/',
    '/player',
    '/library'
  ],
  // Dynamic caching for tracks
  dynamicUrls: async () => {
    const downloads = await getOfflineDownloads();
    return downloads.map(d => d.audioUrl);
  }
};
```

### 4. Search & Discovery

#### Multi-faceted Search
```javascript
// Algolia/Typesense integration
const searchClient = {
  indices: {
    tracks: {
      searchableAttributes: ['title', 'artist', 'album'],
      attributesForFaceting: ['genre', 'year', 'language'],
      customRanking: ['popularity', 'recency']
    },
    artists: {
      searchableAttributes: ['name', 'aliases'],
      attributesForFaceting: ['genre', 'country']
    },
    albums: {
      searchableAttributes: ['title', 'artist'],
      attributesForFaceting: ['type', 'year', 'label']
    }
  }
};
```

#### Recommendation Engine
```javascript
// Basic collaborative filtering
async function getRecommendations(userId) {
  const userHistory = await getUserListeningHistory(userId);
  const similarUsers = await findSimilarUsers(userHistory);
  const recommendations = await aggregateRecommendations(similarUsers);
  
  return recommendations;
}
```

### 5. User Features

#### Library Management
```typescript
interface UserLibrary {
  playlists: Playlist[];
  favorites: {
    tracks: TrackId[];
    albums: AlbumId[];
    artists: ArtistId[];
  };
  history: ListeningHistory[];
  downloads: OfflineTrack[];
}
```

#### Social Features
- Create and share playlists
- Follow artists and users
- Activity feed
- Collaborative playlists

### 6. Analytics & Reporting

#### Usage Tracking
```javascript
// Privacy-respecting analytics
class AnalyticsService {
  async trackPlay(userId, trackId, context) {
    await firestore.collection('plays').add({
      userId: hash(userId), // Privacy
      trackId,
      timestamp: serverTimestamp(),
      duration: 0,
      context: {
        playlist: context.playlistId,
        source: context.source, // search, browse, playlist
        device: context.deviceType
      }
    });
  }
  
  async updatePlayDuration(playId, duration) {
    // Update when 30s+ played
    if (duration >= 30) {
      await firestore.collection('plays').doc(playId).update({
        duration,
        counted: true // For royalty calculation
      });
    }
  }
}
```

#### DSR Generation
```javascript
// DDEX DSR (Digital Sales Reporting)
class DSRGenerator {
  async generateMonthlyDSR(year, month) {
    const plays = await getMonthlyPlays(year, month);
    const report = new DSRBuilder('3.0');
    
    for (const play of plays) {
      report.addTransaction({
        isrc: play.track.isrc,
        territory: play.user.territory,
        serviceType: 'StreamingSubscription',
        uses: play.count,
        revenue: calculateRevenue(play)
      });
    }
    
    return report.build();
  }
}
```

## Ingestion Architecture Deep Dive

### Direct Pipeline vs Pub/Sub

The platform evolved from a Pub/Sub architecture to a direct pipeline approach for several key reasons:

#### Direct Pipeline Advantages (Current Architecture)
1. **Simplicity**: Single function orchestrates entire flow
2. **Debuggability**: Complete stack traces and linear execution
3. **Cost Efficiency**: Fewer function invocations and no message costs
4. **Performance**: 30-50% faster for typical workloads
5. **Transaction Support**: Better data consistency with atomic operations

#### When Pub/Sub Would Be Better
- Processing millions of deliveries per day
- Need for complex retry patterns per step
- Multiple consumers for same events
- Geographic distribution requirements

### File Transfer Architecture

```javascript
// Separate file transfer job system
interface FileTransferJob {
  deliveryId: string;
  distributorId: string;
  audioFiles: string[];    // Source URLs from distributor
  imageFiles: string[];    // Source URLs from distributor
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  md5ValidationStatus?: 'passed' | 'failed';
  transferredFiles?: {
    audio: TransferredFile[];
    images: TransferredFile[];
  };
}

interface TransferredFile {
  originalUrl: string;
  storagePath: string;
  publicUrl: string;
  fileName: string;
  size: number;
  md5Hash: string;
  md5Valid: boolean | null;
  expectedMD5?: string;
}
```

### Processing State Management

The system uses granular status tracking for complete visibility:

- **received**: Delivery accepted from distributor
- **pending**: Queued for processing
- **waiting_for_files**: File transfer in progress
- **files_ready**: Files transferred, ready to process
- **parsing**: Extracting data from ERN XML
- **validating**: DDEX Workbench validation
- **processing_releases**: Creating catalog entries
- **completed**: Successfully processed
- **failed**: Error occurred
- **cancelled**: Manually cancelled

### Scheduled Functions

Three scheduled functions maintain system health:

1. **processPendingDeliveries** (every minute): Processes queued deliveries
2. **processPendingFileTransfers** (every 5 minutes): Handles file transfers
3. **cleanupStuckDeliveries** (every 30 minutes): Unlocks stuck processes

## Data Models

### Firestore Collections

```typescript
// releases collection (from ingestion)
interface Release {
  id: string;
  messageId: string; // From ERN
  sender: string;    // Label/Distributor ID
  
  metadata: {
    title: string;
    displayArtist: string;
    label: string;
    releaseDate: Date;
    genre: string[];
    copyright: Copyright[];
  };
  
  assets: {
    coverArt: ImageAsset;
    additionalArt?: ImageAsset[];
  };
  
  availability: {
    territories: string[];
    startDate: Date;
    endDate?: Date;
    tier: 'free' | 'premium' | 'all';
  };
  
  ingestion: {
    receivedAt: Timestamp;
    processedAt: Timestamp;
    ernVersion: string;
    validation: ValidationResult;
  };
  
  status: 'processing' | 'active' | 'expired' | 'removed';
}

// tracks collection
interface Track {
  id: string;
  releaseId: string;
  isrc: string;
  
  metadata: {
    title: string;
    displayArtist: string;
    duration: number;
    trackNumber?: number;
    discNumber?: number;
    contributors: Contributor[];
  };
  
  audio: {
    original: string;      // Original file
    streams: {
      hls: string;         // HLS manifest
      dash: string;        // DASH manifest
    };
    downloads?: {
      high: string;        // 320kbps
      medium: string;      // 128kbps
    };
  };
  
  rights: {
    copyright: Copyright[];
    territories: string[];
  };
  
  stats: {
    playCount: number;
    lastPlayed?: Timestamp;
  };
}

// artists collection
interface Artist {
  id: string;
  name: string;
  sortName: string;
  
  profile: {
    bio?: string;
    image?: string;
    country?: string;
    genres?: string[];
    founded?: Date;
  };
  
  links: {
    official?: string;
    social?: SocialLinks;
  };
  
  stats: {
    trackCount: number;
    albumCount: number;
    monthlyListeners: number;
    followers: number;
  };
  
  verified: boolean;
}

// albums collection
interface Album {
  id: string;
  releaseId: string; // Links to release
  
  metadata: {
    title: string;
    displayArtist: string;
    type: 'Album' | 'Single' | 'EP' | 'Compilation';
    releaseDate: Date;
    label: string;
    upc?: string;
  };
  
  artwork: {
    cover: ArtworkSizes;
    additional?: ImageAsset[];
    palette?: ColorPalette; // For UI theming
  };
  
  trackIds: string[];
  
  stats: {
    playCount: number;
    savedCount: number;
  };
}

// users collection (consumers)
interface User {
  id: string;
  email: string;
  
  profile: {
    displayName: string;
    avatar?: string;
    country: string;
    birthDate?: Date; // For age verification
  };
  
  subscription: {
    type: 'free' | 'premium' | 'family';
    startDate: Date;
    renewalDate?: Date;
    paymentMethod?: string;
  };
  
  preferences: {
    language: string;
    explicitContent: boolean;
    audioQuality: 'auto' | 'high' | 'medium' | 'low';
    downloadQuality: 'high' | 'medium';
  };
  
  stats: {
    joinDate: Timestamp;
    totalListeningTime: number;
    favoriteGenres: string[];
  };
}

// playlists collection
interface Playlist {
  id: string;
  userId: string;
  
  metadata: {
    title: string;
    description?: string;
    cover?: string;
    public: boolean;
    collaborative: boolean;
  };
  
  tracks: {
    trackId: string;
    addedAt: Timestamp;
    addedBy: string;
  }[];
  
  stats: {
    followers: number;
    playCount: number;
  };
  
  created: Timestamp;
  updated: Timestamp;
}

// plays collection (for analytics)
interface Play {
  id: string;
  userId: string; // Hashed for privacy
  trackId: string;
  
  session: {
    startTime: Timestamp;
    duration: number; // Seconds played
    completed: boolean;
    deviceType: 'web' | 'mobile' | 'desktop';
  };
  
  context: {
    source: 'playlist' | 'album' | 'search' | 'radio';
    sourceId?: string;
    territory: string;
  };
  
  counted: boolean; // For royalty calculation (30s+)
}

// deliveries collection (enhanced)
interface Delivery {
  id: string;
  sender: string;
  messageId: string; // DDEX MessageId from ERN
  
  ern: {
    version: '3.8.2' | '4.1' | '4.2' | '4.3';
    profile: string; // e.g., 'AudioAlbum'
    messageType: 'NewReleaseMessage'; // Currently only type supported
    messageSubType?: 'Initial' | 'Update' | 'Takedown'; // Detected from content
    messageId: string; // Preserved from original
    releaseCount: number;
    parsedMessageId?: string; // If different from original
  };
  
  processing: {
    receivedAt: Timestamp;
    status: ProcessingStatus;
    releases?: ProcessedRelease[]; // Includes action taken per release
  };
  
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  
  files: {
    transferred: {
      audio: TransferredFile[];
      images: TransferredFile[];
    };
    md5ValidationStatus: 'passed' | 'warnings' | 'failed';
  };
}

// releases collection (enhanced)
interface Release {
  id: string; // UPC_{upc} or GR_{grid}
  upc: string; // Primary identifier
  
  ingestion: {
    deliveryId: string;
    firstDeliveryId: string; // Original delivery
    deliveryHistory: string[]; // All delivery IDs
    messageType: 'Initial' | 'Update' | 'Takedown';
    updateCount: number;
    takedownAt?: Timestamp;
    takedownDeliveryId?: string;
  };
  
  status: 'active' | 'taken_down' | 'processing';
  
  // ... rest of release fields
}

// deliveryHistory collection (new)
interface DeliveryHistoryRecord {
  deliveryId: string;
  sender: string;
  messageType: 'Initial' | 'Update' | 'Takedown';
  processedAt: Timestamp;
  releases: Array<{
    releaseId: string;
    title: string;
    artist: string;
    action: 'create' | 'update' | 'overwrite' | 'takedown';
    trackCount: number;
  }>;
  ernVersion: string;
}
```

## DDEX Standards & Message Types

### ERN Processing Architecture
Stardust DSP implements DDEX ERN 4.3 as the primary ingestion format, with backward compatibility for ERN 3.8.2.

### Message Type Handling

#### Reception and Processing
The DSP processes three message subtypes differently based on the delivery history:

**Initial Deliveries:**
- Creates new release document with UPC-based ID (`UPC_{upc}`)
- Processes all tracks and assets
- Creates artist profiles if new
- Sets status to "active"

**Update Deliveries:**
- Merges with existing release data
- Preserves play counts and user-generated data
- Updates metadata and assets
- Increments update counter
- Maintains delivery history

**Takedown Deliveries:**
- Sets release status to "taken_down"
- Preserves all data for reporting
- Removes from public catalog
- Records takedown timestamp

### UPC-Based Deduplication
The platform uses UPC as the primary identifier to prevent duplicate releases:

```javascript
// Document ID strategy
const releaseId = upc ? `UPC_${upc}` : `GR_${gridId}`;

// Check for existing release
const existingRelease = await db.collection("releases").doc(releaseId).get();

if (existingRelease.exists && messageType === 'Update') {
  // Merge with existing
} else if (existingRelease.exists && messageType === 'Initial') {
  // Log warning and overwrite (duplicate delivery)
} else {
  // Create new
}
```

### Delivery History Tracking
Each release maintains a complete delivery history:

```javascript
interface DeliveryHistory {
  deliveryId: string;
  messageType: 'Initial' | 'Update' | 'Takedown';
  processedAt: Timestamp;
  sender: string;
  ernVersion: string;
}
```

### File Transfer with DDEX Naming
During file transfer, the DSP renames files to DDEX-compliant names:

```javascript
// Extract UPC from parsed ERN
const upc = release.RELEASEID?.ICPN?._; 

// Generate DDEX filenames
const audioFile = `${upc}_${discNumber}_${trackNumber}.wav`;
const coverArt = `${upc}.jpg`;
```

### MD5 Validation
Files are validated during transfer but mismatches are treated as warnings:

```javascript
if (expectedMD5 !== calculatedMD5) {
  console.warn('MD5 mismatch - expected if re-encoded');
  // Continue processing with warning flag
}
```

## API Architecture

### Consumer API (Public)

```typescript
// Catalog browsing
GET /api/browse/new-releases
GET /api/browse/top-charts
GET /api/browse/genres
GET /api/browse/moods

// Search
GET /api/search?q={query}&type={type}&limit={limit}
GET /api/search/suggestions?q={query}

// Content details
GET /api/albums/:id
GET /api/artists/:id
GET /api/tracks/:id
GET /api/playlists/:id

// Streaming
GET /api/stream/:trackId/manifest
GET /api/stream/:trackId/license  // DRM if enabled

// User library
GET    /api/library/playlists
POST   /api/library/playlists
PUT    /api/library/playlists/:id
DELETE /api/library/playlists/:id
POST   /api/library/favorites/:type/:id
DELETE /api/library/favorites/:type/:id

// User profile
GET  /api/profile
PUT  /api/profile
GET  /api/profile/history
GET  /api/profile/stats
```

### Industry API (B2B)

```typescript
// Delivery endpoints
POST /api/deliveries              // Submit new delivery
GET  /api/deliveries/:id          // Check delivery status
GET  /api/deliveries/:id/receipt  // Download receipt

// Catalog management
GET  /api/industry/releases       // List delivered releases
GET  /api/industry/releases/:id   // Release details
POST /api/industry/releases/:id/update
POST /api/industry/releases/:id/takedown

// Reporting
GET  /api/industry/reports/usage  // Usage reports
GET  /api/industry/reports/dsr    // DSR files
```

### Admin API (Internal)

```typescript
// Ingestion management
GET  /api/admin/deliveries
POST /api/admin/deliveries/:id/reprocess
GET  /api/admin/ingestion/queue
POST /api/admin/ingestion/pause

// Content moderation
GET  /api/admin/content/flagged
POST /api/admin/content/:id/review
POST /api/admin/content/:id/remove

// Analytics
GET  /api/admin/analytics/overview
GET  /api/admin/analytics/revenue
GET  /api/admin/analytics/usage
```

## CLI Tool Architecture

### Installation & Setup
```bash
# Global installation
npm install -g @stardust-dsp/dsp-cli

# Create new DSP
stardust-dsp create my-music-service \
  --template=streaming \
  --search=algolia \
  --cdn=cloudflare

# Interactive setup
cd my-music-service
stardust-dsp init
# Prompts for:
# - Firebase project
# - Domain configuration
# - Ingestion settings
# - Payment processing (optional)
```

### CLI Commands
```bash
# Project management
stardust-dsp create <name>       # Create new DSP
stardust-dsp init                # Initialize services
stardust-dsp deploy              # Deploy platform
stardust-dsp update              # Update framework

# Configuration
stardust-dsp config ingestion    # Configure delivery reception
stardust-dsp config streaming    # Setup CDN/transcoding
stardust-dsp config search       # Configure search service

# Development
stardust-dsp dev                 # Start local server
stardust-dsp emulators           # Firebase emulators
stardust-dsp seed                # Load demo content

# Operations
stardust-dsp deliveries list     # List recent deliveries
stardust-dsp deliveries process  # Manually process delivery
stardust-dsp reports generate    # Generate DSR
```

## Security Architecture

### Content Protection
```javascript
// Secure streaming URLs
class SecureStreaming {
  async generateStreamToken(userId, trackId) {
    // Verify user access
    const hasAccess = await verifyAccess(userId, trackId);
    if (!hasAccess) throw new UnauthorizedError();
    
    // Generate time-limited token
    return jwt.sign({
      userId,
      trackId,
      expires: Date.now() + 3600000 // 1 hour
    }, process.env.STREAM_SECRET);
  }
  
  async getSecureUrl(trackId, token) {
    const verified = jwt.verify(token, process.env.STREAM_SECRET);
    
    // Return signed CDN URL
    return signUrl(`${CDN_URL}/${trackId}/manifest.m3u8`, {
      expires: verified.expires
    });
  }
}
```

### DRM Integration (Optional)
```javascript
// Widevine/FairPlay integration
class DRMService {
  async getLicense(trackId, challenge) {
    // Verify user subscription
    const user = await getCurrentUser();
    if (!user.subscription.active) {
      throw new SubscriptionRequiredError();
    }
    
    // Generate license
    return drmProvider.generateLicense(trackId, challenge);
  }
}
```

### Privacy & Compliance
- GDPR compliant data handling
- Anonymous analytics option
- Data export capabilities
- Right to deletion support

## Customization & Theming

### White-Label Configuration
```javascript
// Brand configuration (generated by CLI)
export default {
  brand: {
    name: 'My Music Service',
    logo: '/assets/logo.svg',
    favicon: '/assets/favicon.ico'
  },
  
  theme: {
    colors: {
      primary: '#FF6B6B',
      secondary: '#4ECDC4',
      background: '#1A1A2E',
      surface: '#16213E'
    },
    fonts: {
      display: 'Bebas Neue',
      body: 'Inter'
    },
    player: {
      style: 'minimal', // or 'full', 'compact'
      position: 'bottom' // or 'top', 'floating'
    }
  },
  
  features: {
    social: true,
    downloads: true,
    podcasts: false,
    liveRadio: false,
    merchandise: false
  }
};
```

### Plugin System
```javascript
// Custom recommendation algorithm
export class CustomRecommendations {
  async getRecommendations(user, context) {
    // Custom logic
    return tracks;
  }
}

// Register plugin
dsp.registerPlugin('recommendations', CustomRecommendations);
```

## Monetization Models

### Subscription Tiers
```typescript
interface SubscriptionPlans {
  free: {
    features: ['shuffle', 'ads'],
    limitations: {
      skipsPerHour: 6,
      audioQuality: 128,
      offline: false
    }
  },
  premium: {
    price: 9.99,
    features: ['unlimited', 'offline', 'hq'],
    limitations: null
  },
  family: {
    price: 14.99,
    features: ['premium', 'multiUser'],
    userLimit: 6
  }
}
```

### Revenue Streams
1. **Subscriptions**: Monthly/annual plans
2. **Advertising**: Audio and display ads
3. **Downloads**: Premium track purchases
4. **Merchandise**: Artist merchandise
5. **Live Events**: Ticketing integration

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4) ✅ COMPLETE
- [x] Create CLI scaffolding tool
- [x] Set up package structure
- [x] Design Firestore schema
- [x] Implement unified auth
- [x] Create base UI components
- [x] Setup Firebase project template
- [x] Create core composables (useAuth, useDualAuth, useCatalog, usePlayer)
- [x] Implement CSS architecture
- [x] Setup development environment

#### Phase 1 Accomplishments:
- **CLI functional**: Can create and manage projects
- **Auth working**: Users can sign up and log in
- **UI responsive**: Works on desktop and mobile
- **Deploy ready**: Can deploy to Firebase
- **Developer friendly**: Hot reload, good DX

### Phase 2: Ingestion Pipeline (Weeks 5-8) ✅ COMPLETE
- [x] Build ERN receiver (HTTP endpoint)
- [x] Implement direct pipeline architecture
- [x] Create XML parser with ERN 4.3 support
- [x] Integrate Workbench validation
- [x] Build file transfer system with MD5 validation
- [x] Implement scheduled queue processing
- [x] Create asset processor for releases
- [x] Build acknowledgment system
- [x] Add transaction-based locking
- [x] Create distributor management UI
- [x] Build ingestion monitoring dashboard
- [x] Add real-time processing status
- [x] Enable Stardust Distro integration

#### Phase 2 Accomplishments:
- **Direct pipeline**: Simplified architecture without Pub/Sub complexity
- **Reliable processing**: Transaction-based locking prevents race conditions
- **File integrity**: MD5 validation ensures correct file transfers
- **Scheduled processing**: Automatic queue handling every minute
- **Separate file transfers**: Dedicated job system for large files
- **Complete monitoring**: Real-time status updates via Firestore
- **Production ready**: Deployed and operational on Firebase

### Phase 3: Core Streaming (Weeks 9-12) ✅ COMPLETE
- [x] Implement catalog structure
- [x] Build catalog browse interface
- [x] Create release detail pages
- [x] Implement basic search (client-side)
- [x] Add audio playback with Howler.js
- [x] Create mini player component
- [x] Build queue management
- [x] Update dashboard with real data
- [x] Create artist detail pages
- [x] Add HLS/DASH support preparation
- [x] Implement streaming URL generation foundation
- [x] Add user library framework (favorites/playlists)

#### Phase 3 Accomplishments:
- **Catalog functional**: Browse and search working with real ingested data
- **Playback working**: Audio streaming via Howler.js with queue management
- **Release pages complete**: Full album/track details with metadata
- **Dashboard live**: Real-time stats and monitoring of platform
- **Artist profiles**: Complete artist pages with discography
- **Player system**: Full audio player with controls and progress tracking

### Phase 4: Testing Suite (Weeks 13-16) ✅ COMPLETE
- [x] Build comprehensive testing framework
- [x] Implement system health tests
- [x] Create ingestion pipeline tests
- [x] Add catalog operation tests
- [x] Build performance benchmarks
- [x] Add test result export functionality
- [x] Create real-time test execution log
- [x] Implement health score calculation
- [x] Test MD5 validation and file transfers
- [x] Verify DDEX Workbench API integration

#### Phase 4 Accomplishments:
- **20+ automated tests**: Covering all critical platform functions
- **System health monitoring**: Firebase Auth, Firestore, Storage, Functions verified
- **Ingestion testing**: Complete pipeline validation including ERN parsing and file transfers
- **Performance benchmarks**: Measured ingestion speed, query performance, stream latency
- **Health score system**: Overall platform health calculated from test results
- **Real-time logging**: Detailed execution logs with timestamps and status
- **Export capability**: JSON export of all test results for analysis

### Phase 5: Consumer Features (Weeks 17-20) ✅ COMPLETE

- [x] Build enhanced browse interface
- [x] Add advanced search with filters
- [x] Implement playlist management
- [x] Add favorites system
- [x] Create user profiles
- [x] Add social features (sharing)
- [x] Implement recommendations
- [x] Add recently played history
- [x] Create personalized home page
- [x] Add follow artist functionality

#### Phase 5 Accomplishments:

**Consumer Views Created:**
- **Home.vue**: Personalized dashboard with greeting, recently played, recommendations, new releases, trending tracks, followed artists, and mood-based playlists
- **Browse.vue**: Enhanced discovery interface with featured content, genre exploration, mood playlists, new releases, charts (Top 50, Viral, Local), and personalized recommendations
- **Search.vue**: Advanced search with real-time results, filters (genre, release date, duration, explicit content), recent searches, and category browsing
- **Library.vue**: Complete library management with playlists, favorite tracks/albums/artists, recently played history, and playlist creation
- **Profile.vue**: User profiles with stats (followers, following, playlists), activity feed, public playlists, recently played, and profile editing
- **PlaylistDetail.vue**: Full playlist management with inline editing, drag-and-drop track reordering, collaborative playlists, search/filter within playlist
- **Artist.vue**: Artist pages with discography, top tracks, similar artists, follow/unfollow functionality

**Composables Implemented:**
- **useLibrary.js**: Complete library management with favorites, playlists, recently played, real-time syncing with Firestore
- **useSocial.js**: Social features including follow/unfollow users and artists, sharing content, activity feed
- **useProfile.js**: Profile management with stats, avatar/cover upload, username validation, public playlists
- **useDebounce.js**: Search optimization for real-time search functionality

**Services Created:**
- **recommendations.js**: Recommendation engine with personalized suggestions based on listening history, pattern extraction, and Discover Weekly generation

**Component Libraries:**
- **Browse Components**: AlbumCarousel, AlbumGrid, ArtistCarousel, ArtistGrid, PlaylistGrid, TrackList
- **Library Components**: PlaylistCard for visual playlist representation
- **Profile Components**: ActivityFeed, EditProfileModal, RecentlyPlayedList, UserList

**Features Implemented:**
- ✅ **Personalized Home**: Customized content based on time of day, listening history, and preferences
- ✅ **Advanced Search**: Multi-faceted search across tracks, artists, albums, playlists with advanced filters
- ✅ **Playlist Management**: Create, edit, delete, reorder tracks, collaborative playlists, public/private settings
- ✅ **Favorites System**: Add/remove favorites for tracks, albums, artists with instant syncing
- ✅ **Social Features**: Follow/unfollow users and artists, share content, activity feeds
- ✅ **Recommendations**: ML-ready recommendation system with pattern analysis and personalized suggestions
- ✅ **History Tracking**: Automatic tracking of recently played content with timestamps
- ✅ **Discovery Features**: Browse by genre, mood, charts, new releases, curated playlists
- ✅ **User Profiles**: Public profiles with stats, followers/following, activity, and customization
- ✅ **Real-time Updates**: All user actions sync instantly across devices via Firestore

**Technical Achievements:**
- Reactive state management with Vue 3 Composition API
- Real-time data synchronization with Firestore listeners
- Optimized search with debouncing
- Drag-and-drop functionality for playlist management
- Responsive design for all screen sizes
- Local storage for user preferences and recent searches
- File upload capabilities for profile customization

### Phase 6: Analytics & Reporting (Weeks 21-24) 📅 UP NEXT
- [ ] Implement play tracking
- [ ] Build analytics dashboard
- [ ] Create DSR generator
- [ ] Add usage reports
- [ ] Implement royalty calculations
- [ ] Add distributor reporting portal
- [ ] Create admin analytics panel
- [ ] Build export functionality
- [ ] Add real-time analytics
- [ ] Implement data visualization

### Phase 7: Polish & Launch (Weeks 25-28) 📅 UPCOMING
- [ ] Performance optimization
- [ ] Security audit
- [ ] Documentation completion
- [ ] Demo deployment (stardust-dsp.org)
- [ ] npm package publication
- [ ] Create video tutorials
- [ ] Launch marketing site
- [ ] Gather beta feedback
- [ ] Production release
- [ ] Post-launch monitoring

## Success Metrics

### Platform Metrics (Year 1)
- **Deployments**: 1,000+ active DSPs
- **Catalog Size**: 1M+ tracks ingested
- **User Base**: 100K+ active listeners
- **Uptime**: 99.9% availability

### Performance Targets
- **Ingestion Speed**: <2 min for standard album
- **Search Latency**: <50ms response time
- **Stream Start**: <500ms buffering
- **Page Load**: <2s initial load

### Ecosystem Integration
- **Distro Integration**: 80% using DDEX Distro
- **Workbench Validation**: 100% of ingestions
- **Cross-Platform**: 60% using multiple tools

## Future Enhancements

### Advanced Features (v2.0)
1. **AI-Powered Discovery**: ML-based recommendations
2. **Live Streaming**: Radio and live events
3. **Podcast Platform**: Full podcast support
4. **Artist Direct**: Direct artist uploads
5. **Blockchain Rights**: Decentralized licensing

### Platform Extensions
1. **Mobile SDKs**: iOS/Android native apps
2. **TV Apps**: Smart TV applications
3. **Voice Integration**: Alexa/Google Assistant
4. **Car Systems**: Android Auto/CarPlay
5. **Wearables**: Watch apps

### B2B Features
1. **White-Label API**: Full platform-as-a-service
2. **Analytics API**: Deep usage insights
3. **Advertising Platform**: Self-serve ad system
4. **Content Management**: Label/artist portal
5. **Revenue Sharing**: Automated royalty distribution

## Technical Considerations

### Scalability
- **Auto-scaling**: Cloud Functions handle load
- **CDN Strategy**: Global edge locations
- **Database Sharding**: For 10M+ tracks
- **Search Scaling**: Distributed search indices

### Performance Optimization
```javascript
// Lazy loading strategies
const optimizations = {
  images: {
    lazy: true,
    sizes: [64, 128, 256, 512],
    formats: ['webp', 'jpeg']
  },
  audio: {
    preload: 'metadata',
    bufferSize: 64 * 1024 // 64KB
  },
  search: {
    debounce: 300,
    minLength: 2,
    cache: true
  }
};
```

### Monitoring
```javascript
// Comprehensive monitoring
import { monitor } from '@stardust-dsp/monitoring';

monitor.track('ingestion', {
  success: ingestSuccess,
  duration: processingTime,
  releaseId,
  sender
});

monitor.alert('stream-errors', {
  threshold: 100,
  window: '5m',
  action: 'page-oncall'
});
```

## Getting Started

### Quick Start
```bash
# Install CLI
npm install -g @stardust-dsp/dsp-cli

# Create your streaming platform
stardust-dsp create my-platform --template=streaming

# Deploy
cd my-platform
npm run deploy

# Your DSP is live! 🎵
```

## Development Setup

### Prerequisites
- Node.js 16+
- npm or yarn
- Firebase CLI
- Git

### Local Development
```bash
# Clone repository
git clone https://github.com/stardust-ecosystem/dsp.git
cd dsp

# Install CLI
cd cli
npm install
npm link

# Create test project
stardust-dsp create test-project
cd test-project
npm run dev
```

## Contributing

### How to Contribute
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Style
- Vue 3 Composition API
- Semantic commit messages

## License

MIT License - Free for commercial and personal use

## Support & Resources

- **Documentation**: https://docs.stardust-dsp.org
- **GitHub**: https://github.com/daddykev/stardust-dsp
- **Email**: daddykev@gmail.com

---

*The future of music streaming is open, compliant, and yours to build.*