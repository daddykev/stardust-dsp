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

## **Development Status (August 2025)**

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

### 📅 Upcoming Phases
- Phase 4: Consumer Features (Weeks 13-16) - UP NEXT
- Phase 5: Analytics & Reporting (Weeks 17-20)
- Phase 6: Advanced Features (Weeks 21-24)
- Phase 7: Testing & Launch (Weeks 25-28)

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

## Unified Authentication Strategy

Stardust DSP integrates with the ecosystem authentication while maintaining its own user base:

```javascript
// Dual authentication model
import { initializeAuth } from '@stardust-ecosystem/auth';

// Industry auth (for deliveries/testing)
const industryAuth = initializeAuth({
  project: 'stardust-ecosystem',
  domain: 'auth.stardust-ecosystem.org'
});

// Consumer auth (for listeners)
const consumerAuth = initializeAuth({
  project: 'my-dsp',
  domain: 'auth.my-streaming-service.com'
});

// Enables:
// - Labels to test deliveries from Stardust Distro
// - Separate consumer accounts for streaming
// - Analytics across the ecosystem
```

### Authentication Flows
1. **Industry Users**: Labels/distributors sending content
2. **Consumer Users**: Listeners accessing the platform
3. **Admin Users**: Platform operators and moderators

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
│   │   ├── streaming/            # Full streaming platform ❌
│   │   ├── catalog/              # Catalog-only (B2B) ❌
│   │   └── test/                 # Test environment ❌
│   └── package.json              # CLI dependencies ✅
├── packages/                     # Core packages
│   ├── @stardust-dsp/dsp-core/   # Core DSP logic
│   │   ├── src/
│   │   │   ├── ingestion/        # ERN processing
│   │   │   │   └── ern-processor.ts # ERN processor ✅
│   │   │   ├── catalog/          # Catalog management ❌
│   │   │   ├── streaming/        # Playback engine ❌
│   │   │   └── reporting/        # DSR generation ❌
│   │   └── package.json          # Package config ✅
│   ├── @stardust-dsp/player/     # Audio player
│   │   ├── src/
│   │   │   ├── components/       # Player UI ❌
│   │   │   ├── engine/           # Playback logic ❌
│   │   │   └── drm/              # Rights management ❌
│   │   └── package.json          # Package config ❌
│   └── @stardust-dsp/storefront/ # Public UI components
│       ├── src/
│       │   ├── browse/           # Browse components ❌
│       │   ├── search/           # Search interface ❌
│       │   ├── player/           # Player integration ❌
│       │   └── account/          # User account ❌
│       └── package.json          # Package config ❌
├── template/                     # Default project template
│   ├── src/                      # Vue application
│   │   ├── components/           # UI components
│   │   │   ├── NavBar.vue        # Navigation component ✅
│   │   │   ├── browse/           # Browse & discovery
│   │   │   │   ├── HomePage.vue  # Home page ❌
│   │   │   │   ├── AlbumGrid.vue # Album grid ❌
│   │   │   │   ├── ArtistPage.vue # Artist page ❌
│   │   │   │   └── GenreExplorer.vue # Genre explorer ❌
│   │   │   ├── player/           # Music player
│   │   │   │   ├── FullPlayer.vue # Full player view ✅
│   │   │   │   ├── NowPlaying.vue # Now playing view ❌
│   │   │   │   ├── Queue.vue     # Queue management ❌
│   │   │   │   ├── Controls.vue  # Player controls ❌
│   │   │   │   └── ProgressBar.vue # Progress indicator ❌
│   │   │   ├── search/           # Search functionality
│   │   │   │   ├── SearchBar.vue # Search input ❌
│   │   │   │   ├── SearchResults.vue # Results display ❌
│   │   │   │   └── Filters.vue   # Search filters ❌
│   │   │   ├── library/          # User library
│   │   │   │   ├── Playlists.vue # Playlist management ❌
│   │   │   │   ├── Favorites.vue # Favorite tracks ❌
│   │   │   │   └── History.vue   # Listening history ❌
│   │   │   └── admin/            # Admin panel
│   │   │       ├── Deliveries.vue # Delivery management ❌
│   │   │       ├── Catalog.vue   # Catalog admin ❌
│   │   │       └── Analytics.vue # Analytics dashboard ❌
│   │   ├── views/                # Page views
│   │   │   ├── Dashboard.vue     # User dashboard ✅
│   │   │   ├── Login.vue         # Login page ✅
│   │   │   ├── Signup.vue        # Signup page ✅
│   │   │   ├── SplashPage.vue    # Landing page ✅
│   │   │   ├── Distributors.vue  # Distributor management ✅
│   │   │   ├── Ingestion.vue     # Ingestion monitoring ✅
│   │   │   ├── IngestionDetail.vue # Delivery details ✅
│   │   │   ├── Catalog.vue       # Browse catalog ✅
│   │   │   ├── ReleaseDetail.vue # Release/Album details ✅
│   │   │   ├── Artist.vue        # Artist profile ✅
│   │   │   ├── Library.vue       # User library ✅
│   │   │   ├── Search.vue        # Search results ❌
│   │   │   ├── Account.vue       # User account ❌
│   │   │   └── Admin.vue         # Admin dashboard ❌
│   │   ├── stores/               # Pinia stores
│   │   │   ├── auth.js           # Authentication ❌
│   │   │   ├── catalog.js        # Music catalog ❌
│   │   │   ├── player.js         # Playback state ❌
│   │   │   ├── library.js        # User library ❌
│   │   │   └── search.js         # Search state ❌
│   │   ├── services/             # API services
│   │   │   ├── streaming.js      # Streaming service ✅
│   │   │   ├── catalog.js        # Catalog API ❌
│   │   │   ├── search.js         # Search service ❌
│   │   │   └── analytics.js      # Usage tracking ❌
│   │   ├── composables/          # Vue composables
│   │   │   ├── useAuth.js        # Basic authentication ✅
│   │   │   ├── useDualAuth.js    # Dual auth model ✅
│   │   │   ├── useCatalog.js     # Catalog operations ✅
│   │   │   ├── usePlayer.js      # Audio playback ✅
│   │   │   └── useLibrary.js     # Library management ✅
│   │   ├── router/               # Vue Router
│   │   │   └── index.js          # Route definitions ✅
│   │   ├── assets/               # Design system CSS architecture
│   │   │   ├── main.css          # Entry point importing all stylesheets ✅
│   │   │   ├── base.css          # CSS reset, normalization, base typography ✅
│   │   │   ├── themes.css        # CSS custom properties, light/dark themes ✅
│   │   │   └── components.css    # Reusable component & utility classes ✅
│   │   ├── firebase.js           # Firebase initialization ✅
│   │   ├── App.vue               # Root component ✅
│   │   └── main.js               # Entry point ✅
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
│   ├── workers/                  # Service workers
│   │   └── offline.js            # Offline playback ❌
│   ├── scripts/                  # Scripts
│   │   ├── setup.js              # Initial setup ❌
│   │   ├── configure.js          # Configuration ❌
│   │   └── seed.js               # Demo data seeder ❌
│   ├── .env.example              # Environment template ✅
│   ├── firebase.json             # Firebase config ✅
│   ├── firestore.rules           # Security rules ✅
│   ├── firestore.indexes.json    # Database indexes ✅
│   ├── storage.rules             # Storage rules ❌
│   ├── algolia.config.js         # Search config ❌
│   ├── package.json              # Dependencies ✅
│   └── vite.config.js            # Vite config ✅
├── docs/                         # Documentation
│   ├── getting-started.md        # Quick start guide ❌
│   ├── ingestion-guide.md        # ERN ingestion ❌
│   ├── streaming-setup.md        # Streaming config ❌
│   ├── customization.md          # Theming guide ❌
│   ├── api-reference.md          # API docs ❌
│   └── dsr-reporting.md          # DSR guide ❌
├── examples/                     # Example configs
│   ├── test-platform/            # Test environment ❌
│   ├── indie-dsp/                # Indie platform ❌
│   └── enterprise/               # Enterprise setup ❌
├── tests/                        # Test suites ❌
├── LICENSE                       # MIT License ❌
├── README.md                     # Project README ❌
└── blueprint.md                  # This document ✅
```

### Files Created and Deployed:
✅ = File exists and is functional
❌ = File not yet created
📝 = File partially created or needs implementation

### **Summary of Current Status:**
- **Core App (template/)**: 65% complete - All Phase 3 features complete
- **CLI Tool**: ✅ 100% complete - All commands created and functional
- **Packages**: 15% complete - @stardust-dsp/dsp-core started with ERN processor
- **Services**: 25% complete - Streaming service implemented
- **Components**: 15% complete - NavBar and FullPlayer created
- **Composables**: ✅ 100% complete - All composables implemented (useAuth, useDualAuth, useCatalog, usePlayer, useLibrary)
- **Views**: 79% complete - 11 of 14 views created (including all Phase 3 views)
- **Functions**: ✅ 100% complete - All ingestion Cloud Functions deployed and working
- **Documentation**: 5% complete - blueprint exists
- **Testing**: 0% complete - no tests written yet

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

// deliveries collection (ingestion log)
interface Delivery {
  id: string;
  sender: string;
  
  package: {
    originalPath: string;
    size: number;
    files: string[];
  };
  
  ern: {
    messageId: string;
    version: string;
    releaseCount: number;
  };
  
  processing: {
    receivedAt: Timestamp;
    startedAt?: Timestamp;
    completedAt?: Timestamp;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    errors?: ProcessingError[];
  };
  
  acknowledgment?: {
    sentAt: Timestamp;
    messageId: string;
  };
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

### Phase 4: Consumer Features (Weeks 13-16) 📅 UPCOMING
- [ ] Build enhanced browse interface
- [ ] Add advanced search with filters
- [ ] Implement playlist management
- [ ] Add favorites system
- [ ] Create user profiles
- [ ] Add social features (sharing)
- [ ] Implement recommendations
- [ ] Add recently played history
- [ ] Create personalized home page
- [ ] Add follow artist functionality

### Phase 5: Analytics & Reporting (Weeks 17-20) 📅 UPCOMING
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

### Phase 6: Advanced Features (Weeks 21-24) 📅 UPCOMING
- [ ] Add recommendation engine
- [ ] Implement offline playback (PWA)
- [ ] Add podcast support (optional)
- [ ] Create artist tools portal
- [ ] Build mobile app shells
- [ ] Add live streaming capability
- [ ] Implement advanced search (Algolia)
- [ ] Add multi-language support
- [ ] Create content moderation tools
- [ ] Add A/B testing framework

### Phase 7: Testing & Launch (Weeks 25-28) 📅 UPCOMING
- [ ] Comprehensive testing suite
- [ ] Performance optimization
- [ ] Security audit
- [ ] Documentation completion
- [ ] Demo deployment (stardust-dsp.org)
- [ ] npm package publication
- [ ] Create video tutorials
- [ ] Launch marketing site
- [ ] Gather beta feedback
- [ ] Production release

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

### Test with Stardust Distro
```bash
# Send test delivery from Stardust Distro
stardust-distro deliver \
  --target=http://localhost:5001/api/deliveries \
  --release=test-album

# Check ingestion status
stardust-dsp deliveries list
```

### Next Steps
1. Configure your brand
2. Set up payment processing
3. Customize the interface
4. Launch to the world

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
- ESLint configuration
- Semantic commit messages
- JSDoc comments

## Known Issues & TODOs

### Technical Debt
- [ ] Add comprehensive error handling
- [ ] Implement proper logging
- [ ] Add input validation
- [ ] Create unit tests
- [ ] Add TypeScript to template

### Documentation Needs
- [ ] Create README.md
- [ ] Write API documentation
- [ ] Create user guides
- [ ] Add code comments
- [ ] Create video tutorials

## License

MIT License - Free for commercial and personal use

## Support & Resources

- **Documentation**: https://docs.stardust-dsp.org
- **GitHub**: https://github.com/daddykev/stardust-dsp
- **Email**: daddykev@gmail.com

---

The future of music streaming is open, compliant, and yours to build.