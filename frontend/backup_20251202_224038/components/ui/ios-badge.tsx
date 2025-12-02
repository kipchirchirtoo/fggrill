import React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-sf-pro font-medium rounded-ios-full", 
  {
    variants: {
      variant: {
        filled: "",
        light: "",
        outline: "border",
        pill: "px-3"
      },
      size: {
        xs: "h-5 text-[10px] px-1.5",
        sm: "h-6 text-xs px-2",
        md: "h-7 text-xs px-2.5",
        lg: "h-8 text-sm px-3"
      },
      color: {
        // Primary colors (Blue)
        primary: "",
        // Secondary (Gray)
        secondary: "",
        // Success (Green)
        success: "",
        // Warning (Orange/Yellow)
        warning: "",
        // Danger (Red)
        danger: "",
        // Info (Teal)
        info: "",
        // Purple
        purple: "",
        // Pink
        pink: "",
        // Indigo
        indigo: "",
        // Custom
        custom: "",
      },
    },
    compoundVariants: [
      // Filled variant colors
      { variant: "filled", color: "primary", className: "bg-ios-blue-light text-white dark:bg-ios-blue-dark" },
      { variant: "filled", color: "secondary", className: "bg-ios-gray-1 text-white dark:bg-ios-gray-2" },
      { variant: "filled", color: "success", className: "bg-ios-green-light text-white dark:bg-ios-green-dark" },
      { variant: "filled", color: "warning", className: "bg-ios-orange-light text-white dark:bg-ios-orange-dark" },
      { variant: "filled", color: "danger", className: "bg-ios-red-light text-white dark:bg-ios-red-dark" },
      { variant: "filled", color: "info", className: "bg-ios-teal-light text-white dark:bg-ios-teal-dark" },
      { variant: "filled", color: "purple", className: "bg-ios-purple-light text-white dark:bg-ios-purple-dark" },
      { variant: "filled", color: "pink", className: "bg-ios-pink-light text-white dark:bg-ios-pink-dark" },
      { variant: "filled", color: "indigo", className: "bg-ios-indigo-light text-white dark:bg-ios-indigo-dark" },
      
      // Light variant colors
      { variant: "light", color: "primary", className: "bg-ios-blue-light/15 text-ios-blue-light dark:bg-ios-blue-dark/15 dark:text-ios-blue-dark" },
      { variant: "light", color: "secondary", className: "bg-ios-gray-1/15 text-ios-gray-1 dark:bg-ios-gray-2/15 dark:text-ios-gray-3" },
      { variant: "light", color: "success", className: "bg-ios-green-light/15 text-ios-green-light dark:bg-ios-green-dark/15 dark:text-ios-green-dark" },
      { variant: "light", color: "warning", className: "bg-ios-orange-light/15 text-ios-orange-light dark:bg-ios-orange-dark/15 dark:text-ios-orange-dark" },
      { variant: "light", color: "danger", className: "bg-ios-red-light/15 text-ios-red-light dark:bg-ios-red-dark/15 dark:text-ios-red-dark" },
      { variant: "light", color: "info", className: "bg-ios-teal-light/15 text-ios-teal-light dark:bg-ios-teal-dark/15 dark:text-ios-teal-dark" },
      { variant: "light", color: "purple", className: "bg-ios-purple-light/15 text-ios-purple-light dark:bg-ios-purple-dark/15 dark:text-ios-purple-dark" },
      { variant: "light", color: "pink", className: "bg-ios-pink-light/15 text-ios-pink-light dark:bg-ios-pink-dark/15 dark:text-ios-pink-dark" },
      { variant: "light", color: "indigo", className: "bg-ios-indigo-light/15 text-ios-indigo-light dark:bg-ios-indigo-dark/15 dark:text-ios-indigo-dark" },
      
      // Outline variant colors
      { variant: "outline", color: "primary", className: "border-ios-blue-light text-ios-blue-light dark:border-ios-blue-dark dark:text-ios-blue-dark" },
      { variant: "outline", color: "secondary", className: "border-ios-gray-1 text-ios-gray-1 dark:border-ios-gray-2 dark:text-ios-gray-2" },
      { variant: "outline", color: "success", className: "border-ios-green-light text-ios-green-light dark:border-ios-green-dark dark:text-ios-green-dark" },
      { variant: "outline", color: "warning", className: "border-ios-orange-light text-ios-orange-light dark:border-ios-orange-dark dark:text-ios-orange-dark" },
      { variant: "outline", color: "danger", className: "border-ios-red-light text-ios-red-light dark:border-ios-red-dark dark:text-ios-red-dark" },
      { variant: "outline", color: "info", className: "border-ios-teal-light text-ios-teal-light dark:border-ios-teal-dark dark:text-ios-teal-dark" },
      { variant: "outline", color: "purple", className: "border-ios-purple-light text-ios-purple-light dark:border-ios-purple-dark dark:text-ios-purple-dark" },
      { variant: "outline", color: "pink", className: "border-ios-pink-light text-ios-pink-light dark:border-ios-pink-dark dark:text-ios-pink-dark" },
      { variant: "outline", color: "indigo", className: "border-ios-indigo-light text-ios-indigo-light dark:border-ios-indigo-dark dark:text-ios-indigo-dark" },

      // Pill variant uses same colors as filled
      { variant: "pill", color: "primary", className: "bg-ios-blue-light text-white dark:bg-ios-blue-dark" },
      { variant: "pill", color: "secondary", className: "bg-ios-gray-1 text-white dark:bg-ios-gray-2" },
      { variant: "pill", color: "success", className: "bg-ios-green-light text-white dark:bg-ios-green-dark" },
      { variant: "pill", color: "warning", className: "bg-ios-orange-light text-white dark:bg-ios-orange-dark" },
      { variant: "pill", color: "danger", className: "bg-ios-red-light text-white dark:bg-ios-red-dark" },
      { variant: "pill", color: "info", className: "bg-ios-teal-light text-white dark:bg-ios-teal-dark" },
      { variant: "pill", color: "purple", className: "bg-ios-purple-light text-white dark:bg-ios-purple-dark" },
      { variant: "pill", color: "pink", className: "bg-ios-pink-light text-white dark:bg-ios-pink-dark" },
      { variant: "pill", color: "indigo", className: "bg-ios-indigo-light text-white dark:bg-ios-indigo-dark" },
    ],
    defaultVariants: {
      variant: "filled",
      size: "md",
      color: "primary",
    }
  }
);

