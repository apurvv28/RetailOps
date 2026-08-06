// ===== FORMATTING UTILITIES =====
export const formatNumber = (num) => {
  if (num === null || num === undefined) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

export const formatPercent = (value) => {
  if (value === null || value === undefined) return '0%';
  return `${(value * 100).toFixed(1)}%`;
};

export const formatDate = (timestamp) => {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

export const formatTimeShort = (timestamp) => {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// ===== RISK UTILITIES =====
export const getRiskInfo = (probability) => {
  if (probability >= 0.7) {
    return {
      level: 'High Risk',
      badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
      dotClass: 'bg-rose-500',
      color: '#f43f5e',
      description: 'Critical stockout risk. Immediate reorder action required before inventory depletes.'
    };
  } else if (probability >= 0.4) {
    return {
      level: 'Medium Risk',
      badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
      dotClass: 'bg-amber-500',
      color: '#f59e0b',
      description: 'Moderate stockout probability. Schedule a reorder within the next 48 hours.'
    };
  } else {
    return {
      level: 'Low Risk',
      badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
      dotClass: 'bg-emerald-500',
      color: '#10b981',
      description: 'Healthy inventory levels. Standard monitoring is sufficient.'
    };
  }
};

// ===== CSV EXPORT =====
export const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row =>
    Object.values(row).map(val =>
      typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
    ).join(',')
  );
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ===== MOCK DATA =====
const SKUS = ['22723', '85123A', '21970', '23084', '22197', '21212', '22423', '85099B', '22355', '20685'];
const PRODUCTS = {
  '22723': 'STRAWBERRY CERAMIC TRINKET BOX', '85123A': 'WHITE HANGING HEART T-LIGHT HOLDER',
  '21970': 'HOME BUILDING BLOCK WORD', '23084': 'RABBIT NIGHT LIGHT',
  '22197': 'SMALL POPCORN HOLDER', '21212': 'PACK OF 72 RETROSPOT CAKE CASES',
  '22423': 'REGENCY CAKESTAND 3 TIER', '85099B': 'JUMBO BAG RED RETROSPOT',
  '22355': 'CHARLOTTE BAG SUKI DESIGN', '20685': 'CHICKEN FEED'
};
const COUNTRIES = ['United Kingdom', 'Germany', 'France', 'Netherlands', 'Australia', 'Spain', 'Belgium'];

const generateSKUPrediction = (i = 0) => {
  const sku = SKUS[i % SKUS.length];
  const prob = parseFloat((Math.random() * 0.95 + 0.05).toFixed(3));
  return {
    id: `pred_${Date.now()}_${i}`,
    sku,
    product_name: PRODUCTS[sku],
    prediction_prob: prob,
    risk_flag: prob >= 0.4 ? 1 : 0,
    model_version: 'v1.2.0',
    timestamp: new Date(Date.now() - i * 15000).toISOString(),
    country: COUNTRIES[i % COUNTRIES.length],
    top_features: [
      { feature: 'quantity_sold_7d', importance: 0.42, value: Math.floor(Math.random() * 200 + 50) },
      { feature: 'current_stock', importance: 0.31, value: Math.floor(Math.random() * 50 + 5) },
      { feature: 'days_since_restock', importance: 0.18, value: Math.floor(Math.random() * 30 + 5) },
      { feature: 'price_sensitivity', importance: 0.09, value: parseFloat((Math.random() * 2).toFixed(2)) },
    ]
  };
};

const generateRawEvent = (i = 0) => {
  const sku = SKUS[i % SKUS.length];
  return {
    id: `evt_${Date.now()}_${i}`,
    timestamp: new Date(Date.now() - i * 3000).toISOString(),
    invoice_no: `INV${Math.floor(Math.random() * 900000 + 100000)}`,
    sku,
    product_name: PRODUCTS[sku],
    quantity: Math.floor(Math.random() * 100 + 1),
    country: COUNTRIES[i % COUNTRIES.length],
    status: ['RECEIVED', 'PROCESSING', 'PREDICTED'][i % 3]
  };
};

export const MOCK_PREDICTIONS = Array.from({ length: 30 }, (_, i) => generateSKUPrediction(i));
export const MOCK_ALERTS = Array.from({ length: 8 }, (_, i) => ({
  id: `alert_${i}`,
  sku: SKUS[i % SKUS.length],
  recipient: 'inventory-team@retailops.internal',
  action_type: 'email_alert',
  details: `High stockout risk detected for SKU ${SKUS[i % SKUS.length]}. Immediate reorder recommended.`,
  sent_at: new Date(Date.now() - i * 3600000).toISOString(),
  status: 'delivered'
}));
export const MOCK_EVENTS = Array.from({ length: 25 }, (_, i) => generateRawEvent(i));

export const MOCK_SYSTEM_HEALTH = {
  kafka_broker: true,
  kafka_producer: true,
  kafka_consumer: true,
  fastapi: true,
  cockroachdb: true,
  last_checked: new Date().toISOString()
};

export const MOCK_METRICS = {
  events_per_second: parseFloat((Math.random() * 15 + 5).toFixed(1)),
  processed_per_second: parseFloat((Math.random() * 12 + 4).toFixed(1)),
  consumer_lag: Math.floor(Math.random() * 50),
  kafka_queue_size: Math.floor(Math.random() * 200),
  pending_messages: Math.floor(Math.random() * 30),
  api_latency_ms: Math.floor(Math.random() * 80 + 20),
  cpu_usage: parseFloat((Math.random() * 60 + 10).toFixed(1)),
  memory_usage: parseFloat((Math.random() * 40 + 30).toFixed(1)),
  model_accuracy: 0.942,
  drift_score: parseFloat((Math.random() * 0.12 + 0.03).toFixed(3)),
};

export const MOCK_DRIFT_STATUS = {
  dataset_drift: false,
  drifted_columns: 1,
  share_of_drifted_columns: 0.1,
  total_features: 10,
  last_checked: new Date().toISOString(),
  report_available: true
};
