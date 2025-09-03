<!-- src/views/business/UserAdmin.vue -->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { collection, getDocs, doc, updateDoc, deleteDoc, orderBy, query, where } from 'firebase/firestore'
import { db, auth } from '../../firebase'
import { useAuth } from '@/composables/useDualAuth'

const { userProfile } = useAuth()

// State
const users = ref([])
const loading = ref(true)
const searchQuery = ref('')
const roleFilter = ref('')
const currentPage = ref(1)
const itemsPerPage = 10
const selectedUser = ref(null)

// Current user ID to prevent self-modification
const currentUserId = computed(() => userProfile.value?.id)

// Stats
const stats = computed(() => {
  return {
    total: users.value.length,
    consumers: users.value.filter(u => u.role === 'consumer').length,
    business: users.value.filter(u => ['label', 'distributor'].includes(u.role)).length,
    admins: users.value.filter(u => u.role === 'admin').length
  }
})

// Filtered users based on search and role
const filteredUsers = computed(() => {
  let filtered = users.value

  // Apply role filter
  if (roleFilter.value) {
    filtered = filtered.filter(u => u.role === roleFilter.value)
  }

  // Apply search filter
  if (searchQuery.value) {
    const search = searchQuery.value.toLowerCase()
    filtered = filtered.filter(u => 
      u.email?.toLowerCase().includes(search) ||
      u.displayName?.toLowerCase().includes(search) ||
      u.organizationName?.toLowerCase().includes(search)
    )
  }

  return filtered
})

// Paginated users
const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  const end = start + itemsPerPage
  return filteredUsers.value.slice(start, end)
})

// Total pages
const totalPages = computed(() => {
  return Math.ceil(filteredUsers.value.length / itemsPerPage)
})

// Load users
const loadUsers = async () => {
  loading.value = true
  try {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'))
    const snapshot = await getDocs(q)
    users.value = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      active: doc.data().active !== false // Default to active if not specified
    }))
  } catch (error) {
    console.error('Error loading users:', error)
  } finally {
    loading.value = false
  }
}

// Update user role
const updateUserRole = async (user) => {
  try {
    await updateDoc(doc(db, 'users', user.id), {
      role: user.role,
      updatedAt: new Date()
    })
    console.log(`Updated role for ${user.email} to ${user.role}`)
  } catch (error) {
    console.error('Error updating user role:', error)
    // Revert the change in UI
    loadUsers()
  }
}

// Toggle user active status
const toggleUserStatus = async (user) => {
  try {
    const newStatus = !user.active
    await updateDoc(doc(db, 'users', user.id), {
      active: newStatus,
      updatedAt: new Date()
    })
    user.active = newStatus
    console.log(`User ${user.email} ${newStatus ? 'activated' : 'deactivated'}`)
  } catch (error) {
    console.error('Error toggling user status:', error)
  }
}

// View user details
const viewUserDetails = (user) => {
  selectedUser.value = user
}

// Delete user (with confirmation)
const deleteUser = async (user) => {
  if (!confirm(`Are you sure you want to delete ${user.email}? This action cannot be undone.`)) {
    return
  }
  
  try {
    await deleteDoc(doc(db, 'users', user.id))
    users.value = users.value.filter(u => u.id !== user.id)
    console.log(`Deleted user ${user.email}`)
  } catch (error) {
    console.error('Error deleting user:', error)
  }
}

// Helper functions
const getUserInitials = (user) => {
  const name = user.displayName || user.organizationName || user.email || ''
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'
}

const formatDate = (timestamp) => {
  if (!timestamp) return 'Never'
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleDateString()
}

const formatDateTime = (timestamp) => {
  if (!timestamp) return 'Never'
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleString()
}

// Load users on mount
onMounted(() => {
  loadUsers()
})
</script>

