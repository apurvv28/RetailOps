import React, { useState, useRef, useEffect } from 'react';
import { Menu, Search, Sun, Moon, Bell, Sparkles } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDashboard } from '../context/DashboardContext';
import { useAuth } from '../context/AuthContext';
import { LanguageSelector } from '../components/ui/LanguageSelector';
import { cn } from '../utils/cn';

export const Navbar = ({ setSidebarOpen }) => {
  const { alerts, selectedFarmId, setSelectedFarmId, availableFarms } = useDashboard();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchInputRef = useRef(null);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [searchQuery, setSearchQuery] = useState('');

  // ⌘K / Ctrl+K keyboard shortcut focus
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Dynamic search placeholder based on current route
  const getSearchPlaceholder = () => {
    const path = location.pathname;
    if (path.includes('stream')) return 'Search farm sensor readings, soil moisture...';
    if (path.includes('predictions')) return 'Search crop recommendations, harvest forecasts...';
    if (path.includes('monitoring')) return 'Search field stability and sensor changes...';
    if (path.includes('alerts')) return 'Search urgent farm alerts...';
    return 'Search farms, fields, sensors (⌘K)...';
  };

  return (
    <header className="h-18 px-6 py-4 flex items-center justify-between border-b hairline-border bg-transparent select-none z-30">
      {/* Left Search Bar with ⌘K Chip */}
      <div className="flex items-center gap-3 flex-1 max-w-lg">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="p-2 text-slate-500 bg-white dark:bg-[#121A15] hairline-border rounded-full lg:hidden shadow-sm"
          aria-label="Open sidebar"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={getSearchPlaceholder()}
            className="w-full pl-11 pr-14 py-2.5 text-xs bg-white dark:bg-[#121A15] hairline-border rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 shadow-sm transition-all"
          />
          <kbd className="absolute right-3.5 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/[0.06] rounded-md hairline-border pointer-events-none">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right Action Pill Group */}
      <div className="flex items-center gap-3">
        {/* Farm selector dropdown if multiple farms */}
        {availableFarms && availableFarms.length > 0 && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-[#121A15] hairline-border text-xs">
            <span className="text-[11px] font-semibold text-slate-400">Farm:</span>
            <select
              value={selectedFarmId || ''}
              onChange={(e) => setSelectedFarmId && setSelectedFarmId(e.target.value)}
              className="bg-transparent font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              {availableFarms.map((f) => (
                <option key={f.farm_id} value={f.farm_id} className="dark:bg-slate-900">
                  {f.farm_name || f.farm_id} ({f.region || 'MH'})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Alerts Notification Button */}
        <button
          type="button"
          onClick={() => navigate('/admin/alerts')}
          className="relative p-2.5 text-slate-600 dark:text-slate-300 bg-white dark:bg-[#121A15] hairline-border rounded-full hover:bg-slate-50 dark:hover:bg-white/[0.04] shadow-sm transition-all"
          title="Field Alerts"
        >
          <Bell className="w-4 h-4" />
          {alerts?.length > 0 && (
            <span 
              style={{ backgroundColor: 'var(--accent-primary)' }}
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-white dark:ring-[#121A15] animate-pulse" 
            />
          )}
        </button>

        {/* Multilingual Selector (Free Google Translation) */}
        <LanguageSelector />

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2.5 text-slate-600 dark:text-slate-300 bg-white dark:bg-[#121A15] hairline-border rounded-full hover:bg-slate-50 dark:hover:bg-white/[0.04] shadow-sm transition-all"
          title="Toggle Dark / Light Theme"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* Avatar with Name + Email */}
        <div 
          onClick={() => navigate('/admin/settings')}
          className="flex items-center gap-2.5 pl-2 pr-3.5 py-1.5 bg-white dark:bg-[#121A15] hairline-border rounded-full shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all"
        >
          <img
            src={user?.picture || "https://api.dicebear.com/7.x/avataaars/svg?seed=Apurv"}
            alt="Profile Avatar"
            className="w-7 h-7 rounded-full bg-[var(--accent-tint)] object-cover"
          />
          <div className="hidden sm:flex flex-col text-left leading-none">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
              {user?.name || "Apurv Sharma"}
            </span>
            <span className="text-[10px] text-slate-400 font-medium mt-0.5">
              {user?.email || "apurv@krishiloop.ai"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
