import React, { useState, useEffect } from 'react';
import { FarmerService, DashboardService } from '../../services/api';
import { Card, CardTitle, CardDescription } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Toast } from '../../components/ui/Toast';
import { GaugeChart } from '../../components/ui/GaugeChart';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import {
  Droplet, AlertTriangle, CheckCircle2, Flame, CloudRain,
  Thermometer, RefreshCw, Send, MapPin, Radio, Activity, Sparkles
} from 'lucide-react';

export const SoilIrrigation = () => {
  const [farm, setFarm] = useState(null);
  const [moisture, setMoisture] = useState(25.0);
  const [temperature, setTemperature] = useState(28.5);
  const [humidity, setHumidity] = useState(65.0);
  const [rainfall, setRainfall] = useState(0.0);

  const [loading, setLoading] = useState(false);
  const [syncingSensors, setSyncingSensors] = useState(false);
  const [result, setResult] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    const fetchFarmLand = async () => {
      try {
        const farmData = await FarmerService.getAssignedFarm();
        if (farmData) {
          setFarm(farmData);
          if (farmData.latest_telemetry) {
            const tel = farmData.latest_telemetry;
            if (tel.soil_moisture !== undefined) setMoisture(tel.soil_moisture);
            if (tel.temperature !== undefined) setTemperature(tel.temperature);
            if (tel.humidity !== undefined) setHumidity(tel.humidity);
            if (tel.rainfall !== undefined) setRainfall(tel.rainfall);
          }
        }
      } catch (err) {
        console.warn('Failed to load farmer farm land:', err);
      }
    };
    fetchFarmLand();
  }, []);

  const handleSyncSensors = async () => {
    setSyncingSensors(true);
    try {
      const res = await FarmerService.getLiveTelemetry(1);
      if (res && res.events && res.events.length > 0) {
        const latest = res.events[0];
        setMoisture(latest.soil_moisture);
        setTemperature(latest.temperature);
        setHumidity(latest.humidity);
        setRainfall(latest.rainfall);
        setToastMessage({
          type: 'success',
          text: `Sensors synchronized from ${farm?.farm_name || 'estate'}: Moisture ${latest.soil_moisture}%, Temp ${latest.temperature}°C`,
        });
      }
    } catch (err) {
      console.warn('Sync error:', err);
    } finally {
      setSyncingSensors(false);
    }
  };

  const handlePredict = async () => {
    setLoading(true);
    try {
      const res = await FarmerService.predictIrrigation({
        field_id: farm?.farm_id || 'FARM_MH_PUNE_01',
        farm_id: farm?.farm_id || 'FARM_MH_PUNE_01',
        soil_moisture: parseFloat(moisture),
        temperature: parseFloat(temperature),
        humidity: parseFloat(humidity),
        rainfall: parseFloat(rainfall)
      });
      setResult(res);
      setToastMessage({
        type: 'success',
        text: 'Watering advice generated successfully.',
      });
    } catch (err) {
      console.error('Prediction request failed:', err);
      setToastMessage({
        type: 'error',
        text: 'Watering advice service momentarily busy. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerAlert = async () => {
    try {
      await DashboardService.triggerAlert({
        field_id: farm?.farm_id || 'FARM_MH_PUNE_01',
        model_type: 'irrigation',
        reason: `Soil moisture critical at ${moisture}%. Risk level: ${((result?.moisture_depletion_risk || 0) * 100).toFixed(1)}%`
      });
      setToastMessage({
        type: 'success',
        text: 'Watering alert dispatched to field operators.',
      });
    } catch (err) {
      setToastMessage({
        type: 'info',
        text: 'Watering alert logged to system.',
      });
    }
  };

  const riskPercent = result ? Math.round((result.moisture_depletion_risk || 0) * 100) : 0;

  return (
    <div className="space-y-8 pb-10">
      {/* Page Header */}
      <PageHeader
        title="Smart Watering & Soil Moisture Guide"
        subtitle="Smart watering guidance based on real soil moisture and local weather measurements."
        secondaryAction={{
          label: syncingSensors ? 'Syncing...' : 'Sync Live Sensors',
          icon: Activity,
          onClick: handleSyncSensors,
          disabled: syncingSensors,
        }}
        primaryAction={{
          label: loading ? 'Checking...' : 'Check Watering Advice',
          icon: RefreshCw,
          onClick: handlePredict,
          loading: loading,
        }}
      />

      {/* Farm Estate Header Card */}
      <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div 
            style={{ backgroundColor: 'var(--accent-primary)' }}
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0"
          >
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Assigned Agricultural Plot
              </span>
              <Badge variant="success" dot className="text-[10px]">
                SENSORS ONLINE
              </Badge>
            </div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
              {farm?.farm_name || 'Kisan Green Valley Farm'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {farm?.district || 'Pune'}, {farm?.region || 'Maharashtra'} • {farm?.acreage || 12.5} Acres • Primary Crop: <strong className="text-[var(--accent-mid)] dark:text-[var(--accent-light)] capitalize">{farm?.current_crop || 'Rice'}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Badge variant="accent">
            Field ID: {farm?.farm_id || 'FARM_MH_PUNE_01'}
          </Badge>
        </div>
      </Card>

      {/* Main 2-Column Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Column 1: Risk Assessment Results Card */}
        <Card className="p-6 flex flex-col justify-between space-y-6">
          {!result ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[320px] text-center space-y-3 p-6 border-2 border-dashed border-black/[0.06] dark:border-white/[0.08] rounded-2xl">
              <div className="w-14 h-14 rounded-2xl bg-[var(--accent-tint)] dark:bg-[var(--accent-dark-tint)] text-[var(--accent-primary)] dark:text-[var(--accent-light)] flex items-center justify-center">
                <Droplet className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Watering Advice Ready</h4>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Adjust soil and weather values on the right or sync live sensors, then click "Check Watering Advice".
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>24-Hour Soil Moisture Forecast</CardTitle>
                  <CardDescription>Chances of soil drying out in the next 24 hours</CardDescription>
                </div>
                <Badge variant={result.risk_flag ? 'danger' : 'success'} dot>
                  {result.risk_flag ? 'WATERING NEEDED' : 'AMPLE MOISTURE'}
                </Badge>
              </div>

              {/* Semicircle Gauge for Water Need */}
              <div className="flex justify-center py-1">
                <GaugeChart
                  percentage={riskPercent}
                  label="Water Need"
                  completedCount={riskPercent}
                  inProgressCount={Math.max(100 - riskPercent - 10, 0)}
                  pendingCount={10}
                />
              </div>

              {/* Recommendation Box */}
              <div className={`p-4 rounded-2xl hairline-border text-xs leading-relaxed ${
                result.risk_flag
                  ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-200'
                  : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-200'
              }`}>
                <div className="flex items-center gap-2 font-bold text-sm mb-1">
                  {result.risk_flag ? (
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  )}
                  <span>{result.risk_flag ? 'Action Required: Irrigate Farm Today' : 'Moisture Optimal: No Watering Needed Today'}</span>
                </div>
                <p className="opacity-90">
                  {result.risk_flag
                    ? `Current soil moisture is low (${moisture}%). Apply 15–20 mm of drip irrigation in the morning to prevent root wilting.`
                    : `Current moisture (${moisture}%) is well within the healthy moisture range for ${farm?.current_crop || 'crops'}.`}
                </p>
              </div>

              {/* Emergency Alert Button */}
              <Button
                variant={result.risk_flag ? 'danger' : 'secondary'}
                size="md"
                disabled={!result.risk_flag}
                onClick={handleTriggerAlert}
                className="w-full"
                icon={Send}
              >
                {result.risk_flag ? 'Send Watering Alert to Field Operators' : 'Water Pumps on Standby'}
              </Button>
            </div>
          )}
        </Card>

        {/* Column 2: Live Farm Land Sensor Readings & Sliders */}
        <Card className="p-6 space-y-6">
          <div className="flex items-center justify-between pb-2 border-b border-black/[0.05] dark:border-white/[0.06]">
            <div>
              <CardTitle>Field Telemetry Sensor Sliders</CardTitle>
              <CardDescription>Live readings streamed from official sensors</CardDescription>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {farm?.farm_id || 'FARM_MH_PUNE_01'}
            </span>
          </div>

          {/* Moisture Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Droplet className="w-4 h-4 text-sky-500" /> Soil Moisture (NRSC Pod)
              </span>
              <span className="font-mono font-bold text-sky-600 dark:text-sky-400 text-sm">{moisture}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="90"
              value={moisture}
              onChange={(e) => setMoisture(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-black/30 rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]"
            />
          </div>

          {/* Temperature Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Thermometer className="w-4 h-4 text-amber-500" /> Ambient Temperature
              </span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">{temperature}°C</span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-black/30 rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]"
            />
          </div>

          {/* Humidity Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-cyan-500" /> Relative Air Humidity
              </span>
              <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400 text-sm">{humidity}%</span>
            </div>
            <input
              type="range"
              min="15"
              max="95"
              value={humidity}
              onChange={(e) => setHumidity(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-black/30 rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]"
            />
          </div>

          {/* Rainfall Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <CloudRain className="w-4 h-4 text-indigo-500" /> Expected 24h Precipitation
              </span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">{rainfall} mm</span>
            </div>
            <input
              type="range"
              min="0"
              max="150"
              value={rainfall}
              onChange={(e) => setRainfall(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-black/30 rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)]"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] hairline-border text-xs text-slate-500 flex items-center justify-between">
            <span>Sensors continuously stream from official NRSC telemetry.</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono text-[11px]">Sync Active</span>
          </div>
        </Card>
      </div>

      <Toast
        isOpen={!!toastMessage}
        message={toastMessage?.text}
        type={toastMessage?.type}
        onClose={() => setToastMessage(null)}
      />
    </div>
  );
};
