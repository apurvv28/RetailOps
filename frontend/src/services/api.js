import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://krishiloop-alb-1915260657.ap-south-1.elb.amazonaws.com';
const API_KEY = import.meta.env.VITE_API_KEY || '';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    ...(API_KEY && { 'X-API-Key': API_KEY }),
  },
});

// Request interceptor to attach JWT auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('agritech_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — graceful error handling without synthetic mocks
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    console.warn(`[API Notice] ${url} — ${error.message}`);
    return Promise.reject(error);
  }
);

export const AuthService = {
  getGoogleAuthUrl: (role = 'farmer') =>
    api.get('/api/auth/google/url', { params: { role } }).then(r => r.data),

  loginWithGoogle: (idToken, requestedRole = 'farmer') =>
    api.post('/api/auth/google', { id_token: idToken, requested_role: requestedRole }).then(r => r.data),

  demoLogin: (role = 'farmer', email = null) =>
    api.post('/api/auth/demo-login', { role, email }).then(r => r.data),

  getMe: () =>
    api.get('/api/auth/me').then(r => r.data),
};

export const FarmerService = {
  getProfile: () =>
    api.get('/api/farmer/profile').then(r => r.data),

  updateProfile: (profileData) =>
    api.put('/api/farmer/profile', profileData).then(r => r.data),

  getAssignedFarm: () =>
    api.get('/api/farmer/farm').then(r => r.data),

  getLiveTelemetry: (limit = 20) =>
    api.get('/api/farmer/telemetry/live', { params: { limit } }).then(r => r.data),

  getSummary: () =>
    api.get('/api/farmer/summary').then(r => r.data),

  predictIrrigation: (payload) =>
    api.post('/predict/irrigation', payload).then(r => r.data),

  predictCrop: (payload) =>
    api.post('/predict/crop', payload).then(r => r.data),

  predictFertilizer: (payload) =>
    api.post('/predict/fertilizer', payload).then(r => r.data),

  predictYield: (payload) =>
    api.post('/predict/yield', payload).then(r => r.data),

  getFarmerAlerts: () =>
    api.get('/api/farmer/alerts').then(r => r.data),

  markAlertRead: (alertId) =>
    api.post(`/api/farmer/alerts/${alertId}/read`).then(r => r.data),

  getSensorStatus: () =>
    api.get('/api/farmer/sensor-status').then(r => r.data),
};

export const DashboardService = {
  getAdminFarms: () =>
    api.get('/api/admin/farms').then(r => r.data),

  getFarmTelemetry: (farmId, limit = 50) =>
    api.get(`/api/admin/farms/${farmId}/telemetry`, { params: { limit } }).then(r => r.data),

  getRecentPredictions: (limit = 100) =>
    api.get('/dashboard/recent-predictions', { params: { limit } }).then(r => r.data),

  getDriftStatus: () =>
    api.get('/dashboard/drift-status').then(r => r.data),

  getComprehensiveDrift: (sampleLimit = 500) =>
    api.get('/api/mlops/drift', { params: { sample_limit: sampleLimit } }).then(r => r.data),

  runDriftAnalysis: (sampleLimit = 500) =>
    api.post('/api/mlops/drift/run', null, { params: { sample_limit: sampleLimit } }).then(r => r.data),

  getMlopsModels: () =>
    api.get('/api/mlops/models').then(r => r.data),

  promoteMlopsModel: (modelKey, newStage) =>
    api.post('/api/mlops/models/promote', null, { params: { model_key: modelKey, new_stage: newStage } }).then(r => r.data),

  getAlerts: (limit = 100) =>
    api.get('/dashboard/alerts', { params: { limit } }).then(r => r.data),

  getRawEvents: (limit = 100) =>
    api.get('/dashboard/events', { params: { limit } }).then(r => r.data),

  getSystemHealth: () =>
    api.get('/dashboard/system-health').then(r => r.data),

  getMetrics: () =>
    api.get('/dashboard/metrics').then(r => r.data),

  triggerAlert: (payload) =>
    api.post('/actions/alert', payload).then(r => r.data),

  triggerRetraining: (source = 'ADMIN_UI') =>
    api.post('/api/mlops/retrain', null, { params: { trigger_source: source } }).then(r => r.data),

  getRetrainingStatus: (jobId) =>
    api.get(`/api/mlops/retrain/status/${jobId}`).then(r => r.data),

  getRetrainingHistory: () =>
    api.get('/api/mlops/retrain/history').then(r => r.data),

  triggerRealSensorObservation: (farmId = 'FARM_MH_PUNE_01') =>
    api.post('/api/admin/trigger-event', null, { params: { farm_id: farmId } }).then(r => r.data),

  triggerSyntheticEvent: (farmId = 'FARM_MH_PUNE_01') =>
    api.post('/api/admin/trigger-event', null, { params: { farm_id: farmId } }).then(r => r.data),
};

export default api;
