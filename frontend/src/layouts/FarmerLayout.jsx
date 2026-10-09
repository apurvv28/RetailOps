import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FarmerService } from '../services/api';
import { 
  Droplet, 
  Sprout, 
  FlaskConical, 
  TrendingUp, 
  User, 
  LogOut, 
  Bell, 
  MapPin, 
  Menu, 
  X, 
  Sun, 
  Moon, 
  CheckCircle2, 
  AlertTriangle,
  Radio,
  Sparkles,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { Drawer } from '../components/ui/Drawer';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LanguageSelector } from '../components/ui/LanguageSelector';
import { ThemeSelector } from '../components/ui/ThemeSelector';
import { KrishiMitraAssistant } from '../components/assistant/KrishiMitraAssistant';
import { cn } from '../utils/cn';

export const FarmerLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [alertsData, setAlertsData] = useState({ count: 0, unread_count: 0, alerts: [] });
  const [sensorStatus, setSensorStatus] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertDrawerOpen, setAlertDrawerOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const loadFarmerData = async () => {
    try {
      const [profData, sumData, alData, senData] = await Promise.all([
        FarmerService.getProfile(),
        FarmerService.getSummary(),
        FarmerService.getFarmerAlerts(),
        FarmerService.getSensorStatus()
      ]);
      setProfile(profData);
      setSummary(sumData);
      if (alData) setAlertsData(alData);
      if (senData?.sensors) setSensorStatus(senData.sensors);
    } catch (err) {
      console.warn('Farmer data load warning:', err);
    }
  };

  useEffect(() => {
    loadFarmerData();
  }, []);

  const handleMarkRead = async (alertId) => {
    try {
      await FarmerService.markAlertRead(alertId);
      await loadFarmerData();
    } catch (e) {
      console.warn('Mark read warning:', e);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      root.classList.remove('dark');
      setIsDark(false);
      localStorage.setItem('agritech_theme', 'light');
    } else {
      root.classList.add('dark');
      setIsDark(true);
      localStorage.setItem('agritech_theme', 'dark');
    }
  };

  const navItems = [
    { name: 'Smart Watering', path: '/farmer/irrigation', icon: Droplet },
    { name: 'Best Crops', path: '/farmer/crop', icon: Sprout },
    { name: 'Fertilizer Guide', path: '/farmer/fertilizer', icon: FlaskConical },
    { name: 'Harvest Forecast', path: '/farmer/yield', icon: TrendingUp },
    { name: 'My Farm Land', path: '/farmer/profile', icon: User },
  ];

  const onlineSensorsCount = sensorStatus.filter(s => s.status === 'ONLINE').length;

  return (
    <div className="min-h-screen w-full flex bg-[#F4F6F4] dark:bg-[#0E1411] text-slate-900 dark:text-slate-100 overflow-x-hidden">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Full-Height Left Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 h-screen bg-[#FFFFFF] dark:bg-[#0D1510] border-r hairline-border transition-transform duration-300 ease-out lg:translate-x-0 lg:sticky lg:top-0 flex flex-col justify-between p-5 shrink-0 select-none overflow-y-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="space-y-6">
          {/* Farm Brand Header */}
          <div className="flex items-center gap-3 px-2 py-1">
            <div 
              style={{ backgroundColor: 'var(--accent-primary)' }}
              className="w-10 h-10 rounded-full flex items-center justify-center shadow-md text-white shrink-0"
            >
              <Sprout className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white leading-tight truncate">
                {profile?.farm_name || 'KrishiLoop Kisan'}
              </span>
              <span className="text-[11px] font-semibold text-[var(--accent-mid)] dark:text-[var(--accent-light)] flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{profile?.region || 'Maharashtra'}</span>
              </span>
            </div>
          </div>

          {/* MENU section: Core Farm Guides */}
          <div>
            <p className="px-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
              FARM ADVISORY
            </p>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => { if (window.innerWidth < 1024) setSidebarOpen(false); }}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all relative group",
                      isActive
                        ? "text-slate-900 dark:text-white font-bold bg-[var(--accent-tint)] dark:bg-[var(--accent-dark-tint)]"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Fernly 3px left accent bar for active item */}
                      {isActive && (
                        <span 
                          style={{ backgroundColor: 'var(--accent-primary)' }}
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                        />
                      )}
                      <item.icon 
                        className={cn(
                          "w-4 h-4 shrink-0 transition-colors",
                          isActive ? "text-[var(--accent-primary)] dark:text-[var(--accent-light)]" : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500"
                        )} 
                      />
                      <span className="truncate">{item.name}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* GENERAL section: Appearance & System */}
          <div>
            <p className="px-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
              PREFERENCES
            </p>
            
            {/* Color Customization Palette */}
            <div className="px-1 mb-2">
              <ThemeSelector />
            </div>

            <nav className="space-y-1">
              {/* Field Alerts Trigger */}
              <button
                type="button"
                onClick={() => setAlertDrawerOpen(true)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-all"
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 text-slate-400" />
                  <span>Farm Alerts</span>
                </div>
                {alertsData?.unread_count > 0 && (
                  <span 
                    style={{ backgroundColor: 'var(--accent-primary)' }}
                    className="px-2 py-0.5 text-[10px] font-bold text-white rounded-full animate-pulse"
                  >
                    {alertsData.unread_count}
                  </span>
                )}
              </button>

              {/* Logout Button */}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all text-left"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Logout</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Bottom Sensor Health Pill */}
        <div className="pt-4 space-y-3">
          <div className="p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] hairline-border space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" /> Live Field Nodes
              </span>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                {onlineSensorsCount}/{sensorStatus.length || 6} Active
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Soil moisture & temperature updating continuously.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Container Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 px-4 sm:px-6 flex items-center justify-between border-b hairline-border bg-white/80 dark:bg-[#0E1411]/80 backdrop-blur-md sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-full hairline-border bg-white dark:bg-[#121A15] text-slate-600 dark:text-slate-300"
              title="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {profile?.farm_name || 'KrishiLoop Kisan'}
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {onlineSensorsCount}/{sensorStatus.length || 6} Sensors Live
              </span>
            </div>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2">
            {/* Multilingual Selector */}
            <LanguageSelector />

            {/* Field Alerts Trigger */}
            <button
              onClick={() => setAlertDrawerOpen(true)}
              className="relative p-2 rounded-full bg-white dark:bg-[#121A15] hairline-border text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-sm transition-all"
              title="Field Alerts / खेत की चेतावनियां"
            >
              <Bell className="w-4 h-4" />
              {alertsData?.unread_count > 0 && (
                <span 
                  style={{ backgroundColor: 'var(--accent-primary)' }}
                  className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] text-[9px] font-bold text-white rounded-full flex items-center justify-center px-1 animate-pulse"
                >
                  {alertsData.unread_count}
                </span>
              )}
            </button>

            {/* Dark/Light Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-white dark:bg-[#121A15] hairline-border text-slate-600 dark:text-slate-300 hover:bg-slate-50 shadow-sm transition-all"
              title="Toggle Dark/Light Mode"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* Farmer Avatar */}
            <div 
              onClick={() => navigate('/farmer/profile')}
              className="flex items-center gap-2 pl-2 border-l border-black/[0.06] dark:border-white/[0.06] cursor-pointer"
            >
              <div 
                style={{ backgroundColor: 'var(--accent-primary)' }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
              >
                {user?.name?.[0] || 'K'}
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Outlet Page Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className="w-full">
            <Outlet context={{ profile, summary, loadFarmerData }} />
          </div>
        </main>
      </div>

      {/* Field Alerts Drawer */}
      <Drawer
        isOpen={alertDrawerOpen}
        onClose={() => setAlertDrawerOpen(false)}
        title="Field Warnings & Sensor Alerts"
        subtitle={`${alertsData?.alerts?.length || 0} active telemetry triggers`}
      >
        <div className="space-y-3">
          {alertsData?.alerts?.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500 opacity-80" />
              <p className="text-sm font-medium">All field parameters within safe thresholds</p>
            </div>
          ) : (
            alertsData.alerts.map((al) => (
              <div 
                key={al.alert_id}
                className={cn(
                  "p-4 rounded-2xl hairline-border bg-white dark:bg-[#121A15] transition-all",
                  !al.is_read ? "border-l-4 border-l-amber-500" : "opacity-80"
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className={cn(
                      "w-4 h-4 shrink-0",
                      al.severity === 'CRITICAL' ? 'text-rose-500' : 'text-amber-500'
                    )} />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {al.metric?.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <Badge variant={al.severity === 'CRITICAL' ? 'danger' : 'warning'}>
                    {al.severity}
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 leading-relaxed">
                  {al.message}
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{new Date(al.created_at).toLocaleTimeString()}</span>
                  {!al.is_read && (
                    <button
                      onClick={() => handleMarkRead(al.alert_id)}
                      className="text-[var(--accent-mid)] dark:text-[var(--accent-light)] font-bold hover:underline"
                    >
                      Mark as Read
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Drawer>

      {/* Floating Multi-Lingual AI Assistant */}
      <KrishiMitraAssistant />
    </div>
  );
};

export default FarmerLayout;
