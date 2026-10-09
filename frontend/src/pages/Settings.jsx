import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { Toast } from '../components/ui/Toast';
import { Tabs } from '../components/ui/Tabs';
import { PALETTES, applyAccentTheme, getActiveAccentTheme } from '../utils/theme';
import { LanguageSelector } from '../components/ui/LanguageSelector';
import { 
  Settings as SettingsIcon, Globe, Bell, Save, CheckCircle, 
  Palette, User, Calendar, Shield, Sliders, Languages
} from 'lucide-react';
import { cn } from '../utils/cn';

const STORAGE_KEY_THEME = 'agritech_theme';
const STORAGE_KEY_REFRESH = 'agritech_refresh_interval';
const STORAGE_KEY_AUTO_REFRESH = 'agritech_auto_refresh';
const STORAGE_KEY_WEEK_START = 'fernly_week_start';

export const Settings = () => {
  const [activeSection, setActiveSection] = useState('appearance');
  const [activeAccent, setActiveAccent] = useState(() => getActiveAccentTheme());
  const [weekStart, setWeekStart] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_WEEK_START) || 'Monday';
    } catch {
      return 'Monday';
    }
  });

  const [autoRefresh, setAutoRefresh] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_AUTO_REFRESH);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [refreshInterval, setRefreshInterval] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_REFRESH);
      return saved ? parseInt(saved, 10) : 5000;
    } catch {
      return 5000;
    }
  });

  const [themeMode, setThemeMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_THEME) || 'dark';
    } catch {
      return 'dark';
    }
  });

  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_AUTO_REFRESH, String(autoRefresh));
    } catch (e) {}
  }, [autoRefresh]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_REFRESH, String(refreshInterval));
    } catch (e) {}
  }, [refreshInterval]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WEEK_START, weekStart);
    } catch (e) {}
  }, [weekStart]);

  const handlePaletteSelect = (paletteId) => {
    setActiveAccent(paletteId);
    applyAccentTheme(paletteId);
    setToastMessage({
      type: 'success',
      text: `Accent palette updated to ${PALETTES[paletteId]?.name || paletteId}. Whole app re-tinted live.`,
    });
  };

  const handleThemeModeToggle = (mode) => {
    setThemeMode(mode);
    try {
      localStorage.setItem(STORAGE_KEY_THEME, mode);
    } catch (e) {}
    document.documentElement.classList.toggle('dark', mode === 'dark');
  };

  return (
    <div className="space-y-8 pb-10 w-full">
      {/* Fernly Page Header */}
      <PageHeader
        title="Settings & System Preferences"
        subtitle="Configure live accent swatches, telemetry polling frequency, and MLOps platform credentials."
      />

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        {/* Fernly Inner Left Sub-Nav in a Card (3 Cols) */}
        <Card className="lg:col-span-3 p-3 self-start space-y-1">
          <p className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Configuration
          </p>
          {[
            { id: 'appearance', label: 'Appearance & Theme', icon: Palette },
            { id: 'profile', label: 'Operator Profile', icon: User },
            { id: 'notifications', label: 'Notification Rules', icon: Bell },
            { id: 'system', label: 'API & Telemetry Link', icon: Globe },
          ].map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left transition-all",
                  isActive
                    ? "bg-[var(--accent-tint)] dark:bg-[var(--accent-dark-tint)] text-slate-900 dark:text-white font-bold hairline-border"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                )}
              >
                <item.icon className={cn(
                  "w-4 h-4 shrink-0",
                  isActive ? "text-[var(--accent-primary)] dark:text-[var(--accent-light)]" : "text-slate-400"
                )} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </Card>

        {/* Right Content Panels (9 Cols) */}
        <div className="lg:col-span-9 space-y-6">
          {/* SECTION 1: Appearance */}
          {activeSection === 'appearance' && (
            <Card className="p-6 space-y-6">
              <div className="border-b border-black/[0.05] dark:border-white/[0.06] pb-4">
                <CardTitle>Appearance & Live Accent Swatches</CardTitle>
                <CardDescription>
                  Selecting an accent swatch dynamically re-tints buttons, gauges, active indicators, and charts across the entire platform.
                </CardDescription>
              </div>

              {/* Accent Palette Swatches */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Color Accent Palette
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {Object.values(PALETTES).map((pal) => {
                    const isSelected = activeAccent === pal.id;
                    return (
                      <button
                        key={pal.id}
                        type="button"
                        onClick={() => handlePaletteSelect(pal.id)}
                        className={cn(
                          "p-4 rounded-2xl hairline-border flex flex-col items-center text-center transition-all cursor-pointer relative",
                          isSelected
                            ? "ring-2 ring-offset-2 ring-[var(--accent-primary)] dark:ring-offset-slate-900 bg-white dark:bg-[#1A261F] shadow-md"
                            : "bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100"
                        )}
                      >
                        <span
                          className="w-8 h-8 rounded-full mb-2.5 shadow-sm ring-2 ring-white dark:ring-black"
                          style={{ backgroundColor: pal.primary }}
                        />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{pal.name}</span>
                        <span className="text-[10px] font-mono text-slate-400 mt-0.5">{pal.primary}</span>
                        {isSelected && (
                          <span className="mt-2 text-[10px] font-extrabold uppercase tracking-wider text-[var(--accent-mid)] dark:text-[var(--accent-light)]">
                            Active Ring
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Segmented Theme Mode */}
              <div className="space-y-3 pt-4 border-t border-black/[0.05] dark:border-white/[0.06]">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Interface Surface Mode
                </label>
                <Tabs
                  layoutId="settingsThemeTabs"
                  tabs={[
                    { id: 'dark', label: 'Dark Surface (#0E1411)' },
                    { id: 'light', label: 'Off-White Surface (#F4F6F4)' },
                  ]}
                  activeTab={themeMode}
                  onChange={(mode) => handleThemeModeToggle(mode)}
                />
              </div>

              {/* Segmented Week Starts On Toggle */}
              <div className="space-y-3 pt-4 border-t border-black/[0.05] dark:border-white/[0.06]">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Week Starts On (Farm Calendar)
                </label>
                <Tabs
                  layoutId="settingsWeekStartTabs"
                  tabs={[
                    { id: 'Sunday', label: 'Sunday' },
                    { id: 'Monday', label: 'Monday (Default)' },
                    { id: 'Saturday', label: 'Saturday' },
                  ]}
                  activeTab={weekStart}
                  onChange={(day) => setWeekStart(day)}
                />
              </div>

              {/* Language & Regional Localization (Multi-Lingual) */}
              <div className="space-y-3 pt-4 border-t border-black/[0.05] dark:border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Platform Language (बहुभाषी समर्थन)
                    </label>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Supports English, हिन्दी (Hindi), मराठी (Marathi), ગુજરાતી (Gujarati), தமிழ் (Tamil), and తెలుగు (Telugu) with instant translation.
                    </p>
                  </div>
                  <LanguageSelector />
                </div>
              </div>
            </Card>
          )}

          {/* SECTION 2: Operator Profile */}
          {activeSection === 'profile' && (
            <Card className="p-6 space-y-6">
              <div className="border-b border-black/[0.05] dark:border-white/[0.06] pb-4">
                <CardTitle>Operator Profile</CardTitle>
                <CardDescription>Authenticated user credentials and system authorization role</CardDescription>
              </div>

              <div className="flex items-center gap-4">
                <img
                  src="https://api.dicebear.com/7.x/avataaars/svg?seed=Apurv"
                  alt="Avatar"
                  className="w-16 h-16 rounded-full bg-[var(--accent-tint)] p-1 border-2 border-[var(--accent-primary)] object-cover"
                />
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">Apurv Sharma</h4>
                  <p className="text-xs text-slate-500">MLOps Lead & Field Intelligence Admin</p>
                  <div className="mt-1">
                    <Badge variant="accent">Administrator Access</Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Email Address</label>
                  <input
                    type="email"
                    disabled
                    value="apurv@krishiloop.ai"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl text-slate-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Supervised District</label>
                  <input
                    type="text"
                    disabled
                    value="Maharashtra Agricultural Zone (35 Districts)"
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl text-slate-500 cursor-not-allowed"
                  />
                </div>
              </div>
            </Card>
          )}

          {/* SECTION 3: Notification Rules */}
          {activeSection === 'notifications' && (
            <Card className="p-6 space-y-6">
              <div className="border-b border-black/[0.05] dark:border-white/[0.06] pb-4">
                <CardTitle>Automated Field Notification Rules</CardTitle>
                <CardDescription>Thresholds for automatic field technician dispatches and SSE alerts</CardDescription>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] hairline-border">
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">Critical Soil Moisture Depletion (&lt; 15%)</h5>
                    <p className="text-[11px] text-slate-400">Trigger immediate SMS & automated valve actuator prompt</p>
                  </div>
                  <Badge variant="success">Active</Badge>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] hairline-border">
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">Model Drift PSI Trigger (&gt; 0.20)</h5>
                    <p className="text-[11px] text-slate-400">Alert MLOps team for dataset shift and scheduled retraining</p>
                  </div>
                  <Badge variant="success">Active</Badge>
                </div>
              </div>
            </Card>
          )}

          {/* SECTION 4: System & API Link */}
          {activeSection === 'system' && (
            <Card className="p-6 space-y-6">
              <div className="border-b border-black/[0.05] dark:border-white/[0.06] pb-4">
                <CardTitle>System & Fast API Connection</CardTitle>
                <CardDescription>Backend microservice parameters, polling intervals, and SSE endpoints</CardDescription>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    FastAPI Endpoint Base URL
                  </label>
                  <input
                    type="text"
                    disabled
                    value={import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}
                    className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-black/30 hairline-border rounded-xl text-slate-500 font-mono cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                    Continuous Telemetry Polling Interval
                  </label>
                  <select
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs bg-white dark:bg-[#121A15] hairline-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)] font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <option value={2000}>2 Seconds (Real-Time Sensor Pulse)</option>
                    <option value={5000}>5 Seconds (Recommended)</option>
                    <option value={10000}>10 Seconds (Bandwidth Saver)</option>
                    <option value={30000}>30 Seconds (Low Power)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">Continuous SSE Stream Sync</span>
                    <p className="text-[11px] text-slate-400">Stream NRSC telemetry records in real time</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="w-4 h-4 rounded text-[var(--accent-primary)] focus:ring-[var(--accent-light)] cursor-pointer"
                  />
                </div>
              </div>
            </Card>
          )}
        </div>
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

export default Settings;
