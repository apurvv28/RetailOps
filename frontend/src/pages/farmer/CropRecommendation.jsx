import React, { useState } from 'react';
import { FarmerService } from '../../services/api';
import { Sprout, Sparkles, CheckCircle2, RefreshCw, BarChart2 } from 'lucide-react';

export const CropRecommendation = () => {
  const [n, setN] = useState(90);
  const [p, setP] = useState(42);
  const [k, setK] = useState(43);
  const [temp, setTemp] = useState(20.8);
  const [hum, setHum] = useState(82.0);
  const [ph, setPh] = useState(6.5);
  const [rainfall, setRainfall] = useState(202.9);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState({
    recommended_crop: 'rice',
    confidence: 0.94,
    top_3_recommendations: [
      { crop: 'rice', confidence: 0.94 },
      { crop: 'jute', confidence: 0.04 },
      { crop: 'maize', confidence: 0.02 }
    ],
    llm_explanation: 'Rice thrives in clayey/loamy soil with high nitrogen (90 kg/ha) and high seasonal rainfall (>200 mm). The current climate and moisture levels provide ideal growing conditions.'
  });

  const handlePredict = async () => {
    setLoading(true);
    try {
      const res = await FarmerService.predictCrop({
        field_id: 'FARMER_FIELD_01',
        N: parseFloat(n),
        P: parseFloat(p),
        K: parseFloat(k),
        temperature: parseFloat(temp),
        humidity: parseFloat(hum),
        ph: parseFloat(ph),
        rainfall: parseFloat(rainfall)
      });
      setResult(res);
    } catch (err) {
      console.warn('Crop prediction fallback:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm mb-1">
            <Sprout className="w-4 h-4" /> Feature 2 of 4
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Crop Recommendation Engine</h2>
          <p className="text-slate-400 text-sm">Discover the most profitable and suitable crop for your farm's soil & climate</p>
        </div>

        <button
          onClick={handlePredict}
          disabled={loading}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-900/30 flex items-center gap-2 text-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Recommend Crop
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recommendation Results Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Top Recommended Crop
            </span>

            <div className="mt-4 p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-2xl uppercase">
                  🌾
                </div>
                <div>
                  <h3 className="text-2xl font-extrabold text-white capitalize">{result.recommended_crop}</h3>
                  <div className="text-xs text-emerald-400 font-semibold mt-0.5">
                    {Math.round(result.confidence * 100)}% Match Confidence
                  </div>
                </div>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
          </div>

          {/* Top 3 Crop Breakdown */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Alternative Top 3 Suitable Crops
            </h4>
            <div className="space-y-2.5">
              {result.top_3_recommendations?.map((item, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-white capitalize">{item.crop}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 bg-slate-800 rounded-full h-2">
                      <div
                        className="bg-emerald-500 h-2 rounded-full"
                        style={{ width: `${Math.round(item.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-300 w-10 text-right">
                      {Math.round(item.confidence * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Explanation Box */}
          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-indigo-300">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              NVIDIA Nemotron AI Insights
            </div>
            <p className="text-xs text-indigo-200 leading-relaxed">
              {result.llm_explanation}
            </p>
          </div>
        </div>

        {/* Soil & Climate Input Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <h3 className="font-bold text-white text-base mb-2 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-emerald-400" />
            Soil Nutrient & Climate Profile
          </h3>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Nitrogen (N)</label>
              <input
                type="number"
                value={n}
                onChange={(e) => setN(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Phosphorus (P)</label>
              <input
                type="number"
                value={p}
                onChange={(e) => setP(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Potassium (K)</label>
              <input
                type="number"
                value={k}
                onChange={(e) => setK(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Temperature (°C)</label>
              <input
                type="number"
                step="0.1"
                value={temp}
                onChange={(e) => setTemp(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Humidity (%)</label>
              <input
                type="number"
                step="0.1"
                value={hum}
                onChange={(e) => setHum(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Soil pH</label>
              <input
                type="number"
                step="0.1"
                value={ph}
                onChange={(e) => setPh(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Annual Rainfall (mm)</label>
              <input
                type="number"
                step="0.1"
                value={rainfall}
                onChange={(e) => setRainfall(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
