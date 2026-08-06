import React, { useState, useEffect } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { StatusDot } from '../components/ui/StatusDot';
import {
  Database, Server, Cpu, ArrowDown, Activity, Layers, Box, Radio, HardDrive, LayoutDashboard, CheckCircle2
} from 'lucide-react';

const PIPELINE_STAGES = [
  { id: 'dataset', label: 'Retail Dataset', sublabel: 'Online Retail II / Live Kafka', icon: Database, color: 'text-violet-500', bg: 'bg-violet-100 dark:bg-violet-500/20', animLabel: 'Receiving Transaction…' },
  { id: 'producer', label: 'Kafka Producer', sublabel: 'Publishing to retail-events-raw', icon: Radio, color: 'text-sky-500', bg: 'bg-sky-100 dark:bg-sky-500/20', animLabel: 'Publishing to Kafka…' },
  { id: 'topic_in', label: 'retail-events-raw', sublabel: 'Kafka Topic (partitioned)', icon: Layers, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-500/20', animLabel: 'Topic Receiving…' },
  { id: 'consumer', label: 'Kafka Consumer', sublabel: 'Event processor group', icon: Server, color: 'text-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-500/20', animLabel: 'Consumer Processing…' },
  { id: 'fastapi', label: 'FastAPI /predict', sublabel: 'POST prediction endpoint', icon: Activity, color: 'text-rose-500', bg: 'bg-rose-100 dark:bg-rose-500/20', animLabel: 'Calling Prediction API…' },
  { id: 'model', label: 'ML Model', sublabel: 'XGBoost + SHAP explainer', icon: Cpu, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-500/20', animLabel: 'Generating Prediction…' },
  { id: 'db', label: 'CockroachDB', sublabel: 'Persisting prediction', icon: HardDrive, color: 'text-sky-500', bg: 'bg-sky-100 dark:bg-sky-500/20', animLabel: 'Saving to Database…' },
  { id: 'topic_out', label: 'retail-predictions', sublabel: 'Kafka output topic', icon: Box, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-500/20', animLabel: 'Publishing Prediction…' },
  { id: 'dashboard', label: 'Dashboard', sublabel: 'Real-time UI polling', icon: LayoutDashboard, color: 'text-violet-500', bg: 'bg-violet-100 dark:bg-violet-500/20', animLabel: 'Dashboard Updated ✓' },
];

export const Pipeline = () => {
  const { isPipelineActive, metrics, systemHealth } = useDashboard();
  const [activeStage, setActiveStage] = useState(null);
  const [completedStages, setCompletedStages] = useState(new Set());
  const [runningAnimation, setRunningAnimation] = useState(false);

  const runAnimation = () => {
    if (runningAnimation) return;
    setRunningAnimation(true);
    setCompletedStages(new Set());
    let idx = 0;
    const advance = () => {
      setActiveStage(idx);
      idx++;
      if (idx <= PIPELINE_STAGES.length) {
        setCompletedStages(prev => new Set([...prev, idx - 2]));
        setTimeout(advance, 320);
      } else {
        setTimeout(() => {
          setActiveStage(null);
          setCompletedStages(new Set(PIPELINE_STAGES.map((_, i) => i)));
          setTimeout(() => { setCompletedStages(new Set()); setRunningAnimation(false); }, 1500);
        }, 400);
      }
    };
    advance();
  };

  useEffect(() => {
    if (isPipelineActive && !runningAnimation) runAnimation();
  }, [isPipelineActive]);

  const healthMap = {
    dataset: true, producer: systemHealth?.kafka_producer ?? true, topic_in: systemHealth?.kafka_broker ?? true,
    consumer: systemHealth?.kafka_consumer ?? true, fastapi: systemHealth?.fastapi ?? true, model: systemHealth?.fastapi ?? true,
    db: systemHealth?.cockroachdb ?? true, topic_out: systemHealth?.kafka_broker ?? true, dashboard: true,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Pipeline</h1>
          <p className="text-slate-500 dark:text-slate-400">End-to-end data flow — animates when transactions are processed</p>
        </div>
        <button onClick={runAnimation} disabled={runningAnimation} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-sky-500 hover:bg-sky-600 disabled:bg-sky-400 text-white rounded-lg transition-colors">
          <Activity className={`w-4 h-4 ${runningAnimation ? 'animate-spin' : ''}`} />
          {runningAnimation ? 'Processing…' : 'Simulate Event'}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pipeline Flow */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-0">
                {PIPELINE_STAGES.map((stage, idx) => {
                  const Icon = stage.icon;
                  const isActive = activeStage === idx;
                  const isCompleted = completedStages.has(idx);
                  const isHealthy = healthMap[stage.id];

                  return (
                    <React.Fragment key={stage.id}>
                      <div className={`
                        relative flex items-center gap-4 w-full max-w-lg px-5 py-3.5 rounded-xl border-2 transition-all duration-300
                        ${isActive
                          ? `border-sky-500 shadow-lg shadow-sky-500/20 ${stage.bg} scale-[1.02]`
                          : isCompleted
                            ? 'border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-500/5'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]'
                        }
                      `}>
                        <div className={`w-10 h-10 rounded-lg ${stage.bg} flex items-center justify-center flex-shrink-0 transition-all duration-300 ${isActive ? 'scale-110' : ''}`}>
                          <Icon className={`w-5 h-5 ${stage.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{stage.label}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {isActive ? stage.animLabel : stage.sublabel}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <StatusDot active={isHealthy} />
                          {isCompleted && (
                            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                        {isActive && (
                          <div className="absolute inset-0 rounded-xl border-2 border-sky-400 animate-ping opacity-30 pointer-events-none" />
                        )}
                      </div>

                      {idx < PIPELINE_STAGES.length - 1 && (
                        <div className="flex flex-col items-center py-0.5">
                          <div className={`w-0.5 h-4 transition-all duration-300 ${isCompleted || isActive ? 'bg-sky-400' : 'bg-slate-200 dark:bg-slate-800'}`} />
                          <ArrowDown className={`w-3.5 h-3.5 transition-all duration-300 ${isCompleted || isActive ? 'text-sky-400' : 'text-slate-300 dark:text-slate-700'}`} />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Processing Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Live Processing Steps</CardTitle>
              <CardDescription>Current event stage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {PIPELINE_STAGES.map((stage, idx) => {
                const isActive = activeStage === idx;
                const isCompleted = completedStages.has(idx);
                const isPending = activeStage !== null && idx > activeStage;
                return (
                  <div key={stage.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-300 ${isActive ? 'bg-sky-50 dark:bg-sky-500/10 font-medium' : isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    {isCompleted
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      : isActive
                        ? <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                        : <div className="w-4 h-4 border-2 border-slate-300 dark:border-slate-700 rounded-full flex-shrink-0" />
                    }
                    <span className={isActive ? 'text-sky-700 dark:text-sky-300' : ''}>
                      {isActive ? stage.animLabel : stage.label}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* System Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pipeline Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'API Latency', value: metrics ? `${metrics.api_latency_ms}ms` : '—' },
                { label: 'Throughput', value: metrics ? `${metrics.events_per_second}/s` : '—' },
                { label: 'Consumer Lag', value: metrics ? `${metrics.consumer_lag} msgs` : '—' },
                { label: 'CPU Usage', value: metrics ? `${metrics.cpu_usage}%` : '—' },
                { label: 'Memory', value: metrics ? `${metrics.memory_usage}%` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
