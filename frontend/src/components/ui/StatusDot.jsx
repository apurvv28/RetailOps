import React from 'react';

export const StatusDot = ({ active, label, size = 'sm' }) => {
  const sizeClasses = size === 'lg' ? 'w-3 h-3' : 'w-2 h-2';
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex">
        {active && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${sizeClasses} bg-emerald-400 opacity-75`} />
        )}
        <span
          className={`relative inline-flex rounded-full ${sizeClasses} ${
            active ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
      </span>
      {label && (
        <span className={`text-xs font-medium ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
          {label}
        </span>
      )}
    </div>
  );
};
