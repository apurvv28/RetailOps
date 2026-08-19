import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { DashboardService } from '../services/api';
import {
  MOCK_PREDICTIONS, MOCK_ALERTS, MOCK_EVENTS,
  MOCK_SYSTEM_HEALTH, MOCK_METRICS, MOCK_DRIFT_STATUS
} from '../utils/helpers';
import Swal from 'sweetalert2';

const DashboardContext = createContext();
export const useDashboard = () => useContext(DashboardContext);

export const DashboardProvider = ({ children }) => {
  const [predictions, setPredictions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [driftStatus, setDriftStatus] = useState(null);
  const [rawEvents, setRawEvents] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [metricsHistory, setMetricsHistory] = useState([]); // rolling 20-point history for charts
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [isPipelineActive, setIsPipelineActive] = useState(false); // triggers pipeline animation

  const prevHighRiskIds = useRef(new Set());
  const REFRESH_INTERVAL = parseInt(import.meta.env.VITE_REFRESH_INTERVAL || '3000', 10);

  const showHighRiskToast = (field_id, prob) => {
    // Alert popups completely removed per user request.
  };

  const fetchAll = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const [predsRes, alertsRes, driftRes, eventsRes, healthRes, metricsRes] = await Promise.allSettled([
        DashboardService.getRecentPredictions(100),
        DashboardService.getAlerts(100),
        DashboardService.getDriftStatus(),
        DashboardService.getRawEvents(50),
        DashboardService.getSystemHealth(),
        DashboardService.getMetrics(),
      ]);

      if (predsRes.status === 'fulfilled') {
        const raw = predsRes.value?.predictions || [];
        const normalized = (raw.length > 0 ? raw : MOCK_PREDICTIONS).map((p, idx) => {
          const prob = p.prediction_prob ?? p.confidence_score ?? 0.85;
          return {
            ...p,
            id: p.id || `pred_${idx}`,
            field_id: p.field_id || p.sku || 'FIELD_MH_01',
            model_type: p.model_type || 'irrigation',
            prediction_output: p.prediction_output || 'Optimal Moisture',
            prediction_prob: prob,
            confidence_score: prob,
            model_version: p.model_version || 'v3.0.0 (Production)',
            timestamp: p.timestamp || new Date().toISOString(),
            top_features: p.top_features || [
              { feature: 'soil_moisture_3d_avg', importance: 0.45, value: '14.2%' },
              { feature: 'nitrogen_level', importance: 0.28, value: '45' },
              { feature: 'temperature_c', importance: 0.17, value: '28.5°C' },
              { feature: 'rainfall_mm', importance: 0.10, value: '120mm' },
            ]
          };
        });

        normalized.forEach(p => {
          if (p.prediction_prob >= 0.7 && !prevHighRiskIds.current.has(p.id)) {
            showHighRiskToast(p.field_id, p.prediction_prob);
            prevHighRiskIds.current.add(p.id);
          }
        });
        setPredictions(normalized);
        if (normalized.length > 0) setIsPipelineActive(true);
      }

      if (alertsRes.status === 'fulfilled') {
        const rawAlerts = alertsRes.value?.alerts || [];
        setAlerts(rawAlerts.length > 0 ? rawAlerts : MOCK_ALERTS);
      } else {
        setAlerts(MOCK_ALERTS);
      }

      if (driftRes.status === 'fulfilled' && driftRes.value) {
        setDriftStatus(driftRes.value);
      } else {
        setDriftStatus(MOCK_DRIFT_STATUS);
      }

      if (eventsRes.status === 'fulfilled') {
        const rawEvts = eventsRes.value?.events || [];
        setRawEvents(rawEvts.length > 0 ? rawEvts : MOCK_EVENTS);
      } else {
        setRawEvents(MOCK_EVENTS);
      }

      if (healthRes.status === 'fulfilled' && healthRes.value) {
        setSystemHealth(healthRes.value);
      } else {
        setSystemHealth(MOCK_SYSTEM_HEALTH);
      }

      const m = (metricsRes.status === 'fulfilled' && metricsRes.value) ? metricsRes.value : MOCK_METRICS;
      setMetrics(m);
      setMetricsHistory(prev => {
        const entry = {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          accuracy: m.model_accuracy ? m.model_accuracy * 100 : 95.5,
          drift: m.drift_score ? m.drift_score * 100 : 2.5,
          latency: m.api_latency_ms || 25,
          cpu: m.cpu_usage || 35,
          memory: m.memory_usage || 45,
          events: m.events_per_second || 18,
          lag: m.consumer_lag || 0,
        };
        const updated = [...prev, entry];
        return updated.length > 20 ? updated.slice(-20) : updated;
      });

      setError(null);
      setLastRefreshed(new Date());
    } catch (err) {
      setError('Connection error — displaying cached data.');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(true);
  }, [fetchAll]);

  useEffect(() => {
    const interval = setInterval(() => fetchAll(false), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAll, REFRESH_INTERVAL]);

  // Reset pipeline pulse after 2s
  useEffect(() => {
    if (isPipelineActive) {
      const t = setTimeout(() => setIsPipelineActive(false), 2000);
      return () => clearTimeout(t);
    }
  }, [isPipelineActive]);

  const totalProducts = predictions.length;
  const highRiskCount = predictions.filter(p => p.prediction_prob >= 0.7).length;
  const mediumRiskCount = predictions.filter(p => p.prediction_prob >= 0.4 && p.prediction_prob < 0.7).length;
  const lowRiskCount = predictions.filter(p => p.prediction_prob < 0.4).length;
  const todayCount = predictions.filter(p => {
    if (!p.timestamp) return false;
    const d = new Date(p.timestamp);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
  }).length;
  const weekAlerts = alerts.filter(a => {
    if (!a.sent_at) return false;
    return (Date.now() - new Date(a.sent_at).getTime()) < 7 * 24 * 3600 * 1000;
  }).length;

  return (
    <DashboardContext.Provider value={{
      predictions, alerts, driftStatus, rawEvents, systemHealth, metrics,
      metricsHistory, loading, error, lastRefreshed, isPipelineActive,
      refreshData: () => fetchAll(true),
      stats: { totalProducts, highRiskCount, mediumRiskCount, lowRiskCount, todayCount, weekAlerts }
    }}>
      {children}
    </DashboardContext.Provider>
  );
};
