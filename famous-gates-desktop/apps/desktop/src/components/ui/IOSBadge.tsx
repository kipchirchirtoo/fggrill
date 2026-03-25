import React from 'react';
import { cn } from '../../utils/cn';
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
      { variant: "filled", color: "primary", className: "bg-amber-500 text-white" },
      { variant: "filled", color: "secondary", className: "bg-stone-500 text-white" },
      { variant: "filled", color: "success", className: "bg-emerald-500 text-white" },
      { variant: "filled", color: "warning", className: "bg-amber-500 text-white" },
      { variant: "filled", color: "danger", className: "bg-red-500 text-white" },
      { variant: "filled", color: "info", className: "bg-sky-500 text-white" },
      { variant: "light", color: "primary", className: "bg-amber-50 text-amber-700" },
      { variant: "light", color: "secondary", className: "bg-stone-100 text-stone-600" },
      { variant: "light", color: "success", className: "bg-emerald-50 text-emerald-700" },
      { variant: "light", color: "warning", className: "bg-amber-50 text-amber-700" },
      { variant: "light", color: "danger", className: "bg-red-50 text-red-700" },
      { variant: "light", color: "info", className: "bg-sky-50 text-sky-700" },
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
    const displayContent = () => {
      if (dot) return null;
      if (count !== undefined) {
        if (count === 0 && !showZero) return null;
        return count > max ? `${max}+` : count;
      }
      return children;
    };
    
    const content = displayContent();
    
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant, size, color: color as any }), className)}
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
