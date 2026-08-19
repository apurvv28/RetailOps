import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Activity, Radio, PieChart, Bell, Settings, Sprout, Smartphone, HelpCircle, ArrowUpRight } from 'lucide-react';
import { cn } from '../utils/cn';
import { useDashboard } from '../context/DashboardContext';
import { StatusDot } from '../components/ui/StatusDot';

const mainNavItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Multi-Model Feed', path: '/predictions', icon: Activity },
  { name: 'IoT Telemetry Stream', path: '/stream', icon: Radio },
  { name: 'Feature Drift', path: '/monitoring', icon: PieChart },
  { name: 'Field Alerts', path: '/alerts', icon: Bell },
];

const generalNavItems = [
  { name: 'Settings', path: '/settings', icon: Settings },
];

export const Sidebar = ({ isOpen, setisOpen }) => {
  const { systemHealth, isPipelineActive } = useDashboard();
  const allHealthy = systemHealth
    ? Object.values(systemHealth).filter(v => typeof v === 'boolean').every(Boolean)
    : true;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 h-screen sticky top-0 bg-white dark:bg-[#0A0E0C] border-r border-slate-200/80 dark:border-emerald-950/60 transition-transform duration-300 ease-in-out lg:translate-x-0 overflow-y-auto flex flex-col justify-between p-4 shrink-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-10 h-10 rounded-full bg-[#0F5238] flex items-center justify-center shadow-md shadow-emerald-900/20 text-white">
            <Sprout className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">KrishiLoop AI</span>

        </div>

        {/* Menu Section 1 */}
        <div>
          <p className="px-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">MENU</p>
          <nav className="space-y-1">
            {mainNavItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                end={item.path === '/'}
                onClick={() => { if (window.innerWidth < 1024) setisOpen(false); }}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all relative group",
                    isActive
                      ? "text-[#0F5238] dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/40"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100/50 dark:hover:bg-emerald-950/20"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-[#0F5238] dark:bg-emerald-400 rounded-r-full" />
                    )}
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span>{item.name}</span>
                    {item.badge && (
                      <span className="ml-auto px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#0F5238] text-white">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Menu Section 2 */}
        <div>
          <p className="px-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">GENERAL</p>
          <nav className="space-y-1">
            {generalNavItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={() => { if (window.innerWidth < 1024) setisOpen(false); }}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100/50 dark:hover:bg-emerald-950/20",
                    isActive && "text-[#0F5238] dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/40"
                  )
                }
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* Bottom Promo Card (Donezo Style) */}
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-gradient-to-b from-[#0B3B2D] to-[#05241B] text-white shadow-lg relative overflow-hidden group">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mb-3">
            <Smartphone className="w-4 h-4 text-emerald-300" />
          </div>
          <h4 className="text-sm font-bold leading-tight mb-1">Download Mobile App</h4>
          <p className="text-xs text-emerald-200/70 mb-3">Get field alerts & moisture updates in another way</p>
          <button className="w-full py-2 px-3 bg-white/15 hover:bg-white/25 rounded-full text-xs font-bold text-white transition-colors flex items-center justify-center gap-1">
            Download <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* System Health pill */}
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100/70 dark:bg-[#0E1411] rounded-full border border-slate-200/50 dark:border-emerald-950/60">
          <StatusDot active={allHealthy} />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {allHealthy ? 'All Systems Operational' : 'Degraded Service'}
          </span>
        </div>
      </div>
    </aside>
  );
};
