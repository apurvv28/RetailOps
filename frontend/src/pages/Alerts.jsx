import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { DashboardService } from '../services/api';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { SkeletonRow } from '../components/ui/Skeleton';
import { formatDate, exportToCSV } from '../utils/helpers';
import { Mail, ShieldCheck, Search, RefreshCw, Download, ChevronLeft, ChevronRight, Plus, Send } from 'lucide-react';
import Swal from 'sweetalert2';

export const Alerts = () => {
  const { alerts, loading, refreshData } = useDashboard();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const filtered = alerts.filter(a =>
    a.field_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.recipient?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.details?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleTriggerAlert = async () => {
    const { value: formValues } = await Swal.fire({
      title: '⚡ Dispatch Live Field Advisory Alert',
      html:
        '<input id="swal-field-id" class="swal2-input" placeholder="Field ID (e.g. FIELD_MH_01)">' +
        '<input id="swal-recipient" class="swal2-input" placeholder="Recipient Email" value="field-ops@agritech.internal">' +
        '<input id="swal-reason" class="swal2-input" placeholder="Alert Reason (e.g. Moisture < 12%)">',
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Dispatch Alert',
      confirmButtonColor: '#0F5238',
      background: '#0E1411',
      color: '#f8fafc',
      preConfirm: () => {
        return {
          field_id: document.getElementById('swal-field-id').value || 'FIELD_MH_01',
          recipient: document.getElementById('swal-recipient').value || 'field-ops@agritech.internal',
          reason: document.getElementById('swal-reason').value || 'Critical soil moisture depletion warning triggered',
          model_type: 'irrigation'
        };
      }
    });

    if (formValues) {
      try {
        const res = await DashboardService.triggerAlert(formValues);
        Swal.fire({
          icon: 'success',
          title: 'Alert Dispatched!',
          text: res.message || 'Notification sent to field operations team.',
          background: '#0E1411',
          color: '#f8fafc',
          confirmButtonColor: '#0F5238',
        });
        refreshData();
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Dispatch Failed',
          text: err.message || 'Failed to dispatch alert.',
          background: '#0E1411',
          color: '#f8fafc',
        });
      }
    }
  };

  const handleExport = () => {
    exportToCSV(
      filtered.map(a => ({
        FieldID: a.field_id,
        Recipient: a.recipient || 'field-ops@agritech.internal',
        Risk: 'High Risk',
        Action: 'Trigger Field Valve',
        Details: a.details || '',
        Status: a.status || 'delivered',
        Timestamp: a.sent_at
      })),
      `agri_alerts_${new Date().toISOString().split('T')[0]}.csv`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Field Alerts & Automated Dispatches</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {alerts.length} field alert{alerts.length !== 1 ? 's' : ''} dispatched — auto-refreshing
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleTriggerAlert}
            className="flex items-center gap-2 px-4 py-2 bg-[#0F5238] hover:bg-[#0b3d2a] text-white rounded-full text-xs font-bold shadow-md shadow-emerald-900/20 transition-all"
          >
            <Send className="w-3.5 h-3.5" /> Dispatch Alert
          </button>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full sm:w-64 pl-9 pr-4 py-2 text-sm bg-white dark:bg-[#0E1411] border border-slate-200/80 dark:border-emerald-950/60 rounded-full focus:outline-none focus:ring-2 focus:ring-[#0F5238]/40 shadow-sm"
            />
          </div>
          <button onClick={handleExport} className="p-2.5 text-slate-700 bg-white border border-slate-200/80 rounded-full hover:bg-slate-50 dark:bg-[#0E1411] dark:text-slate-200 dark:border-emerald-950/60 dark:hover:bg-emerald-950/40 transition-colors shadow-sm">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={refreshData} className="p-2.5 text-slate-700 bg-white border border-slate-200/80 rounded-full hover:bg-slate-50 dark:bg-[#0E1411] dark:text-slate-200 dark:border-emerald-950/60 dark:hover:bg-emerald-950/40 transition-colors shadow-sm">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="rounded-3xl bg-white dark:bg-[#0E1411] border border-slate-200/80 dark:border-emerald-950/60 shadow-sm overflow-hidden">
        <div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50/70 dark:bg-emerald-950/30 dark:text-slate-400 border-b border-slate-200/60 dark:border-emerald-950/60">
                <tr>
                  <th className="px-5 py-4 font-medium">Field ID</th>
                  <th className="px-5 py-4 font-medium">Alert Details</th>
                  <th className="px-5 py-4 font-medium">Risk Level</th>
                  <th className="px-5 py-4 font-medium">Automated Action</th>
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
                          <td className="px-5 py-3.5 font-mono font-semibold text-slate-900 dark:text-slate-100">{alert.field_id}</td>
                          <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 max-w-[240px] truncate text-xs">
                            {alert.details || 'Soil moisture depletion risk threshold reached'}
                          </td>
                          <td className="px-5 py-3.5">
                            <Badge variant="danger">High Risk</Badge>
                          </td>
                          <td className="px-5 py-3.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">Trigger Field Valve</td>
                          <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 text-xs">
                            <span className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5" />
                              {alert.recipient || 'field-ops@agritech.internal'}
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
        </div>
      </div>
    </div>
  );
};
