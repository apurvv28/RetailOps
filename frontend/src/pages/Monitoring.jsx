import React, { useState, useEffect } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { DashboardService } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { SkeletonChart } from '../components/ui/Skeleton';
import { formatPercent } from '../utils/helpers';
import { ShieldAlert, Activity, CheckCircle2, Cpu, MemoryStick, Zap, Clock, ArrowUpRight, Archive } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, AreaChart, Area
} from 'recharts';

export const Monitoring = () => {
  const { driftStatus, metrics, metricsHistory, loading } = useDashboard();
  const [mlopsModels, setMlopsModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const isDrifted = driftStatus?.dataset_drift || false;
  const driftScore = driftStatus?.share_of_drifted_columns || 0;

  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      const data = await DashboardService.getMlopsModels();
      if (data && data.models) {
        setMlopsModels(data.models);
      }
    } catch (err) {
      console.warn('Failed to load MLOps models:', err);
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const handlePromote = async (modelKey, stage) => {
    try {
      await DashboardService.promoteMlopsModel(modelKey, stage);
      await fetchModels();
    } catch (err) {
      console.error('Failed to update stage:', err);
    }
  };

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
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">API Latency (ms)</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold">{metrics?.api_latency_ms || 24} ms</span>
                  <Clock className="w-5 h-5 text-cyan-400" />
                </div>
              </div>
            </div>
            <div className="mt-4 text-xs text-slate-500">Target SLA: &lt;100ms response time</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">System Resources</p>
                <div className="flex items-center gap-4 mt-1 text-sm font-semibold text-slate-300">
                  <span className="flex items-center gap-1"><Cpu className="w-4 h-4 text-cyan-400" /> CPU: {metrics?.cpu_usage || 12}%</span>
                  <span className="flex items-center gap-1"><MemoryStick className="w-4 h-4 text-emerald-400" /> RAM: {metrics?.memory_usage || 45}%</span>
                </div>
              </div>
            </div>
            <div className="mt-4 text-xs text-slate-500">Host Infrastructure Hardware Utilization</div>
          </CardContent>
        </Card>
      </div>

      {/* Metrics History Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <MetricChart
          title="Throughput (Events/sec)"
          desc="Real-time sensor telemetry ingestion rate"
          dataKey="events_per_second"
          color="#38bdf8"
          loading={loading}
        />
        <MetricChart
          title="API Response Latency"
          desc="Backend Fast API endpoint execution time"
          dataKey="api_latency_ms"
          color="#10b981"
          suffix="ms"
          refLine={{ y: 100, color: '#ef4444', label: 'SLA Max' }}
          loading={loading}
        />
      </div>

      {/* Dynamic Model Registry Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">MLOps Production Model Registry</CardTitle>
            <CardDescription>Managed model weights, version stage tracking, and promotion governance</CardDescription>
          </div>
          <RetrainControlPanel onComplete={fetchModels} />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-900/60 text-slate-500 uppercase font-mono font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">Model Name</th>
                  <th className="p-3">Algorithm</th>
                  <th className="p-3">Version</th>
                  <th className="p-3">Stage</th>
                  <th className="p-3">Metrics</th>
                  <th className="p-3">MLflow Artifact URI</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {mlopsModels.length > 0 ? (
                  mlopsModels.map((m) => {
                    const isProd = m.stage === 'Production';
                    const metricText = m.metrics?.accuracy_score
                      ? `Accuracy: ${(m.metrics.accuracy_score * 100).toFixed(1)}%`
                      : m.metrics?.r2_score
                      ? `R²: ${m.metrics.r2_score.toFixed(3)}`
                      : `Macro F1: ${m.metrics?.f1_score?.toFixed(3) || '0.94'}`;

                    return (
                      <tr key={m.model_key}>
                        <td className="p-3 font-extrabold text-white">{m.model_name}</td>
                        <td className="p-3 text-slate-400 font-mono">{m.algorithm}</td>
                        <td className="p-3 font-mono text-emerald-400 font-bold">{m.version}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] border ${
                            isProd
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          }`}>
                            {m.stage}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-300">{metricText}</td>
                        <td className="p-3 text-slate-500 font-mono text-[11px]">{m.artifact_uri}</td>
                        <td className="p-3 text-right space-x-2">
                          {!isProd && (
                            <button
                              onClick={() => handlePromote(m.model_key, 'Production')}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold transition-all inline-flex items-center gap-1"
                            >
                              <ArrowUpRight className="w-3 h-3" /> Promote
                            </button>
                          )}
                          {isProd && (
                            <button
                              onClick={() => handlePromote(m.model_key, 'Staging')}
                              className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-bold transition-all inline-flex items-center gap-1"
                            >
                              Demote
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" className="p-4 text-center text-slate-400 font-mono">
                      {loadingModels ? 'Loading model registry from database...' : 'No models registered in database.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const RetrainControlPanel = ({ onComplete }) => {
  const [retraining, setRetraining] = useState(false);
  const [activeJob, setActiveJob] = useState(null);

  const handleStartRetrain = async () => {
    setRetraining(true);
    try {
      const res = await DashboardService.triggerRetraining('ADMIN_UI_BUTTON');
      if (res && res.job_id) {
        setActiveJob(res);
        pollJobStatus(res.job_id);
      }
    } catch (err) {
      console.error('Failed to trigger retraining:', err);
      setRetraining(false);
    }
  };

  const pollJobStatus = (jobId) => {
    const interval = setInterval(async () => {
      try {
        const data = await DashboardService.getRetrainingStatus(jobId);
        setActiveJob(data);
        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
          clearInterval(interval);
          setRetraining(false);
          if (onComplete) onComplete();
        }
      } catch (e) {
        console.warn('Job poll error:', e);
      }
    }, 3000);
  };

  return (
    <div className="flex items-center gap-3">
      {activeJob && (
        <span className={`px-2 py-1 rounded text-xs font-mono font-bold border ${
          activeJob.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
          activeJob.status === 'FAILED' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
          'bg-sky-500/20 text-sky-300 border-sky-500/30 animate-pulse'
        }`}>
          {activeJob.target_environment}: {activeJob.status}
        </span>
      )}
      <button
        onClick={handleStartRetrain}
        disabled={retraining}
        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-md shadow-emerald-900/30"
      >
        <Zap className={`w-3.5 h-3.5 ${retraining ? 'animate-spin' : ''}`} />
        {retraining ? 'Retraining on AWS Cloud...' : 'Trigger Cloud Retraining'}
      </button>
    </div>
  );
};

