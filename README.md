# DDEX DSP

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-brightgreen.svg)](https://vuejs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Powered-orange.svg)](https://firebase.google.com/)

**Launch a DDEX-compliant streaming platform in minutes.** DDEX DSP is an open-source, npm-installable Digital Service Provider that receives DDEX ERN deliveries, processes them into a searchable catalog, and provides a complete music streaming experience.

🌐 **Official Platform**: [https://ddex-dsp.org](https://ddex-dsp.org)  
📚 **Documentation**: [https://docs.ddex-dsp.org](https://docs.ddex-dsp.org)

## ✨ Features

### 🚀 Core Capabilities

- **DDEX ERN Ingestion** - Automatic processing of DDEX deliveries with validation and acknowledgment
- **Instant Streaming** - Deploy a fully-functional platform with adaptive bitrate and CDN delivery
- **Complete Catalog** - Auto-enriched music catalog with search, browse, and recommendations
- **DSR Reporting** - Automated Digital Sales Reporting with usage tracking and royalty calculations
- **White-Label Ready** - Fully customizable UI, branding, and features for any market
- **Test Environment** - Perfect for labels to test their DDEX Distro deployments

### 🎯 Platform Features

- **Music Streaming** - HLS/DASH adaptive streaming with offline playback support
- **User Management** - Authentication, profiles, playlists, and favorites
- **Search & Discovery** - Fast full-text search with filters and recommendations
- **Analytics Dashboard** - Real-time streaming metrics and usage reports
- **Content Management** - Ingestion monitoring, catalog management, and moderation tools
- **Mobile Ready** - Progressive Web App with responsive design

## 🚀 Quick Start

### Deploy Your Own DSP

```bash
# Install the CLI globally
npm install -g @ddex/dsp-cli

# Create your streaming platform
npx create-ddex-dsp my-streaming-service

# Navigate to your project
cd my-streaming-service

# Deploy to production
npm run deploy
```

Your streaming platform will be live at `https://my-streaming-service.app` 🎉

### Local Development

```bash
# Clone the repository
git clone https://github.com/ddex-ecosystem/ddex-dsp.git
cd ddex-dsp

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Firebase credentials

# Start development server
npm run dev

# Build for production
npm run build
```

## 🛠️ Technology Stack

- **Frontend**: Vue 3 (Composition API) + Vite
- **Backend**: Firebase (Firestore, Functions, Storage, Auth)
- **Streaming**: Firebase Storage + CDN with adaptive bitrate
- **Search**: Algolia or Typesense integration
- **Ingestion**: Cloud Functions for ERN processing
- **Analytics**: Firebase Analytics + custom DSR generation
- **Styling**: Custom CSS architecture with theme support

## 📦 Project Structure

```
ddex-dsp/
├── src/
│   ├── components/        # Reusable UI components
│   ├── views/             # Page components
│   ├── stores/            # Pinia state management
│   ├── services/          # API services
│   ├── composables/       # Vue composition utilities
│   ├── assets/            # CSS design system
│   └── router/            # Vue Router configuration
├── functions/             # Firebase Cloud Functions
├── public/                # Static assets
├── firebase.json          # Firebase configuration
└── vite.config.js         # Vite configuration
```

## 🎨 CSS Architecture

Our design system uses a modular CSS architecture:

- **`main.css`** - Entry point importing all stylesheets
- **`base.css`** - CSS reset and base typography
- **`themes.css`** - CSS custom properties for theming (light/dark modes)
- **`components.css`** - Reusable component and utility classes

## 🔧 Configuration

### Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication, Firestore, Storage, and Functions
3. Add your Firebase config to `.env.local`:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-auth-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### Ingestion Configuration

Configure DDEX delivery endpoints in `firebase.json`:

```json
{
  "functions": {
    "ingestion": {
      "ftp": "ftp://deliveries.your-domain.com",
      "api": "https://api.your-domain.com/deliveries"
    }
  }
}
```

## 🔄 Integration with DDEX Ecosystem

DDEX DSP works seamlessly with:

- **[DDEX Distro](https://github.com/ddex-ecosystem/ddex-distro)** - Send test deliveries from your distribution platform
- **[DDEX Workbench](https://github.com/ddex-ecosystem/ddex-workbench)** - Automatic ERN validation during ingestion

### Testing Deliveries

```bash
# Send a test delivery from DDEX Distro
ddex-distro deliver \
  --target=http://localhost:5001/api/deliveries \
  --release=test-album

# Check ingestion status
ddex-dsp deliveries list
```

## 📊 Performance Targets

- **Ingestion Speed**: <2 min for standard album
- **Search Latency**: <50ms response time
- **Stream Start**: <500ms buffering
- **Page Load**: <2s initial load
- **Uptime**: 99.9% availability

## 🧪 Development

### Available Scripts

```bash
# Development server with hot reload
npm run dev

# Run tests
npm run test

# Lint and format code
npm run lint
npm run format

# Build for production
npm run build

# Preview production build
npm run preview

# Deploy to Firebase
npm run deploy

# Start Firebase emulators
npm run emulators
```

### Testing with Emulators

```bash
# Start all Firebase emulators
npm run emulators

# In another terminal, run the app
npm run dev
```

## 🚢 Deployment

### Firebase Hosting

```bash
# Build and deploy to Firebase
npm run build
firebase deploy
```

### Custom Domain

1. Add your domain in Firebase Console → Hosting
2. Update DNS records as instructed
3. SSL certificates are automatically provisioned

## 📈 Use Cases

- **Test Environment** - Perfect for labels testing DDEX deliveries
- **Enterprise Platform** - Full-scale streaming service with subscriptions
- **Regional Service** - Specialized platforms for specific markets
- **White-Label Solution** - Customizable for any brand or organization

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [https://docs.ddex-dsp.org](https://docs.ddex-dsp.org)
- **Issues**: [GitHub Issues](https://github.com/ddex-ecosystem/ddex-dsp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ddex-ecosystem/ddex-dsp/discussions)
- **Email**: support@ddex-dsp.org

## 🙏 Acknowledgments

- Part of the [DDEX Ecosystem](https://github.com/ddex-ecosystem)
- Built with [Vue.js](https://vuejs.org/) and [Firebase](https://firebase.google.com/)
- DDEX standards by [DDEX Limited](https://ddex.net/)

---

**Ready to launch your streaming platform?** Get started in minutes with `npx create-ddex-dsp` 🚀