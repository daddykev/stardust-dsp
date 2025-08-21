<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { db, auth } from '../firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { updatePassword, updateEmail, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'

const router = useRouter()
const { user, userProfile, logout } = useAuth()

// State
const activeTab = ref('general')
const isSaving = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

// Form data
const generalSettings = ref({
  organizationName: '',
  displayName: '',
  email: '',
  timezone: 'America/New_York',
  language: 'en'
})

const notificationSettings = ref({
  emailNotifications: true,
  newDeliveries: true,
  ingestionStatus: true,
  validationErrors: true,
  catalogUpdates: true,
  platformAlerts: true,
  weeklyReports: false,
  monthlyAnalytics: false,
  systemUpdates: false
})

const securitySettings = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  twoFactorEnabled: false
})

const appearanceSettings = ref({
  theme: 'auto',
  compactMode: false,
  showTips: true,
  defaultView: 'dashboard'
})

// Load user settings
onMounted(async () => {
  if (userProfile.value) {
    generalSettings.value = {
      organizationName: userProfile.value.organizationName || '',
      displayName: userProfile.value.displayName || '',
      email: userProfile.value.email || '',
      timezone: userProfile.value.timezone || 'America/New_York',
      language: userProfile.value.language || 'en'
    }
    
    notificationSettings.value = {
      ...notificationSettings.value,
      ...(userProfile.value.notifications || {})
    }
    
    appearanceSettings.value = {
      ...appearanceSettings.value,
      ...(userProfile.value.appearance || {})
    }
  }
})

// Methods
const saveGeneralSettings = async () => {
  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  
  try {
    // Update Firestore profile
    const userRef = doc(db, 'users', user.value.uid)
    await updateDoc(userRef, {
      organizationName: generalSettings.value.organizationName,
      displayName: generalSettings.value.displayName,
      timezone: generalSettings.value.timezone,
      language: generalSettings.value.language,
      updatedAt: new Date()
    })
    
    // Update email if changed
    if (generalSettings.value.email !== user.value.email) {
      await updateEmail(user.value, generalSettings.value.email)
    }
    
    successMessage.value = 'General settings saved successfully'
    setTimeout(() => successMessage.value = '', 3000)
  } catch (error) {
    console.error('Error saving general settings:', error)
    errorMessage.value = error.message
  } finally {
    isSaving.value = false
  }
}

const saveNotificationSettings = async () => {
  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  
  try {
    const userRef = doc(db, 'users', user.value.uid)
    await updateDoc(userRef, {
      notifications: notificationSettings.value,
      updatedAt: new Date()
    })
    
    successMessage.value = 'Notification settings saved successfully'
    setTimeout(() => successMessage.value = '', 3000)
  } catch (error) {
    console.error('Error saving notification settings:', error)
    errorMessage.value = error.message
  } finally {
    isSaving.value = false
  }
}

const updateSecuritySettings = async () => {
  if (securitySettings.value.newPassword !== securitySettings.value.confirmPassword) {
    errorMessage.value = 'New passwords do not match'
    return
  }
  
  if (securitySettings.value.newPassword.length < 6) {
    errorMessage.value = 'Password must be at least 6 characters'
    return
  }
  
  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  
  try {
    // Re-authenticate user
    const credential = EmailAuthProvider.credential(
      user.value.email,
      securitySettings.value.currentPassword
    )
    await reauthenticateWithCredential(user.value, credential)
    
    // Update password
    await updatePassword(user.value, securitySettings.value.newPassword)
    
    // Clear form
    securitySettings.value.currentPassword = ''
    securitySettings.value.newPassword = ''
    securitySettings.value.confirmPassword = ''
    
    successMessage.value = 'Password updated successfully'
    setTimeout(() => successMessage.value = '', 3000)
  } catch (error) {
    console.error('Error updating password:', error)
    errorMessage.value = error.message
  } finally {
    isSaving.value = false
  }
}

