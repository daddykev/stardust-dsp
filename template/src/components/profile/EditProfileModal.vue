<!-- template/src/components/profile/EditProfileModal.vue -->
<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useProfile } from '@/composables/useProfile'
import { useDebounce } from '@/composables/useDebounce'

const props = defineProps({
  profile: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['save', 'close'])

const profileService = useProfile()

// Refs
const avatarInput = ref(null)
const coverInput = ref(null)

// State
const saving = ref(false)
const usernameError = ref('')
const usernameAvailable = ref(false)

const formData = reactive({
  displayName: props.profile.displayName || '',
  username: props.profile.username || '',
  bio: props.profile.bio || '',
  location: props.profile.location || '',
  website: props.profile.website || '',
  avatar: props.profile.avatar || '',
  coverImage: props.profile.coverImage || '',
  social: {
    twitter: props.profile.social?.twitter || '',
    instagram: props.profile.social?.instagram || '',
    spotify: props.profile.social?.spotify || ''
  },
  privateProfile: props.profile.privateProfile || false,
  hideListeningActivity: props.profile.hideListeningActivity || false,
  allowMessages: props.profile.allowMessages || true
})

// Username validation
const checkUsername = useDebounce(async (username) => {
  if (!username || username === props.profile.username) {
    usernameError.value = ''
    usernameAvailable.value = false
    return
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    usernameError.value = 'Username can only contain letters, numbers, and underscores'
    usernameAvailable.value = false
    return
  }

  if (username.length < 3) {
    usernameError.value = 'Username must be at least 3 characters'
    usernameAvailable.value = false
    return
  }

  // Check availability
  const available = await profileService.checkUsernameAvailability(username)
  if (available) {
    usernameError.value = ''
    usernameAvailable.value = true
  } else {
    usernameError.value = 'Username is already taken'
    usernameAvailable.value = false
  }
}, 500)

function validateUsername() {
  checkUsername(formData.username)
}

// Avatar handling
function selectAvatar() {
  avatarInput.value?.click()
}

async function handleAvatarChange(event) {
  const file = event.target.files[0]
  if (!file) return

  // Validate file
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file')
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    alert('Image must be less than 5MB')
    return
  }

  // Preview
  const reader = new FileReader()
  reader.onload = (e) => {
    formData.avatar = e.target.result
  }
  reader.readAsDataURL(file)

  // TODO: Upload to storage
  // const url = await uploadAvatar(file)
  // formData.avatar = url
}

// Cover image handling
function selectCover() {
  coverInput.value?.click()
}

async function handleCoverChange(event) {
  const file = event.target.files[0]
  if (!file) return

  // Validate file
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file')
    return
  }

  if (file.size > 10 * 1024 * 1024) {
    alert('Image must be less than 10MB')
    return
  }

  // Preview
  const reader = new FileReader()
  reader.onload = (e) => {
    formData.coverImage = e.target.result
  }
  reader.readAsDataURL(file)

  // TODO: Upload to storage
  // const url = await uploadCover(file)
  // formData.coverImage = url
}

// Save profile
async function saveProfile() {
  if (usernameError.value) {
    return
  }

  saving.value = true

  try {
    const updatedProfile = {
      ...props.profile,
      ...formData
    }

    await profileService.updateProfile(updatedProfile)
    emit('save', updatedProfile)
  } catch (error) {
    console.error('Error saving profile:', error)
    alert('Failed to save profile. Please try again.')
  } finally {
    saving.value = false
  }
}

function handleAvatarError(e) {
  e.target.src = '/default-avatar.png'
}
</script>

