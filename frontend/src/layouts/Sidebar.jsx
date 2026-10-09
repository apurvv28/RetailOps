import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Activity, 
  Radio, 
  PieChart, 
  Bell, 
  Settings, 
  Sprout, 
  Smartphone, 
  ArrowUpRight, 
  LogOut,
  SlidersHorizontal
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useDashboard } from '../context/DashboardContext';
import { useAuth } from '../context/AuthContext';
import { StatusDot } from '../components/ui/StatusDot';

const mainNavItems = [
  { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { name: 'Farm Advisories', path: '/admin/predictions', icon: Activity },
  { name: 'Live Field Sensors', path: '/admin/stream', icon: Radio },
  { name: 'Field Health & Stability', path: '/admin/monitoring', icon: PieChart },
  { name: 'Urgent Farm Alerts', path: '/admin/alerts', icon: Bell },
];

const generalNavItems = [
  { name: 'Settings', path: '/admin/settings', icon: Settings },
];

export const Sidebar = ({ isOpen, setisOpen }) => {
  const { systemHealth, alerts } = useDashboard();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const allHealthy = systemHealth
    ? Object.values(systemHealth).filter(v => typeof v === 'boolean').every(Boolean)
    : true;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 h-screen bg-[#FFFFFF] dark:bg-[#0D1510] border-r hairline-border transition-transform duration-300 ease-out lg:translate-x-0 lg:sticky lg:top-0 flex flex-col justify-between p-5 shrink-0 select-none overflow-y-auto",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 py-1">
          <div 
            style={{ backgroundColor: 'var(--accent-primary)' }}
            className="w-10 h-10 rounded-full flex items-center justify-center shadow-md text-white shrink-0"
          >
            <Sprout className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white leading-tight">
              KrishiLoop
            </span>
            <span className="text-[11px] font-semibold text-[var(--accent-mid)] dark:text-[var(--accent-light)] uppercase tracking-wider">
              Smart Agriculture Suite
            </span>
          </div>
        </div>

        {/* Menu Section 1: Core Farm Operations */}
        <div>
          <p className="px-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
            MENU
          </p>
          <nav className="space-y-1">
            {mainNavItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                end={item.path === '/admin'}
                onClick={() => { if (window.innerWidth < 1024) setisOpen(false); }}
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
                    {item.name === 'Field Alerts' && alerts?.length > 0 && (
                      <span 
                        style={{ backgroundColor: 'var(--accent-primary)' }}
                        className="ml-auto px-2 py-0.5 text-[10px] font-bold rounded-full text-white"
                      >
                        {alerts.length}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Menu Section 2: General Settings */}
        <div>
          <p className="px-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
            GENERAL
          </p>
          <nav className="space-y-1">
            {generalNavItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={() => { if (window.innerWidth < 1024) setisOpen(false); }}
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
                    {isActive && (
                      <span 
                        style={{ backgroundColor: 'var(--accent-primary)' }}
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                      />
                    )}
                    <item.icon className={cn(
                      "w-4 h-4 shrink-0 transition-colors",
                      isActive ? "text-[var(--accent-primary)] dark:text-[var(--accent-light)]" : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500"
                    )} />
                    <span>{item.name}</span>
                  </>
                )}
              </NavLink>
            ))}

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all text-left"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Logout</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Bottom Promo Card */}
      <div className="space-y-3 pt-4">
        <div className="p-4 rounded-2xl bg-stripe-texture text-white shadow-lg relative overflow-hidden group">
          <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center mb-3 shadow-inner">
            <Smartphone className="w-4 h-4 text-white" />
          </div>
          <h4 className="text-xs font-bold leading-tight mb-1">Farm Sensor Network</h4>
          <p className="text-[11px] text-white/80 mb-3 leading-snug">
            Real-time soil moisture and climate tracking across all plots.
          </p>
          <button 
            onClick={() => navigate('/admin/stream')}
            className="w-full py-2 px-3 bg-white text-slate-900 hover:bg-slate-100 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm active:scale-95"
          >
            View Field Sensors <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* System Health Pill */}
        <div className="flex items-center justify-between px-3.5 py-2 bg-slate-100/80 dark:bg-black/20 rounded-full hairline-border">
          <div className="flex items-center gap-2">
            <StatusDot active={allHealthy} />
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              {allHealthy ? 'All Systems Online' : 'Updating Sensor Feeds'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
