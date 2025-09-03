<template>
  <div class="royalty-calculator">
    <div class="calculator-header">
      <h2>Royalty Calculator</h2>
      <p class="description">Calculate and distribute royalties based on streaming data and agreements</p>
    </div>

    <!-- Calculation Parameters -->
    <div class="calculator-main">
      <div class="parameters-section">
        <h3>Calculation Parameters</h3>
        
        <!-- Period Selection -->
        <div class="form-row">
          <div class="form-group">
            <label for="period">Calculation Period</label>
            <select id="period" v-model="params.period" class="form-select">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          <div class="form-group">
            <label for="month">Month/Quarter</label>
            <select 
              id="month" 
              v-model="params.selectedPeriod" 
              class="form-select"
              :disabled="params.period === 'custom'"
            >
              <option v-for="period in availablePeriods" :key="period.value" :value="period.value">
                {{ period.label }}
              </option>
            </select>
          </div>
        </div>

        <!-- Custom Date Range -->
        <div v-if="params.period === 'custom'" class="form-row">
          <div class="form-group">
            <label for="startDate">Start Date</label>
            <input 
              type="date" 
              id="startDate" 
              v-model="params.startDate" 
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="endDate">End Date</label>
            <input 
              type="date" 
              id="endDate" 
              v-model="params.endDate" 
              class="form-input"
            />
          </div>
        </div>

        <!-- Territory & Currency -->
        <div class="form-row">
          <div class="form-group">
            <label for="territory">Territory</label>
            <select id="territory" v-model="params.territory" class="form-select">
              <option value="worldwide">Worldwide</option>
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="EU">European Union</option>
              <option value="JP">Japan</option>
              <option value="AU">Australia</option>
            </select>
          </div>

          <div class="form-group">
            <label for="currency">Currency</label>
            <select id="currency" v-model="params.currency" class="form-select">
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="JPY">JPY (¥)</option>
              <option value="AUD">AUD ($)</option>
            </select>
          </div>
        </div>

        <!-- Calculation Method -->
        <div class="form-group">
          <label>Calculation Method</label>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" v-model="params.method" value="pro-rata" />
              <span>Pro-Rata (Market Share)</span>
            </label>
            <label class="radio-label">
              <input type="radio" v-model="params.method" value="user-centric" />
              <span>User-Centric</span>
            </label>
            <label class="radio-label">
              <input type="radio" v-model="params.method" value="hybrid" />
              <span>Hybrid Model</span>
            </label>
          </div>
        </div>

        <button @click="calculateRoyalties" class="btn btn-primary" :disabled="calculating">
          <i class="fas fa-calculator" v-if="!calculating"></i>
          <i class="fas fa-spinner fa-spin" v-else></i>
          {{ calculating ? 'Calculating...' : 'Calculate Royalties' }}
        </button>
      </div>

      <!-- Revenue Sources -->
      <div class="revenue-section">
        <h3>Revenue Sources</h3>
        
        <div class="revenue-inputs">
          <div class="revenue-item" v-for="source in revenueSources" :key="source.id">
            <div class="source-header">
              <i :class="source.icon"></i>
              <span>{{ source.name }}</span>
            </div>
            <div class="source-inputs">
              <div class="input-group">
                <label>Streams</label>
                <input 
                  type="number" 
                  v-model.number="source.streams" 
                  class="form-input"
                  @input="updateCalculations"
                />
              </div>
              <div class="input-group">
                <label>Rate</label>
                <input 
                  type="number" 
                  v-model.number="source.rate" 
                  step="0.0001"
                  class="form-input"
                  @input="updateCalculations"
                />
              </div>
              <div class="input-group">
                <label>Revenue</label>
                <input 
                  type="text" 
                  :value="formatCurrency(source.revenue)" 
                  class="form-input"
                  disabled
                />
              </div>
            </div>
          </div>
        </div>

        <div class="revenue-summary">
          <div class="summary-row">
            <span>Total Streams:</span>
            <strong>{{ formatNumber(totalStreams) }}</strong>
          </div>
          <div class="summary-row">
            <span>Gross Revenue:</span>
            <strong>{{ formatCurrency(grossRevenue) }}</strong>
          </div>
          <div class="summary-row">
            <span>Platform Fee ({{ platformFee }}%):</span>
            <strong>-{{ formatCurrency(platformFeeAmount) }}</strong>
          </div>
          <div class="summary-row total">
            <span>Net Revenue:</span>
            <strong>{{ formatCurrency(netRevenue) }}</strong>
          </div>
        </div>
      </div>
    </div>

    <!-- Royalty Results -->
    <div v-if="results" class="results-section">
      <div class="results-header">
        <h3>Royalty Distribution</h3>
        <div class="results-actions">
          <button @click="exportResults" class="btn btn-secondary">
            <i class="fas fa-download"></i> Export
          </button>
          <button @click="saveStatement" class="btn btn-primary">
            <i class="fas fa-save"></i> Save Statement
          </button>
        </div>
      </div>

      <!-- Summary Cards -->
      <div class="summary-cards">
        <div class="summary-card">
          <div class="card-icon">
            <i class="fas fa-music"></i>
          </div>
          <div class="card-content">
            <div class="card-value">{{ results.totalTracks }}</div>
            <div class="card-label">Tracks</div>
          </div>
        </div>

        <div class="summary-card">
          <div class="card-icon">
            <i class="fas fa-users"></i>
          </div>
          <div class="card-content">
            <div class="card-value">{{ results.totalRightsHolders }}</div>
            <div class="card-label">Rights Holders</div>
          </div>
        </div>

        <div class="summary-card">
          <div class="card-icon">
            <i class="fas fa-dollar-sign"></i>
          </div>
          <div class="card-content">
            <div class="card-value">{{ formatCurrency(results.totalDistributed) }}</div>
            <div class="card-label">Distributed</div>
          </div>
        </div>

        <div class="summary-card">
          <div class="card-icon">
            <i class="fas fa-percentage"></i>
          </div>
          <div class="card-content">
            <div class="card-value">{{ results.averageRate }}</div>
            <div class="card-label">Avg Rate</div>
          </div>
        </div>
      </div>

      <!-- Distribution Table -->
      <div class="distribution-table">
        <table>
          <thead>
            <tr>
              <th>Rights Holder</th>
              <th>Type</th>
              <th>Tracks</th>
              <th>Streams</th>
              <th>Share %</th>
              <th>Gross</th>
              <th>Fees</th>
              <th>Net Royalty</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="holder in results.distributions" :key="holder.id">
              <td>
                <div class="holder-info">
                  <div class="holder-name">{{ holder.name }}</div>
                  <div class="holder-id">{{ holder.id }}</div>
                </div>
              </td>
              <td>
                <span class="badge" :class="`badge-${holder.type}`">
                  {{ holder.type }}
                </span>
              </td>
              <td>{{ holder.trackCount }}</td>
              <td>{{ formatNumber(holder.streams) }}</td>
              <td>{{ holder.sharePercentage }}%</td>
              <td>{{ formatCurrency(holder.gross) }}</td>
              <td>{{ formatCurrency(holder.fees) }}</td>
              <td class="net-amount">{{ formatCurrency(holder.net) }}</td>
              <td>
                <span class="status" :class="`status-${holder.status}`">
                  {{ holder.status }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Track-Level Details -->
      <div class="track-details" v-if="showTrackDetails">
        <h4>Track-Level Breakdown</h4>
        <div class="track-table">
          <table>
            <thead>
              <tr>
                <th>Track</th>
                <th>Artist</th>
                <th>ISRC</th>
                <th>Streams</th>
                <th>Revenue</th>
                <th>Master %</th>
                <th>Publishing %</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="track in results.trackDetails" :key="track.isrc">
                <td>{{ track.title }}</td>
                <td>{{ track.artist }}</td>
                <td class="mono">{{ track.isrc }}</td>
                <td>{{ formatNumber(track.streams) }}</td>
                <td>{{ formatCurrency(track.revenue) }}</td>
                <td>{{ track.masterShare }}%</td>
                <td>{{ track.publishingShare }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Payment Instructions -->
    <div v-if="results" class="payment-section">
      <h3>Payment Instructions</h3>
      
      <div class="payment-grid">
        <div class="payment-card" v-for="payment in results.payments" :key="payment.id">
          <div class="payment-header">
            <span class="payment-recipient">{{ payment.recipient }}</span>
            <span class="payment-amount">{{ formatCurrency(payment.amount) }}</span>
          </div>
          <div class="payment-details">
            <div class="detail-row">
              <span>Method:</span>
              <strong>{{ payment.method }}</strong>
            </div>
            <div class="detail-row">
              <span>Account:</span>
              <strong>{{ payment.account }}</strong>
            </div>
            <div class="detail-row">
              <span>Due Date:</span>
              <strong>{{ formatDate(payment.dueDate) }}</strong>
            </div>
          </div>
          <button @click="processPayment(payment)" class="btn btn-sm btn-primary">
            Process Payment
          </button>
        </div>
      </div>
    </div>

    <!-- Historical Statements -->
    <div class="historical-section">
      <h3>Historical Statements</h3>
      
      <div class="statements-list">
        <div v-for="statement in historicalStatements" :key="statement.id" class="statement-item">
          <div class="statement-info">
            <div class="statement-period">
              {{ statement.period }} {{ statement.year }}
            </div>
            <div class="statement-meta">
              Generated {{ formatRelativeTime(statement.createdAt) }}
            </div>
          </div>
          <div class="statement-amount">
            {{ formatCurrency(statement.total) }}
          </div>
          <div class="statement-actions">
            <button @click="viewStatement(statement)" class="btn-icon">
              <i class="fas fa-eye"></i>
            </button>
            <button @click="downloadStatement(statement)" class="btn-icon">
              <i class="fas fa-download"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import analyticsService from '@/services/analytics';
import { useToast } from '@/composables/useToast';

export default {
  name: 'RoyaltyCalculator',
  setup() {
    const calculating = ref(false);
    const showTrackDetails = ref(false);
    const results = ref(null);
    const historicalStatements = ref([]);
    const { showToast } = useToast();

    // Calculation parameters
    const params = ref({
      period: 'monthly',
      selectedPeriod: '',
      startDate: '',
      endDate: '',
      territory: 'worldwide',
      currency: 'USD',
      method: 'pro-rata'
    });

    // Revenue sources
    const revenueSources = ref([
      { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', streams: 0, rate: 0.003, revenue: 0 },
      { id: 'apple', name: 'Apple Music', icon: 'fab fa-apple', streams: 0, rate: 0.0075, revenue: 0 },
      { id: 'youtube', name: 'YouTube Music', icon: 'fab fa-youtube', streams: 0, rate: 0.002, revenue: 0 },
      { id: 'amazon', name: 'Amazon Music', icon: 'fab fa-amazon', streams: 0, rate: 0.0045, revenue: 0 },
      { id: 'tidal', name: 'Tidal', icon: 'fas fa-water', streams: 0, rate: 0.0125, revenue: 0 }
    ]);

    const platformFee = ref(15); // 15% platform fee

    // Computed properties
    const availablePeriods = computed(() => {
      if (params.value.period === 'monthly') {
        return [
          { value: '2025-01', label: 'January 2025' },
          { value: '2024-12', label: 'December 2024' },
          { value: '2024-11', label: 'November 2024' }
        ];
      } else if (params.value.period === 'quarterly') {
        return [
          { value: '2024-Q4', label: 'Q4 2024' },
          { value: '2024-Q3', label: 'Q3 2024' },
          { value: '2024-Q2', label: 'Q2 2024' }
        ];
      } else if (params.value.period === 'annual') {
        return [
          { value: '2024', label: '2024' },
          { value: '2023', label: '2023' }
        ];
      }
      return [];
    });

    const totalStreams = computed(() => {
      return revenueSources.value.reduce((sum, source) => sum + (source.streams || 0), 0);
    });

    const grossRevenue = computed(() => {
      return revenueSources.value.reduce((sum, source) => sum + (source.revenue || 0), 0);
    });

    const platformFeeAmount = computed(() => {
      return grossRevenue.value * (platformFee.value / 100);
    });

    const netRevenue = computed(() => {
      return grossRevenue.value - platformFeeAmount.value;
    });

    // Methods
    const updateCalculations = () => {
      revenueSources.value.forEach(source => {
        source.revenue = source.streams * source.rate;
      });
    };

    const calculateRoyalties = async () => {
      calculating.value = true;
      try {
        // Call backend service
        const response = await analyticsService.calculateRoyalties(
          params.value.period,
          params.value.territory
        );

        // Mock results for demo
        results.value = {
          totalTracks: 245,
          totalRightsHolders: 18,
          totalDistributed: netRevenue.value,
          averageRate: '0.0045',
          distributions: [
            {
              id: 'RH001',
              name: 'Artist Label Records',
              type: 'label',
              trackCount: 120,
              streams: 450000,
              sharePercentage: 45,
              gross: 2025,
              fees: 303.75,
              net: 1721.25,
              status: 'pending'
            },
            {
              id: 'RH002',
              name: 'Independent Artist Co.',
              type: 'artist',
              trackCount: 85,
              streams: 320000,
              sharePercentage: 32,
              gross: 1440,
              fees: 216,
              net: 1224,
              status: 'pending'
            },
            {
              id: 'RH003',
              name: 'Publishing House Ltd.',
              type: 'publisher',
              trackCount: 40,
              streams: 230000,
              sharePercentage: 23,
              gross: 1035,
              fees: 155.25,
              net: 879.75,
              status: 'pending'
            }
          ],
          trackDetails: [
            {
              title: 'Summer Vibes',
              artist: 'The Waves',
              isrc: 'USRC17607839',
              streams: 125000,
              revenue: 562.50,
              masterShare: 80,
              publishingShare: 20
            },
            {
              title: 'Night Drive',
              artist: 'Midnight Crew',
              isrc: 'USRC17607840',
              streams: 98000,
              revenue: 441,
              masterShare: 75,
              publishingShare: 25
            }
          ],
          payments: [
            {
              id: 'PAY001',
              recipient: 'Artist Label Records',
              amount: 1721.25,
              method: 'Bank Transfer',
              account: '****4521',
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            },
            {
              id: 'PAY002',
              recipient: 'Independent Artist Co.',
              amount: 1224,
              method: 'PayPal',
              account: 'artist@example.com',
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
          ]
        };

        showToast('Royalties calculated successfully', 'success');
      } catch (error) {
        console.error('Error calculating royalties:', error);
        showToast('Failed to calculate royalties', 'error');
      } finally {
        calculating.value = false;
      }
    };

    const exportResults = () => {
      if (!results.value) return;
      
      const dataStr = JSON.stringify(results.value, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `royalty_statement_${params.value.selectedPeriod}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      showToast('Results exported successfully', 'success');
    };

    const saveStatement = async () => {
      try {
        // Save to Firestore
        showToast('Statement saved successfully', 'success');
      } catch (error) {
        showToast('Failed to save statement', 'error');
      }
    };

    const processPayment = (payment) => {
      showToast(`Processing payment for ${payment.recipient}...`, 'info');
    };

    const viewStatement = (statement) => {
      showToast('Opening statement viewer...', 'info');
    };

    const downloadStatement = (statement) => {
      showToast('Downloading statement...', 'info');
    };

    // Utility functions
    const formatNumber = (num) => {
      return new Intl.NumberFormat().format(num || 0);
    };

    const formatCurrency = (amount) => {
      const symbol = params.value.currency === 'EUR' ? '€' :
                    params.value.currency === 'GBP' ? '£' :
                    params.value.currency === 'JPY' ? '¥' : '$';
      return `${symbol}${formatNumber(amount?.toFixed(2) || 0)}`;
    };

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString();
    };

    const formatRelativeTime = (date) => {
      const diff = Date.now() - new Date(date).getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days === 0) return 'today';
      if (days === 1) return 'yesterday';
      return `${days} days ago`;
    };

    // Load historical statements
    const loadHistoricalStatements = () => {
      historicalStatements.value = [
        {
          id: 'STMT001',
          period: 'January',
          year: '2025',
          total: 4825.00,
          createdAt: new Date('2025-02-01')
        },
        {
          id: 'STMT002',
          period: 'December',
          year: '2024',
          total: 5240.50,
          createdAt: new Date('2025-01-01')
        },
        {
          id: 'STMT003',
          period: 'November',
          year: '2024',
          total: 4120.75,
          createdAt: new Date('2024-12-01')
        }
      ];
    };

    onMounted(() => {
      // Set default period
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
      params.value.selectedPeriod = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
      
      loadHistoricalStatements();
    });

    return {
      calculating,
      showTrackDetails,
      results,
      historicalStatements,
      params,
      revenueSources,
      platformFee,
      availablePeriods,
      totalStreams,
      grossRevenue,
      platformFeeAmount,
      netRevenue,
      updateCalculations,
      calculateRoyalties,
      exportResults,
      saveStatement,
      processPayment,
      viewStatement,
      downloadStatement,
      formatNumber,
      formatCurrency,
      formatDate,
      formatRelativeTime
    };
  }
};
</script>

<style scoped>
.royalty-calculator {
  padding: var(--spacing-lg);
  max-width: 1400px;
  margin: 0 auto;
}

.calculator-header {
  margin-bottom: var(--spacing-xl);
}

.calculator-header h2 {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-sm);
}

.description {
  color: var(--text-secondary);
}

.calculator-main {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.parameters-section,
.revenue-section {
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
}

.parameters-section h3,
.revenue-section h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-lg);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.radio-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  cursor: pointer;
}

.revenue-inputs {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.revenue-item {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}

.source-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
  font-weight: var(--font-medium);
}

.source-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--spacing-sm);
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.input-group label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.revenue-summary {
  margin-top: var(--spacing-lg);
  padding-top: var(--spacing-lg);
  border-top: 1px solid var(--border-subtle);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-sm) 0;
}

.summary-row.total {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  border-top: 2px solid var(--border-subtle);
  margin-top: var(--spacing-sm);
  padding-top: var(--spacing-md);
}

.results-section {
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
  margin-bottom: var(--spacing-xl);
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.results-header h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.results-actions {
  display: flex;
  gap: var(--spacing-md);
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-xl);
}

.summary-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--surface-secondary);
  border-radius: var(--radius-md);
}

.card-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary);
}

.card-content {
  flex: 1;
}

.card-value {
  font-size: var(--font-size-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.card-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.distribution-table,
.track-table {
  overflow-x: auto;
}

.distribution-table table,
.track-table table {
  width: 100%;
  border-collapse: collapse;
}

.distribution-table th,
.track-table th {
  text-align: left;
  padding: var(--spacing-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-subtle);
  font-size: var(--font-size-sm);
}

.distribution-table td,
.track-table td {
  padding: var(--spacing-sm);
  border-bottom: 1px solid var(--border-subtle);
}

.holder-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.holder-name {
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.holder-id {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  font-family: monospace;
}

.badge {
  display: inline-block;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-medium);
  text-transform: uppercase;
}

.badge-label {
  background: var(--primary-light);
  color: var(--primary);
}

.badge-artist {
  background: var(--success-light);
  color: var(--success);
}

.badge-publisher {
  background: var(--warning-light);
  color: var(--warning);
}

.net-amount {
  font-weight: var(--font-semibold);
  color: var(--success);
}

.status {
  display: inline-block;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-medium);
  text-transform: uppercase;
}

.status-pending {
  background: var(--warning-light);
  color: var(--warning);
}

.status-paid {
  background: var(--success-light);
  color: var(--success);
}

.track-details {
  margin-top: var(--spacing-xl);
  padding-top: var(--spacing-xl);
  border-top: 1px solid var(--border-subtle);
}

.track-details h4 {
  font-size: var(--font-size-md);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-md);
}

.mono {
  font-family: monospace;
  font-size: var(--font-size-sm);
}

.payment-section {
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
  margin-bottom: var(--spacing-xl);
}

.payment-section h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-lg);
}

.payment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-lg);
}

.payment-card {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}

.payment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--border-subtle);
}

.payment-recipient {
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.payment-amount {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--success);
}

.payment-details {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-sm);
}

.detail-row span {
  color: var(--text-secondary);
}

.historical-section {
  background: var(--surface-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  box-shadow: var(--shadow-sm);
}

.historical-section h3 {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-lg);
}

.statements-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.statement-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  transition: var(--transition-base);
}

.statement-item:hover {
  background: var(--surface-secondary);
}

.statement-info {
  flex: 1;
}

.statement-period {
  font-weight: var(--font-medium);
  color: var(--text-primary);
  margin-bottom: var(--spacing-xs);
}

.statement-meta {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.statement-amount {
  font-size: var(--font-size-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.statement-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.btn-icon {
  width: 32px;
  height: 32px;
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

.btn-sm {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-sm);
}

@media (max-width: 768px) {
  .calculator-main {
    grid-template-columns: 1fr;
  }
  
  .payment-grid {
    grid-template-columns: 1fr;
  }
}
</style>