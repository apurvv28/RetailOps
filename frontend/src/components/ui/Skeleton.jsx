import React from 'react';

export const SkeletonRow = ({ cols = 5 }) => (
  <tr className="animate-pulse">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-6 py-4">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full" />
      </td>
    ))}
  </tr>
);

export const SkeletonCard = ({ className = '' }) => (
  <div className={`animate-pulse rounded-xl p-6 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 ${className}`}>
    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-4" />
    <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-2" />
    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
  </div>
);

export const SkeletonChart = ({ className = '' }) => (
  <div className={`animate-pulse rounded-xl p-6 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 ${className}`}>
    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-2" />
    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-6" />
    <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-lg" />
  </div>
);
