import React from 'react';
import { cn } from '../../utils/cn';

export const Badge = ({
  className,
  variant = 'neutral', // 'success' | 'warning' | 'danger' | 'accent' | 'neutral' | 'outline'
  dot = false,
  children,
  ...props
}) => {
  const variantStyles = {
    success: 'badge-soft-success',
    completed: 'badge-soft-success',
    warning: 'badge-soft-warning',
    in_progress: 'badge-soft-warning',
    danger: 'badge-soft-danger',
    pending: 'badge-soft-danger',
    critical: 'badge-soft-danger',
    accent: 'bg-[var(--accent-tint)] dark:bg-[var(--accent-dark-tint)] text-[var(--accent-primary)] dark:text-[var(--accent-light)] border border-[var(--accent-light)]/30',
    neutral: 'badge-soft-neutral',
    outline: 'bg-transparent border border-black/10 dark:border-white/10 text-slate-700 dark:text-slate-300',
  };

  const dotColors = {
    success: 'bg-emerald-500',
    completed: 'bg-emerald-500',
    warning: 'bg-amber-500',
    in_progress: 'bg-amber-500',
    danger: 'bg-rose-500',
    pending: 'bg-rose-500',
    critical: 'bg-rose-500',
    accent: 'bg-[var(--accent-primary)]',
    neutral: 'bg-slate-400',
    outline: 'bg-slate-400',
  };

  const styleClass = variantStyles[variant] || variantStyles.neutral;
  const dotClass = dotColors[variant] || dotColors.neutral;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide select-none transition-all',
        styleClass,
        className
      )}
      {...props}
    >
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotClass)} />
      )}
      {children}
    </span>
  );
};
