import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { SkeletonRow } from '../components/ui/Skeleton';
import { formatDate, getRiskInfo, formatPercent, exportToCSV } from '../utils/helpers';
import { Mail, AlertTriangle, ShieldCheck, Search, RefreshCw, Download, ChevronLeft, ChevronRight } from 'lucide-react';

export const Alerts = () => {
  const { alerts, loading, refreshData } = useDashboard();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const filtered = alerts.filter(a =>
    a.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.recipient?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.details?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleExport = () => {
    exportToCSV(
      filtered.map(a => ({
        SKU: a.sku,
        Recipient: a.recipient || 'inventory-team@retailops.internal',
        Risk: 'High',
        Reason: a.details || '',
        Status: a.status || 'delivered',
        Timestamp: a.sent_at
      })),
      `alerts_${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alerts & Actions</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''} dispatched — auto-refreshing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search alerts..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full sm:w-72 pl-9 pr-4 py-2 text-sm bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50" />
          </div>
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 dark:bg-[#111827] dark:text-slate-200 dark:border-slate-800 dark:hover:bg-slate-800 transition-colors">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={refreshData} className="p-2 text-slate-500 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-4 font-medium">SKU</th>
                  <th className="px-5 py-4 font-medium">Reason</th>
                  <th className="px-5 py-4 font-medium">Risk</th>
                  <th className="px-5 py-4 font-medium">Recommendation</th>
                  <th className="px-5 py-4 font-medium">Recipient</th>
                  <th className="px-5 py-4 font-medium">Status</th>
                  <th className="px-5 py-4 font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {loading && !alerts.length
                  ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
                  : paginated.length > 0
                    ? paginated.map((alert) => (
                        <tr key={alert.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-5 py-3.5 font-mono font-semibold text-slate-900 dark:text-slate-100">{alert.sku}</td>
                          <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 max-w-[200px] truncate text-xs">
                            {alert.details || 'Stockout risk exceeded threshold'}
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge variant="danger">High Risk</Badge>
                          </td>
                          <td className="px-5 py-3.5 text-xs font-medium text-amber-600 dark:text-amber-400">Reorder Immediately</td>
                          <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-xs">
                            <span className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5" />
                              {alert.recipient || 'inventory-team@retailops.internal'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              {alert.status || 'Delivered'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-xs">{formatDate(alert.sent_at)}</td>
                        </tr>
                      ))
                    : (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                                <ShieldCheck className="w-7 h-7 text-slate-400" />
                              </div>
                              <p className="text-slate-500 font-medium">{searchTerm ? 'No alerts match your search' : 'No alerts dispatched yet'}</p>
                            </div>
                          </td>
                        </tr>
                      )
                }
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800">
              <span className="text-sm text-slate-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length}
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
    </div>
  );
};
