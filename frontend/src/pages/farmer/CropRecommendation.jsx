import React, { useState, useEffect } from 'react';
import { FarmerService } from '../../services/api';
import { Card, CardTitle, CardDescription } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Toast } from '../../components/ui/Toast';
import { Sprout, Sparkles, CheckCircle2, RefreshCw, Radio, MapPin } from 'lucide-react';

export const CropRecommendation = () => {
  const [farm, setFarm] = useState(null);
  const [n, setN] = useState(90);
  const [p, setP] = useState(42);
  const [k, setK] = useState(43);
  const [temp, setTemp] = useState(20.8);
  const [hum, setHum] = useState(82.0);
  const [ph, setPh] = useState(6.5);
  const [rainfall, setRainfall] = useState(202.9);

  const [loading, setLoading] = useState(false);
  const [syncingSensors, setSyncingSensors] = useState(false);
  const [result, setResult] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    const fetchFarmData = async () => {
      try {
        const farmData = await FarmerService.getAssignedFarm();
        if (farmData) {
          setFarm(farmData);
          if (farmData.latest_telemetry) {
            const tel = farmData.latest_telemetry;
            if (tel.nitrogen !== undefined) setN(tel.nitrogen);
            if (tel.phosphorus !== undefined) setP(tel.phosphorus);
            if (tel.potassium !== undefined) setK(tel.potassium);
            if (tel.temperature !== undefined) setTemp(tel.temperature);
            if (tel.humidity !== undefined) setHum(tel.humidity);
            if (tel.ph !== undefined) setPh(tel.ph);
            if (tel.rainfall !== undefined) setRainfall(tel.rainfall > 0 ? tel.rainfall : 202.9);
          }
        }
      } catch (err) {
        console.warn('Failed to load farmer farm in crop recommender:', err);
      }
    };
    fetchFarmData();
  }, []);

  const handleSyncSensors = async () => {
    setSyncingSensors(true);
    try {
      const res = await FarmerService.getLiveTelemetry(1);
      if (res && res.events && res.events.length > 0) {
        const latest = res.events[0];
        if (latest.nitrogen !== undefined) setN(latest.nitrogen);
        if (latest.phosphorus !== undefined) setP(latest.phosphorus);
        if (latest.potassium !== undefined) setK(latest.potassium);
        if (latest.temperature !== undefined) setTemp(latest.temperature);
        if (latest.humidity !== undefined) setHum(latest.humidity);
        if (latest.ph !== undefined) setPh(latest.ph);
        if (latest.rainfall !== undefined) setRainfall(latest.rainfall > 0 ? latest.rainfall : 202.9);

        setToastMessage({
          type: 'success',
          text: `Sensors synchronized from ${farm?.farm_name || 'land'}: N=${latest.nitrogen}, P=${latest.phosphorus}, K=${latest.potassium}`,
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
      const res = await FarmerService.predictCrop({
        field_id: farm?.farm_id || 'FARM_MH_PUNE_01',
        N: parseFloat(n) || 90.0,
        P: parseFloat(p) || 42.0,
        K: parseFloat(k) || 43.0,
        temperature: parseFloat(temp) || 20.8,
        humidity: parseFloat(hum) || 82.0,
        ph: parseFloat(ph) || 6.5,
        rainfall: parseFloat(rainfall) || 202.9
      });
      setResult(res);
      setToastMessage({
        type: 'success',
        text: `Optimal crop recommendation calculated: ${res.recommended_crop}`,
      });
    } catch (err) {
      console.warn('Crop prediction fallback:', err);
      setToastMessage({
        type: 'error',
        text: 'Could not calculate crop recommendation. Please verify input fields.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Page Header */}
      <PageHeader
        title="Best Crop Recommendation Guide"
        subtitle={`Discover which crop will produce the best yield based on soil nutrients and climate (${farm?.farm_name || 'My Farm'}).`}
        primaryAction={{
          label: loading ? 'Analyzing Soil...' : 'Find Best Crop For My Land',
          icon: RefreshCw,
          onClick: handlePredict,
          loading: loading,
        }}
        secondaryAction={{
          label: syncingSensors ? 'Syncing...' : 'Sync Live Sensors',
          icon: Radio,
          onClick: handleSyncSensors,
          loading: syncingSensors,
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recommendation Results Card */}
        <Card className="p-6 flex flex-col justify-between space-y-6">
          {!result ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[340px] text-center space-y-3 p-6 border-2 border-dashed border-black/[0.06] dark:border-white/[0.08] rounded-2xl">
              <div className="w-14 h-14 rounded-2xl bg-[var(--accent-tint)] dark:bg-[var(--accent-dark-tint)] text-[var(--accent-primary)] dark:text-[var(--accent-light)] flex items-center justify-center">
                <Sprout className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Recommendation Ready</h4>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Adjust soil nutrients and weather values on the right, then click "Find Best Crop For My Land".
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Recommended Crop
                  </span>
                  <Badge variant="success" dot>
                    Best Match
                  </Badge>
                </div>

                <div className="p-5 rounded-2xl bg-[var(--accent-tint)] dark:bg-[var(--accent-dark-tint)] hairline-border flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-black/20 hairline-border flex items-center justify-center text-2xl shadow-sm">
                      🌾
                    </div>
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-900 dark:text-white capitalize">
                        {result.recommended_crop}
                      </h3>
                      <p className="text-xs font-semibold text-[var(--accent-mid)] dark:text-[var(--accent-light)] mt-0.5">
                        {Math.round((result.confidence || 0.94) * 100)}% Suitability Match
                      </p>
                    </div>
                  </div>
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
              </div>

              {/* Alternative Top 3 Crop Breakdown */}
              {result.top_3_recommendations && (
                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Other Suitable Crops
                  </h4>
                  <div className="space-y-2">
                    {result.top_3_recommendations.map((item, idx) => (
                      <div 
                        key={idx} 
                        className="p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.03] hairline-border flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-bold text-[10px] flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white capitalize">{item.crop}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-20 bg-slate-200 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ 
                                width: `${Math.round(item.confidence * 100)}%`,
                                backgroundColor: 'var(--accent-primary)' 
                              }}
                            />
                          </div>
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-300 w-8 text-right">
                            {Math.round(item.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Agronomist Explanation */}
              {result.llm_explanation && (
                <div className="p-4 rounded-2xl bg-stripe-texture text-white shadow-md space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-emerald-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    Agricultural Expert Advice
                  </div>
                  <p className="text-xs text-white/90 leading-relaxed font-medium">
                    {result.llm_explanation}
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Soil Nutrient & Climate Profile Input Form */}
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-black/[0.05] dark:border-white/[0.06]">
            <div>
              <CardTitle>Soil Nutrient & Climate Profile</CardTitle>
              <CardDescription>Laboratory test results or regional soil sensor values</CardDescription>
            </div>
            <Badge variant="accent">NPK Test</Badge>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Nitrogen (N)
              </label>
              <input
                type="number"
                value={n}
                onChange={(e) => setN(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Phosphorus (P)
              </label>
              <input
                type="number"
                value={p}
                onChange={(e) => setP(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Potassium (K)
              </label>
              <input
                type="number"
                value={k}
                onChange={(e) => setK(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Temperature (°C)
              </label>
              <input
                type="number"
                step="0.1"
                value={temp}
                onChange={(e) => setTemp(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Humidity (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={hum}
                onChange={(e) => setHum(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Soil pH
              </label>
              <input
                type="number"
                step="0.1"
                value={ph}
                onChange={(e) => setPh(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Annual Rainfall (mm)
              </label>
              <input
                type="number"
                step="0.1"
                value={rainfall}
                onChange={(e) => setRainfall(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)]"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] hairline-border text-xs text-slate-500">
            Calibrated on authentic Indian crop datasets (22 crop varieties tested).
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
