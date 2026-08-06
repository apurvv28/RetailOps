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
    contentStyle: { backgroundColor: '#111827', border: 'none', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }
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
        <h1 className="text-2xl font-bold tracking-tight">System Monitoring</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Live model performance, data drift detection, and infrastructure telemetry.
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
        <MetricChart
          title="API Latency"
          desc="FastAPI /predict response time (ms)"
          dataKey="latency"
          color="#f59e0b"
          suffix="ms"
          formatter={v => [`${v}ms`, 'Latency']}
          loading={loading && !metricsHistory.length}
        />
        <MetricChart
          title="Kafka Throughput"
          desc="Incoming events per second"
          dataKey="events"
          color="#0ea5e9"
          suffix="/s"
          formatter={v => [`${v}/s`, 'Events']}
          loading={loading && !metricsHistory.length}
        />
        <MetricChart
          title="CPU Usage"
          desc="System CPU utilisation (%)"
          dataKey="cpu"
          color="#f43f5e"
          suffix="%"
          formatter={v => [`${v.toFixed(1)}%`, 'CPU']}
          loading={loading && !metricsHistory.length}
        />
        <MetricChart
          title="Memory Usage"
          desc="System memory utilisation (%)"
          dataKey="memory"
          color="#6366f1"
          suffix="%"
          formatter={v => [`${v.toFixed(1)}%`, 'Memory']}
          loading={loading && !metricsHistory.length}
        />
      </div>
    </div>
  );
};
