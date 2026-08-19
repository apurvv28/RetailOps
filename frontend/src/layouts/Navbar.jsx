import React, { useState } from 'react';
import { Menu, Search, Sun, Moon, Bell, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDashboard } from '../context/DashboardContext';

export const Navbar = ({ setSidebarOpen }) => {
  const { alerts } = useDashboard();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      root.classList.remove('dark');
      setIsDark(false);
    } else {
      root.classList.add('dark');
      setIsDark(true);
    }
  };

  return (
    <header className="h-20 bg-transparent flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 relative z-40">
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2.5 text-slate-500 bg-white dark:bg-[#0E1411] border border-slate-200/80 dark:border-emerald-950/60 rounded-full lg:hidden shadow-sm"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        {/* Large Search Pill */}
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search field or crop..."
            className="w-full pl-11 pr-14 py-2.5 text-sm bg-white dark:bg-[#0E1411] border border-slate-200/80 dark:border-emerald-950/60 rounded-full focus:outline-none focus:ring-2 focus:ring-[#0F5238]/40 dark:text-slate-200 placeholder:text-slate-400 shadow-sm transition-all"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-emerald-950/40 rounded-md border border-slate-200/60 dark:border-emerald-900/40">
            ⌘F
          </span>
        </div>
      </div>

      {/* Action Pill Group */}
      <div className="flex items-center gap-2.5 relative ml-4">
        <button
          onClick={() => navigate('/alerts')}
          className="p-2.5 text-slate-600 dark:text-slate-300 bg-white dark:bg-[#0E1411] border border-slate-200/80 dark:border-emerald-950/60 rounded-full hover:bg-slate-50 dark:hover:bg-emerald-950/40 shadow-sm transition-all relative flex items-center justify-center"
          title="View Live Alerts"
        >
          <Bell className="w-4 h-4" />
          {alerts.length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => navigate('/alerts')}
          className="p-2.5 text-slate-600 dark:text-slate-300 bg-white dark:bg-[#0E1411] border border-slate-200/80 dark:border-emerald-950/60 rounded-full hover:bg-slate-50 dark:hover:bg-emerald-950/40 shadow-sm transition-all"
          title="Field Messages"
        >
          <Mail className="w-4 h-4" />
        </button>

        <button
          onClick={toggleTheme}
          className="p-2.5 text-slate-600 dark:text-slate-300 bg-white dark:bg-[#0E1411] border border-slate-200/80 dark:border-emerald-950/60 rounded-full hover:bg-slate-50 dark:hover:bg-emerald-950/40 shadow-sm transition-all"
          title="Toggle Dark/Light Mode"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Profile Pill */}
        <div className="flex items-center gap-3 pl-2 pr-4 py-1.5 bg-white dark:bg-[#0E1411] border border-slate-200/80 dark:border-emerald-950/60 rounded-full shadow-sm ml-1">
          <img
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Apurv"
            alt="Apurv Profile"
            className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40"
          />
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">Apurv</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">MLOps Lead</span>
          </div>
        </div>
      </div>
    </header>
  );
};
