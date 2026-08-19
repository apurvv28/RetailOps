import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { formatDate } from '../utils/helpers';
import { Radio, Search, Droplets } from 'lucide-react';

export const InputStream = () => {
  const { rawEvents, loading } = useDashboard();
  const [searchTerm, setSearchTerm] = useState('');
  const [fieldFilter, setFieldFilter] = useState('all');

  const filteredEvents = rawEvents.filter(evt => {
    const matchesSearch = !searchTerm ||
      evt.field_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evt.crop_type?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesField = fieldFilter === 'all' || evt.field_id === fieldFilter;
    return matchesSearch && matchesField;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">IoT Farm Telemetry Stream</h1>
          <p className="text-slate-500 dark:text-slate-400">Live incoming soil sensor, weather, and NPK telemetry observations.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Field ID or Crop..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-4 py-2 text-sm bg-white dark:bg-[#0E1411] border border-slate-200/80 dark:border-emerald-950/60 rounded-full focus:outline-none focus:ring-2 focus:ring-[#0F5238]/40 shadow-sm"
            />
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white dark:bg-[#0E1411] border border-slate-200/80 dark:border-emerald-950/60 shadow-sm overflow-hidden">
        <div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50/70 dark:bg-emerald-950/30 dark:text-slate-400 border-b border-slate-200/60 dark:border-emerald-950/60">
                <tr>
                  <th className="px-5 py-4 font-medium">Field ID</th>
                  <th className="px-5 py-4 font-medium">Crop Type</th>
                  <th className="px-5 py-4 font-medium">Soil Moisture</th>
                  <th className="px-5 py-4 font-medium">NPK (N-P-K)</th>
                  <th className="px-5 py-4 font-medium">Temperature / Humidity</th>
                  <th className="px-5 py-4 font-medium">Rainfall</th>
                  <th className="px-5 py-4 font-medium">Status</th>
                  <th className="px-5 py-4 font-medium">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredEvents.length > 0 ? (
                  filteredEvents.map((evt, idx) => (
                    <tr key={evt.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-900 dark:text-slate-100">{evt.field_id}</td>
                      <td className="px-5 py-3.5 capitalize font-medium text-emerald-600 dark:text-emerald-400">{evt.crop_type}</td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-slate-200">
                        <span className="inline-flex items-center gap-1">
                          <Droplets className="w-3.5 h-3.5 text-sky-500" />
                          {evt.soil_moisture}%
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {evt.nitrogen}-{evt.phosphorus}-{evt.potassium}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                        {evt.temperature}°C / {evt.humidity}%
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">{evt.rainfall} mm</td>
                      <td className="px-5 py-3.5">
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-500">{evt.status || 'RECEIVED'}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400">{formatDate(evt.timestamp)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">No telemetry events stream received.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
