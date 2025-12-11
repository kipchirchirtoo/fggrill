import React from 'react';
import { cn } from '@/lib/utils';

export interface MinimalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const MinimalButton = React.forwardRef<HTMLButtonElement, MinimalButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth = false, children, ...props }, ref) => {
    const variantStyles = {
      primary: "bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700",
      secondary: "bg-stone-900 text-white hover:bg-stone-800 active:bg-stone-950",
      outline: "bg-stone-100 text-stone-900 hover:bg-stone-200 active:bg-stone-300",
      destructive: "bg-red-500 text-white hover:bg-red-600 active:bg-red-700",
      success: "bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700",
      ghost: "text-stone-700 hover:bg-stone-100 active:bg-stone-200",
    };
    
    const sizeStyles = {
      sm: "h-8 px-3 text-sm rounded-lg",
      md: "h-10 px-4 text-sm rounded-lg",
      lg: "h-11 px-5 text-base rounded-lg",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center transition-colors focus:outline-none",
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

MinimalButton.displayName = 'MinimalButton';

// Also export as Button to be a drop-in replacement
export const Button = MinimalButton;

export default MinimalButton;
