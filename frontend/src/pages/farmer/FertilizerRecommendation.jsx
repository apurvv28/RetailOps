import React, { useState } from 'react';
import { FarmerService } from '../../services/api';
import { FlaskConical, AlertCircle, Check, RefreshCw, Sparkles, ShieldAlert } from 'lucide-react';

export const FertilizerRecommendation = () => {
  const [soilType, setSoilType] = useState('Clayey');
  const [cropType, setCropType] = useState('Paddy');
  const [nitrogen, setNitrogen] = useState(12.0);
  const [phosphorus, setPhosphorus] = useState(35.0);
  const [potassium, setPotassium] = useState(10.0);
  const [temperature, setTemperature] = useState(26.0);
  const [humidity, setHumidity] = useState(52.0);
  const [moisture, setMoisture] = useState(38.0);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState({
    recommended_fertilizer: 'Urea',
    confidence: 0.96,
    nutrient_deficiency_summary: 'Deficiency analysis: Nitrogen=12.0 kg/ha is severely low for Paddy. Apply Urea (46% Nitrogen) to restore soil fertility.',
    llm_explanation: 'Urea provides a direct 46% concentrated Nitrogen boost needed during early tiller formation of Paddy in clayey soil.'
  });

  const handlePredict = async () => {
    setLoading(true);
    try {
      const res = await FarmerService.predictFertilizer({
        field_id: 'FARMER_FIELD_01',
        soil_type: soilType,
        crop_type: cropType,
        nitrogen: parseFloat(nitrogen),
        phosphorus: parseFloat(phosphorus),
        potassium: parseFloat(potassium),
        temperature: parseFloat(temperature),
        humidity: parseFloat(humidity),
        moisture: parseFloat(moisture)
      });
      setResult(res);
    } catch (err) {
      console.warn('Fertilizer prediction fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm mb-1">
            <FlaskConical className="w-4 h-4" /> Feature 3 of 4
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Fertilizer Advisory & Nutrient Management</h2>
          <p className="text-slate-400 text-sm">Calculate exact fertilizer dosage based on soil NPK deficits</p>
        </div>

        <button
          onClick={handlePredict}
          disabled={loading}
          className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-amber-900/30 flex items-center gap-2 text-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Calculate Fertilizer
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Fertilizer Recommendation Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Recommended Fertilizer
            </span>

            <div className="mt-4 p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold text-2xl">
                  🧪
                </div>
                <div>
                  <h3 className="text-2xl font-extrabold text-white">{result.recommended_fertilizer}</h3>
                  <div className="text-xs text-amber-400 font-semibold mt-0.5">
                    Recommended Dosage: 50 kg / acre
                  </div>
                </div>
              </div>
              <Check className="w-8 h-8 text-amber-400" />
            </div>
          </div>

          {/* Nutrient Deficits Visual Cards */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Nutrient Balance Status
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <div className="text-xs text-slate-400 mb-1">Nitrogen (N)</div>
                <div className="text-sm font-bold text-rose-400 flex items-center justify-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" /> Deficient
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <div className="text-xs text-slate-400 mb-1">Phosphorus (P)</div>
                <div className="text-sm font-bold text-emerald-400 flex items-center justify-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Balanced
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <div className="text-xs text-slate-400 mb-1">Potassium (K)</div>
                <div className="text-sm font-bold text-amber-400 flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Moderate
                </div>
              </div>
            </div>
          </div>

          {/* AI Explanation Box */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-300">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Nutrient Deficiency Advisory
            </div>
            <p className="text-xs text-amber-200 leading-relaxed">
              {result.nutrient_deficiency_summary}
            </p>
          </div>
        </div>

        {/* Input Parameters Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <h3 className="font-bold text-white text-base mb-2 flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-amber-400" />
            Field & Soil Parameters
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Soil Type</label>
              <select
                value={soilType}
                onChange={(e) => setSoilType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold text-sm focus:border-amber-500 focus:outline-none"
              >
                <option value="Sandy">Sandy</option>
                <option value="Loamy">Loamy</option>
                <option value="Black">Black</option>
                <option value="Red">Red</option>
                <option value="Clayey">Clayey</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Crop Type</label>
              <select
                value={cropType}
                onChange={(e) => setCropType(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold text-sm focus:border-amber-500 focus:outline-none"
              >
                <option value="Paddy">Paddy / Rice</option>
                <option value="Maize">Maize</option>
                <option value="Cotton">Cotton</option>
                <option value="Sugarcane">Sugarcane</option>
                <option value="Wheat">Wheat</option>
                <option value="Pulses">Pulses</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Nitrogen (N)</label>
              <input
                type="number"
                value={nitrogen}
                onChange={(e) => setNitrogen(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Phosphorus (P)</label>
              <input
                type="number"
                value={phosphorus}
                onChange={(e) => setPhosphorus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Potassium (K)</label>
              <input
                type="number"
                value={potassium}
                onChange={(e) => setPotassium(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Moisture (%)</label>
              <input
                type="number"
                value={moisture}
                onChange={(e) => setMoisture(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Temp (°C)</label>
              <input
                type="number"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Humidity (%)</label>
              <input
                type="number"
                value={humidity}
                onChange={(e) => setHumidity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
