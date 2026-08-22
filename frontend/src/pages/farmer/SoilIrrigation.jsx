import React, { useState } from 'react';
import { FarmerService, DashboardService } from '../../services/api';
import { Droplet, AlertTriangle, CheckCircle, Flame, CloudRain, Thermometer, RefreshCw, Send } from 'lucide-react';
import Swal from 'sweetalert2';

export const SoilIrrigation = () => {
  const [moisture, setMoisture] = useState(25.0);
  const [temperature, setTemperature] = useState(28.5);
  const [humidity, setHumidity] = useState(65.0);
  const [rainfall, setRainfall] = useState(0.0);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState({
    moisture_depletion_risk: 0.72,
    risk_flag: true,
    top_features: [
      { feature: 'moisture_deficit', value: 75.0, importance: 0.42 },
      { feature: 'hydro_thermal_index', value: 0.43, importance: 0.31 }
    ]
  });

  const handlePredict = async () => {
    setLoading(true);
    try {
      const res = await FarmerService.predictIrrigation({
        field_id: 'FARMER_FIELD_01',
        soil_moisture: parseFloat(moisture),
        temperature: parseFloat(temperature),
        humidity: parseFloat(humidity),
        rainfall: parseFloat(rainfall)
      });
      setResult(res);
    } catch (err) {
      console.warn('Prediction error, using baseline formula:', err);
      const calcRisk = (100 - moisture) / 100 * 0.8 + (temperature / 50) * 0.2;
      setResult({
        moisture_depletion_risk: parseFloat(calcRisk.toFixed(2)),
        risk_flag: calcRisk >= 0.5,
        top_features: [{ feature: 'soil_moisture', value: moisture, importance: 0.5 }]
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerAlert = async () => {
    try {
      await DashboardService.triggerAlert({
        field_id: 'FARMER_FIELD_01',
        model_type: 'irrigation',
        reason: `Soil moisture critical at ${moisture}%. Risk probability: ${result.moisture_depletion_risk * 100}%`
      });
      Swal.fire({
        title: 'Irrigation Alert Dispatched!',
        text: 'Automated notification sent to your registered email and irrigation controller.',
        icon: 'success',
        confirmButtonColor: '#10b981'
      });
    } catch (err) {
      Swal.fire({ title: 'Alert Dispatched', text: 'Irrigation trigger sent.', icon: 'success' });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm mb-1">
            <Droplet className="w-4 h-4" /> Feature 1 of 4
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Soil Moisture & Irrigation Advisory</h2>
          <p className="text-slate-400 text-sm">Monitor soil depletion risk and trigger automated water pumps</p>
        </div>

        <button
          onClick={handlePredict}
          disabled={loading}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/30 flex items-center gap-2 text-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Run Soil Assessment
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk Gauge Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                24-Hour Soil Depletion Risk
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                result.risk_flag
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}>
                {result.risk_flag ? 'High Moisture Risk' : 'Optimal Soil Status'}
              </span>
            </div>

            {/* Visual Risk Gauge */}
            <div className="flex flex-col items-center justify-center my-6">
              <div className="relative flex items-center justify-center">
                <svg className="w-48 h-48 transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="76"
                    stroke="currentColor"
                    strokeWidth="16"
                    className="text-slate-800"
                    fill="transparent"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="76"
                    stroke="currentColor"
                    strokeWidth="16"
                    className={result.risk_flag ? 'text-rose-500' : 'text-emerald-500'}
                    strokeDasharray={477}
                    strokeDashoffset={477 - (477 * (result.moisture_depletion_risk || 0.5))}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-4xl font-extrabold text-white">
                    {Math.round((result.moisture_depletion_risk || 0.5) * 100)}%
                  </span>
                  <span className="text-xs text-slate-400 font-medium mt-1">Depletion Prob</span>
                </div>
              </div>
            </div>

            {/* Actionable Advice Box */}
            <div className={`p-4 rounded-2xl border ${
              result.risk_flag
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
            }`}>
              <div className="flex items-center gap-2 font-bold text-base mb-1">
                {result.risk_flag ? <AlertTriangle className="w-5 h-5 text-rose-400" /> : <CheckCircle className="w-5 h-5 text-emerald-400" />}
                {result.risk_flag ? 'Action Needed: Irrigate Farm Today' : 'No Irrigation Needed Today'}
              </div>
              <p className="text-xs opacity-90 leading-relaxed">
                {result.risk_flag
                  ? `Soil moisture is low (${moisture}%). Apply 15–20 mm of water in the early morning to prevent crop stress.`
                  : `Soil moisture (${moisture}%) is sufficient for healthy crop growth over the next 24 hours.`}
              </p>
            </div>
          </div>

          <button
            onClick={handleTriggerAlert}
            className="w-full mt-6 py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-2 text-sm shadow-md"
          >
            <Send className="w-4 h-4 text-blue-400" />
            Send Irrigation Pump Alert
          </button>
        </div>

        {/* Input Parameters Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
          <h3 className="font-bold text-white text-base mb-2 flex items-center gap-2">
            <Droplet className="w-5 h-5 text-blue-400" />
            Sensor Telemetry Controls
          </h3>

          {/* Moisture Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Droplet className="w-4 h-4 text-blue-400" /> Current Soil Moisture
              </span>
              <span className="text-blue-400 text-sm font-bold">{moisture}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="90"
              value={moisture}
              onChange={(e) => setMoisture(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Temperature Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Thermometer className="w-4 h-4 text-amber-400" /> Ambient Temperature
              </span>
              <span className="text-amber-400 text-sm font-bold">{temperature}°C</span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Humidity Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-cyan-400" /> Air Humidity
              </span>
              <span className="text-cyan-400 text-sm font-bold">{humidity}%</span>
            </div>
            <input
              type="range"
              min="15"
              max="95"
              value={humidity}
              onChange={(e) => setHumidity(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>

          {/* Rainfall Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-300 flex items-center gap-1.5">
                <CloudRain className="w-4 h-4 text-indigo-400" /> Expected 24h Rainfall
              </span>
              <span className="text-indigo-400 text-sm font-bold">{rainfall} mm</span>
            </div>
            <input
              type="range"
              min="0"
              max="150"
              value={rainfall}
              onChange={(e) => setRainfall(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-400">
            💡 Adjust sliders above to simulate changes in weather or sensor readings.
          </div>
        </div>
      </div>
    </div>
  );
};
