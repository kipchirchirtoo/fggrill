import React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-ios-lg font-sf-pro font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ios-blue-light focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]", 
  {
    variants: {
      variant: {
        // Primary iOS blue button
        primary: "bg-ios-blue-light text-white shadow-ios-sm hover:bg-ios-blue-light/90 dark:bg-ios-blue-dark dark:hover:bg-ios-blue-dark/90",
        // Secondary light gray button with blue text
        secondary: "bg-ios-gray-6 text-ios-blue-light hover:bg-ios-gray-5 dark:bg-[#2C2C2E] dark:text-ios-blue-dark dark:hover:bg-[#3A3A3C]",
        // Destructive red button
        destructive: "bg-ios-red-light text-white shadow-ios-sm hover:bg-ios-red-light/90 dark:bg-ios-red-dark dark:hover:bg-ios-red-dark/90",
        // Success green button
        success: "bg-ios-green-light text-white shadow-ios-sm hover:bg-ios-green-light/90 dark:bg-ios-green-dark dark:hover:bg-ios-green-dark/90",
        // Outline button with border
        outline: "border border-ios-gray-4 bg-white text-ios-blue-light hover:bg-ios-gray-6 dark:border-[#3A3A3C] dark:bg-black dark:text-ios-blue-dark dark:hover:bg-[#1C1C1E]",
        // Ghost button with no background
        ghost: "text-ios-blue-light hover:bg-ios-gray-6/50 dark:text-ios-blue-dark dark:hover:bg-[#2C2C2E]/50",
        // Link style
        link: "text-ios-blue-light underline-offset-4 hover:underline dark:text-ios-blue-dark",
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
