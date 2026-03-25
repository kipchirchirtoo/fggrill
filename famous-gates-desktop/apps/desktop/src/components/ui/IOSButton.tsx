import React from 'react';
import { cn } from '../../utils/cn';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] select-none", 
  {
    variants: {
      variant: {
        primary: "bg-[#007AFF] text-white hover:bg-[#0056CC] shadow-sm hover:shadow-md",
        secondary: "bg-[#F2F2F7] text-[#007AFF] hover:bg-[#E5E5EA] border border-[#E5E5EA]",
        destructive: "bg-[#FF3B30] text-white hover:bg-[#E6352B] shadow-sm",
        success: "bg-[#34C759] text-white hover:bg-[#2DB24E] shadow-sm",
        outline: "border-2 border-[#007AFF] bg-white text-[#007AFF] hover:bg-[#007AFF]/5",
        ghost: "text-[#007AFF] hover:bg-[#007AFF]/10",
        link: "text-[#007AFF] hover:underline underline-offset-2",
      },
      size: {
        xs: "h-7 px-2.5 text-xs gap-1.5 rounded-lg",
        sm: "h-8 px-3 text-sm gap-1.5 rounded-lg",
        md: "h-10 px-4 text-sm gap-2 rounded-xl",
        lg: "h-11 px-5 text-base gap-2 rounded-xl",
        xl: "h-12 px-6 text-base gap-2.5 rounded-xl",
        icon: "h-9 w-9 rounded-xl p-0",
        "icon-sm": "h-8 w-8 rounded-lg p-0",
        "icon-lg": "h-11 w-11 rounded-xl p-0",
      },
      pill: {
        true: "rounded-full"
      },
      glass: {
        true: "backdrop-blur-md bg-white/80 border border-white/20 shadow-lg"
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
  iconOnly?: boolean;
}

export const IOSButton = React.forwardRef<HTMLButtonElement, IOSButtonProps>(
  ({ className, variant, size, fullWidth, loading, leftIcon, rightIcon, pill, glass, iconOnly, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          buttonVariants({ variant, size: iconOnly && size === 'md' ? 'icon' : size, pill, glass }),
          fullWidth && 'w-full',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <>
            {leftIcon && <span className="flex-shrink-0 mr-2">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="flex-shrink-0 ml-2">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

IOSButton.displayName = 'IOSButton';
