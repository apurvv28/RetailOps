import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { SkeletonCard } from '../components/ui/Skeleton';
import { StatusDot } from '../components/ui/StatusDot';
import { formatNumber, formatPercent, formatDate } from '../utils/helpers';
import {
  Box, AlertTriangle, TrendingUp, ShieldCheck, Activity,
  Server, Clock, RefreshCw, Zap, Database, Radio, Cpu
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';

export const Overview = () => {
  const { predictions, alerts, stats, driftStatus, systemHealth, metrics, metricsHistory, rawEvents, loading, lastRefreshed, refreshData } = useDashboard();

  const riskDistribution = [
    { name: 'High Risk', value: stats.highRiskCount, color: '#f43f5e' },
    { name: 'Medium Risk', value: stats.mediumRiskCount, color: '#f59e0b' },
    { name: 'Low Risk', value: stats.lowRiskCount, color: '#10b981' },
  ];

  const trendData = metricsHistory.length > 0
    ? metricsHistory.map(m => ({ time: m.time, riskScore: m.events }))
    : [];

  const StatCard = ({ title, value, subtitle, icon: Icon, colorClass }) => {
    if (loading && value === '—') return <SkeletonCard />;
    return (
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between pb-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{title}</p>
            <div className={`p-1.5 rounded-lg ${colorClass}`}>
              <Icon className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">{value}</span>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
        </CardContent>
      </Card>
    );
  };

  const healthItems = [
    { label: 'Kafka Broker', key: 'kafka_broker' },
    { label: 'Producer', key: 'kafka_producer' },
    { label: 'Consumer', key: 'kafka_consumer' },
    { label: 'FastAPI', key: 'fastapi' },
    { label: 'CockroachDB', key: 'cockroachdb' },
  ];

  const lastPredTime = predictions.length > 0 ? formatDate(predictions[0]?.timestamp) : '—';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
          <p className="text-slate-500 dark:text-slate-400">Real-time retail intelligence — polling every 3s</p>
        </div>
        <button onClick={refreshData} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Row 1 — Primary KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Incoming Transactions" value={formatNumber(rawEvents.length)} subtitle="Events received today" icon={Radio} colorClass="bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400" />
        <StatCard title="Predictions Today" value={formatNumber(stats.todayCount)} subtitle="ML predictions generated" icon={Activity} colorClass="bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400" />
        <StatCard title="High Risk Products" value={formatNumber(stats.highRiskCount)} subtitle="Immediate action required" icon={AlertTriangle} colorClass="bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400" />
        <StatCard title="Today's Alerts" value={formatNumber(stats.weekAlerts)} subtitle="Automated dispatches" icon={TrendingUp} colorClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" />
      </div>

      {/* Row 2 — Secondary KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <StatCard title="Medium Risk" value={formatNumber(stats.mediumRiskCount)} subtitle="Schedule restock" icon={ShieldCheck} colorClass="bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400" />
        <StatCard title="Low Risk" value={formatNumber(stats.lowRiskCount)} subtitle="Healthy inventory" icon={ShieldCheck} colorClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" />
        <StatCard title="Model Version" value={predictions[0]?.model_version || '—'} subtitle="Active in production" icon={Box} colorClass="bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400" />
        <StatCard title="Model Accuracy" value={metrics ? `${((metrics.model_accuracy || 0.942) * 100).toFixed(1)}%` : '—'} subtitle="ROC-AUC" icon={TrendingUp} colorClass="bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400" />
        <StatCard title="Current Drift" value={metrics ? formatPercent(metrics.drift_score) : (driftStatus ? formatPercent(driftStatus.share_of_drifted_columns) : '—')} subtitle={driftStatus?.dataset_drift ? 'Drift Detected' : 'Stable'} icon={ShieldCheck} colorClass="bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400" />
      </div>

      {/* Row 3 — System Health + Live Counters + Risk Chart */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* System Health */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-slate-500" />
              <CardTitle>System Health</CardTitle>
            </div>
            <CardDescription>Real-time service status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {healthItems.map(({ label, key }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
                <StatusDot active={systemHealth ? systemHealth[key] : true} label={systemHealth ? (systemHealth[key] ? 'Connected' : 'Offline') : '...'} />
              </div>
            ))}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Last Prediction</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{lastPredTime}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Last Refreshed</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{lastRefreshed.toLocaleTimeString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Event Counters */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-sky-500" />
              <CardTitle>Live Counters</CardTitle>
            </div>
            <CardDescription>Kafka streaming metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Events / sec', value: metrics?.events_per_second ?? '—', color: 'text-sky-500' },
              { label: 'Processed / sec', value: metrics?.processed_per_second ?? '—', color: 'text-emerald-500' },
              { label: 'Kafka Queue Size', value: formatNumber(metrics?.kafka_queue_size ?? 0), color: 'text-amber-500' },
              { label: 'Pending Messages', value: formatNumber(metrics?.pending_messages ?? 0), color: 'text-violet-500' },
              { label: 'Consumer Lag', value: formatNumber(metrics?.consumer_lag ?? 0), color: 'text-rose-500' },
              { label: 'API Latency', value: metrics ? `${metrics.api_latency_ms}ms` : '—', color: 'text-indigo-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
                <span className={`text-lg font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Risk Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Distribution</CardTitle>
            <CardDescription>Live prediction categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[230px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskDistribution} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#374151" opacity={0.2} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '8px', color: '#f8fafc' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={28}>
                    {riskDistribution.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 4 — Trend Chart */}
      {trendData.length > 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Kafka Throughput Trend</CardTitle>
            <CardDescription>Events per second — rolling 20-point window, auto-updating</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dx={-10} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '8px', color: '#f8fafc' }} />
                  <Area type="monotone" dataKey="riskScore" name="Events/sec" stroke="#0ea5e9" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRisk)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
