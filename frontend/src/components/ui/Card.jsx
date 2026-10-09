import React from 'react';
import { cn } from '../../utils/cn';

export const Card = React.forwardRef(({
  className,
  stripe = false,
  accent = false,
  children,
  ...props
}, ref) => {
  if (stripe) {
    return (
      <div
        ref={ref}
        className={cn(
          "bg-stripe-texture text-white rounded-[20px] p-6 shadow-lg border border-white/10 relative overflow-hidden",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (accent) {
    return (
      <div
        ref={ref}
        style={{ backgroundColor: 'var(--accent-primary)' }}
        className={cn(
          "text-white rounded-[20px] p-6 shadow-lg border border-white/10 relative overflow-hidden transition-all duration-200",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={cn("fernly-card overflow-hidden", className)}
      {...props}
    >
      {children}
    </div>
  );
});
Card.displayName = "Card";

export const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-normal leading-relaxed", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0 border-t border-black/[0.04] dark:border-white/[0.04] mt-4 pt-4", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";
