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

// ===== AGRI RISK UTILITIES =====
export const getRiskInfo = (probability) => {
  if (probability >= 0.7) {
    return {
      level: 'High Risk',
      badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
      dotClass: 'bg-rose-500',
      color: '#f43f5e',
      description: 'Critical moisture depletion detected! Trigger automated field irrigation valve immediately.'
    };
  } else if (probability >= 0.4) {
    return {
      level: 'Medium Risk',
      badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
      dotClass: 'bg-amber-500',
      color: '#f59e0b',
      description: 'Moderate soil moisture loss. Schedule field irrigation cycle within 24 hours.'
    };
  } else {
    return {
      level: 'Low Risk',
      badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
      dotClass: 'bg-emerald-500',
      color: '#10b981',
      description: 'Optimal soil hydration levels. Standard automated monitoring active.'
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

// ===== AGRI MOCK DATA GENERATORS =====
export const FIELDS = ['FIELD_MH_01', 'FIELD_MH_02', 'FIELD_US_01', 'FIELD_US_04', 'FIELD_PB_01', 'FIELD_KA_03'];
export const CROPS = ['rice', 'maize', 'cotton', 'chickpea', 'banana', 'grapes', 'watermelon', 'coffee', 'jute', 'wheat'];
export const FERTILIZERS = ['Urea', 'DAP', '14-35-14', '28-28', '17-17-17', '20-20', '10-26-26'];
export const STATES = ['Maharashtra', 'Iowa', 'Illinois', 'Punjab', 'Karnataka', 'California'];

export const generateAgriPredictions = (count = 30) => {
  return Array.from({ length: count }, (_, i) => {
    const field_id = FIELDS[i % FIELDS.length];
    const model_type = ['irrigation', 'crop', 'fertilizer', 'yield'][i % 4];
    const prob = parseFloat((Math.random() * 0.85 + 0.1).toFixed(3));
    
    let pred_output = 'Low Risk';
    if (model_type === 'irrigation') pred_output = prob >= 0.7 ? 'High Depletion Risk' : prob >= 0.4 ? 'Medium Depletion Risk' : 'Optimal Moisture';
    else if (model_type === 'crop') pred_output = CROPS[i % CROPS.length];
    else if (model_type === 'fertilizer') pred_output = FERTILIZERS[i % FERTILIZERS.length];
    else if (model_type === 'yield') pred_output = `${(Math.random() * 80 + 120).toFixed(1)} bu/acre`;

    return {
      id: `agri_pred_${Date.now()}_${i}`,
      field_id,
      model_type,
      prediction_output: pred_output,
      prediction_prob: prob,
      risk_flag: prob >= 0.7 ? 1 : 0,
      model_version: 'v3.0.0 (Production)',
      timestamp: new Date(Date.now() - i * 12000).toISOString(),
      state: STATES[i % STATES.length],
      top_features: [
        { feature: 'soil_moisture_3d_avg', importance: 0.45, value: (Math.random() * 20 + 10).toFixed(1) },
        { feature: 'nitrogen_level', importance: 0.28, value: Math.floor(Math.random() * 100 + 20) },
        { feature: 'temperature_c', importance: 0.17, value: (Math.random() * 15 + 20).toFixed(1) },
        { feature: 'rainfall_mm', importance: 0.10, value: (Math.random() * 150 + 50).toFixed(1) },
      ]
    };
  });
};

export const generateRawTelemetryEvents = (count = 25) => {
  return Array.from({ length: count }, (_, i) => {
    const field_id = FIELDS[i % FIELDS.length];
    return {
      id: `evt_tel_${Date.now()}_${i}`,
      timestamp: new Date(Date.now() - i * 4000).toISOString(),
      field_id,
      crop_type: CROPS[i % CROPS.length],
      soil_type: 'Loamy',
      nitrogen: Math.floor(Math.random() * 100 + 20),
      phosphorus: Math.floor(Math.random() * 80 + 15),
      potassium: Math.floor(Math.random() * 80 + 15),
      temperature: parseFloat((Math.random() * 15 + 20).toFixed(1)),
      humidity: parseFloat((Math.random() * 40 + 40).toFixed(1)),
      ph: parseFloat((Math.random() * 2 + 5.5).toFixed(1)),
      soil_moisture: parseFloat((Math.random() * 35 + 10).toFixed(1)),
      rainfall: parseFloat((Math.random() * 200 + 50).toFixed(1)),
      status: ['RECEIVED', 'PROCESSING', 'PREDICTED'][i % 3]
    };
  });
};

export const MOCK_PREDICTIONS = generateAgriPredictions(30);
export const MOCK_ALERTS = Array.from({ length: 8 }, (_, i) => ({
  id: `alert_agri_${i}`,
  field_id: FIELDS[i % FIELDS.length],
  recipient: 'field-ops@agritech.internal',
  action_type: 'irrigation_valve_trigger',
  details: `Automated moisture depletion alert triggered for ${FIELDS[i % FIELDS.length]}. Soil moisture dropped below critical 15% threshold.`,
  sent_at: new Date(Date.now() - i * 3600000).toISOString(),
  status: 'delivered'
}));
export const MOCK_EVENTS = generateRawTelemetryEvents(25);

export const MOCK_SYSTEM_HEALTH = {
  pubsub_broker: true,
  telemetry_producer: true,
  telemetry_consumer: true,
  fastapi: true,
  sqlite_db: true,
  last_checked: new Date().toISOString()
};

export const MOCK_METRICS = {
  events_per_second: parseFloat((Math.random() * 18 + 8).toFixed(1)),
  processed_per_second: parseFloat((Math.random() * 15 + 6).toFixed(1)),
  consumer_lag: Math.floor(Math.random() * 15),
  pubsub_queue_size: Math.floor(Math.random() * 80),
  pending_messages: Math.floor(Math.random() * 10),
  api_latency_ms: Math.floor(Math.random() * 35 + 15),
  cpu_usage: parseFloat((Math.random() * 40 + 10).toFixed(1)),
  memory_usage: parseFloat((Math.random() * 30 + 25).toFixed(1)),
  model_accuracy: 0.955,
  drift_score: parseFloat((Math.random() * 0.08 + 0.01).toFixed(3)),
};

export const MOCK_DRIFT_STATUS = {
  dataset_drift: false,
  drifted_columns: 0,
  share_of_drifted_columns: 0.0,
  total_features: 10,
  last_checked: new Date().toISOString(),
  report_available: true
};

