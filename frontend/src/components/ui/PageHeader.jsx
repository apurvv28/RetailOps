import React from 'react';
import { motion } from 'framer-motion';
import { Button } from './Button';
import { cn } from '../../utils/cn';

export const PageHeader = ({
  title,
  subtitle,
  primaryAction, // { label, icon, onClick, loading, disabled }
  secondaryAction, // { label, icon, onClick }
  extra,
  className = '',
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-2 border-b border-black/[0.05] dark:border-white/[0.06]", className)}
    >
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        {extra}
        {secondaryAction && (
          <Button
            variant="secondary"
            size="md"
            icon={secondaryAction.icon}
            onClick={secondaryAction.onClick}
          >
            {secondaryAction.label}
          </Button>
        )}
        {primaryAction && (
          <Button
            variant="primary"
            size="md"
            icon={primaryAction.icon}
            onClick={primaryAction.onClick}
            loading={primaryAction.loading}
            disabled={primaryAction.disabled}
          >
            {primaryAction.label}
          </Button>
        )}
      </div>
    </motion.div>
  );
};
