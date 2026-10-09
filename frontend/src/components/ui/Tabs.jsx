import React, { useId } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

export const Tabs = ({
  tabs = [],
  activeTab,
  onChange,
  className = '',
  pillClassName = '',
  layoutId,
}) => {
  const generatedId = useId();
  const effectiveLayoutId = layoutId || `tabs_${generatedId}`;

  return (
    <div className={cn("inline-flex items-center gap-1 p-1 bg-slate-200/60 dark:bg-black/30 rounded-full", className)}>
      {tabs.map((tab) => {
        const id = typeof tab === 'object' ? tab.id : tab;
        const label = typeof tab === 'object' ? tab.label : tab;
        const count = typeof tab === 'object' ? tab.count : undefined;
        const isActive = activeTab === id;

        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "relative px-4 py-1.5 rounded-full text-xs font-semibold select-none cursor-pointer transition-colors z-10 flex items-center gap-1.5",
              isActive
                ? "text-slate-900 dark:text-white"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
              pillClassName
            )}
          >
            {isActive && (
              <motion.div
                layoutId={effectiveLayoutId}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="absolute inset-0 bg-white dark:bg-[#1A261F] rounded-full shadow-sm z-[-1] hairline-border"
              />
            )}
            <span>{label}</span>
            {count !== undefined && (
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                  isActive
                    ? "bg-[var(--accent-tint)] text-[var(--accent-primary)] dark:bg-[var(--accent-dark-tint)] dark:text-[var(--accent-light)]"
                    : "bg-slate-300/60 dark:bg-white/10 text-slate-600 dark:text-slate-400"
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
