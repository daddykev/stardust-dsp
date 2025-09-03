# Stardust DSP

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-4FC08D.svg)](https://vuejs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-v9-FFA000.svg)](https://firebase.google.com/)
[![Status](https://img.shields.io/badge/Status-Alpha-orange.svg)](https://github.com/daddykev/stardust-dsp)

> Open-source, npm-installable streaming platform that turns DDEX deliveries into a complete music service.

Stardust DSP enables anyone to deploy a fully functional, DDEX-compliant streaming platform in minutes. Receive ERN deliveries, process them automatically, and provide a complete music streaming experience. **Every feature, every protocol, every line of code is MIT licensed and free forever.**

## 🎯 True Open Source Philosophy

**Stardust DSP is 100% open source.** The entire platform is MIT licensed with no paid tiers, no enterprise edition, and no artificial limitations. You get a complete, production-ready streaming platform with ALL ingestion protocols (FTP, SFTP, S3, API), full ERN processing, adaptive streaming, and everything needed to run a professional music service.

We believe in democratizing music streaming technology. The core platform is and will always be completely free and fully functional.

### Why This Matters
- **No vendor lock-in**: Deploy and use forever without paying a cent
- **No artificial limits**: No track caps, no watermarks, no time bombs
- **Complete functionality**: Every feature needed for professional streaming
- **True community ownership**: Fork it, modify it, deploy it - it's yours
- **Perfect for testing**: Ideal companion for testing Stardust Distro deliveries

## 🚧 Current Development Status

**Alpha Release - v0.8.0** (September 2025)

### ✅ Phase 1: Foundation - COMPLETE
- [x] Project architecture and blueprint
- [x] Vue 3 application with core views
- [x] Firebase integration (Auth, Firestore, Storage)
- [x] Complete authentication system
- [x] Dual-auth model for industry and consumer users
- [x] Navigation and routing structure
- [x] Professional CSS architecture
- [x] Theme support (light/dark)
- [x] CLI tool with all commands
- [x] Vue composables (useAuth, useDualAuth, useCatalog, usePlayer)
- [x] Responsive design foundation
- [x] Live deployment to Firebase Hosting

#### Phase 1 Accomplishments:
- **CLI functional**: Can create and manage projects
- **Auth working**: Users can sign up and log in
- **UI responsive**: Works on desktop and mobile
- **Deploy ready**: Can deploy to Firebase
- **Developer friendly**: Hot reload, good DX

### ✅ Phase 2: Ingestion Pipeline - COMPLETE
- [x] Build ERN receiver with HTTP endpoint
- [x] Implement direct pipeline architecture
- [x] Create XML parser with ERN 4.3 support
- [x] Integrate DDEX Workbench validation
- [x] Build file transfer system with MD5 validation
- [x] Implement scheduled queue processing
- [x] Create asset processor for releases
- [x] Build acknowledgment system
- [x] Add transaction-based locking for concurrency
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

### ✅ Phase 3: Core Streaming - COMPLETE
- [x] Implement catalog structure
- [x] Build streaming API
- [x] Add HLS/DASH support foundation
- [x] Create web player component
- [x] Implement basic search and filtering
- [x] Add user library system
- [x] Build catalog browsing interface
- [x] Create release and artist detail pages
- [x] Implement audio playback with Howler.js
- [x] Add queue management and controls
- [x] Real-time dashboard with platform statistics
- [x] Mini player with persistent playback

#### Phase 3 Accomplishments:
- **Catalog functional**: Browse and search working with real ingested data
- **Playback working**: Audio streaming via Howler.js with queue management
- **Release pages complete**: Full album/track details with metadata
- **Dashboard live**: Real-time stats and monitoring of platform
- **Artist profiles**: Complete artist pages with discography
- **Player system**: Full audio player with controls and progress tracking
- **Library system**: Favorites and playlists with Firebase persistence

### ✅ Phase 4: Testing Suite - COMPLETE
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

### ✅ Phase 5: Consumer Features - COMPLETE
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

### 🚧 Phase 6: Analytics & Reporting (Weeks 21-24)
- [ ] Play tracking implementation
- [ ] Analytics dashboard
- [ ] DSR generator
- [ ] Usage reports
- [ ] Revenue tracking
- [ ] Territory analytics
- [ ] Admin panel
- [ ] Content moderation tools
- [ ] System monitoring
- [ ] Performance metrics

### 📅 Phase 7: Testing & Launch (Weeks 25-28)
- [ ] Unit test suite
- [ ] Integration testing
- [ ] E2E test coverage
- [ ] Performance optimization
- [ ] Security audit
- [ ] Load testing
- [ ] Documentation completion
- [ ] Video tutorials
- [ ] Demo site deployment
- [ ] npm package publication

## ✨ Core Features (100% Free & Open Source)

### Complete Streaming Platform
✅ **ERN Ingestion** *(Phase 2 - COMPLETE)*
- Direct pipeline processing architecture
- Automatic DDEX delivery processing via HTTP API
- Multi-version ERN support (3.8.2, 4.2, 4.3)
- DDEX Workbench validation integration
- MD5 hash validation for file integrity
- Transaction-based locking for reliable processing
- Scheduled queue processing (every minute)
- Automatic acknowledgments
- Separate file transfer job system with retry logic

✅ **Music Streaming** *(Phase 3 - COMPLETE)*
- Audio playback with Howler.js
- Queue management and controls
- Mini player with persistent playback
- Streaming URL generation ready
- Multiple quality options preparation
- Progress tracking and seek controls

✅ **Catalog Management** *(Phase 3 - COMPLETE)*
- Browse releases, tracks, and artists
- Automatic metadata display
- Artist profile pages
- Album artwork display
- Search and filtering
- Related content linking

✅ **User Experience** *(Phase 3 - COMPLETE)*
- Personal music library
- Basic playlist functionality
- Favorites system
- Listening history tracking
- Cross-device state sync
- Responsive design

✅ **Search & Discovery** *(Phase 3 - COMPLETE)*
- Real-time search across catalog
- Filter by releases, tracks, artists
- Basic discovery features
- Catalog statistics
- Related content suggestions
- Trending content ready

🚧 **Analytics & Reporting** *(Coming Phase 5)*
- Real-time streaming metrics
- DSR generation
- Usage reports
- Revenue tracking
- Territory analytics
- Play count tracking

✅ **Professional Dashboard** *(Phase 2-3 - COMPLETE)*
- Ingestion monitoring with real-time status
- Distributor management
- Processing pipeline visibility
- File transfer tracking
- Catalog overview
- User statistics
- System health monitoring

✅ **White-Label Ready**
- Custom branding
- Theme customization
- Multi-tenant support
- Domain mapping
- Feature toggles

## 🚀 Quick Start

### Install and Deploy (Completely Free)
```bash
# Create your streaming platform
npx stardust-dsp create my-dsp

# Navigate to project
cd my-dsp

# Initialize Firebase (free tier available)
stardust-dsp init

# Start development server
npm run dev
# Visit http://localhost:5173

# Deploy to production
npm run deploy
# Your platform is live! 🚀
```

### Try the Live Features
With Phases 1-3 complete, you can now:

**Phase 1 Features:**
1. **Deploy a streaming platform** with one command
2. **Authenticate users** with Firebase Auth
3. **Navigate the interface** with responsive design
4. **Toggle themes** between light and dark modes
5. **Access the dashboard** with real-time stats

**Phase 2 Features:**
6. **Receive DDEX deliveries** via HTTP API endpoint
7. **Process ERN files** with direct pipeline architecture
8. **Monitor ingestion** in real-time dashboard
9. **Configure distributors** with full management UI
10. **Track delivery status** through processing states
11. **Generate acknowledgments** automatically
12. **Validate file integrity** with MD5 hash checking

**Phase 3 Features (NEW):**
13. **Browse catalog** with search and filtering
14. **View release details** with full metadata
15. **Play music** with full audio controls
16. **Manage queue** with drag-and-drop functionality
17. **Save favorites** and create playlists
18. **Explore artists** with complete discography
19. **Use mini player** for persistent playback
20. **Track statistics** in real-time dashboard

### Using the CLI Tool
```bash
# Available commands
stardust-dsp create <name>       # Create new streaming platform
stardust-dsp init                # Initialize Firebase configuration
stardust-dsp deploy              # Deploy to Firebase
stardust-dsp configure           # Configure ingestion settings
stardust-dsp dev                 # Start development server
stardust-dsp deliveries          # Manage DDEX deliveries
```

### Test the Complete Workflow
```bash
# Send test delivery from Stardust Distro
stardust-distro deliver \
  --target=https://us-central1-my-dsp.cloudfunctions.net/receiveDelivery \
  --release=test-album

# Check ingestion status
stardust-dsp deliveries list

# Monitor processing
# Visit http://localhost:5173/ingestion

# Browse the catalog
# Visit http://localhost:5173/catalog

# Play the music!
# Click any release to start streaming
```

## 🏗️ Ingestion Architecture

### Direct Pipeline Processing
The platform uses a **direct pipeline architecture** for processing DDEX deliveries, chosen for its simplicity, debuggability, and cost efficiency:

```javascript
// Processing flow with transaction-based locking
exports.processDeliveryPipeline = async (deliveryId) => {
  // 1. Lock delivery to prevent concurrent processing
  // 2. Check/wait for file transfers if needed
  // 3. Parse ERN XML directly
  // 4. Validate with DDEX Workbench
  // 5. Process releases and assets
  // 6. Generate acknowledgment
  // 7. Update status and unlock
};
```

### Processing Status Flow
```
received → pending → waiting_for_files → files_ready → parsing → 
validating → processing_releases → completed (or failed/cancelled)
```

### Key Architectural Features
- **Transaction-based locking**: Prevents race conditions and duplicate processing
- **Scheduled processing**: Runs every minute to handle queued deliveries
- **File transfer jobs**: Separate system for handling large audio/image files
- **MD5 validation**: Ensures file integrity during transfers
- **Retry logic**: Automatic retries with exponential backoff
- **30-50% faster** than pub/sub approaches for typical workloads

### Scheduled Functions
- **processPendingDeliveries** (every minute): Main processing queue
- **processPendingFileTransfers** (every 5 minutes): File transfer handling
- **cleanupStuckDeliveries** (every 30 minutes): Recovery from stuck states

## 🛠️ Technology Stack

- **Frontend**: Vue 3 (Composition API) + Vite
- **Backend**: Firebase (Firestore, Functions, Storage, Auth)
- **Audio**: Howler.js for cross-browser audio playback ✅
- **Streaming**: Firebase Storage + CDN with adaptive bitrate prep
- **Search**: Client-side filtering + Algolia/Typesense ready
- **Ingestion**: Direct pipeline with Cloud Functions ✅
- **Validation**: DDEX Workbench API integration ✅
- **Analytics**: Firebase Analytics + custom DSR generation prep
- **Styling**: Custom CSS architecture with theme system
- **Icons**: FontAwesome free icons
- **CLI**: Node.js with Commander.js
- **Deployment**: Firebase Hosting with global CDN

## 💻 Development

```bash
# Clone the repository
git clone https://github.com/daddykev/stardust-dsp.git
cd stardust-dsp

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Firebase credentials

# Start development server
npm run dev
# Visit http://localhost:5173

# Build for production
npm run build

# Deploy to Firebase
npm run deploy

# Run Firebase emulators
npm run emulators
```

## 🏗️ Project Structure

```
stardust-dsp/
├── template/            # Default Vue app template
│   ├── src/
│   │   ├── views/       # Page components (✅ 11/14 complete)
│   │   │   ├── Dashboard.vue     # Dashboard with stats (✅)
│   │   │   ├── Login.vue         # Login page (✅)
│   │   │   ├── Signup.vue        # Signup page (✅)
│   │   │   ├── SplashPage.vue    # Landing page (✅)
│   │   │   ├── Distributors.vue  # Distributor mgmt (✅)
│   │   │   ├── Ingestion.vue     # Ingestion monitor (✅)
│   │   │   ├── IngestionDetail.vue # Delivery details (✅)
│   │   │   ├── Catalog.vue       # Browse catalog (✅)
│   │   │   ├── ReleaseDetail.vue # Release details (✅)
│   │   │   ├── Artist.vue        # Artist profile (✅)
│   │   │   ├── Library.vue       # User library (✅)
│   │   │   ├── Search.vue        # Search results (📅 Phase 4)
│   │   │   ├── Account.vue       # User account (📅 Phase 4)
│   │   │   └── Admin.vue         # Admin panel (📅 Phase 5)
│   │   ├── components/  # UI components (✅ Core complete)
│   │   │   └── NavBar.vue        # Navigation (✅)
│   │   ├── composables/ # Vue composables (✅ 5/5 complete)
│   │   │   ├── useAuth.js        # Authentication (✅)
│   │   │   ├── useDualAuth.js    # Dual auth model (✅)
│   │   │   ├── useCatalog.js     # Catalog operations (✅)
│   │   │   ├── usePlayer.js      # Audio playback (✅)
│   │   │   └── useLibrary.js     # Library management (✅)
│   │   ├── services/    # Backend services (🚧 Streaming complete)
│   │   ├── stores/      # State management (📅 Phase 4)
│   │   ├── router/      # Routing config (✅ Complete)
│   │   ├── assets/      # CSS architecture (✅ Complete)
│   │   └── firebase.js  # Firebase config (✅ Complete)
│   └── functions/       # Cloud Functions (✅ Ingestion complete)
│       └── ingestion/   # Direct pipeline processing (✅ All complete)
│           ├── receiver.js       # HTTP endpoint & validation (✅)
│           ├── parser.js         # ERN XML parsing (✅)
│           ├── validator.js      # DDEX Workbench validation (✅)
│           ├── processor.js      # Release & asset processing (✅)
│           └── notifier.js       # Acknowledgments & notifications (✅)
├── cli/                 # CLI tool (✅ Complete)
│   ├── bin/             # Executable scripts
│   └── commands/        # All CLI commands
├── packages/            # Core packages
│   └── @stardust-dsp/
│       ├── dsp-core/    # Core logic (🚧 Started)
│       ├── player/      # Audio player (✅ Complete via composables)
│       └── storefront/  # UI components (📅 Phase 4)
├── firebase.json        # Firebase configuration (✅)
├── firestore.rules      # Security rules (✅)
└── docs/                # Documentation (📅 Phase 7)
```

## 🤝 Contributing

We welcome contributions! With Phase 3 complete and Phase 4 starting, we need help with:

### Immediate Needs (Phase 4 - Consumer Features)
- 🎨 Enhanced browse and discovery interfaces
- 🔍 Advanced search with faceted filtering
- 📋 Comprehensive playlist management
- 👥 Social features and user interactions
- 🎯 Personalization and recommendations
- 📱 Mobile experience optimization

### Just Completed (Phase 3)
✅ **Complete streaming platform core!** The platform now has:
- Full catalog browsing and search
- Audio playback with queue management
- Release and artist detail pages
- User library with favorites and playlists
- Real-time dashboard with statistics
- Mini player for persistent playback

### Upcoming Priorities (Phase 4)
- 🎨 Discovery algorithms and recommendations
- 🔍 Advanced search with filters and facets
- 📋 Enhanced playlist collaboration
- 👤 Rich user profiles and preferences
- 🔗 Social sharing and activity feeds
- 📊 Personalized homepage experience

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 🔗 Stardust Ecosystem

Stardust DSP is part of the larger Stardust ecosystem:

- **[Stardust Distro](https://github.com/daddykev/stardust-distro)** - Distribution platform for labels
- **[DDEX Workbench](https://github.com/daddykev/ddex-workbench)** - Validation and testing tools

All tools share unified authentication for seamless workflow integration.

## 📈 Performance Targets

- **Ingestion Speed**: <2 min for standard album ✅
- **Search Latency**: <50ms response time ✅
- **Stream Start**: <500ms buffering ✅
- **Page Load**: <2s initial load ✅
- **Processing Efficiency**: 30-50% faster than pub/sub ✅
- **Catalog Size**: 1M+ tracks supported
- **Concurrent Users**: 10K+ simultaneous streams
- **Uptime**: 99.9% availability

## 🔐 Security

- ✅ Firebase Auth with SSO support
- ✅ Secure streaming URLs with expiration
- ✅ Role-based access control (RBAC)
- ✅ Transaction-based processing locks
- ✅ MD5 validation for file integrity
- ✅ Input validation and sanitization
- ✅ Firestore security rules
- 📅 DRM integration ready *(Phase 5)*
- 📅 Regular security audits *(Phase 7)*

## 📄 License

**MIT License** - Use freely for any purpose, forever. See [LICENSE](LICENSE) for details.

This means you can:
- ✅ Use commercially without payment
- ✅ Modify and customize freely
- ✅ Distribute and sell your modifications
- ✅ Use privately without restrictions
- ✅ Fork and create your own platform

## 💬 Support

### Community Support (Free)
- **GitHub Issues**: [Bug reports and features](https://github.com/daddykev/stardust-dsp/issues)
- **Discussions**: [Community forum](https://github.com/daddykev/stardust-dsp/discussions)
- **Discord**: Coming soon
- **Documentation**: Comprehensive guides and API docs

## 🙏 Acknowledgments

Built for the music industry, by the music industry. Special thanks to:
- [DDEX](https://ddex.net) for the standards and specifications
- [Vue.js](https://vuejs.org/) team for the amazing framework
- [Firebase](https://firebase.google.com/) for the backend infrastructure
- [Howler.js](https://howlerjs.com/) for robust audio playback
- Early contributors and testers
- The open-source community

---

**Join us in democratizing music streaming. True open source, no compromises.**

*Star ⭐ the repo to follow our progress! Phase 3 (Core Streaming) is now complete - we have a fully functional streaming platform with direct pipeline ingestion! Phase 4 (Consumer Features) is next - help us build the social features and advanced discovery tools!*