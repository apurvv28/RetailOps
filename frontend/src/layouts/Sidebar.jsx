import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Activity, Box, Bell, Settings, PieChart, Radio } from 'lucide-react';
import { cn } from '../utils/cn';
import { useDashboard } from '../context/DashboardContext';
import { StatusDot } from '../components/ui/StatusDot';

const navItems = [
  { name: 'Overview', path: '/', icon: LayoutDashboard },
  { name: 'Live Predictions', path: '/predictions', icon: Activity },
  { name: 'Input Stream', path: '/stream', icon: Radio },

  { name: 'Monitoring', path: '/monitoring', icon: PieChart },
  { name: 'Alerts', path: '/alerts', icon: Bell },
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
        "fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#111827] border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto flex flex-col",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex items-center justify-center h-16 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 px-4 w-full">
          <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center">
            <Box className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">RetailOps</span>
          {isPipelineActive && (
            <span className="ml-auto w-2 h-2 rounded-full bg-sky-400 animate-ping" />
          )}
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            end={item.path === '/'}
            onClick={() => { if (window.innerWidth < 1024) setisOpen(false); }}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-50"
              )
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 px-3 py-2">
          <StatusDot active={allHealthy} />
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {allHealthy ? 'All Systems Operational' : 'Degraded Service'}
          </span>
        </div>
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex-shrink-0">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Apurv" alt="User" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Apurv</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">MLOps Engineer</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
