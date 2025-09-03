# Stardust DSP

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-4FC08D.svg)](https://vuejs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-v9-FFA000.svg)](https://firebase.google.com/)
[![Status](https://img.shields.io/badge/Status-Alpha-orange.svg)](https://github.com/daddykev/stardust-dsp)

> Open-source, npm-installable streaming platform that turns DDEX deliveries into a complete music service.

Stardust DSP enables anyone to deploy a fully functional, DDEX-compliant streaming platform in minutes. Receive ERN deliveries, process them automatically, and provide a complete music streaming experience.

## Introduction

**Stardust DSP is open-source software.** The entire platform is MIT licensed with no paid tiers, no enterprise edition, and no artificial limitations. You get a complete, production-ready streaming platform with ALL ingestion protocols (FTP, SFTP, S3, API), full ERN processing, adaptive streaming, and everything needed to run a professional music service.

### Why This Matters
- **No artificial limits**: No track caps, no watermarks, no time bombs
- **Complete functionality**: Every feature needed for professional streaming
- **True community ownership**: Fork it, modify it, deploy it - it's yours
- **Perfect for testing**: Ideal companion for testing DDEX deliveries from your distribution platform

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

### ✅ Phase 6: Analytics & Reporting - COMPLETE
- [x] Implement play tracking
- [x] Build analytics dashboard
- [x] Create DSR generator
- [x] Add usage reports
- [x] Implement royalty calculations
- [x] Add distributor reporting portal

### 🚧 Phase 7: Testing & Launch (Weeks 25-28)
- [x] Documentation completion
- [ ] Performance optimization
- [ ] Security audit
- [ ] npm package publication

## ✨ Core Features

### Complete DDEX Ingestion Pipeline
- **Direct Pipeline Architecture**: Simplified processing without Pub/Sub complexity
- **ERN Support**: Handles ERN 3.8.2, 4.2, and 4.3 formats
- **DDEX Workbench Validation**: Automatic validation of all deliveries
- **File Transfer System**: Secure file handling with MD5 validation
- **Transaction Locking**: Prevents race conditions and duplicate processing
- **Scheduled Processing**: Automatic queue handling every minute
- **Real-time Monitoring**: Live status updates via dashboard
- **Acknowledgments**: Automatic generation of DDEX-compliant receipts

### Music Streaming Platform
- **Audio Playback**: Howler.js-powered player with queue management
- **Catalog Management**: Browse releases, tracks, and artists
- **Search & Discovery**: Real-time search with filters and recommendations
- **User Library**: Personal playlists, favorites, and listening history
- **Artist Profiles**: Complete artist pages with discography
- **Release Pages**: Detailed album views with track listings
- **Mini Player**: Persistent playback across navigation
- **Cross-device Sync**: Real-time state synchronization

### Consumer Features
- **Personalized Home**: Time-based greetings and tailored content
- **Browse Interface**: Discover by genre, mood, charts, and new releases
- **Advanced Search**: Multi-faceted filters with recent searches
- **Playlist Management**: Create, edit, share, and collaborate on playlists
- **Social Features**: Follow users and artists, activity feeds, sharing
- **User Profiles**: Public profiles with stats and activity
- **Favorites System**: Save tracks, albums, and artists
- **Recommendations**: Pattern-based suggestion engine
- **Recently Played**: Automatic history tracking

### Analytics & Reporting
- **Real-time Tracking**: Automatic play tracking with progress updates
- **Analytics Dashboard**: Interactive charts and visualizations (Chart.js)
- **DSR Generation**: DDEX-compliant Digital Sales Reports
- **Usage Reports**: 6 report types (streaming, geographic, demographic, etc.)
- **Royalty Calculations**: Pro-rata, user-centric, and hybrid methods
- **Distributor Portal**: Dedicated reporting interface for partners
- **Multi-format Export**: DDEX XML, CSV, Excel, JSON
- **Territory Analytics**: Geographic breakdowns and insights
- **API Access**: RESTful API for distributor integration

### Professional Dashboard
- **Ingestion Monitoring**: Real-time processing status
- **Distributor Management**: Partner account administration
- **System Health**: Platform performance metrics
- **User Statistics**: Active users, engagement metrics
- **Catalog Overview**: Release and track statistics
- **Testing Suite**: 20+ automated tests for platform health

### White-Label Ready
- **Custom Branding**: Logo, colors, fonts customization
- **Theme System**: Light/dark modes with CSS variables
- **Multi-tenant Support**: Multiple brands on one platform
- **Domain Mapping**: Custom domain configuration
- **Feature Toggles**: Enable/disable features per deployment

## 🚀 Quick Start

### Install and Deploy
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

## 🏗️ Architecture Overview

### Direct Pipeline Processing
The platform uses a **direct pipeline architecture** for processing DDEX deliveries:

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

### Scheduled Functions
- **processPendingDeliveries** (every minute): Main processing queue
- **processPendingFileTransfers** (every 5 minutes): File transfer handling
- **cleanupStuckDeliveries** (every 30 minutes): Recovery from stuck states

## 🛠️ Technology Stack

- **Frontend**: Vue 3 (Composition API) + Vite
- **Backend**: Firebase (Firestore, Functions, Storage, Auth)
- **Audio**: Howler.js for cross-browser audio playback
- **Charts**: Chart.js for analytics visualizations
- **Streaming**: Firebase Storage + CDN
- **Search**: Client-side filtering + Algolia/Typesense ready
- **Ingestion**: Direct pipeline with Cloud Functions
- **Validation**: DDEX Workbench API integration
- **Analytics**: Firebase Analytics + custom DSR generation
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
├── template/                     # Default Vue app template
│   ├── src/
│   │   ├── views/                # Page components (18+ views)
│   │   │   ├── business/         # Industry views
│   │   │   ├── consumer/         # Consumer views
│   │   │   └── public/           # Public views
│   │   ├── components/           # UI components
│   │   │   ├── analytics/        # Analytics components
│   │   │   ├── browse/           # Browse & discovery
│   │   │   ├── library/          # User library
│   │   │   ├── player/           # Music player
│   │   │   └── profile/          # User profile
│   │   ├── composables/          # Vue composables (9 total)
│   │   ├── services/             # Backend services
│   │   ├── router/               # Routing config
│   │   ├── assets/               # CSS architecture
│   │   └── firebase.js           # Firebase config
│   └── functions/                # Cloud Functions
│       ├── ingestion/            # Direct pipeline processing
│       └── reporting/            # Analytics & DSR
├── cli/                          # CLI tool
│   ├── bin/                      # Executable scripts
│   └── commands/                 # All CLI commands
├── firebase.json                 # Firebase configuration
├── firestore.rules               # Security rules
└── docs/                         # Documentation
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 🔗 Stardust Ecosystem

Stardust DSP is part of the larger Stardust ecosystem:

- **[Stardust Distro](https://github.com/daddykev/stardust-distro)** - Distribution platform for labels
- **[DDEX Workbench](https://github.com/daddykev/ddex-workbench)** - Validation and testing tools

All tools share unified authentication for seamless workflow integration.

## 📈 Performance

### Current Performance
- **Ingestion Speed**: <2 min for standard album ✅
- **Search Latency**: <50ms response time ✅
- **Stream Start**: <500ms buffering ✅
- **Page Load**: <2s initial load ✅
- **Processing Efficiency**: 30-50% faster than pub/sub ✅

### Scalability Targets
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

### Community Support
- **GitHub Issues**: [Bug reports and features](https://github.com/daddykev/stardust-dsp/issues)
- **Documentation**: Comprehensive guides and API docs

### Professional Support
For enterprise deployments or custom development:
- **Email**: support@stardust-dsp.org
- **Consulting**: Available for large-scale implementations

## 🙏 Acknowledgments

Built for the music industry, by the music industry. Special thanks to:
- [DDEX](https://ddex.net) for the standards and specifications
- [Vue.js](https://vuejs.org/) team for the amazing framework
- [Firebase](https://firebase.google.com/) for the backend infrastructure
- Early contributors and testers
- The open-source community

---

*Star ⭐ the repo to follow our progress!*