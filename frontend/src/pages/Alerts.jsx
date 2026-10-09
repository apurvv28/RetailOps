import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { DashboardService } from '../services/api';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';
import { PageHeader } from '../components/ui/PageHeader';
import { SkeletonRow } from '../components/ui/Skeleton';
import { formatDate, exportToCSV } from '../utils/helpers';
import { Mail, ShieldCheck, Search, Download, ChevronLeft, ChevronRight, Send, AlertTriangle } from 'lucide-react';

export const Alerts = () => {
  const { alerts, loading, refreshData } = useDashboard();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [dispatching, setDispatching] = useState(false);
  const itemsPerPage = 12;

  // Dispatch Form State
  const [formValues, setFormValues] = useState({
    field_id: 'FIELD_MH_01',
    recipient: 'field-ops@agritech.internal',
    reason: 'Critical soil moisture depletion warning triggered',
    model_type: 'irrigation',
  });

  const filtered = alerts.filter(a =>
    a.field_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.recipient?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.details?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSubmitDispatch = async (e) => {
    e.preventDefault();
    setDispatching(true);
    try {
      const res = await DashboardService.triggerAlert(formValues);
      setDispatchModalOpen(false);
      setToastMsg({
        type: 'success',
        text: res.message || 'Advisory alert dispatched to field operations team.',
      });
      refreshData();
    } catch (err) {
      setToastMsg({
        type: 'error',
        text: err.message || 'Failed to dispatch alert.',
      });
    } finally {
      setDispatching(false);
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
    <div className="space-y-8 pb-10">
      {/* Fernly Page Header */}
      <PageHeader
        title="Field Alerts & Automated Dispatches"
        subtitle={`${alerts.length} field alerts dispatched across agricultural zones — real-time trigger registry.`}
        secondaryAction={{
          label: 'Export CSV',
          icon: Download,
          onClick: handleExport,
        }}
        primaryAction={{
          label: 'Dispatch Alert',
          icon: Send,
          onClick: () => setDispatchModalOpen(true),
        }}
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Alert Status:</span>
          <Badge variant="accent">
            {filtered.length} Dispatches Logged
          </Badge>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search alerts, fields, recipients..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2 text-xs bg-white dark:bg-[#121A15] hairline-border rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 shadow-sm transition-all"
          />
        </div>
      </div>

      {/* Alerts Table Card */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-black/30 text-slate-500 uppercase font-mono font-bold border-b border-black/[0.05] dark:border-white/[0.06]">
              <tr>
                <th className="px-5 py-4">Field ID</th>
                <th className="px-5 py-4">Alert Details</th>
                <th className="px-5 py-4">Risk Level</th>
                <th className="px-5 py-4">Automated Action</th>
                <th className="px-5 py-4">Recipient</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Dispatched At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              {loading && !alerts.length
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
                : paginated.length > 0
                  ? paginated.map((alert) => (
                      <tr key={alert.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                          {alert.field_id}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300 max-w-[260px] truncate">
                          {alert.details || 'Soil moisture depletion risk threshold reached'}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant="danger" dot>High Risk</Badge>
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-[var(--accent-mid)] dark:text-[var(--accent-light)]">
                          Trigger Field Valve
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          <span className="flex items-center gap-1.5 font-mono text-[11px]">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            {alert.recipient || 'field-ops@agritech.internal'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant="success" className="text-[10px]">
                            {alert.status || 'Delivered'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-slate-400 font-mono">
                          {formatDate(alert.sent_at)}
                        </td>
                      </tr>
                    ))
                  : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                          {searchTerm ? 'No alerts match your search' : 'No alerts dispatched yet.'}
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
              Showing {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} alerts
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

      {/* Fernly Modal for Dispatching Alert */}
      <Modal
        isOpen={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        title="Dispatch Live Field Advisory Alert"
        subtitle="Trigger emergency actuator instruction or field technician dispatch"
        size="md"
      >
        <form onSubmit={handleSubmitDispatch} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Target Field ID
            </label>
            <input
              type="text"
              autoFocus
              value={formValues.field_id}
              onChange={(e) => setFormValues({ ...formValues, field_id: e.target.value })}
              className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)] text-slate-900 dark:text-slate-100"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Recipient Email / Webhook
            </label>
            <input
              type="email"
              value={formValues.recipient}
              onChange={(e) => setFormValues({ ...formValues, recipient: e.target.value })}
              className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)] text-slate-900 dark:text-slate-100"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Advisory Reason & Technical Directive
            </label>
            <textarea
              rows={3}
              value={formValues.reason}
              onChange={(e) => setFormValues({ ...formValues, reason: e.target.value })}
              className="w-full px-4 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)] text-slate-900 dark:text-slate-100 resize-none"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-black/[0.05] dark:border-white/[0.06]">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDispatchModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              icon={Send}
              loading={dispatching}
            >
              Dispatch Advisory
            </Button>
          </div>
        </form>
      </Modal>

      {/* Toast Notification */}
      <Toast
        isOpen={!!toastMsg}
        message={toastMsg?.text}
        type={toastMsg?.type}
        onClose={() => setToastMsg(null)}
      />
    </div>
  );
};
