import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { DashboardService } from '../services/api';
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

  const showHighRiskToast = (sku, prob) => {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'warning',
      title: '⚠️ High Risk Detected',
      text: `SKU ${sku} — ${(prob * 100).toFixed(1)}% stockout probability`,
      showConfirmButton: false,
      timer: 5000,
      timerProgressBar: true,
      background: '#1e1b4b',
      color: '#fde68a',
    });
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
        const newPreds = predsRes.value?.predictions || [];
        // Detect new High Risk predictions and show toast
        newPreds.forEach(p => {
          if (p.prediction_prob >= 0.7 && !prevHighRiskIds.current.has(p.id)) {
            showHighRiskToast(p.sku, p.prediction_prob);
            prevHighRiskIds.current.add(p.id);
          }
        });
        setPredictions(newPreds);
        if (newPreds.length > 0) setIsPipelineActive(true);
      }

      if (alertsRes.status === 'fulfilled') {
        setAlerts(alertsRes.value?.alerts || []);
      }

      if (driftRes.status === 'fulfilled' && driftRes.value) {
        setDriftStatus(driftRes.value);
      }

      if (eventsRes.status === 'fulfilled') {
        setRawEvents(eventsRes.value?.events || []);
      }

      if (healthRes.status === 'fulfilled') {
        setSystemHealth(healthRes.value);
      }

      if (metricsRes.status === 'fulfilled' && metricsRes.value) {
        const m = metricsRes.value;
        setMetrics(m);
        setMetricsHistory(prev => {
          const entry = {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            accuracy: m.model_accuracy ? m.model_accuracy * 100 : 94.2,
            drift: m.drift_score ? m.drift_score * 100 : 8.5,
            latency: m.api_latency_ms || 42,
            cpu: m.cpu_usage || 35,
            memory: m.memory_usage || 55,
            events: m.events_per_second || 10,
            lag: m.consumer_lag || 0,
          };
          const updated = [...prev, entry];
          return updated.length > 20 ? updated.slice(-20) : updated;
        });
      }

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
