import React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const cardVariants = cva(
  "rounded-ios-xl bg-white dark:bg-[#1C1C1E] text-black dark:text-white overflow-hidden transition-all duration-200", 
  {
    variants: {
      variant: {
        default: "shadow-ios-sm border border-ios-separator-light dark:border-ios-separator-dark", 
        elevated: "shadow-ios-md",
        filled: "bg-ios-gray-6 dark:bg-[#2C2C2E] border-none",
        outlined: "border-2 border-ios-separator-light dark:border-ios-separator-dark",
        glass: "backdrop-blur-ios bg-white/80 dark:bg-black/70 shadow-ios-sm",
      },
      padding: {
        none: "p-0",
        xs: "p-2",
        sm: "p-3",
        md: "p-4",
        lg: "p-6",
        xl: "p-8",
      },
      radius: {
        default: "rounded-ios-xl",
        sm: "rounded-ios-md",
        lg: "rounded-ios-2xl",
        full: "rounded-ios-full",
      }
    },
    defaultVariants: {
      variant: "default",
      padding: "md",
      radius: "default",
    }
  }
);

export interface IOSCardProps 
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  asChild?: boolean;
  clickable?: boolean;
  hover?: boolean;
}

export const IOSCard = React.forwardRef<HTMLDivElement, IOSCardProps>(
  ({ className, variant, padding, radius, clickable, hover, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          cardVariants({ variant, padding, radius }),
          clickable && "cursor-pointer active:scale-[0.98]",
          hover && "hover:shadow-ios-md hover:-translate-y-0.5",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

IOSCard.displayName = 'IOSCard';

export interface IOSCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  compact?: boolean;
}

export const IOSCardHeader = React.forwardRef<HTMLDivElement, IOSCardHeaderProps>(
  ({ className, compact = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col space-y-1.5',
          compact ? 'mb-2' : 'mb-4',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

IOSCardHeader.displayName = 'IOSCardHeader';

export interface IOSCardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  size?: 'sm' | 'md' | 'lg';
}

export const IOSCardTitle = React.forwardRef<HTMLHeadingElement, IOSCardTitleProps>(
  ({ className, size = 'md', children, ...props }, ref) => {
    const sizeClasses = {
      sm: 'text-base',
      md: 'text-lg',
      lg: 'text-xl',
    }

    return (
      <h3
        ref={ref}
        className={cn(
          'font-sf-pro-display font-semibold tracking-tight text-black dark:text-white',
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
      </h3>
    );
  }
);

IOSCardTitle.displayName = 'IOSCardTitle';

export interface IOSCardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export const IOSCardDescription = React.forwardRef<HTMLParagraphElement, IOSCardDescriptionProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn(
          'font-sf-pro text-sm text-ios-gray-1 dark:text-ios-gray-2 mt-1',
          className
        )}
        {...props}
      >
        {children}
      </p>
    );
  }
);

IOSCardDescription.displayName = 'IOSCardDescription';

export interface IOSCardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export const IOSCardContent = React.forwardRef<HTMLDivElement, IOSCardContentProps>(
  ({ className, padded = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(padded && 'px-4 py-2', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

IOSCardContent.displayName = 'IOSCardContent';

export interface IOSCardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  bordered?: boolean;
}

export const IOSCardFooter = React.forwardRef<HTMLDivElement, IOSCardFooterProps>(
  ({ className, bordered = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'mt-4 flex flex-wrap items-center gap-2',
          bordered && 'border-t border-ios-gray-5 dark:border-[#38383A] pt-4',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

IOSCardFooter.displayName = 'IOSCardFooter';

export interface IOSCardActionProps extends React.HTMLAttributes<HTMLDivElement> {}

export const IOSCardAction = React.forwardRef<HTMLDivElement, IOSCardActionProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('mt-auto', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

IOSCardAction.displayName = 'IOSCardAction';
