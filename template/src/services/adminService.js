// src/services/adminService.js
import { 
  collection, 
  doc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  limit,
  serverTimestamp 
} from 'firebase/firestore'
import { db, functions } from '../firebase'
import { httpsCallable } from 'firebase/functions'

export const adminService = {
  /**
   * Get all users with optional filters
   */
  async getUsers(filters = {}) {
    let q = query(collection(db, 'users'), orderBy('createdAt', 'desc'))
    
    if (filters.role) {
      q = query(q, where('role', '==', filters.role))
    }
    
    if (filters.limit) {
      q = query(q, limit(filters.limit))
    }
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  },

  /**
   * Update user role
   */
  async updateUserRole(userId, newRole) {
    const validRoles = ['consumer', 'label', 'distributor', 'admin']
    if (!validRoles.includes(newRole)) {
      throw new Error('Invalid role')
    }
    
    await updateDoc(doc(db, 'users', userId), {
      role: newRole,
      updatedAt: serverTimestamp()
    })
    
    // Optionally update custom claims via Cloud Function
    try {
      const updateClaims = httpsCallable(functions, 'updateUserClaims')
      await updateClaims({ userId, role: newRole })
    } catch (error) {
      console.warn('Could not update custom claims:', error)
    }
  },

  /**
   * Toggle user active status
   */
  async toggleUserStatus(userId, active) {
    await updateDoc(doc(db, 'users', userId), {
      active,
      updatedAt: serverTimestamp()
    })
  },

  /**
   * Delete user account
   */
  async deleteUser(userId) {
    // Delete user document
    await deleteDoc(doc(db, 'users', userId))
    
    // Call Cloud Function to delete auth account
    try {
      const deleteAuthUser = httpsCallable(functions, 'deleteUser')
      await deleteAuthUser({ userId })
    } catch (error) {
      console.warn('Could not delete auth account:', error)
    }
  },

  /**
   * Get user statistics
   */
  async getUserStats() {
    const users = await this.getUsers()
    
    return {
      total: users.length,
      consumers: users.filter(u => u.role === 'consumer').length,
      labels: users.filter(u => u.role === 'label').length,
      distributors: users.filter(u => u.role === 'distributor').length,
      admins: users.filter(u => u.role === 'admin').length,
      active: users.filter(u => u.active !== false).length,
      verified: users.filter(u => u.verified === true).length
    }
  }
}