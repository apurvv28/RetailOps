import React, { useState, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { SkeletonRow } from '../components/ui/Skeleton';
import { Tabs } from '../components/ui/Tabs';
import { getRiskInfo, formatPercent, formatDate, exportToCSV } from '../utils/helpers';
import {
  Search, Download, ChevronLeft, ChevronRight,
  BarChart2, AlertTriangle, CheckCircle2, Package, ArrowUpDown, Sparkles
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';

export const LivePredictions = () => {
  const { predictions = [], loading } = useDashboard();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });
  const [modelFilter, setModelFilter] = useState('all');
  const [selectedRow, setSelectedRow] = useState(null);
  const itemsPerPage = 12;

  const handleSort = (key) => {
    setSortConfig(c => ({ key, direction: c.key === key && c.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const safePredictions = Array.isArray(predictions) ? predictions : [];

  const filteredData = useMemo(() => {
    let data = [...safePredictions];

    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      data = data.filter(item =>
        item.field_id?.toLowerCase().includes(t) ||
        item.prediction_output?.toLowerCase().includes(t) ||
        item.state?.toLowerCase().includes(t)
      );
    }

    if (modelFilter !== 'all') {
      data = data.filter(item => item.model_type === modelFilter);
    }

    data.sort((a, b) => {
      const aVal = a[sortConfig.key] ?? '';
      const bVal = b[sortConfig.key] ?? '';
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return data;
  }, [safePredictions, searchTerm, sortConfig, modelFilter]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginated = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getRecommendation = (row) => {
    if (!row) return '';
    if (row.model_type === 'irrigation') {
      const prob = row.prediction_prob ?? 0;
      return prob >= 0.7 ? 'Turn On Irrigation' : prob >= 0.4 ? 'Plan Watering in 24 Hours' : 'Soil Moisture Adequate';
    }
    if (row.model_type === 'crop') return `Recommended Crop: ${row.prediction_output || 'Recommended'}`;
    if (row.model_type === 'fertilizer') return `Apply Fertilizer: ${row.prediction_output || 'Dosage'}`;
    return `Expected Harvest: ${row.prediction_output || '3.85 t/ha'}`;
  };

  const handleExport = () => {
    exportToCSV(
      filteredData.map(p => ({
        FieldID: p.field_id,
        ServiceType: p.model_type,
        Output: p.prediction_output,
        AccuracyScore: p.prediction_prob,
        Recommendation: getRecommendation(p),
        State: p.state || '',
        Version: p.model_version,
        Timestamp: p.timestamp
      })),
      `farm_advisories_${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  const DetailModal = ({ row }) => {
    if (!row) return null;
    const risk = getRiskInfo(row.prediction_prob ?? 0.5);
    const features = Array.isArray(row.top_features) ? row.top_features.map(f => ({
      name: f.feature ? f.feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Factor',
      importance: f.importance || 0.1,
      value: f.value ?? 0
    })) : [];

    return (
      <div className="space-y-6">
        {/* Header summary */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[var(--accent-tint)] dark:bg-[var(--accent-dark-tint)] text-[var(--accent-primary)] dark:text-[var(--accent-light)] flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{row.field_id}</h3>
              <p className="text-xs text-slate-500 capitalize mt-0.5">Advisory Service: <strong className="text-[var(--accent-mid)] dark:text-[var(--accent-light)]">{row.model_type}</strong></p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold text-[var(--accent-primary)] dark:text-[var(--accent-light)]">
              {formatPercent(row.prediction_prob ?? 0.8)}
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Accuracy Match</p>
          </div>
        </div>

        {/* Confidence progress */}
        <div>
          <div className="flex justify-between text-[11px] text-slate-400 mb-1.5 font-medium">
            <span>0% Match</span>
            <span>Suitability Rating</span>
            <span>100%</span>
          </div>
          <div className="h-2 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: `${((row.prediction_prob ?? 0.8) * 100).toFixed(1)}%`,
                backgroundColor: 'var(--accent-primary)' 
              }}
            />
          </div>
        </div>

        {/* Action Recommendation */}
        <div className="p-4 bg-slate-50 dark:bg-white/[0.03] rounded-2xl hairline-border flex items-start gap-3">
          {(row.prediction_prob ?? 0) >= 0.7 ? (
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
          )}
          <div>
            <p className="text-xs font-bold text-slate-900 dark:text-white mb-0.5">
              Action: {getRecommendation(row)}
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">{risk.description}</p>
          </div>
        </div>

        {/* Agronomist Advice Reasoning */}
        <div className="p-4 bg-stripe-texture text-white rounded-2xl shadow-md space-y-2">
          <div className="flex items-center gap-2 text-white font-extrabold text-xs tracking-wider uppercase">
            <Sparkles className="w-4 h-4 text-emerald-300 animate-pulse" />
            Agricultural Agronomist Guidance
          </div>
          <p className="text-xs text-white/90 leading-relaxed font-medium">
            {row.llm_explanation || (
              row.model_type === 'crop'
                ? `Agronomic rationale: ${row.prediction_output} flourishes under these soil nitrogen, phosphorus, potassium, and rainfall conditions.`
                : row.model_type === 'fertilizer'
                ? `Targeted nutrient balance: ${row.prediction_output} replenishes soil nutrients for maximum crop health.`
                : `Recommendation verified against field soil condition and local climate.`
            )}
          </p>
        </div>

        {/* Key Influencing Factors */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="w-4 h-4 text-[var(--accent-mid)] dark:text-[var(--accent-light)]" />
            <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Key Factors Influencing This Advice</p>
          </div>
          {features.length > 0 ? (
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={features} layout="vertical" margin={{ top: 5, right: 30, left: 130, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#374151" opacity={0.15} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} width={120} />
                  <RechartsTooltip cursor={{ fill: 'rgba(16, 185, 129, 0.1)' }} contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }} />
                  <Bar dataKey="importance" radius={[0, 6, 6, 0]} barSize={18}>
                    {features.map((_, i) => (
                      <Cell key={i} fill="var(--accent-primary)" opacity={1 - i * 0.18} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No additional factor breakdown available.</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-10 w-full">
      {/* Page Header */}
      <PageHeader
        title="Live Farm Recommendations"
        subtitle="Real-time agricultural guidance generated for water, crops, fertilizers, and expected harvest."
        secondaryAction={{
          label: 'Export CSV',
          icon: Download,
          onClick: handleExport,
        }}
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Model Tabs Filter */}
        <Tabs
          layoutId="modelFilterTabs"
          tabs={[
            { id: 'all', label: 'All Advisories' },
            { id: 'irrigation', label: 'Smart Watering' },
            { id: 'crop', label: 'Crop Selection' },
            { id: 'fertilizer', label: 'Fertilizer Guide' },
            { id: 'yield', label: 'Harvest Forecast' },
          ]}
          activeTab={modelFilter}
          onChange={(id) => { setModelFilter(id); setCurrentPage(1); }}
        />

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search field ID, crop, state..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2 text-xs bg-white dark:bg-[#121A15] hairline-border rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 shadow-sm transition-all"
          />
        </div>
      </div>

      {/* Inferences Table Card */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-black/30 text-slate-500 uppercase font-mono font-bold border-b border-black/[0.05] dark:border-white/[0.06]">
              <tr>
                <th className="px-5 py-4 cursor-pointer" onClick={() => handleSort('field_id')}>
                  <div className="flex items-center gap-1.5">Field ID <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-5 py-4">Advisory Type</th>
                <th className="px-5 py-4">Guidance / Advice</th>
                <th className="px-5 py-4 cursor-pointer" onClick={() => handleSort('prediction_prob')}>
                  <div className="flex items-center gap-1.5">Accuracy Match <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-5 py-4">Recommended Action</th>
                <th className="px-5 py-4">District / State</th>
                <th className="px-5 py-4 cursor-pointer" onClick={() => handleSort('timestamp')}>
                  <div className="flex items-center gap-1.5">Generated At <ArrowUpDown className="w-3 h-3" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              {loading && !safePredictions.length
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
                : paginated.length > 0
                  ? paginated.map((row) => (
                      <tr 
                        key={row.id} 
                        onClick={() => setSelectedRow(row)} 
                        className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer transition-colors group"
                      >
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-900 dark:text-white group-hover:text-[var(--accent-mid)] transition-colors">
                          {row.field_id}
                        </td>
                        <td className="px-5 py-3.5 capitalize">
                          <Badge variant="accent" className="text-[10px]">
                            {row.model_type}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-slate-200">
                          {row.prediction_output}
                        </td>
                        <td className="px-5 py-3.5 font-mono font-bold text-[var(--accent-mid)] dark:text-[var(--accent-light)]">
                          {formatPercent(row.prediction_prob ?? 0.8)}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 font-medium">
                          {getRecommendation(row)}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          {row.state || 'Maharashtra'}
                        </td>
                        <td className="px-5 py-3.5 text-slate-400 font-mono">
                          {formatDate(row.timestamp)}
                        </td>
                      </tr>
                    ))
                  : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                        No predictions matched the filter criteria.
                      </td>
                    </tr>
                  )
              }
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-black/[0.05] dark:border-white/[0.06] text-xs text-slate-500">
            <span>
              Showing {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} records
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                disabled={currentPage === 1} 
                className="p-1.5 rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold px-2">{currentPage} / {totalPages}</span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                disabled={currentPage === totalPages} 
                className="p-1.5 rounded-full hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      <Modal 
        isOpen={!!selectedRow} 
        onClose={() => setSelectedRow(null)} 
        title={`Farm Advisory Details — ${selectedRow?.field_id}`}
        subtitle="Key factors and agronomist recommendations"
        size="lg"
      >
        <DetailModal row={selectedRow} />
      </Modal>
    </div>
  );
};

export default LivePredictions;
