import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Settings as SettingsIcon, Globe, Bell, Save, CheckCircle } from 'lucide-react';

const STORAGE_KEY_THEME = 'agritech_theme';
const STORAGE_KEY_REFRESH = 'agritech_refresh_interval';
const STORAGE_KEY_AUTO_REFRESH = 'agritech_auto_refresh';

export const Settings = () => {
  // Load saved preferences from localStorage (with sensible defaults)
  const [autoRefresh, setAutoRefresh] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_AUTO_REFRESH);
    return saved !== null ? saved === 'true' : true;
  });

  const [refreshInterval, setRefreshInterval] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_REFRESH);
    return saved ? parseInt(saved, 10) : 5000;
  });

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_THEME) || 'dark';
  });

  const [saved, setSaved] = useState(false);

  // Persist to localStorage whenever any setting changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_AUTO_REFRESH, String(autoRefresh));
  }, [autoRefresh]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_REFRESH, String(refreshInterval));
  }, [refreshInterval]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_THEME, theme);
    // Apply theme class to document root for live preview
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Configure dashboard preferences. Changes are persisted automatically.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* API Connection Card (read-only) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-slate-500" />
              <CardTitle>API Connection</CardTitle>
            </div>
            <CardDescription>Backend service integration parameters (set via env variables).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Base URL
              </label>
              <input
                type="text"
                value={import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}
                disabled
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-500 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                API Key
              </label>
              <input
                type="password"
                value="••••••••••••••••"
                disabled
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-500 cursor-not-allowed"
              />
              <p className="text-xs text-slate-500 mt-1">Configured via environment variables.</p>
            </div>
          </CardContent>
        </Card>

        {/* Dashboard Preferences Card (interactive + persistent) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-slate-500" />
              <CardTitle>Dashboard Preferences</CardTitle>
            </div>
            <CardDescription>UI polling, theme, and display settings — saved to your browser.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Auto Refresh Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Auto Refresh
                </label>
                <p className="text-xs text-slate-500">Poll backend for new predictions</p>
              </div>
              <button
                id="toggle-auto-refresh"
                onClick={() => setAutoRefresh(prev => !prev)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  autoRefresh ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
                aria-pressed={autoRefresh}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    autoRefresh ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Refresh Interval Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Refresh Interval
                </label>
                <span className="text-sm font-bold text-emerald-400">
                  {(refreshInterval / 1000).toFixed(1)}s
                </span>
              </div>
              <input
                id="refresh-interval-slider"
                type="range"
                min={1000}
                max={30000}
                step={500}
                value={refreshInterval}
                onChange={e => setRefreshInterval(parseInt(e.target.value, 10))}
                disabled={!autoRefresh}
                className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>1s</span>
                <span>30s</span>
              </div>
            </div>

            {/* Theme Toggle */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Theme
              </label>
              <div className="flex gap-2" id="theme-toggle-group">
                {['dark', 'light'].map(t => (
                  <button
                    key={t}
                    id={`theme-${t}`}
                    onClick={() => setTheme(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
                      theme === t
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                        : 'border-slate-700 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <button
              id="save-settings-btn"
              onClick={handleSave}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all"
            >
              {saved ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Preferences
                </>
              )}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
