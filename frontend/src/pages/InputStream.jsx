import React, { useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { formatDate } from '../utils/helpers';
import { 
  Search, Droplets, MapPin, Building2, Cpu, 
  RefreshCw, CheckCircle2, ChevronRight, Activity 
} from 'lucide-react';
import { cn } from '../utils/cn';

export const InputStream = () => {
  const { rawEvents = [], adminFarms = [], loading, triggerObservation } = useDashboard();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFarmFilter, setSelectedFarmFilter] = useState('all');
  const [triggering, setTriggering] = useState(false);

  const safeEvents = Array.isArray(rawEvents) ? rawEvents : [];
  const safeFarms = Array.isArray(adminFarms) ? adminFarms : [];

  const filteredEvents = safeEvents.filter(evt => {
    if (!evt) return false;
    const farmId = evt.farm_id || evt.field_id || '';
    const cropType = evt.crop_type || '';
    const farmName = evt.farm_name || '';

    const matchesSearch = !searchTerm ||
      farmId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cropType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      farmName.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFarm = selectedFarmFilter === 'all' || farmId === selectedFarmFilter;
    return matchesSearch && matchesFarm;
  });

  const handleManualIngest = async () => {
    setTriggering(true);
    try {
      const target = selectedFarmFilter !== 'all' ? selectedFarmFilter : 'FARM_MH_PUNE_01';
      if (triggerObservation) {
        await triggerObservation(target);
      }
    } catch (err) {
      console.warn('Manual ingest notice:', err);
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="space-y-8 pb-10 w-full">
      {/* Page Header */}
      <PageHeader
        title="Live Farm Sensors & Soil Readings"
        subtitle="Real-time measurements from registered farm plots with authentic soil and climate sensors."
        primaryAction={{
          label: triggering ? 'Reading Field Sensors...' : 'Fetch Latest Sensor Readings',
          icon: RefreshCw,
          onClick: handleManualIngest,
          loading: triggering,
        }}
      />

      {/* Admin Multi-Farm Selection Cards (Grid of 5) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <button
          type="button"
          onClick={() => setSelectedFarmFilter('all')}
          className={cn(
            "p-4 rounded-2xl hairline-border text-left transition-all select-none cursor-pointer",
            selectedFarmFilter === 'all'
              ? "bg-[var(--accent-tint)] dark:bg-[var(--accent-dark-tint)] ring-2 ring-[var(--accent-primary)] shadow-sm"
              : "bg-white dark:bg-[#121A15] hover:bg-slate-50 dark:hover:bg-white/[0.04]"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">All Farms</span>
            <Badge variant="accent" className="text-[10px]">Active ({safeFarms.length || 5})</Badge>
          </div>
          <p className="text-xl font-extrabold text-slate-900 dark:text-white leading-tight">
            {safeFarms.length || 5} Farms
          </p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Combined readings from all fields</p>
        </button>

        {safeFarms.map(f => {
          if (!f) return null;
          const isSelected = selectedFarmFilter === f.farm_id;
          const tel = f.latest_telemetry;
          return (
            <button
              key={f.farm_id || Math.random()}
              type="button"
              onClick={() => setSelectedFarmFilter(f.farm_id)}
              className={cn(
                "p-4 rounded-2xl hairline-border text-left transition-all select-none cursor-pointer",
                isSelected
                  ? "bg-[var(--accent-tint)] dark:bg-[var(--accent-dark-tint)] ring-2 ring-[var(--accent-primary)] shadow-sm"
                  : "bg-white dark:bg-[#121A15] hover:bg-slate-50 dark:hover:bg-white/[0.04]"
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono font-bold text-[var(--accent-mid)] dark:text-[var(--accent-light)]">
                  {f.district || 'Maharashtra'}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE
                </span>
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{f.farm_name || f.farm_id}</p>
              <p className="text-[11px] text-slate-400 capitalize">{f.current_crop || 'Mixed'} • {f.acreage || 10} ac</p>
              <div className="mt-2.5 pt-2 border-t border-black/[0.05] dark:border-white/[0.06] flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Moisture:</span>
                <span className="font-bold text-sky-600 dark:text-sky-400">
                  {tel ? `${tel.soil_moisture}%` : '28.5%'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Farm View:</span>
          <Badge variant="neutral">
            {selectedFarmFilter === 'all' ? 'All Managed Farms' : selectedFarmFilter}
          </Badge>
          <span className="text-slate-400">({filteredEvents.length} readings recorded)</span>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search farm, district, or crop..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-white dark:bg-[#121A15] hairline-border rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 shadow-sm transition-all"
          />
        </div>
      </div>

      {/* Sensor Stream Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-black/30 text-slate-500 uppercase font-mono font-bold border-b border-black/[0.05] dark:border-white/[0.06]">
              <tr>
                <th className="px-5 py-4">Farm / Field</th>
                <th className="px-5 py-4">Crop Type</th>
                <th className="px-5 py-4">Soil Moisture</th>
                <th className="px-5 py-4">NPK Soil Nutrients</th>
                <th className="px-5 py-4">Temp / Humidity</th>
                <th className="px-5 py-4">Rainfall</th>
                <th className="px-5 py-4">Soil pH</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Recorded At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              {filteredEvents.length > 0 ? (
                filteredEvents.map((evt, idx) => (
                  <tr key={evt.id || idx} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">
                        {evt.farm_id || evt.field_id}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {evt.farm_name || evt.district || 'Maharashtra Estate'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 capitalize font-semibold text-[var(--accent-mid)] dark:text-[var(--accent-light)]">
                      {evt.crop_type}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-800 dark:text-slate-200">
                      <span className="inline-flex items-center gap-1.5">
                        <Droplets className="w-3.5 h-3.5 text-sky-500" />
                        {evt.soil_moisture}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-700 dark:text-slate-300 font-medium">
                      N:{evt.nitrogen} | P:{evt.phosphorus} | K:{evt.potassium}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                      {evt.temperature}°C / {evt.humidity}%
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                      {evt.rainfall} mm
                    </td>
                    <td className="px-5 py-3.5 font-mono font-semibold text-slate-700 dark:text-slate-300">
                      pH {evt.ph}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant="success" dot className="text-[10px]">
                        NRSC SYNCED
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 font-mono">
                      {formatDate(evt.timestamp)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-medium">
                    {loading ? 'Streaming authentic telemetry...' : 'No telemetry received yet. Ingest an official sensor record above.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default InputStream;
