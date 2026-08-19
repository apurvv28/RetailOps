import React, { useState, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { SkeletonRow } from '../components/ui/Skeleton';
import { getRiskInfo, formatPercent, formatDate, exportToCSV } from '../utils/helpers';
import {
  Search, RefreshCw, Download, ChevronLeft, ChevronRight,
  BarChart2, AlertTriangle, CheckCircle2, Package, Filter, ArrowUpDown, Sparkles
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';

export const LivePredictions = () => {
  const { predictions, loading } = useDashboard();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });
  const [modelFilter, setModelFilter] = useState('all');
  const [selectedRow, setSelectedRow] = useState(null);
  const itemsPerPage = 15;

  const handleSort = (key) => {
    setSortConfig(c => ({ key, direction: c.key === key && c.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const filteredData = useMemo(() => {
    let data = [...predictions];

    // Search
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      data = data.filter(item =>
        item.field_id?.toLowerCase().includes(t) ||
        item.prediction_output?.toLowerCase().includes(t) ||
        item.state?.toLowerCase().includes(t)
      );
    }

    // Model filter
    if (modelFilter !== 'all') {
      data = data.filter(item => item.model_type === modelFilter);
    }

    // Sort
    data.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return data;
  }, [predictions, searchTerm, sortConfig, modelFilter]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginated = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getRecommendation = (row) => {
    if (row.model_type === 'irrigation') return row.prediction_prob >= 0.7 ? 'Trigger Irrigation Valve' : row.prediction_prob >= 0.4 ? 'Schedule 24h Irrigation' : 'Normal Hydration';
    if (row.model_type === 'crop') return `Optimal Planting: ${row.prediction_output}`;
    if (row.model_type === 'fertilizer') return `Apply Prescribed ${row.prediction_output}`;
    return `Yield Estimate: ${row.prediction_output}`;
  };

  const handleExport = () => {
    exportToCSV(
      filteredData.map(p => ({
        FieldID: p.field_id,
        ModelType: p.model_type,
        Output: p.prediction_output,
        ConfidenceScore: p.prediction_prob,
        Recommendation: getRecommendation(p),
        State: p.state || '',
        ModelVersion: p.model_version,
        Timestamp: p.timestamp
      })),
      `agri_predictions_${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  const DetailModal = ({ row }) => {
    if (!row) return null;
    const risk = getRiskInfo(row.prediction_prob);
    const features = (row.top_features || []).map(f => ({
      name: f.feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      importance: f.importance,
      value: f.value
    }));

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Package className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{row.field_id}</h3>
            <p className="text-slate-500 dark:text-slate-400 capitalize">Model Head: <span className="font-semibold text-emerald-500">{row.model_type}</span></p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge className={risk.badgeClass}>{row.prediction_output}</Badge>
              <Badge variant="default">{row.model_version}</Badge>
              {row.state && <Badge variant="outline">{row.state}</Badge>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black text-emerald-500">
              {formatPercent(row.prediction_prob)}
            </div>
            <p className="text-xs text-slate-500">Confidence Score</p>
          </div>
        </div>

        {/* Confidence gauge */}
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>0%</span><span>Model Prediction Confidence</span><span>100%</span>
          </div>
          <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${(row.prediction_prob * 100).toFixed(1)}%` }}
            />
          </div>
        </div>

        {/* Action Recommendation */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-start gap-3 border border-slate-200 dark:border-slate-800">
          {row.prediction_prob >= 0.7 ? (
            <AlertTriangle className="w-5 h-5 text-rose-500 mt-0.5 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Prescription: {getRecommendation(row)}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{risk.description}</p>
          </div>
        </div>

        {/* NVIDIA Nemotron LLM Explainability */}
        <div className="p-4 bg-emerald-950/20 dark:bg-emerald-950/40 rounded-2xl border border-emerald-500/30 space-y-2">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs tracking-wider uppercase">
            <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" />
            NVIDIA Nemotron AI Agronomist Explainability
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
            {row.llm_explanation || (
              row.model_type === 'crop'
                ? `Agronomic rationale: ${row.prediction_output} flourishes under these soil nitrogen, phosphorus, potassium, and local rainfall profiles.`
                : row.model_type === 'fertilizer'
                ? `Targeted nutrient correction: ${row.prediction_output} balances the soil N-P-K deficiency for maximum crop absorption.`
                : `Automated ML decision verified against field microclimate and telemetry features.`
            )}
          </p>
        </div>

        {/* SHAP Feature Importance */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="w-4 h-4 text-emerald-500" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">SHAP Feature Contributions</p>
          </div>
          {features.length > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={features} layout="vertical" margin={{ top: 5, right: 30, left: 130, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#374151" opacity={0.2} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} width={120} />
                  <RechartsTooltip cursor={{ fill: 'rgba(16, 185, 129, 0.1)' }} contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }} formatter={(v, n, p) => [`Importance: ${v.toFixed(3)} (Val: ${p.payload.value})`, 'Impact']} />
                  <Bar dataKey="importance" radius={[0, 4, 4, 0]} barSize={22}>
                    {features.map((_, i) => (
                      <Cell key={i} fill="#10b981" opacity={1 - i * 0.18} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">No SHAP feature data available.</p>
          )}
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          {[
            { label: 'Inference Time', value: formatDate(row.timestamp) },
            { label: 'Model Head', value: row.model_type },
            { label: 'Field State', value: row.state || '—' },
            { label: 'Risk Flag', value: row.risk_flag ? 'Flagged' : 'Normal' },
            { label: 'Model Version', value: row.model_version || '—' },
            { label: 'Output', value: row.prediction_output },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-slate-500 mb-0.5">{label}</p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 capitalize">{value}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Multi-Model Live Predictions Feed</h1>
          <p className="text-slate-500 dark:text-slate-400">Click any row to view model feature importance, SHAP values, and agricultural prescriptions.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search Field ID, crop, state..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full sm:w-64 pl-9 pr-4 py-2 text-sm bg-white dark:bg-[#0E1411] border border-slate-200/80 dark:border-emerald-950/60 rounded-full focus:outline-none focus:ring-2 focus:ring-[#0F5238]/40 shadow-sm" />
          </div>
          <select value={modelFilter} onChange={(e) => { setModelFilter(e.target.value); setCurrentPage(1); }} className="px-4 py-2 text-sm bg-white dark:bg-[#0E1411] border border-slate-200/80 dark:border-emerald-950/60 rounded-full focus:outline-none focus:ring-2 focus:ring-[#0F5238]/40 shadow-sm text-slate-700 dark:text-slate-300 font-semibold">
            <option value="all">All Models</option>
            <option value="irrigation">Irrigation Risk</option>
            <option value="crop">Crop Recommender</option>
            <option value="fertilizer">Fertilizer Recommender</option>
            <option value="yield">Yield Predictor</option>
          </select>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-200/80 rounded-full hover:bg-slate-50 dark:bg-[#0E1411] dark:text-slate-200 dark:border-emerald-950/60 dark:hover:bg-emerald-950/40 transition-colors shadow-sm">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      <div className="rounded-3xl bg-white dark:bg-[#0E1411] border border-slate-200/80 dark:border-emerald-950/60 shadow-sm overflow-hidden">
        <div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50/70 dark:bg-emerald-950/30 dark:text-slate-400 border-b border-slate-200/60 dark:border-emerald-950/60">
                <tr>
                  <th className="px-5 py-4 font-medium cursor-pointer" onClick={() => handleSort('field_id')}>
                    <div className="flex items-center gap-1">Field ID <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-5 py-4 font-medium">Model Head</th>
                  <th className="px-5 py-4 font-medium">Prediction Output</th>
                  <th className="px-5 py-4 font-medium cursor-pointer" onClick={() => handleSort('prediction_prob')}>
                    <div className="flex items-center gap-1">Confidence <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-5 py-4 font-medium">Prescription</th>
                  <th className="px-5 py-4 font-medium">State</th>
                  <th className="px-5 py-4 font-medium cursor-pointer" onClick={() => handleSort('timestamp')}>
                    <div className="flex items-center gap-1">Inference Time <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {loading && !predictions.length
                  ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
                  : paginated.length > 0
                    ? paginated.map((row) => {
                        const risk = getRiskInfo(row.prediction_prob);
                        return (
                          <tr key={row.id} onClick={() => setSelectedRow(row)} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-500/5 cursor-pointer transition-colors group">
                            <td className="px-5 py-3.5 font-mono font-medium text-slate-900 dark:text-slate-100 group-hover:text-emerald-500 transition-colors">{row.field_id}</td>
                            <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 capitalize">
                              <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400">{row.model_type}</Badge>
                            </td>
                            <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-slate-200">{row.prediction_output}</td>
                            <td className="px-5 py-3.5 font-semibold text-emerald-500">{formatPercent(row.prediction_prob)}</td>
                            <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 text-xs font-medium">{getRecommendation(row)}</td>
                            <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{row.state || '—'}</td>
                            <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-xs">{formatDate(row.timestamp)}</td>
                          </tr>
                        );
                      })
                    : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">No AgriTech predictions found.</td>
                      </tr>
                    )
                }
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800">
              <span className="text-sm text-slate-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"><ChevronLeft className="w-5 h-5" /></button>
                <span className="text-sm font-medium px-2">{currentPage} / {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"><ChevronRight className="w-5 h-5" /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={!!selectedRow} onClose={() => setSelectedRow(null)} title={`Agri-Inference Details — ${selectedRow?.field_id}`} size="lg">
        <DetailModal row={selectedRow} />
      </Modal>
    </div>
  );
};
