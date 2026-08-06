import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { SkeletonRow } from '../components/ui/Skeleton';
import { formatDate, formatTimeShort } from '../utils/helpers';
import { Search, Radio, CheckCircle2, Clock, Loader2 } from 'lucide-react';

const STATUS_STYLES = {
  RECEIVED: { badge: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300', dot: 'bg-sky-500', icon: Radio },
  PROCESSING: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300', dot: 'bg-amber-500', icon: Loader2 },
  PREDICTED: { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300', dot: 'bg-emerald-500', icon: CheckCircle2 },
};

export const InputStream = () => {
  const { rawEvents, loading } = useDashboard();
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = rawEvents.filter(e =>
    e.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.invoice_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.country?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Input Stream</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Real-time Kafka events from <code className="text-sky-500 bg-sky-50 dark:bg-sky-500/10 px-1 py-0.5 rounded text-xs">retail-events-raw</code> topic
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Live — {rawEvents.length} events
          </span>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter by SKU, Invoice, Country..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-72 pl-9 pr-4 py-2 text-sm bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            />
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Timestamp</th>
                  <th className="px-6 py-4 font-medium">Invoice No</th>
                  <th className="px-6 py-4 font-medium">SKU</th>
                  <th className="px-6 py-4 font-medium">Product Name</th>
                  <th className="px-6 py-4 font-medium">Quantity</th>
                  <th className="px-6 py-4 font-medium">Country</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {loading && !rawEvents.length
                  ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
                  : filtered.length > 0
                    ? filtered.map((event, idx) => {
                        const statusStyle = STATUS_STYLES[event.status] || STATUS_STYLES.RECEIVED;
                        const StatusIcon = statusStyle.icon;
                        const isNew = idx === 0;
                        return (
                          <tr
                            key={event.id}
                            className={`transition-all duration-500 ${isNew ? 'bg-sky-50/50 dark:bg-sky-500/5' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                          >
                            <td className="px-6 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">
                              {formatTimeShort(event.timestamp)}
                            </td>
                            <td className="px-6 py-3 font-mono text-slate-700 dark:text-slate-300 text-xs">{event.invoice_no}</td>
                            <td className="px-6 py-3 font-mono font-medium text-slate-900 dark:text-slate-100">{event.sku}</td>
                            <td className="px-6 py-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">{event.product_name}</td>
                            <td className="px-6 py-3 font-semibold text-slate-800 dark:text-slate-200">{event.quantity}</td>
                            <td className="px-6 py-3 text-slate-500 dark:text-slate-400">{event.country}</td>
                            <td className="px-6 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold ${statusStyle.badge}`}>
                                <StatusIcon
                                  className={`w-3 h-3 ${event.status === 'PROCESSING' ? 'animate-spin' : ''}`}
                                />
                                {event.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                          No events found. Waiting for Kafka data...
                        </td>
                      </tr>
                    )
                }
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
