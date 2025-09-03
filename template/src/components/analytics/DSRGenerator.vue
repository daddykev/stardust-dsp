<script>
import { ref, computed, onMounted } from 'vue';
import analyticsService from '@/services/analytics';
import { useToast } from '@/composables/useToast';

export default {
  name: 'DSRGenerator',
  setup() {
    const generating = ref(false);
    const showPreview = ref(false);
    const previewData = ref('');
    const recentReports = ref([]);
    const { showToast } = useToast();

    // Report configuration
    const config = ref({
      reportType: 'SalesReport',
      format: 'DDEX',
      startDate: '',
      endDate: '',
      territory: 'worldwide',
      distributor: 'all',
      releases: '',
      includeDetails: true,
      includeSummary: true,
      includeCharts: false,
      compressOutput: false
    });

    // Set default dates
    const today = computed(() => new Date().toISOString().split('T')[0]);
    
    onMounted(() => {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      config.value.startDate = firstOfMonth.toISOString().split('T')[0];
      config.value.endDate = today.value;
      
      loadRecentReports();
    });

    // Generate report
    const generateReport = async () => {
      generating.value = true;
      try {
        const startDate = new Date(config.value.startDate);
        const endDate = new Date(config.value.endDate);
        
        const result = await analyticsService.generateDSR(startDate, endDate, config.value.format);
        
        if (result.success) {
          showToast('Report generated successfully', 'success');
          
          // Add to recent reports
          recentReports.value.unshift({
            id: result.reportId,
            type: config.value.reportType,
            format: config.value.format,
            startDate: config.value.startDate,
            endDate: config.value.endDate,
            createdAt: new Date(),
            url: result.downloadUrl
          });
          
          // Preview or download
          if (config.value.format === 'DDEX') {
            previewData.value = result.preview;
            showPreview.value = true;
          } else {
            window.open(result.downloadUrl, '_blank');
          }
        }
      } catch (error) {
        console.error('Error generating report:', error);
        showToast('Failed to generate report', 'error');
      } finally {
        generating.value = false;
      }
    };

    // Schedule report
    const scheduleReport = () => {
      showToast('Report scheduling coming soon', 'info');
    };

    // Reset form
    const resetForm = () => {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      config.value = {
        reportType: 'SalesReport',
        format: 'DDEX',
        startDate: firstOfMonth.toISOString().split('T')[0],
        endDate: today.value,
        territory: 'worldwide',
        distributor: 'all',
        releases: '',
        includeDetails: true,
        includeSummary: true,
        includeCharts: false,
        compressOutput: false
      };
    };

    // Load recent reports
    const loadRecentReports = async () => {
      // This would load from Firestore
      recentReports.value = [
        {
          id: '1',
          type: 'SalesReport',
          format: 'DDEX',
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          createdAt: new Date('2025-02-01'),
          url: '#'
        }
      ];
    };

    // Download report
    const downloadReport = (report) => {
      window.open(report.url, '_blank');
    };

    // View report
    const viewReport = (report) => {
      // Load and preview report
      previewData.value = 'Report preview content...';
      showPreview.value = true;
    };

    // Delete report
    const deleteReport = async (report) => {
      if (confirm('Are you sure you want to delete this report?')) {
        recentReports.value = recentReports.value.filter(r => r.id !== report.id);
        showToast('Report deleted', 'success');
      }
    };

    // Close preview
    const closePreview = () => {
      showPreview.value = false;
      previewData.value = '';
    };

    // Download preview
    const downloadPreview = () => {
      // Download full report
      const blob = new Blob([previewData.value], { type: 'text/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DSR_${config.value.startDate}_${config.value.endDate}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    };

    // Utility functions
    const formatDateRange = (start, end) => {
      return `${start} to ${end}`;
    };

    const formatRelativeTime = (date) => {
      const diff = Date.now() - new Date(date).getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days === 0) return 'today';
      if (days === 1) return 'yesterday';
      return `${days} days ago`;
    };

    return {
      generating,
      showPreview,
      previewData,
      recentReports,
      config,
      today,
      generateReport,
      scheduleReport,
      resetForm,
      downloadReport,
      viewReport,
      deleteReport,
      closePreview,
      downloadPreview,
      formatDateRange,
      formatRelativeTime
    };
  }
};
</script>

<template>
  <div class="dsr-generator">
    <div class="generator-header">
      <h2>Digital Sales Report Generator</h2>
      <p class="description">Generate DDEX-compliant Digital Sales Reports for your catalog</p>
    </div>

    <div class="generator-form">
      <!-- Report Configuration -->
      <div class="form-section">
        <h3>Report Configuration</h3>
        
        <div class="form-row">
          <div class="form-group">
            <label for="reportType">Report Type</label>
            <select id="reportType" v-model="config.reportType" class="form-select">
              <option value="SalesReport">Sales Report</option>
              <option value="UsageReport">Usage Report</option>
              <option value="RoyaltyStatement">Royalty Statement</option>
            </select>
          </div>

          <div class="form-group">
            <label for="format">Format</label>
            <select id="format" v-model="config.format" class="form-select">
              <option value="DDEX">DDEX DSR 3.0</option>
              <option value="CSV">CSV</option>
              <option value="XLSX">Excel</option>
              <option value="JSON">JSON</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="startDate">Start Date</label>
            <input 
              type="date" 
              id="startDate" 
              v-model="config.startDate" 
              class="form-input"
              :max="config.endDate"
            />
          </div>

          <div class="form-group">
            <label for="endDate">End Date</label>
            <input 
              type="date" 
              id="endDate" 
              v-model="config.endDate" 
              class="form-input"
              :min="config.startDate"
              :max="today"
            />
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="form-section">
        <h3>Filters</h3>
        
        <div class="form-row">
          <div class="form-group">
            <label for="territory">Territory</label>
            <select id="territory" v-model="config.territory" class="form-select">
              <option value="worldwide">Worldwide</option>
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="EU">European Union</option>
              <option value="custom">Custom Selection</option>
            </select>
          </div>

          <div class="form-group">
            <label for="distributor">Distributor</label>
            <select id="distributor" v-model="config.distributor" class="form-select">
              <option value="all">All Distributors</option>
              <option value="spotify">Spotify</option>
              <option value="apple">Apple Music</option>
              <option value="amazon">Amazon Music</option>
              <option value="youtube">YouTube Music</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label for="releases">Specific Releases (Optional)</label>
          <input 
            type="text" 
            id="releases" 
            v-model="config.releases" 
            class="form-input"
            placeholder="Enter UPCs separated by commas"
          />
        </div>
      </div>

      <!-- Report Options -->
      <div class="form-section">
        <h3>Report Options</h3>
        
        <div class="checkbox-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="config.includeDetails" />
            <span>Include transaction details</span>
          </label>
          
          <label class="checkbox-label">
            <input type="checkbox" v-model="config.includeSummary" />
            <span>Include summary statistics</span>
          </label>
          
          <label class="checkbox-label">
            <input type="checkbox" v-model="config.includeCharts" />
            <span>Include visual charts</span>
          </label>
          
          <label class="checkbox-label">
            <input type="checkbox" v-model="config.compressOutput" />
            <span>Compress output (ZIP)</span>
          </label>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="form-actions">
        <button @click="generateReport" class="btn btn-primary" :disabled="generating">
          <i class="fas fa-file-invoice" v-if="!generating"></i>
          <i class="fas fa-spinner fa-spin" v-else></i>
          {{ generating ? 'Generating...' : 'Generate Report' }}
        </button>
        
        <button @click="scheduleReport" class="btn btn-secondary">
          <i class="fas fa-clock"></i>
          Schedule Report
        </button>
        
        <button @click="resetForm" class="btn btn-outline">
          <i class="fas fa-redo"></i>
          Reset
        </button>
      </div>
    </div>

    <!-- Recent Reports -->
    <div class="recent-reports" v-if="recentReports.length > 0">
      <h3>Recent Reports</h3>
      <div class="reports-list">
        <div v-for="report in recentReports" :key="report.id" class="report-item">
          <div class="report-info">
            <div class="report-title">
              {{ report.type }} - {{ formatDateRange(report.startDate, report.endDate) }}
            </div>
            <div class="report-meta">
              Generated {{ formatRelativeTime(report.createdAt) }} • {{ report.format }}
            </div>
          </div>
          <div class="report-actions">
            <button @click="downloadReport(report)" class="btn-icon">
              <i class="fas fa-download"></i>
            </button>
            <button @click="viewReport(report)" class="btn-icon">
              <i class="fas fa-eye"></i>
            </button>
            <button @click="deleteReport(report)" class="btn-icon danger">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Report Preview Modal -->
    <div v-if="showPreview" class="modal-overlay" @click.self="closePreview">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Report Preview</h3>
          <button @click="closePreview" class="btn-close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <pre>{{ previewData }}</pre>
        </div>
        <div class="modal-footer">
          <button @click="downloadPreview" class="btn btn-primary">
            Download Full Report
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dsr-generator {
  padding: var(--spacing-lg);
  max-width: 1200px;
  margin: 0 auto;
}

.generator-header {
  margin-bottom: var(--spacing-xl);
}

.generator-header h2 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-sm);
}

