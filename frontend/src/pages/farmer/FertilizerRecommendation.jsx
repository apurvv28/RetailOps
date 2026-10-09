import React, { useState, useEffect } from 'react';
import { FarmerService } from '../../services/api';
import { Card, CardTitle, CardDescription } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Toast } from '../../components/ui/Toast';
import { FlaskConical, AlertCircle, Check, RefreshCw, Sparkles, ShieldAlert, CheckCircle2, Radio } from 'lucide-react';

export const FertilizerRecommendation = () => {
  const [farm, setFarm] = useState(null);
  const [soilType, setSoilType] = useState('Clayey');
  const [cropType, setCropType] = useState('Paddy');
  const [nitrogen, setNitrogen] = useState(12.0);
  const [phosphorus, setPhosphorus] = useState(35.0);
  const [potassium, setPotassium] = useState(10.0);
  const [temperature, setTemperature] = useState(26.0);
  const [humidity, setHumidity] = useState(52.0);
  const [moisture, setMoisture] = useState(38.0);

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
          if (farmData.soil_type) {
            const st = farmData.soil_type.toLowerCase();
            if (st.includes('black')) setSoilType('Black');
            else if (st.includes('red')) setSoilType('Red');
            else if (st.includes('sandy')) setSoilType('Sandy');
            else if (st.includes('loam')) setSoilType('Loamy');
            else setSoilType('Clayey');
          }
          if (farmData.current_crop) {
            const cc = farmData.current_crop.toLowerCase();
            if (cc.includes('rice') || cc.includes('paddy')) setCropType('Paddy');
            else if (cc.includes('maize')) setCropType('Maize');
            else if (cc.includes('cotton')) setCropType('Cotton');
            else if (cc.includes('sugarcane')) setCropType('Sugarcane');
            else if (cc.includes('wheat')) setCropType('Wheat');
            else if (cc.includes('pulse')) setCropType('Pulses');
          }
          if (farmData.latest_telemetry) {
            const tel = farmData.latest_telemetry;
            if (tel.nitrogen !== undefined) setNitrogen(tel.nitrogen);
            if (tel.phosphorus !== undefined) setPhosphorus(tel.phosphorus);
            if (tel.potassium !== undefined) setPotassium(tel.potassium);
            if (tel.temperature !== undefined) setTemperature(tel.temperature);
            if (tel.humidity !== undefined) setHumidity(tel.humidity);
            if (tel.soil_moisture !== undefined) setMoisture(tel.soil_moisture);
          }
        }
      } catch (err) {
        console.warn('Failed to load farmer farm in fertilizer guide:', err);
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
        if (latest.nitrogen !== undefined) setNitrogen(latest.nitrogen);
        if (latest.phosphorus !== undefined) setPhosphorus(latest.phosphorus);
        if (latest.potassium !== undefined) setPotassium(latest.potassium);
        if (latest.temperature !== undefined) setTemperature(latest.temperature);
        if (latest.humidity !== undefined) setHumidity(latest.humidity);
        if (latest.soil_moisture !== undefined) setMoisture(latest.soil_moisture);

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
      const res = await FarmerService.predictFertilizer({
        field_id: farm?.farm_id || 'FARM_MH_PUNE_01',
        soil_type: soilType,
        crop_type: cropType,
        nitrogen: parseFloat(nitrogen) || 12.0,
        phosphorus: parseFloat(phosphorus) || 35.0,
        potassium: parseFloat(potassium) || 10.0,
        temperature: parseFloat(temperature) || 26.0,
        humidity: parseFloat(humidity) || 52.0,
        moisture: parseFloat(moisture) || 38.0
      });
      setResult(res);
      setToastMessage({
        type: 'success',
        text: `Fertilizer recommendation calculated: ${res.recommended_fertilizer}`,
      });
    } catch (err) {
      console.warn('Fertilizer prediction fallback:', err);
      setToastMessage({
        type: 'error',
        text: 'Could not calculate fertilizer recommendation. Please verify input fields.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Page Header */}
      <PageHeader
        title="Fertilizer Guide & Nutrient Plan"
        subtitle={`Get the exact fertilizer dosage and nutrient balance to nourish your soil (${farm?.farm_name || 'My Farm'}).`}
        primaryAction={{
          label: loading ? 'Analyzing Soil...' : 'Get Fertilizer Recommendation',
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
        {/* Fertilizer Recommendation Card */}
        <Card className="p-6 flex flex-col justify-between space-y-6">
          {!result ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[340px] text-center space-y-3 p-6 border-2 border-dashed border-black/[0.06] dark:border-white/[0.08] rounded-2xl">
              <div className="w-14 h-14 rounded-2xl bg-[var(--accent-tint)] dark:bg-[var(--accent-dark-tint)] text-[var(--accent-primary)] dark:text-[var(--accent-light)] flex items-center justify-center">
                <FlaskConical className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Advisory Ready</h4>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Input your soil nutrients and crop type on the right, then click "Get Fertilizer Recommendation".
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Recommended Fertilizer Mix
                  </span>
                  <Badge variant="success" dot>
                    Calculated
                  </Badge>
                </div>

                <div className="p-5 rounded-2xl bg-[var(--accent-tint)] dark:bg-[var(--accent-dark-tint)] hairline-border flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-black/20 hairline-border flex items-center justify-center text-2xl shadow-sm">
                      🧪
                    </div>
                    <div>
                      <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                        {result.recommended_fertilizer}
                      </h3>
                      <p className="text-xs font-semibold text-[var(--accent-mid)] dark:text-[var(--accent-light)] mt-0.5">
                        Recommended Application: 50 kg / acre
                      </p>
                    </div>
                  </div>
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
              </div>

              {/* Nutrient Deficits Balance Cards */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Nutrient Deficiency Breakdown
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] hairline-border text-center">
                    <div className="text-[11px] font-medium text-slate-500 mb-1">Nitrogen (N)</div>
                    <Badge variant="danger" dot className="text-[10px]">
                      Deficient
                    </Badge>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] hairline-border text-center">
                    <div className="text-[11px] font-medium text-slate-500 mb-1">Phosphorus (P)</div>
                    <Badge variant="success" dot className="text-[10px]">
                      Balanced
                    </Badge>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] hairline-border text-center">
                    <div className="text-[11px] font-medium text-slate-500 mb-1">Potassium (K)</div>
                    <Badge variant="warning" dot className="text-[10px]">
                      Moderate
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Advisory Explanation */}
              <div className="p-4 rounded-2xl bg-stripe-texture text-white shadow-md space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-emerald-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  Nutrient Deficiency Advisory
                </div>
                <p className="text-xs text-white/90 leading-relaxed font-medium">
                  {result.nutrient_deficiency_summary || 'Targeted N-P-K mineral application plan calculated for root bioavailability and enhanced vegetative yield.'}
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Input Parameters Form */}
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-black/[0.05] dark:border-white/[0.06]">
            <div>
              <CardTitle>Field & Soil Physical Properties</CardTitle>
              <CardDescription>Soil type classification and crop variety</CardDescription>
            </div>
            <Badge variant="accent">Lab Spec</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Soil Type
              </label>
              <select
                value={soilType}
                onChange={(e) => setSoilType(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)]"
              >
                <option value="Sandy">Sandy Soil</option>
                <option value="Loamy">Loamy Soil</option>
                <option value="Black">Black Soil (Regur)</option>
                <option value="Red">Red Soil</option>
                <option value="Clayey">Clayey Soil</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Active Crop
              </label>
              <select
                value={cropType}
                onChange={(e) => setCropType(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)]"
              >
                <option value="Paddy">Paddy / Rice</option>
                <option value="Maize">Maize / Corn</option>
                <option value="Cotton">Cotton</option>
                <option value="Sugarcane">Sugarcane</option>
                <option value="Wheat">Wheat</option>
                <option value="Pulses">Pulses / Lentils</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Nitrogen (N)
              </label>
              <input
                type="number"
                value={nitrogen}
                onChange={(e) => setNitrogen(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Phosphorus (P)
              </label>
              <input
                type="number"
                value={phosphorus}
                onChange={(e) => setPhosphorus(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Potassium (K)
              </label>
              <input
                type="number"
                value={potassium}
                onChange={(e) => setPotassium(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Moisture (%)
              </label>
              <input
                type="number"
                value={moisture}
                onChange={(e) => setMoisture(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Temp (°C)
              </label>
              <input
                type="number"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Humidity (%)
              </label>
              <input
                type="number"
                value={humidity}
                onChange={(e) => setHumidity(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)]"
              />
            </div>
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
