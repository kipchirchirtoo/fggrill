"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const iconVariants = cva(
  "inline-flex items-center justify-center flex-shrink-0", 
  {
    variants: {
      size: {
        xs: "h-4 w-4",
        sm: "h-5 w-5",
        md: "h-6 w-6", 
        lg: "h-8 w-8",
        xl: "h-10 w-10",
        custom: "",
      },
      color: {
        default: "text-black dark:text-white",
        muted: "text-ios-gray-1 dark:text-ios-gray-3",
        primary: "text-ios-blue-light dark:text-ios-blue-dark",
        success: "text-ios-green-light dark:text-ios-green-dark",
        warning: "text-ios-orange-light dark:text-ios-orange-dark",
        danger: "text-ios-red-light dark:text-ios-red-dark",
        info: "text-ios-teal-light dark:text-ios-teal-dark",
      },
      background: {
        none: "",
        subtle: "p-2 rounded-full",
        solid: "p-2 rounded-full",
      }
    },
    compoundVariants: [
      // Background subtle variants
      { background: "subtle", color: "default", className: "bg-ios-gray-6/80 dark:bg-[#2C2C2E]/80" },
      { background: "subtle", color: "muted", className: "bg-ios-gray-6/80 dark:bg-[#2C2C2E]/80" },
      { background: "subtle", color: "primary", className: "bg-ios-blue-light/10 dark:bg-ios-blue-dark/10" },
      { background: "subtle", color: "success", className: "bg-ios-green-light/10 dark:bg-ios-green-dark/10" },
      { background: "subtle", color: "warning", className: "bg-ios-orange-light/10 dark:bg-ios-orange-dark/10" },
      { background: "subtle", color: "danger", className: "bg-ios-red-light/10 dark:bg-ios-red-dark/10" },
      { background: "subtle", color: "info", className: "bg-ios-teal-light/10 dark:bg-ios-teal-dark/10" },

      // Background solid variants
      { background: "solid", color: "default", className: "bg-ios-gray-3 dark:bg-ios-gray-1 text-white" },
      { background: "solid", color: "muted", className: "bg-ios-gray-3 dark:bg-ios-gray-1 text-white" },
      { background: "solid", color: "primary", className: "bg-ios-blue-light dark:bg-ios-blue-dark text-white" },
      { background: "solid", color: "success", className: "bg-ios-green-light dark:bg-ios-green-dark text-white" },
      { background: "solid", color: "warning", className: "bg-ios-orange-light dark:bg-ios-orange-dark text-white" },
      { background: "solid", color: "danger", className: "bg-ios-red-light dark:bg-ios-red-dark text-white" },
      { background: "solid", color: "info", className: "bg-ios-teal-light dark:bg-ios-teal-dark text-white" },
    ],
    defaultVariants: {
      size: "md",
      color: "default",
      background: "none",
    }
  }
);

// Base interface for iOS icons
export interface IOSIconProps 
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'>,
    VariantProps<typeof iconVariants> {
  strokeWidth?: number;
  fill?: boolean;
}

export const IOSIcon = React.forwardRef<HTMLSpanElement, IOSIconProps & { icon: React.ReactNode }>(
  ({ className, icon, size, color, background, strokeWidth = 1.5, fill = false, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(iconVariants({ 
          size, 
          color: color as "default" | "muted" | "primary" | "success" | "warning" | "danger" | "info" | null | undefined, 
          background 
        }), className)}
        {...props}
      >
        {React.isValidElement(icon) && React.cloneElement(icon as React.ReactElement, {
          strokeWidth,
          fill: fill ? 'currentColor' : 'none',
        })}
      </span>
    );
  }
);

IOSIcon.displayName = 'IOSIcon';

// iOS-style SF Symbols inspired components
// These components follow iOS design principles but use lucide-react icons with appropriate styling

// A set of iOS-style tab bar icons (Home, Search, Notifications, Settings)
export const HomeIcon: React.FC<IOSIconProps> = (props) => (
  <IOSIcon
    icon={
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    }
    {...props}
  />
);

export const CalendarIcon: React.FC<IOSIconProps> = (props) => (
  <IOSIcon
    icon={
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    }
    {...props}
  />
);

export const BellIcon: React.FC<IOSIconProps> = (props) => (
  <IOSIcon
    icon={
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    }
    {...props}
  />
);

export const GearIcon: React.FC<IOSIconProps> = (props) => (
  <IOSIcon
    icon={
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    }
    {...props}
  />
);

export const PlusIcon: React.FC<IOSIconProps> = (props) => (
  <IOSIcon
    icon={
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    }
    {...props}
  />
);

export const CheckIcon: React.FC<IOSIconProps> = (props) => (
  <IOSIcon
    icon={
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    }
    {...props}
  />
);

export const ChevronRightIcon: React.FC<IOSIconProps> = (props) => (
  <IOSIcon
    icon={
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    }
    {...props}
  />
);

export const ChevronDownIcon: React.FC<IOSIconProps> = (props) => (
  <IOSIcon
    icon={
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    }
    {...props}
  />
);

export const SearchIcon: React.FC<IOSIconProps> = (props) => (
  <IOSIcon
    icon={
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    }
    {...props}
  />
);

export const CloseIcon: React.FC<IOSIconProps> = (props) => (
  <IOSIcon
    icon={
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    }
    {...props}
  />
);

export const TrashIcon: React.FC<IOSIconProps> = (props) => (
  <IOSIcon
    icon={
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    }
    {...props}
  />
);

export const EditIcon: React.FC<IOSIconProps> = (props) => (
  <IOSIcon
    icon={
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    }
    {...props}
  />
);

export const InfoIcon: React.FC<IOSIconProps> = (props) => (
  <IOSIcon
    icon={
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    }
    {...props}
  />
);

export const AlertIcon: React.FC<IOSIconProps> = (props) => (
  <IOSIcon
    icon={
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    }
    {...props}
  />
);

export const ChatIcon: React.FC<IOSIconProps> = (props) => (
  <IOSIcon
    icon={
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    }
    {...props}
  />
);

export const UserIcon: React.FC<IOSIconProps> = (props) => (
  <IOSIcon
    icon={
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    }
    {...props}
  />
);

export const ShieldIcon: React.FC<IOSIconProps> = (props) => (
  <IOSIcon
    icon={
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    }
    {...props}
  />
);

export const BookmarkIcon: React.FC<IOSIconProps> = (props) => (
  <IOSIcon
    icon={
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    }
    {...props}
  />
);
