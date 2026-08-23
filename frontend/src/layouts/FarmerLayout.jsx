import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
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
  CheckCircle2,
  AlertTriangle,
  Menu,
  X
} from 'lucide-react';

export const FarmerLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [alertsData, setAlertsData] = useState({ count: 0, unread_count: 0, alerts: [] });
  const [sensorStatus, setSensorStatus] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

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
    navigate('/login');
  };

  const navItems = [
    { name: 'Soil Irrigation', path: '/farmer/irrigation', icon: Droplet, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { name: 'Crop Recommendation', path: '/farmer/crop', icon: Sprout, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { name: 'Fertilizer Recommendation', path: '/farmer/fertilizer', icon: FlaskConical, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { name: 'Yield Prediction', path: '/farmer/yield', icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { name: 'Farmer Profile', path: '/farmer/profile', icon: User, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

  const onlineSensorsCount = sensorStatus.filter(s => s.status === 'ONLINE').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight leading-none">
                {profile?.farm_name || 'Farmer Portal'}
              </h1>
              <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                <MapPin className="w-3 h-3 text-emerald-400" />
                <span>{profile?.region || 'Maharashtra'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls & User Profile */}
        <div className="flex items-center gap-3">
          {/* Alerts Notification Button */}
          <button
            onClick={() => setAlertOpen(!alertOpen)}
            className="relative p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 transition-all flex items-center gap-2 text-xs font-medium"
          >
            <Bell className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Advisories</span>
            {alertsData.unread_count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                {alertsData.unread_count}
              </span>
            )}
          </button>

          {/* User Account & Role Badge */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <div className="w-8 h-8 rounded-full bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-sm">
              {user?.name ? user.name[0].toUpperCase() : 'F'}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-white leading-tight">{user?.name || 'Farmer User'}</div>
              <div className="text-[10px] font-medium text-emerald-400">Verified Farmer</div>
            </div>

            <button
              onClick={handleLogout}
              title="Logout"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Advisories Popover Modal */}
      {alertOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white">Farmer Advisories & Field Alerts</h3>
              </div>
              <button onClick={() => setAlertOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {alertsData.alerts.length > 0 ? (
                alertsData.alerts.map((al) => (
                  <div key={al.id} className={`p-4 rounded-xl border text-sm space-y-1 ${
                    al.severity === 'HIGH' ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-slate-800/60 border-slate-700 text-slate-300'
                  }`}>
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-amber-400" />
                        {al.alert_type} ({al.field_id})
                      </span>
                      {!al.is_read && (
                        <button
                          onClick={() => handleMarkRead(al.id)}
                          className="text-[10px] font-bold text-emerald-400 hover:underline"
                        >
                          Mark Read
                        </button>
                      )}
                    </div>
                    <p className="text-xs">{al.message}</p>
                    <div className="text-[10px] text-slate-500">{al.created_at}</div>
                  </div>
                ))
              ) : (
                <div className="text-center text-xs text-slate-500 py-4">No active field alerts.</div>
              )}
            </div>
            <button
              onClick={() => setAlertOpen(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 font-semibold rounded-xl text-sm transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Main Layout Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className={`w-64 bg-slate-900/90 border-r border-slate-800 p-4 flex flex-col justify-between absolute md:relative inset-y-0 left-0 z-30 transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}>
          <div className="space-y-6">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-3 mb-2">
                4 Core Features
              </div>
              <nav className="space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-3 rounded-xl font-medium text-sm transition-all ${
                          isActive
                            ? 'bg-slate-800 text-white shadow-lg shadow-slate-900/50 border border-slate-700/60 font-semibold'
                            : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                        }`
                      }
                    >
                      <div className={`p-2 rounded-lg ${item.bg} ${item.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span>{item.name}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Real Sensors Status Pill */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-semibold">IoT Telemetry Nodes</span>
              <span className={`w-2 h-2 rounded-full ${onlineSensorsCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            </div>
            <div className="text-[11px] text-slate-300 font-mono">
              {onlineSensorsCount > 0 ? `${onlineSensorsCount} Node(s) ONLINE` : 'Sensors Standby'}
            </div>
          </div>
        </aside>

        {/* Content View */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