.description {
  color: var(--text-secondary);
}

.generator-form {
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-xl);
  box-shadow: var(--shadow-sm);
}

.form-section {
  margin-bottom: var(--spacing-xl);
}

.form-section:last-child {
  margin-bottom: 0;
}

.form-section h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-lg);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.form-actions {
  display: flex;
  gap: var(--spacing-md);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--border-subtle);
}

.recent-reports {
  margin-top: var(--spacing-xl);
}

.recent-reports h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-lg);
}

.reports-list {
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
}

.report-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  transition: var(--transition-base);
}

.report-item:hover {
  background: var(--surface-secondary);
}

.report-info {
  flex: 1;
}

.report-title {
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.report-meta {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.report-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.btn-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: var(--surface-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--transition-base);
}

.btn-icon:hover {
  background: var(--primary-light);
  color: var(--primary);
  border-color: var(--primary);
}

.btn-icon.danger:hover {
  background: var(--danger-light);
  color: var(--danger);
  border-color: var(--danger);
}

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

.modal-content {
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--border-subtle);
}

.modal-header h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.btn-close {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--transition-base);
}

.btn-close:hover {
  background: var(--surface-secondary);
}

.modal-body {
  flex: 1;
  padding: var(--spacing-lg);
  overflow-y: auto;
}

.modal-body pre {
  font-family: 'Courier New', monospace;
  font-size: var(--font-size-sm);
  line-height: 1.5;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
}

.modal-footer {
  padding: var(--spacing-lg);
  border-top: 1px solid var(--border-subtle);
  display: flex;
  justify-content: flex-end;
}
</style>