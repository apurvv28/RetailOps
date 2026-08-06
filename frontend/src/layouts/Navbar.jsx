import React from 'react';
import { Menu, Search, Sun, Moon } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';

export const Navbar = ({ setSidebarOpen }) => {
  const { lastRefreshed } = useDashboard();
  const [isDark, setIsDark] = React.useState(() => document.documentElement.classList.contains('dark'));

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
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0B0F19]/50 backdrop-blur-xl sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span>Retail Ops Intelligence</span>
          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search SKU..."
            className="w-64 pl-9 pr-4 py-1.5 text-sm bg-slate-100 dark:bg-slate-800/50 border-none rounded-full focus:outline-none focus:ring-2 focus:ring-sky-500/50 dark:text-slate-200 placeholder:text-slate-500 transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 hidden sm:block">
            Updated {lastRefreshed.toLocaleTimeString()}
          </span>
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </header>
  );
};
