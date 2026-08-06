import React from 'react';
import { cn } from '../../utils/cn';

export const Badge = ({ className, variant = 'default', children, ...props }) => {
  const variants = {
    default: 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100',
    primary: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    danger: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
    outline: 'border border-slate-200 text-slate-900 dark:border-slate-800 dark:text-slate-100',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-slate-800',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
