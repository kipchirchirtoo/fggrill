'use client';

import React from 'react';
import { useBranch } from '@/lib/branch-context';
import { useAuth } from '@/lib/auth-context';
import { Building2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BranchSelectorProps {
  className?: string;
  showAllOption?: boolean;
  allOptionLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'minimal' | 'outlined';
  onChange?: (branchId: number | null) => void;
  value?: number | null;
  disabled?: boolean;
}

export function BranchSelector({
  className,
  showAllOption = false,
  allOptionLabel = 'All Branches',
  size = 'md',
  variant = 'default',
  onChange,
  value,
  disabled = false,
}: BranchSelectorProps) {
  const { userBranches, activeBranchId, setActiveBranch, isLoading } = useBranch();
  const { user } = useAuth();

  // Use controlled value if provided, otherwise use context
  const currentValue = value !== undefined ? value : activeBranchId;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value ? Number(e.target.value) : null;
    
    if (onChange) {
      onChange(newValue);
    } else if (newValue !== null) {
      setActiveBranch(newValue);
    }
  };

  // Don't show if user only has access to one branch and no "all" option
  if (!showAllOption && userBranches.length <= 1) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={cn(
        "animate-pulse bg-stone-100 rounded-lg",
        size === 'sm' ? 'h-8 w-32' : size === 'lg' ? 'h-12 w-48' : 'h-10 w-40',
        className
      )} />
    );
  }

  const sizeClasses = {
    sm: 'h-8 text-xs px-2',
    md: 'h-10 text-sm px-3',
    lg: 'h-12 text-base px-4',
  };

  const variantClasses = {
    default: 'bg-stone-50 border border-stone-200 focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400',
    minimal: 'bg-transparent border-0 focus:ring-0 hover:bg-stone-50',
    outlined: 'bg-white border-2 border-stone-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500',
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Building2 className={cn(
        "text-stone-400",
        size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'
      )} />
      <select
        value={currentValue || ''}
        onChange={handleChange}
        disabled={disabled || isLoading}
        className={cn(
          "rounded-lg font-medium transition-all cursor-pointer appearance-none pr-8",
          sizeClasses[size],
          variantClasses[variant],
          disabled && "opacity-50 cursor-not-allowed"
        )}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
          backgroundPosition: 'right 0.5rem center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '1.5em 1.5em',
        }}
      >
        {showAllOption && (
          <option value="">{allOptionLabel}</option>
        )}
        {userBranches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// Hook for pages that need branch-aware data fetching
export function useBranchFilter(initialBranchId?: number | null) {
  const { activeBranchId, userBranches } = useBranch();
  const { user } = useAuth();
  const [selectedBranchId, setSelectedBranchId] = React.useState<number | null>(
    initialBranchId !== undefined ? initialBranchId : activeBranchId
  );

  // Sync with context if no initial value provided
  React.useEffect(() => {
    if (initialBranchId === undefined && activeBranchId) {
      setSelectedBranchId(activeBranchId);
    }
  }, [activeBranchId, initialBranchId]);

  // Check if user can view all branches
  const canViewAllBranches = React.useMemo(() => {
    const multiAccessRoles = [
      'super_admin',
      'general_manager',
      'central_operations_manager',
      'accountant',
      'finance_manager',
    ];
    return user?.role && multiAccessRoles.includes(user.role);
  }, [user?.role]);

  // Get the effective branch ID for API calls
  const effectiveBranchId = React.useMemo(() => {
    // If user selected "all branches" and has permission
    if (selectedBranchId === null && canViewAllBranches) {
      return undefined; // undefined means no filter
    }
    // Otherwise use selected or fall back to user's branch
    return selectedBranchId || user?.branch_id || undefined;
  }, [selectedBranchId, canViewAllBranches, user?.branch_id]);

  return {
    selectedBranchId,
    setSelectedBranchId,
    effectiveBranchId,
    canViewAllBranches,
    userBranches,
    activeBranchId,
  };
}

// Compact branch indicator for headers
export function BranchIndicator({ className }: { className?: string }) {
  const { activeBranch } = useBranch();

  if (!activeBranch) return null;

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium",
      className
    )}>
      <Building2 className="h-3 w-3" />
      <span>{activeBranch.name}</span>
    </div>
  );
}

export default BranchSelector;
