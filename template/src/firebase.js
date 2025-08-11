// firebase.js - Firebase configuration and initialization
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getPerformance } from 'firebase/performance';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Initialize Analytics (only in production and if supported)
export const analytics = isSupported().then(yes => 
  yes && import.meta.env.PROD ? getAnalytics(app) : null
);

// Initialize Performance Monitoring (production only)
export const performance = import.meta.env.PROD ? getPerformance(app) : null;

// Connect to emulators in development
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectStorageEmulator(storage, 'localhost', 9199);
  connectFunctionsEmulator(functions, 'localhost', 5001);
  
  console.log('🔧 Connected to Firebase emulators');
}

// Helper function to get current user with a promise
export const getCurrentUser = () => {
  return new Promise((resolve, reject) => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      unsubscribe();
      resolve(user);
    }, reject);
  });
};

// Collection references
export const collections = {
  // Content collections
  releases: 'releases',
  tracks: 'tracks',
  albums: 'albums',
  artists: 'artists',
  
  // User collections
  users: 'users',
  playlists: 'playlists',
  favorites: 'favorites',
  history: 'history',
  
  // Analytics collections
  plays: 'plays',
  sessions: 'sessions',
  
  // Industry collections
  deliveries: 'deliveries',
  reports: 'reports',
  
  // System collections
  config: 'config',
  cache: 'cache'
};

// Storage bucket paths
export const storagePaths = {
  // Audio files
  audio: {
    original: 'audio/original',
    hls: 'audio/hls',
    dash: 'audio/dash',
    downloads: 'audio/downloads'
  },
  
  // Image assets
  images: {
    artwork: 'images/artwork',
    artists: 'images/artists',
    playlists: 'images/playlists',
    users: 'images/users'
  },
  
  // Delivery packages
  deliveries: 'deliveries',
  
  // Reports
  reports: {
    dsr: 'reports/dsr',
    usage: 'reports/usage'
  }
};

// Cloud Functions endpoints
export const functionEndpoints = {
  // Ingestion functions
  processDelivery: 'processDelivery',
  validateERN: 'validateERN',
  acknowledgeDelivery: 'acknowledgeDelivery',
  
  // Catalog functions
  enrichRelease: 'enrichRelease',
  indexSearch: 'indexSearch',
  generateManifests: 'generateManifests',
  
  // Streaming functions
  getStreamUrl: 'getStreamUrl',
  trackPlay: 'trackPlay',
  generateLicense: 'generateLicense',
  
  // Reporting functions
  generateDSR: 'generateDSR',
  generateUsageReport: 'generateUsageReport',
  
  // Admin functions
  reprocessDelivery: 'reprocessDelivery',
  moderateContent: 'moderateContent',
  
  // User functions
  createUserProfile: 'createUserProfile',
  updateSubscription: 'updateSubscription'
};

// Export app instance for additional configuration if needed
export default app;