const saveAppearanceSettings = async () => {
  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  
  try {
    const userRef = doc(db, 'users', user.value.uid)
    await updateDoc(userRef, {
      appearance: appearanceSettings.value,
      updatedAt: new Date()
    })
    
    // Apply theme immediately
    if (appearanceSettings.value.theme !== 'auto') {
      document.documentElement.setAttribute('data-theme', appearanceSettings.value.theme)
      localStorage.setItem('theme', appearanceSettings.value.theme)
    } else {
      document.documentElement.removeAttribute('data-theme')
      localStorage.removeItem('theme')
    }
    
    successMessage.value = 'Appearance settings saved successfully'
    setTimeout(() => successMessage.value = '', 3000)
  } catch (error) {
    console.error('Error saving appearance settings:', error)
    errorMessage.value = error.message
  } finally {
    isSaving.value = false
  }
}

const signOut = async () => {
  if (confirm('Are you sure you want to sign out?')) {
    await logout()
    router.push('/')
  }
}
</script>

<template>
  <div class="settings">
    <div class="container">
      <!-- Header -->
      <div class="settings-header">
        <h1 class="page-title">Settings</h1>
        <p class="page-subtitle">Manage your DSP platform preferences and account settings</p>
      </div>

      <!-- Success/Error Messages -->
      <div v-if="successMessage" class="message success-message">
        <font-awesome-icon icon="check-circle" />
        {{ successMessage }}
      </div>
      
      <div v-if="errorMessage" class="message error-message">
        <font-awesome-icon icon="exclamation-triangle" />
        {{ errorMessage }}
      </div>

      <!-- Settings Tabs -->
      <div class="settings-tabs">
        <button 
          @click="activeTab = 'general'" 
          class="tab-button"
          :class="{ active: activeTab === 'general' }"
        >
          <font-awesome-icon icon="user" />
          General
        </button>
        <button 
          @click="activeTab = 'notifications'" 
          class="tab-button"
          :class="{ active: activeTab === 'notifications' }"
        >
          <font-awesome-icon icon="bell" />
          Notifications
        </button>
        <button 
          @click="activeTab = 'security'" 
          class="tab-button"
          :class="{ active: activeTab === 'security' }"
        >
          <font-awesome-icon icon="shield-alt" />
          Security
        </button>
        <button 
          @click="activeTab = 'appearance'" 
          class="tab-button"
          :class="{ active: activeTab === 'appearance' }"
        >
          <font-awesome-icon icon="palette" />
          Appearance
        </button>
      </div>

      <!-- Tab Content -->
      <div class="settings-content">
        <!-- General Tab -->
        <div v-if="activeTab === 'general'" class="card">
          <div class="card-body">
            <h2 class="section-title">General Settings</h2>
            <p class="section-description">
              Manage your basic account information and platform preferences
            </p>
            
            <div class="form-group">
              <label class="form-label">Organization Name</label>
              <input 
                v-model="generalSettings.organizationName" 
                type="text" 
                class="form-input"
                placeholder="Your streaming platform or company name"
              />
              <span class="form-hint">This name appears in reports and communications</span>
            </div>
            
            <div class="form-group">
              <label class="form-label">Display Name</label>
              <input 
                v-model="generalSettings.displayName" 
                type="text" 
                class="form-input"
                placeholder="Your name"
              />
            </div>
            
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input 
                v-model="generalSettings.email" 
                type="email" 
                class="form-input"
                placeholder="email@example.com"
              />
              <span class="form-hint">Used for account access and notifications</span>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Timezone</label>
                <select v-model="generalSettings.timezone" class="form-select">
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                  <option value="Australia/Sydney">Sydney (AEDT)</option>
                </select>
                <span class="form-hint">Used for scheduling and reporting</span>
              </div>
              
              <div class="form-group">
                <label class="form-label">Language</label>
                <select v-model="generalSettings.language" class="form-select">
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="ja">Japanese</option>
                  <option value="pt">Portuguese</option>
                </select>
                <span class="form-hint">Interface language preference</span>
              </div>
            </div>
            
            <div class="form-actions">
              <button 
                @click="saveGeneralSettings" 
                class="btn btn-primary"
                :disabled="isSaving"
              >
                <font-awesome-icon :icon="isSaving ? 'spinner' : 'check'" :spin="isSaving" />
                {{ isSaving ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Notifications Tab -->
        <div v-if="activeTab === 'notifications'" class="card">
          <div class="card-body">
            <h2 class="section-title">Notification Preferences</h2>
            <p class="section-description">
              Control how you receive updates about deliveries, catalog changes, and platform activity
            </p>
            
            <div class="notification-section">
              <h3 class="subsection-title">
                <font-awesome-icon icon="inbox" />
                Ingestion & Processing
              </h3>
              
              <label class="checkbox-option">
                <input 
                  v-model="notificationSettings.newDeliveries" 
                  type="checkbox"
                />
                <div class="option-content">
                  <span class="option-title">New Deliveries</span>
                  <span class="option-description">Get notified when distributors send new content</span>
                </div>
              </label>
              
              <label class="checkbox-option">
                <input 
                  v-model="notificationSettings.ingestionStatus" 
                  type="checkbox"
                />
                <div class="option-content">
                  <span class="option-title">Processing Status</span>
                  <span class="option-description">Receive updates when deliveries are processed or fail</span>
                </div>
              </label>
              
              <label class="checkbox-option">
                <input 
                  v-model="notificationSettings.validationErrors" 
                  type="checkbox"
                />
                <div class="option-content">
                  <span class="option-title">Validation Errors</span>
                  <span class="option-description">Alert me when ERN validation fails or issues are detected</span>
                </div>
              </label>
              
              <label class="checkbox-option">
                <input 
                  v-model="notificationSettings.catalogUpdates" 
                  type="checkbox"
                />
                <div class="option-content">
                  <span class="option-title">Catalog Updates</span>
                  <span class="option-description">Notify when releases are added, updated, or removed from catalog</span>
                </div>
              </label>
            </div>
            
            <div class="notification-section">
              <h3 class="subsection-title">
                <font-awesome-icon icon="chart-bar" />
                Analytics & Reports
              </h3>
              
              <label class="checkbox-option">
                <input 
                  v-model="notificationSettings.weeklyReports" 
                  type="checkbox"
                />
                <div class="option-content">
                  <span class="option-title">Weekly Platform Report</span>
                  <span class="option-description">Summary of streams, new releases, and platform performance</span>
                </div>
              </label>
              
              <label class="checkbox-option">
                <input 
                  v-model="notificationSettings.monthlyAnalytics" 
                  type="checkbox"
                />
                <div class="option-content">
                  <span class="option-title">Monthly Analytics</span>
                  <span class="option-description">Detailed analytics including usage reports and DSR summaries</span>
                </div>
              </label>
            </div>
            
            <div class="notification-section">
              <h3 class="subsection-title">
                <font-awesome-icon icon="cog" />
                System & Platform
              </h3>
              
              <label class="checkbox-option">
                <input 
                  v-model="notificationSettings.platformAlerts" 
                  type="checkbox"
                />
                <div class="option-content">
                  <span class="option-title">Platform Alerts</span>
                  <span class="option-description">Critical alerts about service disruptions or issues</span>
                </div>
              </label>
              
              <label class="checkbox-option">
                <input 
                  v-model="notificationSettings.systemUpdates" 
                  type="checkbox"
                />
                <div class="option-content">
                  <span class="option-title">System Updates</span>
                  <span class="option-description">Learn about new features, improvements, and maintenance</span>
                </div>
              </label>
              
              <label class="checkbox-option">
                <input 
                  v-model="notificationSettings.emailNotifications" 
                  type="checkbox"
                />
                <div class="option-content">
                  <span class="option-title">Email Notifications</span>
                  <span class="option-description">Receive all selected notifications via email</span>
                </div>
              </label>
            </div>
            
            <div class="form-actions">
              <button 
                @click="saveNotificationSettings" 
                class="btn btn-primary"
                :disabled="isSaving"
              >
                <font-awesome-icon :icon="isSaving ? 'spinner' : 'check'" :spin="isSaving" />
                {{ isSaving ? 'Saving...' : 'Save Preferences' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Security Tab -->
        <div v-if="activeTab === 'security'" class="card">
          <div class="card-body">
            <h2 class="section-title">Security Settings</h2>
            <p class="section-description">
              Manage your account security and authentication preferences
            </p>
            
            <div class="form-section">
              <h3 class="subsection-title">
                <font-awesome-icon icon="key" />
                Change Password
              </h3>
              
              <div class="form-group">
                <label class="form-label">Current Password</label>
                <input 
                  v-model="securitySettings.currentPassword" 
                  type="password" 
                  class="form-input"
                  placeholder="Enter current password"
                  autocomplete="current-password"
                />
              </div>
              
              <div class="form-group">
                <label class="form-label">New Password</label>
                <input 
                  v-model="securitySettings.newPassword" 
                  type="password" 
                  class="form-input"
                  placeholder="Enter new password (min. 6 characters)"
                  autocomplete="new-password"
                />
              </div>
              
              <div class="form-group">
                <label class="form-label">Confirm New Password</label>
                <input 
                  v-model="securitySettings.confirmPassword" 
                  type="password" 
                  class="form-input"
                  placeholder="Confirm new password"
                  autocomplete="new-password"
                />
              </div>
              
              <button 
                @click="updateSecuritySettings" 
                class="btn btn-primary"
                :disabled="isSaving || !securitySettings.currentPassword || !securitySettings.newPassword"
              >
                <font-awesome-icon :icon="isSaving ? 'spinner' : 'lock'" :spin="isSaving" />
                {{ isSaving ? 'Updating...' : 'Update Password' }}
              </button>
            </div>
            
            <div class="form-section">
              <h3 class="subsection-title">
                <font-awesome-icon icon="sign-out-alt" />
                Session Management
              </h3>
              <p class="section-info">Sign out of your account on this device.</p>
              <button @click="signOut" class="btn btn-secondary">
                <font-awesome-icon icon="sign-out-alt" />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        <!-- Appearance Tab -->
        <div v-if="activeTab === 'appearance'" class="card">
          <div class="card-body">
            <h2 class="section-title">Appearance Settings</h2>
            <p class="section-description">
              Customize the look and feel of your DSP interface
            </p>
            
            <div class="form-group">
              <label class="form-label">Theme</label>
              <select v-model="appearanceSettings.theme" class="form-select">
                <option value="auto">Auto (Follow System)</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
              <span class="form-hint">Choose your preferred color scheme</span>
            </div>
            
            <div class="form-group">
              <label class="form-label">Default View</label>
              <select v-model="appearanceSettings.defaultView" class="form-select">
                <option value="dashboard">Dashboard</option>
                <option value="ingestion">Ingestion Pipeline</option>
                <option value="catalog">Catalog</option>
                <option value="distributors">Distributors</option>
              </select>
              <span class="form-hint">Choose which page to show after login</span>
            </div>
            
            <div class="checkbox-options">
              <label class="checkbox-option">
                <input 
                  v-model="appearanceSettings.compactMode" 
                  type="checkbox"
                />
                <div class="option-content">
                  <span class="option-title">Compact Mode</span>
                  <span class="option-description">Reduce spacing to display more content on screen</span>
                </div>
              </label>
              
              <label class="checkbox-option">
                <input 
                  v-model="appearanceSettings.showTips" 
                  type="checkbox"
                />
                <div class="option-content">
                  <span class="option-title">Show Tips & Hints</span>
                  <span class="option-description">Display helpful tooltips and onboarding guides</span>
                </div>
              </label>
            </div>
            
            <div class="form-actions">
              <button 
                @click="saveAppearanceSettings" 
                class="btn btn-primary"
                :disabled="isSaving"
              >
                <font-awesome-icon :icon="isSaving ? 'spinner' : 'check'" :spin="isSaving" />
                {{ isSaving ? 'Saving...' : 'Save Preferences' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings {
  padding: var(--space-xl) 0;
  min-height: calc(100vh - 64px);
}

.settings-header {
  margin-bottom: var(--space-xl);
}

.page-title {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--color-heading);
  margin-bottom: var(--space-xs);
}

.page-subtitle {
  font-size: var(--text-lg);
  color: var(--color-text-secondary);
}

/* Messages */
.message {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-lg);
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateY(-10px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.success-message {
  background: linear-gradient(135deg, rgba(52, 168, 83, 0.1), rgba(52, 168, 83, 0.05));
  border: 1px solid rgba(52, 168, 83, 0.2);
  color: var(--color-success);
}

.error-message {
  background: linear-gradient(135deg, rgba(234, 67, 53, 0.1), rgba(234, 67, 53, 0.05));
  border: 1px solid rgba(234, 67, 53, 0.2);
  color: var(--color-error);
}

/* Tabs */
.settings-tabs {
  display: flex;
  gap: var(--space-xs);
  border-bottom: 2px solid var(--color-border);
  margin-bottom: var(--space-xl);
  overflow-x: auto;
}

.tab-button {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-lg);
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  color: var(--color-text-secondary);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--transition-base);
  white-space: nowrap;
}

.tab-button:hover {
  color: var(--color-text);
  background-color: var(--color-bg-secondary);
}

.tab-button.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  background-color: transparent;
}

.tab-button svg {
  font-size: var(--text-sm);
}

/* Content */
.settings-content {
  max-width: 800px;
}

.section-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--color-heading);
  margin-bottom: var(--space-sm);
}

.section-description {
  color: var(--color-text-secondary);
  margin-bottom: var(--space-xl);
  line-height: var(--leading-relaxed);
}

.subsection-title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--color-heading);
  margin-bottom: var(--space-md);
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--color-border-light);
}

