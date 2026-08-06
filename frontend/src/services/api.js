import axios from 'axios';
import {
  MOCK_PREDICTIONS, MOCK_ALERTS, MOCK_EVENTS,
  MOCK_SYSTEM_HEALTH, MOCK_METRICS, MOCK_DRIFT_STATUS
} from '../utils/helpers';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const API_KEY = import.meta.env.VITE_API_KEY || '';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
    ...(API_KEY && { 'X-API-Key': API_KEY }),
  },
});

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
      // Randomise metrics slightly each call to simulate live data
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

    return Promise.reject(error);
  }
);

export const DashboardService = {
  getRecentPredictions: (limit = 100) =>
    api.get('/dashboard/recent-predictions', { params: { limit } }).then(r => r.data),

  getDriftStatus: () =>
    api.get('/dashboard/drift-status').then(r => r.data),

  getAlerts: (limit = 100) =>
    api.get('/dashboard/alerts', { params: { limit } }).then(r => r.data),

  getRawEvents: (limit = 100) =>
    api.get('/dashboard/events', { params: { limit } }).then(r => r.data),

  getSystemHealth: () =>
    api.get('/dashboard/system-health').then(r => r.data),

  getMetrics: () =>
    api.get('/dashboard/metrics').then(r => r.data),
};

export default api;
