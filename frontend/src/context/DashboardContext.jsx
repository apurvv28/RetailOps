import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { DashboardService } from '../services/api';

const DashboardContext = createContext();
export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    return {
      predictions: [],
      alerts: [],
      driftStatus: null,
      rawEvents: [],
      adminFarms: [],
      selectedFarmId: 'all',
      setSelectedFarmId: () => {},
      systemHealth: null,
      metrics: null,
      metricsHistory: [],
      loading: false,
      error: null,
      lastRefreshed: new Date(),
      isPipelineActive: false,
      refetch: () => {},
      refreshData: () => {},
      triggerObservation: () => {},
    };
  }
  return context;
};

export const DashboardProvider = ({ children }) => {
  const [predictions, setPredictions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [driftStatus, setDriftStatus] = useState(null);
  const [rawEvents, setRawEvents] = useState([]);
  const [adminFarms, setAdminFarms] = useState([]);
  const [selectedFarmId, setSelectedFarmId] = useState('all');
  const [systemHealth, setSystemHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [metricsHistory, setMetricsHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [isPipelineActive, setIsPipelineActive] = useState(false);

  const REFRESH_INTERVAL = parseInt(import.meta.env.VITE_REFRESH_INTERVAL || '3000', 10);

  const fetchAll = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const [predsRes, alertsRes, driftRes, eventsRes, healthRes, metricsRes, farmsRes] = await Promise.allSettled([
        DashboardService.getRecentPredictions(100),
        DashboardService.getAlerts(100),
        DashboardService.getDriftStatus(),
        DashboardService.getRawEvents(100),
        DashboardService.getSystemHealth(),
        DashboardService.getMetrics(),
        DashboardService.getAdminFarms(),
      ]);

      if (predsRes.status === 'fulfilled') {
        const raw = predsRes.value?.predictions || [];
        const normalized = raw.map((p, idx) => {
          const prob = p.prediction_prob ?? p.confidence_score ?? 0.0;
          return {
            ...p,
            id: p.id || `pred_${idx}`,
            field_id: p.field_id || p.farm_id || 'FARM_MH_PUNE_01',
            farm_id: p.farm_id || p.field_id || 'FARM_MH_PUNE_01',
            model_type: p.model_type || 'irrigation',
            prediction_output: p.prediction_output || 'Normal',
            prediction_prob: prob,
            confidence_score: prob,
            model_version: p.model_version || 'Production v2.0',
            timestamp: p.timestamp || new Date().toISOString(),
            top_features: p.top_features || []
          };
        });
        setPredictions(normalized);
        if (normalized.length > 0) setIsPipelineActive(true);
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

      if (farmsRes.status === 'fulfilled') {
        setAdminFarms(farmsRes.value?.farms || []);
      }

      if (healthRes.status === 'fulfilled' && healthRes.value) {
        setSystemHealth(healthRes.value);
      }

      if (metricsRes.status === 'fulfilled' && metricsRes.value) {
        const m = metricsRes.value;
        setMetrics(m);
        setMetricsHistory(prev => {
          const entry = {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            accuracy: m.model_accuracy ? m.model_accuracy * 100 : 96.0,
            drift: m.drift_score ? m.drift_score * 100 : 0.0,
            latency: m.api_latency_ms || 15,
            throughput: m.events_per_second || 0,
          };
          const next = [...prev, entry];
          return next.length > 20 ? next.slice(next.length - 20) : next;
        });
      }

      setLastRefreshed(new Date());
      setError(null);
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
      setError('Unable to reach production backend services.');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  const triggerObservation = async (farmId = 'FARM_MH_PUNE_01') => {
    try {
      await DashboardService.triggerRealSensorObservation(farmId);
      await fetchAll();
    } catch (err) {
      console.error('Trigger sensor observation notice:', err);
    }
  };

  useEffect(() => {
    fetchAll(true);
    const interval = setInterval(() => fetchAll(false), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAll, REFRESH_INTERVAL]);

  return (
    <DashboardContext.Provider value={{
      predictions,
      alerts,
      driftStatus,
      rawEvents,
      adminFarms,
      selectedFarmId,
      setSelectedFarmId,
      systemHealth,
      metrics,
      metricsHistory,
      loading,
      error,
      lastRefreshed,
      isPipelineActive,
      refetch: () => fetchAll(true),
      refreshData: () => fetchAll(true),
      triggerObservation,
    }}>
      {children}
    </DashboardContext.Provider>
  );
};
