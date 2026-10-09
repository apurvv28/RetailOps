import React, { useState, useEffect } from 'react';
import { PALETTES, applyAccentTheme, getActiveAccentTheme } from '../../utils/theme';
import { Palette, Check } from 'lucide-react';
import { cn } from '../../utils/cn';

export const ThemeSelector = ({ compact = false, className = '' }) => {
  const [activeTheme, setActiveTheme] = useState(() => getActiveAccentTheme());
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (id) => {
    setActiveTheme(id);
    applyAccentTheme(id);
    setIsOpen(false);
  };

  if (compact) {
    return (
      <div className={cn("relative inline-block text-left notranslate", className)}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold hairline-border bg-white dark:bg-[#121A15] hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300 shadow-sm transition-all"
          title="Accent Color / थीम रंग"
        >
          <div 
            className="w-3 h-3 rounded-full ring-1 ring-black/10 shrink-0"
            style={{ backgroundColor: PALETTES[activeTheme]?.primary || '#0F4D2E' }}
          />
          <Palette className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#121A15] hairline-border rounded-2xl shadow-xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-2">
              Color Theme / थीम रंग
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.values(PALETTES).map((p) => {
                const isSelected = p.id === activeTheme;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelect(p.id)}
                    className={cn(
                      "flex items-center gap-2 p-1.5 rounded-xl text-xs font-medium transition-all text-left",
                      isSelected
                        ? "bg-black/[0.05] dark:bg-white/[0.08] font-bold text-slate-900 dark:text-white"
                        : "hover:bg-black/[0.03] dark:hover:bg-white/[0.03] text-slate-600 dark:text-slate-400"
                    )}
                  >
                    <span 
                      className="w-4 h-4 rounded-full shrink-0 shadow-xs ring-1 ring-black/10 flex items-center justify-center"
                      style={{ backgroundColor: p.swatchColor }}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                    </span>
                    <span className="truncate text-[11px]">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] hairline-border space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-[var(--accent-mid)]" /> Accent Palette
        </span>
        <span className="text-[11px] font-semibold text-slate-400 capitalize">{activeTheme}</span>
      </div>
      <div className="flex items-center gap-2 pt-1">
        {Object.values(PALETTES).map((p) => {
          const isSelected = p.id === activeTheme;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelect(p.id)}
              className={cn(
                "relative group flex flex-col items-center gap-1 p-1 rounded-xl transition-all",
                isSelected && "scale-105"
              )}
              title={p.name}
            >
              <div
                className={cn(
                  "w-6 h-6 rounded-full shadow-sm transition-transform duration-150 flex items-center justify-center",
                  isSelected ? "ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-[#0D1510]" : "hover:scale-110"
                )}
                style={{ backgroundColor: p.swatchColor }}
              >
                {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
              </div>
              <span className="text-[10px] text-slate-500 font-medium group-hover:text-slate-900 dark:group-hover:text-white">
                {p.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ThemeSelector;
