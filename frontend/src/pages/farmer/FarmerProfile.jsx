import React, { useState, useEffect } from 'react';
import { FarmerService } from '../../services/api';
import { Card, CardTitle, CardDescription } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/PageHeader';
import { Toast } from '../../components/ui/Toast';
import { User, MapPin, Sprout, Cpu, Save, CheckCircle2, Navigation, Radio, CloudSun } from 'lucide-react';

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
  const [weather, setWeather] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

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

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,rain`);
        const data = await res.json();
        if (data && data.current) {
          setWeather({
            temp: data.current.temperature_2m,
            humidity: data.current.relative_humidity_2m,
            rain: data.current.rain
          });
        }
      } catch (e) {
        console.warn('Weather fetch notice:', e);
      }
    };
    if (latitude && longitude) fetchWeather();
  }, [latitude, longitude]);

  const handleDetectGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(parseFloat(pos.coords.latitude.toFixed(6)));
          setLongitude(parseFloat(pos.coords.longitude.toFixed(6)));
          setToastMessage({
            type: 'success',
            text: `GPS coordinates locked: Lat ${pos.coords.latitude.toFixed(4)}, Lng ${pos.coords.longitude.toFixed(4)}`,
          });
        },
        () => {
          setToastMessage({
            type: 'info',
            text: 'Using regional default coordinates (Pune, Maharashtra).',
          });
        }
      );
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await FarmerService.updateProfile({
        farm_name: farmName,
        gps_latitude: parseFloat(latitude),
        gps_longitude: parseFloat(longitude),
        region: region,
        current_crops: currentCrops,
        sensors_config: sensors
      });
      setToastMessage({
        type: 'success',
        text: 'Farm profile and telemetry configurations saved successfully.',
      });
    } catch (err) {
      setToastMessage({
        type: 'error',
        text: 'Failed to update farmer profile.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-10 max-w-4xl mx-auto">
      {/* Fernly Page Header */}
      <PageHeader
        title="Farm Land Profile & Sensor Setup"
        subtitle="Manage GPS coordinates, active crops planted, and sandboxed telemetry sensor gateways."
      />

      {/* Weather Forecast Card */}
      {weather && (
        <Card className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <CloudSun className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Live Local Weather (Open-Meteo GPS Microclimate)
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                {weather.temp}°C
              </div>
              <div className="text-xs text-slate-500">
                Humidity: <strong>{weather.humidity}%</strong> • Precipitation: <strong>{weather.rain} mm</strong>
              </div>
            </div>
          </div>
          <Badge variant="accent">
            GPS Synchronized
          </Badge>
        </Card>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Farm Identity & GPS Location */}
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-black/[0.05] dark:border-white/[0.06]">
            <div>
              <CardTitle>Farm Identity & GPS Coordinates</CardTitle>
              <CardDescription>Official land registration and geospatial coordinates</CardDescription>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={Navigation}
              onClick={handleDetectGPS}
            >
              Detect My GPS
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Farm Name
              </label>
              <input
                type="text"
                value={farmName}
                onChange={(e) => setFarmName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)]"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Region / District
              </label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                GPS Latitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={latitude}
                onChange={(e) => setLatitude(parseFloat(e.target.value))}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)] font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                GPS Longitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={longitude}
                onChange={(e) => setLongitude(parseFloat(e.target.value))}
                className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)] font-mono"
                required
              />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] hairline-border flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2 font-mono">
              <MapPin className="w-4 h-4 text-[var(--accent-primary)] dark:text-[var(--accent-light)]" />
              <span>Plot Coordinates: {latitude}° N, {longitude}° E</span>
            </div>
            <Badge variant="success" dot className="text-[10px]">
              GPS Locked
            </Badge>
          </div>
        </Card>

        {/* Section 2: Current Crops Planted */}
        <Card className="p-6 space-y-4">
          <div className="border-b border-black/[0.05] dark:border-white/[0.06] pb-2">
            <CardTitle>Active Planted Crops</CardTitle>
            <CardDescription>Crops currently cultivated in the field</CardDescription>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Active Crops List (Comma-separated)
            </label>
            <input
              type="text"
              value={currentCrops}
              onChange={(e) => setCurrentCrops(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)]"
              placeholder="e.g. Paddy, Cotton, Wheat, Sugarcane"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {currentCrops.split(',').map((crop, idx) => (
              <span 
                key={idx} 
                className="px-3 py-1.5 rounded-full bg-[var(--accent-tint)] dark:bg-[var(--accent-dark-tint)] text-[var(--accent-primary)] dark:text-[var(--accent-light)] text-xs font-bold flex items-center gap-1.5 hairline-border"
              >
                <Sprout className="w-3.5 h-3.5" />
                {crop.trim()}
              </span>
            ))}
          </div>
        </Card>

        {/* Section 3: Telemetry Sensor Gateway Toggles */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.06] pb-2">
            <div>
              <CardTitle>Telemetry Sensor Pods</CardTitle>
              <CardDescription>Hardware telemetry sensors mapped to this farm land</CardDescription>
            </div>
            <Badge variant="accent">Sandboxed Gateways</Badge>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] hairline-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Radio className={`w-4 h-4 ${sensors.soil_moisture_sensor ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Soil Moisture Sensor Node #1</div>
                  <div className="text-[11px] text-slate-400">Continuous telemetry streaming rate (0.5s)</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={sensors.soil_moisture_sensor}
                onChange={(e) => setSensors({ ...sensors, soil_moisture_sensor: e.target.checked })}
                className="w-4 h-4 rounded text-[var(--accent-primary)] focus:ring-[var(--accent-light)] cursor-pointer"
              />
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] hairline-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Radio className={`w-4 h-4 ${sensors.npk_sensor ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`} />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">NPK Soil Spectrometer Probe Array</div>
                  <div className="text-[11px] text-slate-400">Multi-depth soil chemistry analysis</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={sensors.npk_sensor}
                onChange={(e) => setSensors({ ...sensors, npk_sensor: e.target.checked })}
                className="w-4 h-4 rounded text-[var(--accent-primary)] focus:ring-[var(--accent-light)] cursor-pointer"
              />
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] hairline-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Radio className={`w-4 h-4 ${sensors.weather_station ? 'text-sky-500 animate-pulse' : 'text-slate-400'}`} />
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Weather & Microclimate Station</div>
                  <div className="text-[11px] text-slate-400">Ambient temp, humidity & rainfall sensor</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={sensors.weather_station}
                onChange={(e) => setSensors({ ...sensors, weather_station: e.target.checked })}
                className="w-4 h-4 rounded text-[var(--accent-primary)] focus:ring-[var(--accent-light)] cursor-pointer"
              />
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          icon={Save}
          loading={loading}
          className="w-full"
        >
          Save Farmer Profile & Sensor Setup
        </Button>
      </form>

      <Toast
        isOpen={!!toastMessage}
        message={toastMessage?.text}
        type={toastMessage?.type}
        onClose={() => setToastMessage(null)}
      />
    </div>
  );
};