<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <!-- Header -->
      <div class="modal-header">
        <h2>Edit Profile</h2>
        <button @click="$emit('close')" class="close-btn">
          <font-awesome-icon icon="times" />
        </button>
      </div>

      <!-- Form -->
      <form @submit.prevent="saveProfile" class="profile-form">
        <!-- Avatar Section -->
        <div class="avatar-section">
          <div class="avatar-preview">
            <img 
              :src="formData.avatar || '/default-avatar.png'" 
              :alt="formData.displayName"
              @error="handleAvatarError"
            />
            <div class="avatar-overlay">
              <button type="button" @click="selectAvatar" class="change-avatar-btn">
                <font-awesome-icon icon="camera" />
                <span>Change</span>
              </button>
            </div>
          </div>
          <input 
            ref="avatarInput"
            type="file"
            accept="image/*"
            @change="handleAvatarChange"
            hidden
          />
        </div>

        <!-- Cover Image Section -->
        <div class="cover-section">
          <label>Cover Image</label>
          <div class="cover-preview" @click="selectCover">
            <img 
              v-if="formData.coverImage"
              :src="formData.coverImage" 
              alt="Cover"
            />
            <div v-else class="cover-placeholder">
              <font-awesome-icon icon="image" />
              <span>Add cover image</span>
            </div>
          </div>
          <input 
            ref="coverInput"
            type="file"
            accept="image/*"
            @change="handleCoverChange"
            hidden
          />
        </div>

        <!-- Basic Info -->
        <div class="form-group">
          <label for="displayName">Display Name</label>
          <input 
            id="displayName"
            v-model="formData.displayName"
            type="text"
            placeholder="Your display name"
            required
            maxlength="50"
          />
          <span class="char-count">{{ formData.displayName.length }}/50</span>
        </div>

        <div class="form-group">
          <label for="username">Username</label>
          <div class="input-with-prefix">
            <span class="input-prefix">@</span>
            <input 
              id="username"
              v-model="formData.username"
              type="text"
              placeholder="username"
              pattern="[a-zA-Z0-9_]+"
              maxlength="30"
              @input="validateUsername"
            />
          </div>
          <span v-if="usernameError" class="error-text">{{ usernameError }}</span>
          <span v-else-if="usernameAvailable" class="success-text">
            <font-awesome-icon icon="check" /> Username available
          </span>
        </div>

        <div class="form-group">
          <label for="bio">Bio</label>
          <textarea 
            id="bio"
            v-model="formData.bio"
            placeholder="Tell us about yourself"
            rows="4"
            maxlength="160"
          ></textarea>
          <span class="char-count">{{ formData.bio?.length || 0 }}/160</span>
        </div>

        <!-- Location & Website -->
        <div class="form-row">
          <div class="form-group">
            <label for="location">Location</label>
            <input 
              id="location"
              v-model="formData.location"
              type="text"
              placeholder="City, Country"
            />
          </div>

          <div class="form-group">
            <label for="website">Website</label>
            <input 
              id="website"
              v-model="formData.website"
              type="url"
              placeholder="https://example.com"
            />
          </div>
        </div>

        <!-- Social Links -->
        <div class="form-section">
          <h3>Social Links</h3>
          <div class="social-links">
            <div class="form-group">
              <label for="twitter">
                <font-awesome-icon :icon="['fab', 'twitter']" /> Twitter
              </label>
              <input 
                id="twitter"
                v-model="formData.social.twitter"
                type="text"
                placeholder="@username"
              />
            </div>

            <div class="form-group">
              <label for="instagram">
                <font-awesome-icon :icon="['fab', 'instagram']" /> Instagram
              </label>
              <input 
                id="instagram"
                v-model="formData.social.instagram"
                type="text"
                placeholder="@username"
              />
            </div>

            <div class="form-group">
              <label for="spotify">
                <font-awesome-icon :icon="['fab', 'spotify']" /> Spotify
              </label>
              <input 
                id="spotify"
                v-model="formData.social.spotify"
                type="text"
                placeholder="Profile URL"
              />
            </div>
          </div>
        </div>

        <!-- Privacy Settings -->
        <div class="form-section">
          <h3>Privacy</h3>
          <div class="privacy-options">
            <label class="toggle-option">
              <input 
                type="checkbox" 
                v-model="formData.privateProfile"
              />
              <span class="toggle-label">
                <span class="toggle-text">Private Profile</span>
                <span class="toggle-description">Only followers can see your activity</span>
              </span>
            </label>

            <label class="toggle-option">
              <input 
                type="checkbox" 
                v-model="formData.hideListeningActivity"
              />
              <span class="toggle-label">
                <span class="toggle-text">Hide Listening Activity</span>
                <span class="toggle-description">Don't show what you're playing</span>
              </span>
            </label>

            <label class="toggle-option">
              <input 
                type="checkbox" 
                v-model="formData.allowMessages"
              />
              <span class="toggle-label">
                <span class="toggle-text">Allow Messages</span>
                <span class="toggle-description">Let others send you messages</span>
              </span>
            </label>
          </div>
        </div>

        <!-- Actions -->
        <div class="form-actions">
          <button type="button" @click="$emit('close')" class="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            <font-awesome-icon v-if="saving" icon="spinner" spin />
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-lg);
  overflow-y: auto;
}

