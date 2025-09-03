<script>
import { ref } from 'vue';
import NavBar from '@/components/NavBar.vue';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard.vue';
import DSRGenerator from '@/components/analytics/DSRGenerator.vue';

export default {
  name: 'Analytics',
  components: {
    NavBar,
    AnalyticsDashboard,
    DSRGenerator,
    // Placeholder components
    RoyaltyCalculator: { template: '<div class="placeholder">Royalty Calculator Coming Soon</div>' },
    UsageReports: { template: '<div class="placeholder">Usage Reports Coming Soon</div>' },
    DistributorPortal: { template: '<div class="placeholder">Distributor Portal Coming Soon</div>' }
  },
  setup() {
    const activeTab = ref('dashboard');
    
    const tabs = [
      { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-chart-line' },
      { id: 'dsr', label: 'DSR Generator', icon: 'fas fa-file-invoice' },
      { id: 'royalties', label: 'Royalties', icon: 'fas fa-calculator' },
      { id: 'usage', label: 'Usage Reports', icon: 'fas fa-chart-bar' },
      { id: 'distributor', label: 'Distributor Portal', icon: 'fas fa-building' }
    ];

    return {
      activeTab,
      tabs
    };
  }
};
</script>

<template>
  <div class="analytics-view">
    <NavBar />
    
    <div class="analytics-container">
      <!-- Tabs Navigation -->
      <div class="tabs">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="['tab', { active: activeTab === tab.id }]"
        >
          <i :class="tab.icon"></i>
          {{ tab.label }}
        </button>
      </div>

      <!-- Tab Content -->
      <div class="tab-content">
        <AnalyticsDashboard v-if="activeTab === 'dashboard'" />
        <DSRGenerator v-if="activeTab === 'dsr'" />
        <RoyaltyCalculator v-if="activeTab === 'royalties'" />
        <UsageReports v-if="activeTab === 'usage'" />
        <DistributorPortal v-if="activeTab === 'distributor'" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.analytics-view {
  min-height: 100vh;
  background: var(--surface-secondary);
}

.analytics-container {
  padding-top: var(--nav-height);
}

.tabs {
  background: var(--surface-primary);
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  gap: var(--spacing-xs);
  padding: 0 var(--spacing-lg);
  overflow-x: auto;
}

.tab {
  padding: var(--spacing-md) var(--spacing-lg);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: var(--transition-base);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  white-space: nowrap;
}

.tab:hover {
  color: var(--text-primary);
  background: var(--surface-secondary);
}

.tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.tab i {
  font-size: var(--font-size-md);
}

.tab-content {
  min-height: calc(100vh - var(--nav-height) - 60px);
}

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 400px;
  font-size: var(--font-size-xl);
  color: var(--text-secondary);
  background: var(--surface-primary);
  margin: var(--spacing-xl);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}
</style>