import axios from 'axios';
import {
  MOCK_PREDICTIONS, MOCK_ALERTS, MOCK_EVENTS,
  MOCK_SYSTEM_HEALTH, MOCK_METRICS, MOCK_DRIFT_STATUS
} from '../utils/helpers';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_KEY = import.meta.env.VITE_API_KEY || '';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 8000,
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

// Response interceptor — fallback to mock data per endpoint on error
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    console.warn(`[API Fallback] ${url} — ${error.message}`);

    if (url.includes('/dashboard/recent-predictions')) {
      return Promise.resolve({ data: { count: MOCK_PREDICTIONS.length, predictions: MOCK_PREDICTIONS } });
    }
    if (url.includes('/dashboard/alerts')) {
      return Promise.resolve({ data: { count: MOCK_ALERTS.length, alerts: MOCK_ALERTS } });
    }
    if (url.includes('/dashboard/drift-status')) {
      return Promise.resolve({ data: MOCK_DRIFT_STATUS });
    }
    if (url.includes('/dashboard/events')) {
      return Promise.resolve({ data: { count: MOCK_EVENTS.length, events: MOCK_EVENTS } });
    }
    if (url.includes('/dashboard/system-health')) {
      return Promise.resolve({ data: MOCK_SYSTEM_HEALTH });
    }
    if (url.includes('/dashboard/metrics')) {
      return Promise.resolve({
        data: {
          ...MOCK_METRICS,
          events_per_second: parseFloat((Math.random() * 15 + 5).toFixed(1)),
          processed_per_second: parseFloat((Math.random() * 12 + 4).toFixed(1)),
          consumer_lag: Math.floor(Math.random() * 50),
          kafka_queue_size: Math.floor(Math.random() * 200),
          api_latency_ms: Math.floor(Math.random() * 80 + 20),
          cpu_usage: parseFloat((Math.random() * 60 + 10).toFixed(1)),
          memory_usage: parseFloat((Math.random() * 40 + 30).toFixed(1)),
          drift_score: parseFloat((Math.random() * 0.12 + 0.03).toFixed(3)),
        }
      });
    }

    if (url.includes('/api/farmer/summary')) {
      return Promise.resolve({
        data: {
          user_id: 1,
          farmer_name: 'Kisan Farmer',
          farm_status: 'Healthy / Active',
          soil_moisture: 28.5,
          moisture_risk: 0.35,
          recommended_crop: 'Paddy',
          recommended_fertilizer: 'Urea (46% N)',
          expected_yield: '158.4 BU/ACRE',
          alerts_count: 1,
          active_alert: 'Optimal irrigation moisture level maintained'
        }
      });
    }

    if (url.includes('/api/farmer/profile')) {
      return Promise.resolve({
        data: {
          user_id: 1,
          farm_name: 'Green Valley Farm',
          gps_latitude: 18.5204,
          gps_longitude: 73.8567,
          region: 'Pune, Maharashtra',
          current_crops: 'Paddy, Cotton',
          sensors_config: { soil_moisture_sensor: true, npk_sensor: true, weather_station: true },
          updated_at: new Date().toISOString()
        }
      });
    }

    if (url.includes('/actions/alert')) {
      return Promise.resolve({
        data: {
          status: 'success',
          message: 'Alert processed and dispatched to field ops team.',
          action_id: Date.now()
        }
      });
    }

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
};

export const DashboardService = {
  getRecentPredictions: (limit = 100) =>
    api.get('/dashboard/recent-predictions', { params: { limit } }).then(r => r.data),

  getDriftStatus: () =>
    api.get('/dashboard/drift-status').then(r => r.data),

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
};


export default api;
