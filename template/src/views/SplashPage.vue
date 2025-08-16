<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const features = [
  {
    icon: 'music',
    title: 'DDEX Ingestion',
    description: 'Receive and process ERN deliveries automatically with built-in validation and acknowledgment.'
  },
  {
    icon: 'rocket',
    title: 'Instant Streaming',
    description: 'Deploy a fully-functional streaming platform in minutes with adaptive bitrate and CDN delivery.'
  },
  {
    icon: 'cube',
    title: 'Complete Catalog',
    description: 'Auto-enriched catalog with search, browse, playlists, and personalized recommendations.'
  },
  {
    icon: 'chart-line',
    title: 'DSR Reporting',
    description: 'Automated Digital Sales Reporting with usage tracking and royalty calculations.'
  },
  {
    icon: 'palette',
    title: 'White-Label Ready',
    description: 'Fully customizable UI, branding, and features for any market or use case.'
  },
  {
    icon: 'check-circle',
    title: 'Test Environment',
    description: 'Perfect for labels to test their Stardust Distro deliveries with instant feedback.'
  }
]

const codeExample = ref(`# Deploy your streaming platform
npx create-ddex-dsp my-streaming-service
cd my-streaming-service
npm run deploy

# Streaming platform live at https://my-streaming-service.app`)

const handleGetStarted = () => {
  router.push('/signup')
}

const handleViewDemo = () => {
  window.open('https://demo.ddex-dsp.org', '_blank')
}

const handleViewDocs = () => {
  router.push('/docs')
}

const copyCode = () => {
  navigator.clipboard.writeText(codeExample.value)
  // You could add a toast notification here
}
</script>

