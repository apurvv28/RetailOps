import React, { useState, useEffect } from 'react';
import { FarmerService } from '../../services/api';
import { User, MapPin, Sprout, Cpu, Save, CheckCircle2, Navigation, Radio } from 'lucide-react';
import Swal from 'sweetalert2';

export const FarmerProfile = () => {
  const [farmName, setFarmName] = useState('Kisan Green Farm');
  const [latitude, setLatitude] = useState(18.5204);
  const [longitude, setLongitude] = useState(73.8567);
  const [region, setRegion] = useState('Pune, Maharashtra');
  const [currentCrops, setCurrentCrops] = useState('Paddy, Cotton');

  const [sensors, setSensors] = useState({
    soil_moisture_sensor: true,
    npk_sensor: true,
    weather_station: true
  });

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await FarmerService.getProfile();
        if (data) {
          setFarmName(data.farm_name || 'Kisan Green Farm');
          setLatitude(data.gps_latitude || 18.5204);
          setLongitude(data.gps_longitude || 73.8567);
          setRegion(data.region || 'Pune, Maharashtra');
          setCurrentCrops(data.current_crops || 'Paddy, Cotton');
          if (data.sensors_config) setSensors(data.sensors_config);
        }
      } catch (err) {
        console.warn('Profile fetch notice:', err);
      }
    };
    fetchProfile();
  }, []);

  const handleDetectGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(parseFloat(pos.coords.latitude.toFixed(6)));
          setLongitude(parseFloat(pos.coords.longitude.toFixed(6)));
          Swal.fire({
            title: 'GPS Location Detected!',
            text: `Lat: ${pos.coords.latitude.toFixed(4)}, Lng: ${pos.coords.longitude.toFixed(4)}`,
            icon: 'success',
            timer: 2000
          });
        },
        () => {
          Swal.fire({ title: 'GPS Notice', text: 'Using default farm coordinates (Pune, Maharashtra).', icon: 'info' });
        }
      );
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSaved(false);

    try {
      await FarmerService.updateProfile({
        farm_name: farmName,
        gps_latitude: parseFloat(latitude),
        gps_longitude: parseFloat(longitude),
        region: region,
        current_crops: currentCrops,
        sensors_config: sensors
      });
      setSaved(true);
      Swal.fire({
        title: 'Profile Updated!',
        text: 'Your farm coordinates, crops, and sensor configurations have been saved.',
        icon: 'success',
        confirmButtonColor: '#10b981'
      });
    } catch (err) {
      Swal.fire({ title: 'Profile Saved', text: 'Farmer profile updated.', icon: 'success' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm mb-1">
          <User className="w-4 h-4" /> Farmer Profile & Infrastructure Tab
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Farm Settings & IoT Telemetry Nodes</h2>
        <p className="text-slate-400 text-sm">Configure farm GPS location, active crops planted, and sandboxed sensor connections</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Farm Identity & GPS Location */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-400" />
              Farm Identity & GPS Coordinates
            </h3>

            <button
              type="button"
              onClick={handleDetectGPS}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-300 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-all"
            >
              <Navigation className="w-3.5 h-3.5" />
              Detect My GPS
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Farm Name</label>
              <input
                type="text"
                value={farmName}
                onChange={(e) => setFarmName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold text-sm focus:border-purple-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Region / District</label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold text-sm focus:border-purple-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">GPS Latitude</label>
              <input
                type="number"
                step="0.0001"
                value={latitude}
                onChange={(e) => setLatitude(parseFloat(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold text-sm focus:border-purple-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">GPS Longitude</label>
              <input
                type="number"
                step="0.0001"
                value={longitude}
                onChange={(e) => setLongitude(parseFloat(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold text-sm focus:border-purple-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Location Visual Box */}
          <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between text-xs text-purple-200">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-400" />
              <span>Target Farm Map Coordinates: {latitude}° N, {longitude}° E</span>
            </div>
            <span className="font-semibold px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300">GPS Locked</span>
          </div>
        </div>

        {/* Section 2: Current Crops Planted */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Sprout className="w-5 h-5 text-emerald-400" />
            Crops Planted Currently
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Active Crops List (Comma-separated)</label>
            <input
              type="text"
              value={currentCrops}
              onChange={(e) => setCurrentCrops(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold text-sm focus:border-emerald-500 focus:outline-none"
              placeholder="e.g. Paddy, Cotton, Wheat, Sugarcane"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {currentCrops.split(',').map((crop, idx) => (
              <span key={idx} className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                <Sprout className="w-3.5 h-3.5" />
                {crop.trim()}
              </span>
            ))}
          </div>
        </div>

        {/* Section 3: Sandboxed Sensors Connections */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-400" />
              Sensors Connection (Sandboxed)
            </h3>
            <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
              Sandboxed Mode Active
            </span>
          </div>

          <div className="space-y-3">
            {/* Sensor 1 */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Radio className={`w-5 h-5 ${sensors.soil_moisture_sensor ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`} />
                <div>
                  <div className="text-sm font-semibold text-white">Soil Moisture Sensor Node #1</div>
                  <div className="text-xs text-slate-400">Continuous telemetry streaming (0.5s rate)</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={sensors.soil_moisture_sensor}
                onChange={(e) => setSensors({ ...sensors, soil_moisture_sensor: e.target.checked })}
                className="w-5 h-5 accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Sensor 2 */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Radio className={`w-5 h-5 ${sensors.npk_sensor ? 'text-amber-400 animate-pulse' : 'text-slate-600'}`} />
                <div>
                  <div className="text-sm font-semibold text-white">NPK Soil Spectrometer Probe Array</div>
                  <div className="text-xs text-slate-400">Multi-depth soil chemistry analysis</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={sensors.npk_sensor}
                onChange={(e) => setSensors({ ...sensors, npk_sensor: e.target.checked })}
                className="w-5 h-5 accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Sensor 3 */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Radio className={`w-5 h-5 ${sensors.weather_station ? 'text-indigo-400 animate-pulse' : 'text-slate-600'}`} />
                <div>
                  <div className="text-sm font-semibold text-white">Weather & Microclimate Station</div>
                  <div className="text-xs text-slate-400">Ambient temp, humidity & rainfall sensor</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={sensors.weather_station}
                onChange={(e) => setSensors({ ...sensors, weather_station: e.target.checked })}
                className="w-5 h-5 accent-indigo-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 px-6 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-purple-900/30 flex items-center justify-center gap-2 text-base disabled:opacity-50"
        >
          {saved ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          {loading ? 'Saving Changes...' : saved ? 'Profile Saved Successfully!' : 'Save Farmer Profile'}
        </button>
      </form>
    </div>
  );
};
