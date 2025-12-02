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
      primary: "bg-[#007AFF] text-white hover:bg-[#007AFF]/90",
      secondary: "bg-[#F2F2F7] text-[#007AFF] hover:bg-[#E5E5EA]",
      outline: "bg-white border border-[#D1D1D6] text-[#007AFF] hover:bg-[#F2F2F7]",
      destructive: "bg-[#FF3B30] text-white hover:bg-[#FF3B30]/90",
      success: "bg-[#34C759] text-white hover:bg-[#34C759]/90",
      ghost: "text-[#007AFF] hover:bg-[#F2F2F7]",
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