<template>
  <div class="splash-page">
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="container">
        <div class="hero-content">
          <div class="hero-badge">
            <span class="badge-text">Open Source</span>
            <span class="badge-separator">•</span>
            <span class="badge-text">DDEX Compliant</span>
            <span class="badge-separator">•</span>
            <span class="badge-text">npm Installable</span>
          </div>
          
          <h1 class="hero-title">
            Your Own Streaming Platform
            <span class="hero-highlight">Ready to Stream</span>
          </h1>
          
          <p class="hero-description">
            Stardust DSP is an open-source, npm-installable streaming platform that receives 
            DDEX deliveries, processes them into a searchable catalog, and provides a 
            complete music streaming experience. Perfect for testing or production.
          </p>
          
          <div class="hero-actions">
            <button @click="handleGetStarted" class="btn btn-primary btn-lg">
              Deploy Your DSP
            </button>
            <button @click="handleViewDemo" class="btn btn-secondary btn-lg">
              Try Demo Platform
            </button>
          </div>

          <div class="hero-stats">
            <div class="stat">
              <span class="stat-value">ERN 4.3</span>
              <span class="stat-label">DDEX Compliant</span>
            </div>
            <div class="stat">
              <span class="stat-value"><2min</span>
              <span class="stat-label">Ingestion Time</span>
            </div>
            <div class="stat">
              <span class="stat-value">100%</span>
              <span class="stat-label">Firebase Uptime</span>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- Quick Start Section -->
    <section class="section bg-secondary">
      <div class="container">
        <div class="quick-start">
          <div class="quick-start-content">
            <h2 class="section-title">From Zero to Streaming in Minutes</h2>
            <p class="section-description">
              Launch a complete streaming platform faster than uploading an album
            </p>
          </div>
          <div class="code-block">
            <pre><code>{{ codeExample }}</code></pre>
            <button class="copy-btn" @click="copyCode" title="Copy to clipboard">
              <font-awesome-icon icon="copy" />
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Grid -->
    <section class="section">
      <div class="container">
        <div class="text-center mb-xl">
          <h2 class="section-title">Everything You Need to Stream Music</h2>
          <p class="section-description">
            A complete streaming platform with enterprise features, ready for any use case
          </p>
        </div>
        
        <div class="grid grid-cols-1 grid-cols-md-2 grid-cols-lg-3">
          <div v-for="feature in features" :key="feature.title" class="feature-card card card-hover">
            <div class="card-body">
              <div class="feature-icon">
                <font-awesome-icon :icon="feature.icon" />
              </div>
              <h3 class="feature-title">{{ feature.title }}</h3>
              <p class="feature-description">{{ feature.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Integration Section -->
    <section class="section bg-secondary">
      <div class="container">
        <div class="integration-section">
          <div class="integration-content">
            <h2 class="section-title">Perfect Testing Partner for Stardust Distro</h2>
            <p class="section-description">
              Test your Stardust Distro deliveries instantly with automatic ingestion, validation feedback, 
              and immediate streaming availability
            </p>
            <div class="integration-features">
              <div class="integration-item">
                <font-awesome-icon icon="check" class="check-icon" />
                <span>Instant delivery processing with acknowledgments</span>
              </div>
              <div class="integration-item">
                <font-awesome-icon icon="check" class="check-icon" />
                <span>Automatic ERN validation via DDEX Workbench</span>
              </div>
              <div class="integration-item">
                <font-awesome-icon icon="check" class="check-icon" />
                <span>Real-time catalog updates and search indexing</span>
              </div>
              <div class="integration-item">
                <font-awesome-icon icon="check" class="check-icon" />
                <span>Complete DSR reporting back to distributors</span>
              </div>
            </div>
          </div>
          <div class="integration-visual">
            <div class="flow-diagram">
              <div class="flow-node flow-distro">
                <font-awesome-icon icon="truck" class="node-icon" />
                <span>Stardust Distro</span>
              </div>
              <div class="flow-arrow">
                <font-awesome-icon icon="arrow-right" />
                <span class="flow-label">ERN Delivery</span>
              </div>
              <div class="flow-node flow-dsp">
                <font-awesome-icon icon="headphones" class="node-icon" />
                <span>Stardust DSP</span>
              </div>
              <div class="flow-arrow">
                <font-awesome-icon icon="arrow-right" />
                <span class="flow-label">Streaming</span>
              </div>
              <div class="flow-node flow-user">
                <font-awesome-icon icon="users" class="node-icon" />
                <span>Listeners</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Use Cases Section -->
    <section class="section">
      <div class="container">
        <div class="text-center mb-xl">
          <h2 class="section-title">Built for Every Use Case</h2>
          <p class="section-description">
            From testing environments to production platforms serving millions
          </p>
        </div>
        
        <div class="use-cases-grid">
          <div class="use-case-card card">
            <div class="card-body">
              <div class="use-case-icon">
                <font-awesome-icon icon="flask" />
              </div>
              <h3 class="use-case-title">Test Environment</h3>
              <p class="use-case-description">
                Perfect for labels and distributors to test their DDEX deliveries 
                before sending to major DSPs. Instant feedback and validation.
              </p>
            </div>
          </div>
          
          <div class="use-case-card card">
            <div class="card-body">
              <div class="use-case-icon">
                <font-awesome-icon icon="building" />
              </div>
              <h3 class="use-case-title">Enterprise Platform</h3>
              <p class="use-case-description">
                Launch a full-scale streaming service with subscriptions, 
                recommendations, and analytics. Scale to millions of users.
              </p>
            </div>
          </div>
          
          <div class="use-case-card card">
            <div class="card-body">
              <div class="use-case-icon">
                <font-awesome-icon icon="globe" />
              </div>
              <h3 class="use-case-title">Regional Service</h3>
              <p class="use-case-description">
                Create specialized streaming platforms for specific markets, 
                genres, or communities with custom features and content.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Technical Specs -->
    <section class="section bg-secondary">
      <div class="container">
        <div class="tech-specs">
          <div class="text-center mb-xl">
            <h2 class="section-title">Enterprise-Grade Technology</h2>
          </div>
          
          <div class="specs-grid">
            <div class="spec-item">
              <div class="spec-icon">
                <font-awesome-icon icon="bolt" />
              </div>
              <div class="spec-content">
                <h4>Lightning Fast</h4>
                <p><50ms search • <500ms stream start • <2s page load</p>
              </div>
            </div>
            
            <div class="spec-item">
              <div class="spec-icon">
                <font-awesome-icon icon="shield-alt" />
              </div>
              <div class="spec-content">
                <h4>Secure & Compliant</h4>
                <p>DRM support • GDPR ready • Secure streaming</p>
              </div>
            </div>
            
            <div class="spec-item">
              <div class="spec-icon">
                <font-awesome-icon icon="expand-arrows-alt" />
              </div>
              <div class="spec-content">
                <h4>Infinitely Scalable</h4>
                <p>Auto-scaling • Global CDN • 99.9% uptime</p>
              </div>
            </div>
            
            <div class="spec-item">
              <div class="spec-icon">
                <font-awesome-icon icon="code" />
              </div>
              <div class="spec-content">
                <h4>Developer Friendly</h4>
                <p>REST API • Webhooks • Plugin system</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="section">
      <div class="container">
        <div class="cta-section">
          <h2 class="cta-title">Ready to Launch Your Streaming Platform?</h2>
          <p class="cta-description">
            Join the open-source revolution in music streaming. Deploy your DSP today.
          </p>
          <div class="cta-actions">
            <button @click="handleGetStarted" class="btn btn-primary btn-lg">
              Start Streaming Now
            </button>
            <button @click="handleViewDocs" class="btn btn-secondary btn-lg">
              Read Documentation
            </button>
          </div>
          
          <div class="cta-footer">
            <p class="cta-note">
              Part of the Stardust Ecosystem • Works seamlessly with Stardust Distro & DDEX Workbench
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.splash-page {
  padding-top: 0;
}

/* Hero Section */
.hero-section {
  padding: var(--space-3xl) 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
}

.hero-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E") repeat;
}

.hero-content {
  max-width: 800px;
  margin: 0 auto;
  text-align: center;
  position: relative;
  z-index: 1;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-md);
  background-color: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: var(--radius-full);
  margin-bottom: var(--space-lg);
  font-size: var(--text-sm);
}

.badge-text {
  color: rgba(255, 255, 255, 0.95);
}

.badge-separator {
  color: rgba(255, 255, 255, 0.5);
}

