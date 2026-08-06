import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export const Loader = ({ className, size = 24, text }) => {
  return (
    <div className={cn("flex flex-col items-center justify-center p-4", className)}>
      <Loader2 className="animate-spin text-sky-500" size={size} />
      {text && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{text}</p>}
    </div>
  );
};
