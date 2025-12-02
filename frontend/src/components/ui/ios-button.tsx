import React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg font-sf-pro font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed", 
  {
    variants: {
      variant: {
        // Primary button - minimal blue with subtle shadow
        primary: "bg-[#007AFF] text-white hover:bg-[#007AFF]/90 dark:bg-[#0A84FF] dark:hover:bg-[#0A84FF]/90",
        // Secondary button - minimal light gray
        secondary: "bg-[#F2F2F7] text-[#007AFF] hover:bg-[#E5E5EA] dark:bg-[#2C2C2E] dark:text-[#0A84FF] dark:hover:bg-[#3A3A3C]",
        // Destructive button - minimal red
        destructive: "bg-[#FF3B30] text-white hover:bg-[#FF3B30]/90 dark:bg-[#FF453A] dark:hover:bg-[#FF453A]/90",
        // Success button - minimal green
        success: "bg-[#34C759] text-white hover:bg-[#34C759]/90 dark:bg-[#30D158] dark:hover:bg-[#30D158]/90",
        // Outline button - minimal border
        outline: "border border-[#D1D1D6] bg-white text-[#007AFF] hover:bg-[#F2F2F7] dark:border-[#3A3A3C] dark:bg-black dark:text-[#0A84FF] dark:hover:bg-[#1C1C1E]",
        // Ghost button - minimal hover effect
        ghost: "text-[#007AFF] hover:bg-[#F2F2F7]/50 dark:text-[#0A84FF] dark:hover:bg-[#2C2C2E]/50",
        // Link style - minimal
        link: "text-[#007AFF] hover:underline dark:text-[#0A84FF]",
      },
      size: {
        xs: "h-7 px-2.5 text-xs rounded-ios-md",
        sm: "h-9 px-3 py-2 text-sm rounded-ios-md",
        md: "h-11 px-4 py-2.5 text-base rounded-ios-lg",
        lg: "h-12 px-5 py-2.5 text-lg rounded-ios-xl",
        xl: "h-14 px-6 py-3 text-xl rounded-ios-xl",
        icon: "h-10 w-10 rounded-full p-0",
      },
      pill: {
        true: "rounded-ios-full"
      },
      glass: {
        true: "backdrop-blur-ios bg-white/80 dark:bg-black/80"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    }
  }
);

export interface IOSButtonProps 
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  pill?: boolean;
  glass?: boolean;
}

export const IOSButton = React.forwardRef<HTMLButtonElement, IOSButtonProps>(
  ({ className, variant, size, fullWidth, loading, leftIcon, rightIcon, pill, glass, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          buttonVariants({ variant, size, pill, glass }),
          fullWidth && 'w-full',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : leftIcon ? (
          <span className="mr-2">{leftIcon}</span>
        ) : null}
        <span className="flex-1 text-center">{children}</span>
        {rightIcon && <span className="ml-2">{rightIcon}</span>}
      </button>
    );
  }
);

IOSButton.displayName = 'IOSButton';