.hero-title {
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: var(--font-bold);
  line-height: var(--leading-tight);
  margin-bottom: var(--space-lg);
  color: white;
}

.hero-highlight {
  display: block;
  background: linear-gradient(135deg, #ffd89b 0%, #19547b 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-description {
  font-size: var(--text-lg);
  color: rgba(255, 255, 255, 0.9);
  line-height: var(--leading-relaxed);
  margin-bottom: var(--space-xl);
}

.hero-actions {
  display: flex;
  gap: var(--space-md);
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: var(--space-2xl);
}

.hero-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--space-lg);
  padding-top: var(--space-xl);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.stat-value {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: white;
}

.stat-label {
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.8);
}

/* Quick Start Section */
.quick-start {
  text-align: center;
}

.quick-start-content {
  margin-bottom: var(--space-xl);
}

.section-title {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  margin-bottom: var(--space-md);
  color: var(--color-heading);
}

.section-description {
  font-size: var(--text-lg);
  color: var(--color-text-secondary);
}

.code-block {
  position: relative;
  max-width: 600px;
  margin: 0 auto;
  background-color: var(--color-bg-tertiary);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  font-family: var(--font-mono);
}

.code-block pre {
  margin: 0;
  color: var(--color-text);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  white-space: pre-wrap;
}

.copy-btn {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  padding: var(--space-xs) var(--space-sm);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-base);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}

.copy-btn:hover {
  background-color: var(--color-bg);
  color: var(--color-text);
  transform: scale(1.05);
}

/* Features */
.feature-card {
  text-align: center;
  height: 100%;
}

.feature-icon {
  font-size: 2.5rem;
  margin-bottom: var(--space-md);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 60px;
}

.feature-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-sm);
  color: var(--color-heading);
}

.feature-description {
  color: var(--color-text-secondary);
  line-height: var(--leading-relaxed);
}

/* Integration Section */
.integration-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2xl);
  align-items: center;
}

@media (max-width: 768px) {
  .integration-section {
    grid-template-columns: 1fr;
  }
}

.integration-features {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}

.integration-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.check-icon {
  color: var(--color-success);
  flex-shrink: 0;
  font-size: 1.25rem;
}

/* Flow Diagram */
.flow-diagram {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  padding: var(--space-xl);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.flow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: var(--color-bg);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-lg);
  min-width: 100px;
}

.flow-distro {
  border-color: var(--color-primary);
}

.flow-dsp {
  border-color: #667eea;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
}

.flow-user {
  border-color: var(--color-success);
}

.node-icon {
  font-size: 1.5rem;
  color: var(--color-primary);
}

.flow-dsp .node-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.flow-user .node-icon {
  color: var(--color-success);
}

.flow-arrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  color: var(--color-text-secondary);
}

.flow-label {
  font-size: var(--text-xs);
}

/* Use Cases */
.use-cases-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-lg);
}

.use-case-card {
  text-align: center;
}

.use-case-icon {
  font-size: 2.5rem;
  margin-bottom: var(--space-md);
  color: var(--color-text-secondary);
}

.use-case-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-sm);
  color: var(--color-heading);
}

.use-case-description {
  color: var(--color-text-secondary);
  line-height: var(--leading-relaxed);
}

/* Tech Specs */
.tech-specs {
  max-width: 900px;
  margin: 0 auto;
}

.specs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-xl);
}

.spec-item {
  display: flex;
  gap: var(--space-md);
  align-items: flex-start;
}

.spec-icon {
  font-size: 1.5rem;
  color: var(--color-primary);
  flex-shrink: 0;
}

.spec-content h4 {
  font-weight: var(--font-semibold);
  color: var(--color-heading);
  margin-bottom: var(--space-xs);
}

.spec-content p {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

/* CTA Section */
.cta-section {
  text-align: center;
  padding: var(--space-2xl);
  background: linear-gradient(135deg, var(--color-bg-secondary) 0%, var(--color-bg) 100%);
  border-radius: var(--radius-xl);
  position: relative;
  overflow: hidden;
}

.cta-section::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(102, 126, 234, 0.1) 0%, transparent 70%);
  animation: pulse 4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.1); opacity: 0.3; }
}

.cta-title {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  margin-bottom: var(--space-md);
  color: var(--color-heading);
  position: relative;
  z-index: 1;
}

.cta-description {
  font-size: var(--text-lg);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-xl);
  position: relative;
  z-index: 1;
}

.cta-actions {
  display: flex;
  gap: var(--space-md);
  justify-content: center;
  flex-wrap: wrap;
  position: relative;
  z-index: 1;
  margin-bottom: var(--space-xl);
}

.cta-footer {
  position: relative;
  z-index: 1;
}

.cta-note {
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}

/* Add missing Font Awesome icons to main.js */
/* Icons needed: arrow-right, headphones, flask, building, globe, bolt, shield-alt, expand-arrows-alt, code */

/* Responsive adjustments */
@media (max-width: 768px) {
  .hero-title {
    font-size: 2rem;
  }
  
  .hero-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .flow-diagram {
    flex-direction: column;
  }
  
  .flow-arrow {
    transform: rotate(90deg);
  }
  
  .integration-visual {
    display: none;
  }
}
</style>