.subsection-title svg {
  font-size: var(--text-base);
  color: var(--color-primary);
}

/* Forms */
.form-section {
  margin-bottom: var(--space-2xl);
  padding-bottom: var(--space-2xl);
  border-bottom: 1px solid var(--color-border);
}

.form-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.form-group {
  margin-bottom: var(--space-lg);
}

.form-label {
  display: block;
  font-weight: var(--font-medium);
  margin-bottom: var(--space-xs);
  color: var(--color-text);
}

.form-hint {
  display: block;
  margin-top: var(--space-xs);
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-md);
}

.form-actions {
  display: flex;
  gap: var(--space-md);
  margin-top: var(--space-xl);
  padding-top: var(--space-xl);
  border-top: 1px solid var(--color-border-light);
}

.section-info {
  color: var(--color-text-secondary);
  margin-bottom: var(--space-md);
}

/* Notification Sections */
.notification-section {
  margin-bottom: var(--space-2xl);
}

.notification-section:last-child {
  margin-bottom: 0;
}

/* Checkbox Options */
.checkbox-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.checkbox-option {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  padding: var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-base);
  background-color: var(--color-surface);
}

.checkbox-option:hover {
  background-color: var(--color-bg-secondary);
  border-color: var(--color-primary);
  transform: translateX(2px);
}

