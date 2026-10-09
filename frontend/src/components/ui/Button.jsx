import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

export const Button = React.forwardRef(({
  children,
  className,
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size = 'md', // 'sm' | 'md' | 'lg'
  icon: Icon,
  iconRight: IconRight,
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  ...props
}, ref) => {
  const sizeStyles = {
    sm: 'px-3.5 py-1.5 text-xs gap-1.5',
    md: 'px-5 py-2.5 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
  };

  const variantStyles = {
    primary: 'text-white shadow-sm hover:shadow-md border border-transparent',
    secondary: 'bg-white dark:bg-[#15201A] text-slate-800 dark:text-slate-100 hairline-border hover:bg-slate-50 dark:hover:bg-[#1C2C23]',
    outline: 'border border-[var(--accent-primary)] text-[var(--accent-primary)] dark:text-[var(--accent-light)] hover:bg-[var(--accent-tint)] dark:hover:bg-[var(--accent-dark-tint)]',
    ghost: 'text-slate-600 dark:text-slate-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
  };

  const primaryInlineStyle = variant === 'primary' ? {
    backgroundColor: 'var(--accent-primary)',
  } : {};

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      whileHover={{ y: disabled || loading ? 0 : -1 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={primaryInlineStyle}
      className={cn(
        'inline-flex items-center justify-center font-semibold rounded-full select-none cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-light)] focus:ring-offset-2 dark:focus:ring-offset-slate-900',
        sizeStyles[size],
        variantStyles[variant],
        (disabled || loading) && 'opacity-50 cursor-not-allowed pointer-events-none',
        className
      )}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0" />
      ) : null}
      <span>{children}</span>
      {IconRight && !loading && <IconRight className="w-4 h-4 shrink-0" />}
    </motion.button>
  );
});

Button.displayName = 'Button';
