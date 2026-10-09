import React from 'react';
import { motion } from 'framer-motion';
import { AnimatedNumber } from './AnimatedNumber';

export const GaugeChart = ({
  percentage = 84,
  label = 'Efficiency Score',
  completedCount = 84,
  inProgressCount = 12,
  pendingCount = 4,
  className = '',
}) => {
  // Semicircle arc parameters
  const radius = 80;
  const strokeWidth = 14;
  const circumference = Math.PI * radius; // 180 degrees arc length
  const strokeDashoffset = circumference - (circumference * Math.min(percentage, 100)) / 100;

  return (
    <div className={`flex flex-col items-center justify-center p-4 ${className}`}>
      {/* Semicircle SVG */}
      <div className="relative w-48 h-28 flex items-center justify-center overflow-hidden">
        <svg
          viewBox="0 0 200 115"
          className="w-full h-full transform overflow-visible"
        >
          {/* Background Track Arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="text-slate-100 dark:text-slate-800"
          />

          {/* Animated Value Arc */}
          <motion.path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="var(--accent-primary)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.2 }}
          />
        </svg>

        {/* Center Big Percentage & Label */}
        <div className="absolute bottom-1 flex flex-col items-center">
          <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
            <AnimatedNumber value={percentage} suffix="%" />
          </span>
          <span className="text-[11px] font-medium text-slate-400 mt-0.5">
            {label}
          </span>
        </div>
      </div>

      {/* 3-Item Legend */}
      <div className="grid grid-cols-3 gap-2 w-full mt-4 pt-3 border-t border-black/[0.05] dark:border-white/[0.06] text-center">
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Completed</span>
          </div>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{completedCount}%</span>
        </div>

        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">In Progress</span>
          </div>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{inProgressCount}%</span>
        </div>

        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-hatch-pattern border border-slate-300 dark:border-slate-700 shrink-0" />
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Pending</span>
          </div>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{pendingCount}%</span>
        </div>
      </div>
    </div>
  );
};