<template>
  <div class="user-admin">
    <div class="page-header">
      <h1 class="page-title">User Administration</h1>
      <p class="page-subtitle">Manage user accounts and permissions</p>
    </div>

    <!-- Stats Cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">Total Users</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.consumers }}</div>
        <div class="stat-label">Consumers</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.business }}</div>
        <div class="stat-label">Business</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.admins }}</div>
        <div class="stat-label">Admins</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-section">
      <div class="search-box">
        <font-awesome-icon icon="search" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search by name, email, or organization..."
          class="form-input"
        >
      </div>
      <select v-model="roleFilter" class="form-select">
        <option value="">All Roles</option>
        <option value="consumer">Consumer</option>
        <option value="label">Label</option>
        <option value="distributor">Distributor</option>
        <option value="admin">Admin</option>
      </select>
    </div>

    <!-- Users Table -->
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Created</th>
            <th>Last Login</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="7" class="text-center">
              <div class="loading-spinner">Loading users...</div>
            </td>
          </tr>
          <tr v-else-if="filteredUsers.length === 0">
            <td colspan="7" class="text-center text-secondary">
              No users found
            </td>
          </tr>
          <tr v-for="user in paginatedUsers" :key="user.id" class="user-row">
            <td>
              <div class="user-info">
                <div class="user-avatar">
                  <img v-if="user.photoURL" :src="user.photoURL" alt="">
                  <span v-else>{{ getUserInitials(user) }}</span>
                </div>
                <div>
                  <div class="user-name">
                    {{ user.displayName || user.organizationName || 'Unnamed User' }}
                  </div>
                  <div v-if="user.organizationName" class="user-org">
                    {{ user.organizationName }}
                  </div>
                </div>
              </div>
            </td>
            <td>{{ user.email }}</td>
            <td>
              <select 
                v-model="user.role" 
                @change="updateUserRole(user)"
                class="role-select"
                :disabled="user.id === currentUserId"
              >
                <option value="consumer">Consumer</option>
                <option value="label">Label</option>
                <option value="distributor">Distributor</option>
                <option value="admin">Admin</option>
              </select>
            </td>
            <td>
              <span 
                class="status-badge" 
                :class="user.verified ? 'status-verified' : 'status-unverified'"
              >
                {{ user.verified ? 'Verified' : 'Unverified' }}
              </span>
            </td>
            <td>{{ formatDate(user.createdAt) }}</td>
            <td>{{ formatDate(user.lastLogin) }}</td>
            <td>
              <div class="action-buttons">
                <button 
                  @click="viewUserDetails(user)" 
                  class="btn-icon"
                  title="View Details"
                >
                  <font-awesome-icon icon="eye" />
                </button>
                <button 
                  @click="toggleUserStatus(user)" 
                  class="btn-icon"
                  :title="user.active ? 'Deactivate' : 'Activate'"
                  :disabled="user.id === currentUserId"
                >
                  <font-awesome-icon :icon="user.active ? 'ban' : 'check'" />
                </button>
                <button 
                  @click="deleteUser(user)" 
                  class="btn-icon btn-danger"
                  title="Delete User"
                  :disabled="user.id === currentUserId"
                >
                  <font-awesome-icon icon="trash" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="pagination">
      <button 
        @click="currentPage--" 
        :disabled="currentPage === 1"
        class="btn btn-secondary"
      >
        Previous
      </button>
      <span class="pagination-info">
        Page {{ currentPage }} of {{ totalPages }}
      </span>
      <button 
        @click="currentPage++" 
        :disabled="currentPage === totalPages"
        class="btn btn-secondary"
      >
        Next
      </button>
    </div>

    <!-- User Details Modal -->
    <div v-if="selectedUser" class="modal-overlay" @click.self="selectedUser = null">
      <div class="modal">
        <div class="modal-header">
          <h2>User Details</h2>
          <button @click="selectedUser = null" class="btn-icon">
            <font-awesome-icon icon="times" />
          </button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">User ID:</span>
              <span class="detail-value">{{ selectedUser.id }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Email:</span>
              <span class="detail-value">{{ selectedUser.email }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Display Name:</span>
              <span class="detail-value">{{ selectedUser.displayName || 'Not set' }}</span>
            </div>
            <div v-if="selectedUser.organizationName" class="detail-item">
              <span class="detail-label">Organization:</span>
              <span class="detail-value">{{ selectedUser.organizationName }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Role:</span>
              <span class="detail-value">{{ selectedUser.role }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Created:</span>
              <span class="detail-value">{{ formatDateTime(selectedUser.createdAt) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Last Login:</span>
              <span class="detail-value">{{ formatDateTime(selectedUser.lastLogin) }}</span>
            </div>
            <div v-if="selectedUser.subscription" class="detail-item">
              <span class="detail-label">Subscription:</span>
              <span class="detail-value">{{ selectedUser.subscription.type }}</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="selectedUser = null" class="btn btn-secondary">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-admin {
  padding: var(--space-lg);
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--space-xl);
}

.page-title {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--color-text);
  margin-bottom: var(--space-xs);
}

.page-subtitle {
  color: var(--color-text-secondary);
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
}

.stat-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  text-align: center;
}

.stat-value {
  font-size: var(--text-3xl);
  font-weight: var(--font-bold);
  color: var(--color-primary);
  margin-bottom: var(--space-xs);
}

.stat-label {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Filters */
.filters-section {
  display: flex;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

.search-box {
  flex: 1;
  position: relative;
}

.search-icon {
  position: absolute;
  left: var(--space-md);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-secondary);
}

.search-box .form-input {
  padding-left: var(--space-2xl);
}

/* Table */
.table-container {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: var(--space-lg);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  background: var(--color-bg-secondary);
  padding: var(--space-md);
  text-align: left;
  font-weight: var(--font-semibold);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.data-table td {
  padding: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.user-row:hover {
  background: var(--color-bg-hover);
}

/* User Info */
.user-info {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  background: var(--color-primary-light);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-semibold);
  overflow: hidden;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-name {
  font-weight: var(--font-medium);
  color: var(--color-text);
}

.user-org {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

/* Role Select */
.role-select {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: var(--text-sm);
  cursor: pointer;
}

.role-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Status Badge */
.status-badge {
  display: inline-block;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-verified {
  background: var(--color-success-light);
  color: var(--color-success);
}

.status-unverified {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: var(--space-xs);
}

.btn-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-base);
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover:not(:disabled) {
  background: var(--color-bg-secondary);
  color: var(--color-text);
}

.btn-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon.btn-danger:hover:not(:disabled) {
  background: var(--color-danger-light);
  color: var(--color-danger);
  border-color: var(--color-danger);
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
}

.pagination-info {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg);
  border-bottom: 1px solid var(--color-border);
}

.modal-header h2 {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--color-text);
  margin: 0;
}

.modal-body {
  padding: var(--space-lg);
}

.modal-footer {
  padding: var(--space-lg);
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-md);
}

.detail-grid {
  display: grid;
  gap: var(--space-md);
}

.detail-item {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: var(--space-md);
}

.detail-label {
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

.detail-value {
  color: var(--color-text);
}

/* Loading */
.loading-spinner {
  padding: var(--space-xl);
  color: var(--color-text-secondary);
}

.text-center {
  text-align: center;
}

.text-secondary {
  color: var(--color-text-secondary);
}
</style>