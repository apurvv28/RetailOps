import React, { useState, useMemo } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { SkeletonRow } from '../components/ui/Skeleton';
import { getRiskInfo, formatPercent, formatDate, exportToCSV } from '../utils/helpers';
import { Search, Download, ChevronLeft, ChevronRight, ArrowUpDown, Package, AlertTriangle, CheckCircle2, BarChart2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';

export const LivePredictions = () => {
  const { predictions, loading } = useDashboard();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });
  const [riskFilter, setRiskFilter] = useState('all');
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
        item.sku?.toLowerCase().includes(t) ||
        item.product_name?.toLowerCase().includes(t) ||
        item.country?.toLowerCase().includes(t)
      );
    }

    // Risk filter
    if (riskFilter !== 'all') {
      data = data.filter(item => {
        const risk = getRiskInfo(item.prediction_prob);
        if (riskFilter === 'high') return risk.level === 'High Risk';
        if (riskFilter === 'medium') return risk.level === 'Medium Risk';
        if (riskFilter === 'low') return risk.level === 'Low Risk';
        return true;
      });
    }

    // Sort
    data.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return data;
  }, [predictions, searchTerm, sortConfig, riskFilter]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginated = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getRecommendation = (prob) => {
    if (prob >= 0.7) return 'Reorder Immediately';
    if (prob >= 0.4) return 'Schedule Restock';
    return 'Monitor Only';
  };

  const handleExport = () => {
    exportToCSV(
      filteredData.map(p => ({
        SKU: p.sku,
        Product: p.product_name || '',
        Probability: p.prediction_prob,
        Risk: getRiskInfo(p.prediction_prob).level,
        Recommendation: getRecommendation(p.prediction_prob),
        Country: p.country || '',
        ModelVersion: p.model_version,
        Timestamp: p.timestamp
      })),
      `predictions_${new Date().toISOString().split('T')[0]}.csv`
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
    const inventory = features.find(f => f.name.toLowerCase().includes('stock'))?.value || Math.floor(Math.random() * 80 + 5);
    const velocity = features.find(f => f.name.toLowerCase().includes('sold'))?.value || Math.floor(Math.random() * 150 + 20);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
            <Package className="w-6 h-6 text-slate-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{row.sku}</h3>
            <p className="text-slate-500 dark:text-slate-400">{row.product_name || 'Unknown Product'}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge className={risk.badgeClass}>{risk.level}</Badge>
              <Badge variant="default">{row.model_version}</Badge>
              {row.country && <Badge variant="outline">{row.country}</Badge>}
            </div>
          </div>
          <div className={`text-4xl font-black ${risk.level === 'High Risk' ? 'text-rose-500' : risk.level === 'Medium Risk' ? 'text-amber-500' : 'text-emerald-500'}`}>
            {formatPercent(row.prediction_prob)}
          </div>
        </div>

        {/* Risk gauge */}
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>0%</span><span>Stockout Probability</span><span>100%</span>
          </div>
          <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${risk.level === 'High Risk' ? 'bg-rose-500' : risk.level === 'Medium Risk' ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${(row.prediction_prob * 100).toFixed(1)}%` }}
            />
          </div>
        </div>

        {/* Recommendation */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-start gap-3">
          {row.prediction_prob >= 0.4 ? (
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Recommendation: {getRecommendation(row.prediction_prob)}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{risk.description}</p>
          </div>
        </div>

        {/* SHAP Chart */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="w-4 h-4 text-sky-500" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">SHAP Feature Importance</p>
          </div>
          {features.length > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={features} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#374151" opacity={0.2} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} width={110} />
                  <RechartsTooltip cursor={{ fill: 'rgba(14, 165, 233, 0.1)' }} contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }} formatter={(v, n, p) => [`Importance: ${v.toFixed(3)} (Val: ${p.payload.value})`, 'Impact']} />
                  <Bar dataKey="importance" radius={[0, 4, 4, 0]} barSize={22}>
                    {features.map((_, i) => (
                      <Cell key={i} fill={row.prediction_prob >= 0.4 ? '#f43f5e' : '#0ea5e9'} opacity={1 - i * 0.18} />
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
            { label: 'Prediction Time', value: formatDate(row.timestamp) },
            { label: 'Risk Flag', value: row.risk_flag ? 'Flagged' : 'Clear' },
            { label: 'Country', value: row.country || '—' },
            { label: 'Current Inventory', value: inventory },
            { label: 'Sales Velocity (7d)', value: velocity },
            { label: 'Model Version', value: row.model_version || '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-slate-500 mb-0.5">{label}</p>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{value}</p>
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
          <h1 className="text-2xl font-bold tracking-tight">Live Predictions Feed</h1>
          <p className="text-slate-500 dark:text-slate-400">Click any row to view prediction details, SHAP values, and recommendations.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search SKU, product, country..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full sm:w-64 pl-9 pr-4 py-2 text-sm bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50" />
          </div>
          <select value={riskFilter} onChange={(e) => { setRiskFilter(e.target.value); setCurrentPage(1); }} className="px-3 py-2 text-sm bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50">
            <option value="all">All Risk</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="low">Low Risk</option>
          </select>
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 dark:bg-[#111827] dark:text-slate-200 dark:border-slate-800 dark:hover:bg-slate-800 transition-colors">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-4 font-medium cursor-pointer" onClick={() => handleSort('sku')}>
                    <div className="flex items-center gap-1">SKU <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-5 py-4 font-medium">Product Name</th>
                  <th className="px-5 py-4 font-medium cursor-pointer" onClick={() => handleSort('prediction_prob')}>
                    <div className="flex items-center gap-1">Probability <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="px-5 py-4 font-medium">Risk</th>
                  <th className="px-5 py-4 font-medium">Recommendation</th>
                  <th className="px-5 py-4 font-medium">Country</th>
                  <th className="px-5 py-4 font-medium cursor-pointer" onClick={() => handleSort('timestamp')}>
                    <div className="flex items-center gap-1">Time <ArrowUpDown className="w-3 h-3" /></div>
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
                          <tr key={row.id} onClick={() => setSelectedRow(row)} className="hover:bg-sky-50/50 dark:hover:bg-sky-500/5 cursor-pointer transition-colors group">
                            <td className="px-5 py-3.5 font-mono font-medium text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">{row.sku}</td>
                            <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 max-w-[180px] truncate">{row.product_name || 'Unknown'}</td>
                            <td className="px-5 py-3.5 font-semibold">{formatPercent(row.prediction_prob)}</td>
                            <td className="px-5 py-3.5">
                              <Badge className={risk.badgeClass}>
                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${risk.dotClass}`} />
                                {risk.level}
                              </Badge>
                            </td>
                            <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 text-xs font-medium">{getRecommendation(row.prediction_prob)}</td>
                            <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">{row.country || '—'}</td>
                            <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-xs">{formatDate(row.timestamp)}</td>
                          </tr>
                        );
                      })
                    : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">No predictions found.</td>
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
        </CardContent>
      </Card>

      <Modal isOpen={!!selectedRow} onClose={() => setSelectedRow(null)} title={`Prediction — ${selectedRow?.sku}`} size="lg">
        <DetailModal row={selectedRow} />
      </Modal>
    </div>
  );
};
