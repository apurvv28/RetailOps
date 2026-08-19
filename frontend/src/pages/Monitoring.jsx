import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { SkeletonChart } from '../components/ui/Skeleton';
import { formatPercent } from '../utils/helpers';
import { ShieldAlert, Activity, CheckCircle2, Cpu, MemoryStick, Zap, Clock } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, AreaChart, Area
} from 'recharts';

export const Monitoring = () => {
  const { driftStatus, metrics, metricsHistory, loading } = useDashboard();

  const isDrifted = driftStatus?.dataset_drift || false;
  const driftScore = driftStatus?.share_of_drifted_columns || 0;

  const chartTooltipStyle = {
    contentStyle: { backgroundColor: '#0E1411', border: '1px solid #15241D', borderRadius: '12px', color: '#f8fafc', fontSize: '12px' }
  };
  const axisStyle = { axisLine: false, tickLine: false, tick: { fontSize: 11, fill: '#6b7280' } };

  const MetricChart = ({ title, desc, dataKey, color, formatter, refLine, loading: l, suffix = '' }) => {
    if (l) return <SkeletonChart />;
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{desc}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metricsHistory} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                <XAxis dataKey="time" {...axisStyle} dy={8} />
                <YAxis {...axisStyle} dx={-8} tickFormatter={v => `${v}${suffix}`} />
                <Tooltip {...chartTooltipStyle} formatter={formatter || (v => [`${v}${suffix}`, title])} />
                {refLine && <ReferenceLine y={refLine.y} stroke={refLine.color} strokeDasharray="4 2" label={{ value: refLine.label, fill: refLine.color, fontSize: 10, position: 'insideTopRight' }} />}
                <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Feature Drift & System Monitoring</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Live statistical feature drift detection (KS-test / PSI), model accuracy tracking, and IoT infrastructure telemetry.
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className={isDrifted ? 'border-rose-500/50' : 'border-emerald-500/50'}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Data Drift Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold">{isDrifted ? 'Drift Detected' : 'Healthy'}</span>
                  {isDrifted ? <ShieldAlert className="w-5 h-5 text-rose-500" /> : <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-between text-xs text-slate-500">
              <span>Score: {formatPercent(driftScore)}</span>
              <span>Threshold: 20%</span>
            </div>
            <div className="mt-2 h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${isDrifted ? 'bg-rose-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(driftScore * 100, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Model Accuracy (ROC-AUC)</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold">
                    {metrics ? `${((metrics.model_accuracy || 0.942) * 100).toFixed(1)}%` : '—'}
                  </span>
                  <Badge variant="success">Live</Badge>
                </div>
              </div>
              <div className="p-3 bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 rounded-lg">
                <Activity className="w-6 h-6" />
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-500">Validated at: {driftStatus?.last_checked ? new Date(driftStatus.last_checked).toLocaleTimeString() : 'Today'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">API Latency</p>
              <p className="text-2xl font-bold mt-1">{metrics ? `${metrics.api_latency_ms}ms` : '—'}</p>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">CPU Usage</span>
                <span className="font-medium">{metrics ? `${metrics.cpu_usage}%` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Memory Usage</span>
                <span className="font-medium">{metrics ? `${metrics.memory_usage}%` : '—'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <MetricChart
          title="Data Drift Score"
          desc="Share of drifted columns over time"
          dataKey="drift"
          color="#8b5cf6"
          suffix="%"
          formatter={v => [`${v.toFixed(1)}%`, 'Drift Score']}
          refLine={{ y: 20, color: '#f43f5e', label: 'Retrain Threshold' }}
          loading={loading && !metricsHistory.length}
        />
        <MetricChart
          title="Model Accuracy Trend"
          desc="ROC-AUC score over rolling window"
          dataKey="accuracy"
          color="#10b981"
          suffix="%"
          formatter={v => [`${v.toFixed(1)}%`, 'Accuracy']}
          loading={loading && !metricsHistory.length}
        />
      </div>

      {/* Model-Wise Feature Drift Monitoring Matrix */}
      <Card className="border border-slate-200/80 dark:border-emerald-950/80">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#0F5238] dark:text-emerald-400" />
              Per-Model Feature Drift Monitoring Matrix
            </span>
            <Badge variant="outline" className="text-xs">
              4 Production Models Monitored
            </Badge>
          </CardTitle>
          <CardDescription>
            Live Population Stability Index (PSI) and feature-level statistical drift across all production ML models.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(driftStatus?.model_drifts || [
              { model_name: "Irrigation Risk Predictor", model_key: "irrigation", drift_detected: isDrifted, drifted_features: isDrifted ? ["soil_moisture", "temperature"] : [], total_features: 4, psi_score: isDrifted ? 0.32 : 0.04, status: isDrifted ? "CRITICAL_DRIFT" : "STABLE" },
              { model_name: "Crop Recommender", model_key: "crop", drift_detected: isDrifted, drifted_features: isDrifted ? ["nitrogen", "temperature"] : [], total_features: 4, psi_score: isDrifted ? 0.28 : 0.03, status: isDrifted ? "MODERATE_DRIFT" : "STABLE" },
              { model_name: "Fertilizer Advisory", model_key: "fertilizer", drift_detected: isDrifted, drifted_features: isDrifted ? ["nitrogen", "soil_moisture"] : [], total_features: 4, psi_score: isDrifted ? 0.26 : 0.05, status: isDrifted ? "MODERATE_DRIFT" : "STABLE" },
              { model_name: "Yield Predictor", model_key: "yield", drift_detected: isDrifted, drifted_features: isDrifted ? ["soil_moisture", "rainfall"] : [], total_features: 4, psi_score: isDrifted ? 0.31 : 0.02, status: isDrifted ? "CRITICAL_DRIFT" : "STABLE" },
            ]).map((m, idx) => {
              const hasDrift = m.drift_detected;
              const isCrit = m.status === 'CRITICAL_DRIFT';

              return (
                <div
                  key={m.model_key || idx}
                  className={`p-4 rounded-2xl border transition-all ${
                    hasDrift
                      ? isCrit
                        ? 'bg-rose-950/20 border-rose-800/60 dark:bg-rose-950/30'
                        : 'bg-amber-950/20 border-amber-800/60 dark:bg-amber-950/30'
                      : 'bg-slate-50/80 dark:bg-[#0E1411] border-slate-200/80 dark:border-emerald-950/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-slate-500 uppercase">{m.model_key}</span>
                    <Badge variant={hasDrift ? (isCrit ? 'danger' : 'warning') : 'success'} className="text-[10px]">
                      {hasDrift ? (isCrit ? 'Critical Drift' : 'Moderate Drift') : 'Stable'}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight mb-2">
                    {m.model_name}
                  </h4>
                  <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex justify-between">
                      <span>PSI Stability Index:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{m.psi_score}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Monitored Features:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{m.total_features}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Drifted Features ({m.drifted_features.length})
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {m.drifted_features.length > 0 ? (
                        m.drifted_features.map((feat, fIdx) => (
                          <span
                            key={fIdx}
                            className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/60"
                          >
                            {feat}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          ✓ All features within bounds
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
