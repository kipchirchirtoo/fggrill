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
      // Filled variant colors - minimalistic
      { variant: "filled", color: "primary", className: "bg-[#007AFF] text-white dark:bg-[#0A84FF]" },
      { variant: "filled", color: "secondary", className: "bg-[#8E8E93] text-white dark:bg-[#98989D]" },
      { variant: "filled", color: "success", className: "bg-[#34C759] text-white dark:bg-[#30D158]" },
      { variant: "filled", color: "warning", className: "bg-[#FF9500] text-white dark:bg-[#FF9F0A]" },
      { variant: "filled", color: "danger", className: "bg-[#FF3B30] text-white dark:bg-[#FF453A]" },
      { variant: "filled", color: "info", className: "bg-[#5AC8FA] text-white dark:bg-[#64D2FF]" },
      { variant: "filled", color: "purple", className: "bg-[#AF52DE] text-white dark:bg-[#BF5AF2]" },
      { variant: "filled", color: "pink", className: "bg-[#FF2D55] text-white dark:bg-[#FF375F]" },
      { variant: "filled", color: "indigo", className: "bg-[#5856D6] text-white dark:bg-[#5E5CE6]" },
      
      // Light variant colors - minimalistic with reduced opacity
      { variant: "light", color: "primary", className: "bg-[#007AFF]/10 text-[#007AFF] dark:bg-[#0A84FF]/10 dark:text-[#0A84FF]" },
      { variant: "light", color: "secondary", className: "bg-[#8E8E93]/10 text-[#8E8E93] dark:bg-[#98989D]/10 dark:text-[#98989D]" },
      { variant: "light", color: "success", className: "bg-[#34C759]/10 text-[#34C759] dark:bg-[#30D158]/10 dark:text-[#30D158]" },
      { variant: "light", color: "warning", className: "bg-[#FF9500]/10 text-[#FF9500] dark:bg-[#FF9F0A]/10 dark:text-[#FF9F0A]" },
      { variant: "light", color: "danger", className: "bg-[#FF3B30]/10 text-[#FF3B30] dark:bg-[#FF453A]/10 dark:text-[#FF453A]" },
      { variant: "light", color: "info", className: "bg-[#5AC8FA]/10 text-[#5AC8FA] dark:bg-[#64D2FF]/10 dark:text-[#64D2FF]" },
      { variant: "light", color: "purple", className: "bg-[#AF52DE]/10 text-[#AF52DE] dark:bg-[#BF5AF2]/10 dark:text-[#BF5AF2]" },
      { variant: "light", color: "pink", className: "bg-[#FF2D55]/10 text-[#FF2D55] dark:bg-[#FF375F]/10 dark:text-[#FF375F]" },
      { variant: "light", color: "indigo", className: "bg-[#5856D6]/10 text-[#5856D6] dark:bg-[#5E5CE6]/10 dark:text-[#5E5CE6]" },
      
      // Outline variant colors - minimalistic with thin borders
      { variant: "outline", color: "primary", className: "border-[#007AFF] text-[#007AFF] dark:border-[#0A84FF] dark:text-[#0A84FF]" },
      { variant: "outline", color: "secondary", className: "border-[#8E8E93] text-[#8E8E93] dark:border-[#98989D] dark:text-[#98989D]" },
      { variant: "outline", color: "success", className: "border-[#34C759] text-[#34C759] dark:border-[#30D158] dark:text-[#30D158]" },
      { variant: "outline", color: "warning", className: "border-[#FF9500] text-[#FF9500] dark:border-[#FF9F0A] dark:text-[#FF9F0A]" },
      { variant: "outline", color: "danger", className: "border-[#FF3B30] text-[#FF3B30] dark:border-[#FF453A] dark:text-[#FF453A]" },
      { variant: "outline", color: "info", className: "border-[#5AC8FA] text-[#5AC8FA] dark:border-[#64D2FF] dark:text-[#64D2FF]" },
      { variant: "outline", color: "purple", className: "border-[#AF52DE] text-[#AF52DE] dark:border-[#BF5AF2] dark:text-[#BF5AF2]" },
      { variant: "outline", color: "pink", className: "border-[#FF2D55] text-[#FF2D55] dark:border-[#FF375F] dark:text-[#FF375F]" },
      { variant: "outline", color: "indigo", className: "border-[#5856D6] text-[#5856D6] dark:border-[#5E5CE6] dark:text-[#5E5CE6]" },

      // Pill variant - minimalistic
      { variant: "pill", color: "primary", className: "bg-[#007AFF] text-white dark:bg-[#0A84FF]" },
      { variant: "pill", color: "secondary", className: "bg-[#8E8E93] text-white dark:bg-[#98989D]" },
      { variant: "pill", color: "success", className: "bg-[#34C759] text-white dark:bg-[#30D158]" },
      { variant: "pill", color: "warning", className: "bg-[#FF9500] text-white dark:bg-[#FF9F0A]" },
      { variant: "pill", color: "danger", className: "bg-[#FF3B30] text-white dark:bg-[#FF453A]" },
      { variant: "pill", color: "info", className: "bg-[#5AC8FA] text-white dark:bg-[#64D2FF]" },
      { variant: "pill", color: "purple", className: "bg-[#AF52DE] text-white dark:bg-[#BF5AF2]" },
      { variant: "pill", color: "pink", className: "bg-[#FF2D55] text-white dark:bg-[#FF375F]" },
      { variant: "pill", color: "indigo", className: "bg-[#5856D6] text-white dark:bg-[#5E5CE6]" },
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