export interface IOSBadgeProps 
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>,
    VariantProps<typeof badgeVariants> {
  count?: number;
  max?: number;
  dot?: boolean;
  showZero?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const IOSBadge = React.forwardRef<HTMLDivElement, IOSBadgeProps>(
  ({ className, variant, size, color, count, max = 99, dot, showZero = false, startIcon, endIcon, children, ...props }, ref) => {
    // Determine what to display inside the badge
    const displayContent = () => {
      if (dot) return null;
      if (count !== undefined) {
        if (count === 0 && !showZero) return null;
        return count > max ? `${max}+` : count;
      }
      return children;
    };
    
    const content = displayContent();
    if (dot && !content && !startIcon && !endIcon) {
      // Return a small dot badge
      return (
        <span 
          ref={ref} 
          className={cn(
            "block h-2.5 w-2.5 rounded-full", 
            color === "primary" && "bg-ios-red-light dark:bg-ios-red-dark", 
            className
          )} 
          {...props} 
        />
      );
    }
    
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ 
          variant, 
          size, 
          color: color as "primary" | "secondary" | "success" | "warning" | "danger" | "info" | "purple" | "pink" | "indigo" | "custom" | null | undefined
        }), className)}
        {...props}
      >
        {startIcon && <span className="mr-1">{startIcon}</span>}
        {content}
        {endIcon && <span className="ml-1">{endIcon}</span>}
      </div>
    );
  }
);

IOSBadge.displayName = 'IOSBadge';
