import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

export const PillBarChart = ({
  data = [
    { label: 'Mon', value: 45, active: false },
    { label: 'Tue', value: 72, active: false },
    { label: 'Wed', value: 88, active: true },
    { label: 'Thu', value: 64, active: false },
    { label: 'Fri', value: 95, active: true },
    { label: 'Sat', value: 50, active: false },
    { label: 'Sun', value: 30, active: false },
  ],
  height = 180,
  className = '',
  unit = '%',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const maxValue = Math.max(...data.map(d => d.value), 100);

  return (
    <div className={cn("w-full flex items-end justify-between gap-2 sm:gap-3 pt-6 pb-2 px-1", className)} style={{ minHeight: height + 40 }}>
      {data.map((item, index) => {
        const heightPercent = Math.min(Math.max((item.value / maxValue) * 100, 12), 100);
        const isHovered = hoveredIdx === index;

        return (
          <div
            key={item.label || index}
            className="flex-1 flex flex-col items-center gap-2 relative group"
            onMouseEnter={() => setHoveredIdx(index)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            {/* Tooltip bubble on hover */}
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.9 }}
              animate={isHovered ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 4, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="absolute -top-9 z-20 pointer-events-none px-2 py-1 rounded-full bg-slate-900 text-white text-[11px] font-bold shadow-md whitespace-nowrap"
            >
              {item.value}{unit}
            </motion.div>

            {/* Vertical capsule bar container */}
            <div
              className="w-full max-w-[36px] sm:max-w-[44px] bg-slate-100 dark:bg-black/30 rounded-full flex items-end p-1 overflow-hidden"
              style={{ height: height }}
            >
              <motion.div
                initial={{ height: '0%' }}
                animate={{ height: `${heightPercent}%` }}
                transition={{
                  type: 'spring',
                  stiffness: 260,
                  damping: 24,
                  delay: index * 0.06,
                }}
                className={cn(
                  "w-full rounded-full transition-colors",
                  item.active
                    ? "bg-[var(--accent-primary)] group-hover:bg-[var(--accent-mid)]"
                    : "bg-hatch-pattern group-hover:opacity-90"
                )}
                style={item.active ? { backgroundColor: 'var(--accent-primary)' } : {}}
              />
            </div>

            {/* Label */}
            <span
              className={cn(
                "text-xs font-semibold transition-colors",
                item.active
                  ? "text-slate-900 dark:text-white font-bold"
                  : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500"
              )}
            >
              {item.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};
