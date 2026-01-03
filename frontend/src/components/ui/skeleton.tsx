'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'circular' | 'rounded';
  animation?: 'pulse' | 'shimmer' | 'none';
}

export function Skeleton({ 
  className, 
  variant = 'default',
  animation = 'pulse',
  ...props 
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'bg-stone-200',
        variant === 'circular' && 'rounded-full',
        variant === 'rounded' && 'rounded-lg',
        variant === 'default' && 'rounded',
        animation === 'pulse' && 'animate-pulse',
        animation === 'shimmer' && 'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent',
        className
      )}
      {...props}
    />
  );
}

// Stat Card Skeleton
export function StatCardSkeleton() {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <Skeleton className="w-12 h-4" />
      </div>
      <Skeleton className="w-16 h-3 mb-2" />
      <Skeleton className="w-20 h-6" />
    </div>
  );
}

// Table Row Skeleton
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-stone-50">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="py-3 px-3">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

// List Item Skeleton
export function ListItemSkeleton() {
  return (
    <div className="p-3 bg-stone-50 rounded-lg flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="w-2 h-2 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="w-24 h-3.5" />
          <Skeleton className="w-16 h-2.5" />
        </div>
      </div>
      <Skeleton className="w-16 h-6 rounded-full" />
    </div>
  );
}

// Card Skeleton
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card-elevated p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="w-32 h-5" />
        <Skeleton className="w-16 h-4" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-4" style={{ width: `${100 - i * 15}%` }} />
        ))}
      </div>
    </div>
  );
}

// Dashboard Stats Skeleton
export function DashboardStatsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-${Math.min(count, 6)} gap-3`}>
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Quick Links Skeleton
export function QuickLinksSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="card-elevated p-5">
      <Skeleton className="w-28 h-5 mb-4" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="action-card">
            <Skeleton className="w-10 h-10 rounded-lg mx-auto mb-2" />
            <Skeleton className="w-16 h-3 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Full Page Loading Skeleton
export function PageLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="w-48 h-7" />
          <Skeleton className="w-32 h-4" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="w-24 h-10 rounded-lg" />
          <Skeleton className="w-24 h-10 rounded-lg" />
        </div>
      </div>

      {/* Stats */}
      <DashboardStatsSkeleton count={6} />

      {/* Content */}
      <div className="grid lg:grid-cols-2 gap-5">
        <CardSkeleton lines={5} />
        <CardSkeleton lines={4} />
      </div>
    </div>
  );
}

// Empty State Component
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-stone-900 mb-1">{title}</h3>
      {description && (
        <p className="text-[13px] text-stone-500 max-w-sm">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 text-[13px] font-medium text-white bg-stone-900 rounded-lg hover:bg-stone-800 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export default Skeleton;
