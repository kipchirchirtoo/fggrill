import React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-medium rounded-full", 
  {
    variants: {
      variant: {
        filled: "",
        light: "",
        outline: "",
        pill: "px-3"
      },
      size: {
        xs: "h-5 text-[10px] px-1.5",
        sm: "h-6 text-xs px-2",
        md: "h-7 text-xs px-2.5",
        lg: "h-8 text-sm px-3"
      },
      color: {
        primary: "",
        secondary: "",
        success: "",
        warning: "",
        danger: "",
        info: "",
        purple: "",
        pink: "",
        indigo: "",
        custom: "",
      },
    },
    compoundVariants: [
      // Filled variant - minimal solid colors
      { variant: "filled", color: "primary", className: "bg-amber-500 text-white" },
      { variant: "filled", color: "secondary", className: "bg-stone-500 text-white" },
      { variant: "filled", color: "success", className: "bg-emerald-500 text-white" },
      { variant: "filled", color: "warning", className: "bg-amber-500 text-white" },
      { variant: "filled", color: "danger", className: "bg-red-500 text-white" },
      { variant: "filled", color: "info", className: "bg-sky-500 text-white" },
      { variant: "filled", color: "purple", className: "bg-purple-500 text-white" },
      { variant: "filled", color: "pink", className: "bg-pink-500 text-white" },
      { variant: "filled", color: "indigo", className: "bg-indigo-500 text-white" },
      
      // Light variant - subtle backgrounds
      { variant: "light", color: "primary", className: "bg-amber-50 text-amber-700" },
      { variant: "light", color: "secondary", className: "bg-stone-100 text-stone-600" },
      { variant: "light", color: "success", className: "bg-emerald-50 text-emerald-700" },
      { variant: "light", color: "warning", className: "bg-amber-50 text-amber-700" },
      { variant: "light", color: "danger", className: "bg-red-50 text-red-700" },
      { variant: "light", color: "info", className: "bg-sky-50 text-sky-700" },
      { variant: "light", color: "purple", className: "bg-purple-50 text-purple-700" },
      { variant: "light", color: "pink", className: "bg-pink-50 text-pink-700" },
      { variant: "light", color: "indigo", className: "bg-indigo-50 text-indigo-700" },
      
      // Outline variant - no borders, just text
      { variant: "outline", color: "primary", className: "bg-transparent text-amber-600" },
      { variant: "outline", color: "secondary", className: "bg-transparent text-stone-600" },
      { variant: "outline", color: "success", className: "bg-transparent text-emerald-600" },
      { variant: "outline", color: "warning", className: "bg-transparent text-amber-600" },
      { variant: "outline", color: "danger", className: "bg-transparent text-red-600" },
      { variant: "outline", color: "info", className: "bg-transparent text-sky-600" },
      { variant: "outline", color: "purple", className: "bg-transparent text-purple-600" },
      { variant: "outline", color: "pink", className: "bg-transparent text-pink-600" },
      { variant: "outline", color: "indigo", className: "bg-transparent text-indigo-600" },

      // Pill variant - same as filled
      { variant: "pill", color: "primary", className: "bg-amber-500 text-white" },
      { variant: "pill", color: "secondary", className: "bg-stone-500 text-white" },
      { variant: "pill", color: "success", className: "bg-emerald-500 text-white" },
      { variant: "pill", color: "warning", className: "bg-amber-500 text-white" },
      { variant: "pill", color: "danger", className: "bg-red-500 text-white" },
      { variant: "pill", color: "info", className: "bg-sky-500 text-white" },
      { variant: "pill", color: "purple", className: "bg-purple-500 text-white" },
      { variant: "pill", color: "pink", className: "bg-pink-500 text-white" },
      { variant: "pill", color: "indigo", className: "bg-indigo-500 text-white" },
    ],
    defaultVariants: {
      variant: "light",
      size: "sm",
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
