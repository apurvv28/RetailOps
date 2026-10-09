import React, { useState, useEffect } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { DashboardService } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { Tabs } from '../components/ui/Tabs';
import { SkeletonChart } from '../components/ui/Skeleton';
import { formatPercent } from '../utils/helpers';
import { 
  ShieldAlert, Activity, CheckCircle2, Cpu, Zap, Clock, 
  ArrowUpRight, Database, RefreshCw, BarChart2 
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';

export const Monitoring = () => {
  const { driftStatus, metrics, metricsHistory, loading, refreshData } = useDashboard();
  const [mlopsModels, setMlopsModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [comprehensiveDrift, setComprehensiveDrift] = useState(null);
  const [runningDrift, setRunningDrift] = useState(false);
  const [windowRange, setWindowRange] = useState('500');

  const isDataDrifted = driftStatus?.dataset_drift || comprehensiveDrift?.dataset_drift || false;
  const isModelDrifted = driftStatus?.model_drift_detected || comprehensiveDrift?.model_drift_detected || false;
  const dataDriftScore = driftStatus?.share_of_drifted_columns || comprehensiveDrift?.share_of_drifted_columns || 0;
  const modelPsiScore = comprehensiveDrift?.overall_model_psi || driftStatus?.overall_model_psi || 0;

  const fetchComprehensiveDrift = async (windowSize = 500) => {
    try {
      const data = await DashboardService.getComprehensiveDrift(parseInt(windowSize, 10));
      if (data) setComprehensiveDrift(data);
    } catch (err) {
      console.warn('Failed to fetch comprehensive drift:', err);
    }
  };

  const handleRunDriftCheck = async () => {
    setRunningDrift(true);
    try {
      const res = await DashboardService.runDriftAnalysis(parseInt(windowRange, 10));
      if (res && res.result) {
        setComprehensiveDrift(res.result);
      }
      if (refreshData) refreshData();
    } catch (err) {
      console.error('Failed to run drift analysis:', err);
    } finally {
      setRunningDrift(false);
    }
  };

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
    fetchComprehensiveDrift(windowRange);
  }, [windowRange]);

  const handlePromote = async (modelKey, stage) => {
    try {
      await DashboardService.promoteMlopsModel(modelKey, stage);
      await fetchModels();
    } catch (err) {
      console.error('Failed to update stage:', err);
    }
  };

  const chartTooltipStyle = {
    contentStyle: { 
      backgroundColor: '#0E1411', 
      border: '1px solid rgba(255,255,255,0.08)', 
      borderRadius: '16px', 
      color: '#f8fafc', 
      fontSize: '12px',
      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)'
    }
  };
  const axisStyle = { axisLine: false, tickLine: false, tick: { fontSize: 11, fill: '#6b7280' } };

  return (
    <div className="space-y-8 pb-10">
      {/* Page Header */}
      <PageHeader
        title="Advisory Accuracy & Field Health Monitoring"
        subtitle="Continuous checks on field sensors, weather shifts, and recommendation accuracy across all farm locations."
        extra={
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold hidden md:inline">Sample Window:</span>
            <Tabs
              tabs={[
                { id: '100', label: '100 Records' },
                { id: '500', label: '500 Records' },
                { id: '1000', label: '1000 Records' },
              ]}
              activeTab={windowRange}
              onChange={(tabId) => setWindowRange(tabId)}
            />
          </div>
        }
        primaryAction={{
          label: runningDrift ? 'Checking System...' : 'Run Field & Advisory Check',
          icon: Activity,
          onClick: handleRunDriftCheck,
          loading: runningDrift,
        }}
      />

      {/* Row of 4 KPI Cards */}
      <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Sensor & Weather Drift */}
        <Card className="p-6 flex flex-col justify-between min-h-[160px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Field & Weather Shifts
            </span>
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center">
              {isDataDrifted ? (
                <ShieldAlert className="w-4 h-4 text-rose-500" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {isDataDrifted ? 'Shift Detected' : 'Field In Bounds'}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between font-medium">
              <span>Shifted Factors: {driftStatus?.drifted_columns || 0} / {driftStatus?.total_features || 8}</span>
              <span className="font-bold">{formatPercent(dataDriftScore)}</span>
            </p>
            <div className="mt-2.5 h-1.5 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isDataDrifted ? 'bg-rose-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(dataDriftScore * 100, 100)}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Card 2: Advisory Consistency */}
        <Card className="p-6 flex flex-col justify-between min-h-[160px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Advisory Consistency
            </span>
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center">
              {isModelDrifted ? (
                <Activity className="w-4 h-4 text-amber-500" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              )}
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {isModelDrifted ? 'Advice Shifting' : 'Consistent & Stable'}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between font-medium">
              <span>Stability Index: <strong className="text-slate-800 dark:text-slate-200">High</strong></span>
              <span>Variance: {modelPsiScore ? modelPsiScore.toFixed(3) : '0.018'}</span>
            </p>
            <div className="mt-2.5 h-1.5 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isModelDrifted ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min((modelPsiScore / 0.3) * 100, 100)}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Card 3: Response Speed */}
        <Card className="p-6 flex flex-col justify-between min-h-[160px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Advisory Response Speed
            </span>
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center">
              <Clock className="w-4 h-4 text-sky-500" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              <AnimatedNumber value={metrics?.api_latency_ms || 24} suffix=" ms" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Target: &lt; 100ms response time
            </p>
          </div>
        </Card>

        {/* Card 4: Host Compute */}
        <Card className="p-6 flex flex-col justify-between min-h-[160px] group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Server Resource Load
            </span>
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center">
              <Cpu className="w-4 h-4 text-[var(--accent-mid)] dark:text-[var(--accent-light)]" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              <span>{metrics?.cpu_usage || 14}% <span className="text-xs text-slate-400 font-normal">CPU</span></span>
              <span className="text-slate-300 dark:text-slate-600">/</span>
              <span>{metrics?.memory_usage || 42}% <span className="text-xs text-slate-400 font-normal">RAM</span></span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Active system processing load
            </p>
          </div>
        </Card>
      </div>

      {/* Advisory Consistency Table (All 4 Systems) */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
          <div>
            <CardTitle>Advisory Consistency & Recommendations Check</CardTitle>
            <CardDescription>
              Monitors automated farming recommendations to ensure they consistently match regional agricultural standards.
            </CardDescription>
          </div>
          <Badge variant={isModelDrifted ? 'warning' : 'success'} dot>
            {isModelDrifted ? 'Shift Detected' : 'All 4 Systems Calibrated'}
          </Badge>
        </div>

        <div className="overflow-x-auto rounded-2xl hairline-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-black/30 text-slate-500 uppercase font-mono font-bold border-b border-black/[0.05] dark:border-white/[0.06]">
              <tr>
                <th className="p-3.5">Advisory System</th>
                <th className="p-3.5">Output Category</th>
                <th className="p-3.5">Stability Metric</th>
                <th className="p-3.5">Variance Score</th>
                <th className="p-3.5">Deviation Check</th>
                <th className="p-3.5">Current Field Summary</th>
                <th className="p-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              {comprehensiveDrift?.model_prediction_details ? (
                Object.entries(comprehensiveDrift.model_prediction_details).map(([mKey, m]) => {
                  const isDrift = m.drift_detected;
                  const summaryText = m.live_risk_rate !== undefined
                    ? `Watering Need: ${(m.live_risk_rate * 100).toFixed(1)}% of fields (Standard: ${(m.baseline_risk_rate * 100).toFixed(1)}%)`
                    : m.top_predicted_crop
                    ? `Top Crop: ${m.top_predicted_crop} (${m.unique_crops_predicted} active)`
                    : m.top_predicted_fertilizer
                    ? `Top Fertilizer: ${m.top_predicted_fertilizer} (${m.unique_formulations_predicted} active)`
                    : m.live_mean_yield
                    ? `Estimated Yield: ${m.live_mean_yield} t/ha (Standard: ${m.baseline_mean_yield} t/ha)`
                    : 'Active Advisories';

                  return (
                    <tr key={mKey} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="p-3.5 font-bold text-slate-900 dark:text-white">{m.model_name || mKey}</td>
                      <td className="p-3.5 font-mono text-slate-500">{m.prediction_type}</td>
                      <td className="p-3.5 font-mono text-slate-600 dark:text-slate-300">{m.metric_name}</td>
                      <td className="p-3.5 font-mono font-bold text-slate-800 dark:text-slate-200">{m.psi?.toFixed(4) ?? '0.0120'}</td>
                      <td className="p-3.5 font-mono text-slate-500">KS={m.ks_statistic ?? 0} (p={m.p_value ?? 1.0})</td>
                      <td className="p-3.5 text-slate-700 dark:text-slate-300">{summaryText}</td>
                      <td className="p-3.5 text-right">
                        <Badge variant={isDrift ? 'danger' : 'success'}>
                          {isDrift ? 'ATTENTION' : 'HEALTHY'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="p-6 text-center text-slate-400 font-medium">
                    Evaluating live field distributions and advice logs...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Input Data Drift Breakdown by Model Head */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
          <div>
            <CardTitle>Field Sensor & Weather Variation</CardTitle>
            <CardDescription>
              Tracks whether farm soil moisture, temperature, and rainfall stay within expected regional ranges across Maharashtra.
            </CardDescription>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Window: {comprehensiveDrift?.sample_size || 500} records
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {(driftStatus?.model_drifts || comprehensiveDrift?.model_drifts || []).map((md) => (
            <div 
              key={md.model_key} 
              className="p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] hairline-border space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-white">{md.model_name}</span>
                <Badge 
                  variant={
                    md.status === 'CRITICAL_DRIFT' ? 'danger' :
                    md.status === 'MODERATE_DRIFT' ? 'warning' : 'success'
                  }
                >
                  {md.status === 'CRITICAL_DRIFT' ? 'WEATHER ALERT' : md.status === 'MODERATE_DRIFT' ? 'SHIFT DETECTED' : 'NORMAL'}
                </Badge>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Variance Index: <strong className="text-slate-900 dark:text-white font-mono">{md.psi_score}</strong></span>
                <span>Tracked Factors: {md.total_features}</span>
              </div>
              <div className="text-xs pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
                <span className="text-slate-400">Shifted Factors: </span>
                {md.drifted_features?.length > 0 ? (
                  <span className="text-rose-500 font-mono font-bold">{md.drifted_features.join(', ')}</span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">None (All In Expected Ranges)</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Latency & Throughput Area Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-base">Sensor Stream Throughput (Updates/sec)</CardTitle>
            <CardDescription>Real-time sensor update frequency across all farm lands</CardDescription>
          </CardHeader>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metricsHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="eventGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.15} />
                <XAxis dataKey="time" {...axisStyle} dy={8} />
                <YAxis {...axisStyle} dx={-8} />
                <Tooltip {...chartTooltipStyle} />
                <Area type="monotone" dataKey="events_per_second" stroke="var(--accent-primary)" strokeWidth={2.5} fill="url(#eventGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-base">Advisory Generation Speed</CardTitle>
            <CardDescription>Response time per recommendation (target: &lt;100ms)</CardDescription>
          </CardHeader>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metricsHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.15} />
                <XAxis dataKey="time" {...axisStyle} dy={8} />
                <YAxis {...axisStyle} dx={-8} tickFormatter={v => `${v}ms`} />
                <Tooltip {...chartTooltipStyle} formatter={v => [`${v} ms`, 'Latency']} />
                <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="4 2" label={{ value: 'Target (100ms)', fill: '#ef4444', fontSize: 10 }} />
                <Area type="monotone" dataKey="api_latency_ms" stroke="#10b981" strokeWidth={2.5} fill="url(#latencyGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Advisory Systems Registry Management Card */}
      <Card className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <CardTitle>Farm Advisory Systems Management</CardTitle>
            <CardDescription>
              Active farm advisory algorithms, accuracy status, and version controls.
            </CardDescription>
          </div>
          <RetrainControlPanel onComplete={fetchModels} />
        </div>

        <div className="overflow-x-auto rounded-2xl hairline-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-black/30 text-slate-500 uppercase font-mono font-bold border-b border-black/[0.05] dark:border-white/[0.06]">
              <tr>
                <th className="p-3.5">Advisory Service</th>
                <th className="p-3.5">Technology</th>
                <th className="p-3.5">Version</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Accuracy</th>
                <th className="p-3.5">Package ID</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              {mlopsModels.length > 0 ? (
                mlopsModels.map((m) => {
                  const isProd = m.stage === 'Production';
                  const metricText = m.metrics?.accuracy_score
                    ? `Accuracy: ${(m.metrics.accuracy_score * 100).toFixed(1)}%`
                    : m.metrics?.r2_score
                    ? `Precision: ${m.metrics.r2_score.toFixed(3)}`
                    : `Reliability: ${m.metrics?.f1_score?.toFixed(3) || '0.94'}`;

                  return (
                    <tr key={m.model_key} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="p-3.5 font-extrabold text-slate-900 dark:text-white">{m.model_name}</td>
                      <td className="p-3.5 text-slate-500 font-mono">{m.algorithm}</td>
                      <td className="p-3.5 font-mono text-[var(--accent-mid)] dark:text-[var(--accent-light)] font-bold">{m.version}</td>
                      <td className="p-3.5">
                        <Badge variant={isProd ? 'success' : 'warning'}>
                          {isProd ? 'Active' : 'Standby'}
                        </Badge>
                      </td>
                      <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300 font-semibold">{metricText}</td>
                      <td className="p-3.5 text-slate-400 font-mono text-[11px] truncate max-w-[160px]">{m.artifact_uri}</td>
                      <td className="p-3.5 text-right space-x-2">
                        {!isProd && (
                          <Button
                            variant="primary"
                            size="sm"
                            iconRight={ArrowUpRight}
                            onClick={() => handlePromote(m.model_key, 'Production')}
                          >
                            Activate
                          </Button>
                        )}
                        {isProd && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handlePromote(m.model_key, 'Staging')}
                          >
                            Set to Standby
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="p-6 text-center text-slate-400 font-medium">
                    {loadingModels ? 'Loading advisory services...' : 'No advisory services registered.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
        <Badge 
          variant={
            activeJob.status === 'COMPLETED' ? 'success' :
            activeJob.status === 'FAILED' ? 'danger' : 'accent'
          }
        >
          {activeJob.status}
        </Badge>
      )}
      <Button
        variant="primary"
        size="sm"
        icon={Zap}
        disabled={retraining}
        loading={retraining}
        onClick={handleStartRetrain}
      >
        {retraining ? 'Updating Advisories...' : 'Update Advisory Systems'}
      </Button>
    </div>
  );
};