.checkbox-option input[type="checkbox"] {
  margin-top: var(--space-xs);
  cursor: pointer;
}

.checkbox-option input[type="checkbox"]:checked {
  accent-color: var(--color-primary);
}

.option-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.option-title {
  font-weight: var(--font-medium);
  color: var(--color-heading);
}

.option-description {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  line-height: var(--leading-relaxed);
}

/* Custom Buttons */
.btn svg {
  margin-right: var(--space-xs);
}

/* Responsive */
@media (max-width: 768px) {
  .settings {
    padding: var(--space-md) 0;
  }
  
  .settings-tabs {
    overflow-x: auto;
    padding-bottom: var(--space-xs);
    -webkit-overflow-scrolling: touch;
  }
  
  .tab-button {
    padding: var(--space-sm) var(--space-md);
    font-size: var(--text-sm);
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .settings-content {
    max-width: 100%;
  }
  
  .form-actions {
    flex-direction: column;
  }
  
  .form-actions .btn {
    width: 100%;
    justify-content: center;
  }
}

/* Dark mode adjustments */
[data-theme="dark"] .checkbox-option {
  background-color: var(--color-bg-secondary);
}

[data-theme="dark"] .checkbox-option:hover {
  background-color: var(--color-bg-tertiary);
}
</style>