.modal-content {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  width: 600px;
  max-width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-lg);
  border-bottom: 1px solid var(--color-border);
}

.modal-header h2 {
  font-size: var(--text-xl);
}

.close-btn {
  padding: var(--space-sm);
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: color var(--transition-base);
}

.close-btn:hover {
  color: var(--color-text-primary);
}

/* Form */
.profile-form {
  padding: var(--space-lg);
}

.avatar-section {
  display: flex;
  justify-content: center;
  margin-bottom: var(--space-xl);
}

.avatar-preview {
  position: relative;
  width: 120px;
  height: 120px;
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-full);
  object-fit: cover;
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition-base);
}

.avatar-preview:hover .avatar-overlay {
  opacity: 1;
}

.change-avatar-btn {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
}

.cover-section {
  margin-bottom: var(--space-lg);
}

.cover-preview {
  height: 150px;
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  margin-top: var(--space-sm);
}

.cover-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  height: 100%;
  background: var(--color-bg-secondary);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  color: var(--color-text-secondary);
  transition: background var(--transition-base);
}

.cover-preview:hover .cover-placeholder {
  background: var(--color-bg-tertiary);
}

.form-group {
  margin-bottom: var(--space-lg);
  position: relative;
}

.form-group label {
  display: block;
  margin-bottom: var(--space-sm);
  font-weight: var(--font-medium);
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: inherit;
  transition: all var(--transition-base);
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  background: var(--color-surface);
}

.form-group textarea {
  resize: vertical;
}

.char-count {
  position: absolute;
  right: var(--space-sm);
  bottom: var(--space-sm);
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
}

.input-with-prefix {
  position: relative;
}

.input-prefix {
  position: absolute;
  left: var(--space-md);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-secondary);
}

.input-with-prefix input {
  padding-left: calc(var(--space-md) + 20px);
}

.error-text {
  color: var(--color-error);
  font-size: var(--text-sm);
  margin-top: var(--space-xs);
  display: block;
}

.success-text {
  color: var(--color-success);
  font-size: var(--text-sm);
  margin-top: var(--space-xs);
  display: block;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-lg);
}

.form-section {
  margin-top: var(--space-xl);
  padding-top: var(--space-xl);
  border-top: 1px solid var(--color-border);
}

.form-section h3 {
  margin-bottom: var(--space-lg);
}

.social-links {
  display: grid;
  gap: var(--space-md);
}

.social-links label {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.privacy-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.toggle-option {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  cursor: pointer;
}

.toggle-option input[type="checkbox"] {
  margin-top: 2px;
}

.toggle-label {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.toggle-text {
  font-weight: var(--font-medium);
}

.toggle-description {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
  margin-top: var(--space-xl);
  padding-top: var(--space-xl);
  border-top: 1px solid var(--color-border);
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>