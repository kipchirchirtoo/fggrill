'use client';

import React from 'react';
import { useBranch } from '@/lib/branch-context';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BranchSelectorProps {
  className?: string;
  showIcon?: boolean;
  showLabel?: boolean;
  showAllOption?: boolean;
  allOptionLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  onChange?: (branchId: number | null) => void;
  value?: number | null;
  disabled?: boolean;
}

export function BranchSelector({ 
  className = '', 
  showIcon = true,
  showLabel = false,
  showAllOption = false,
  allOptionLabel = 'All Branches',
  size = 'md',
  onChange,
  value,
  disabled = false,
}: BranchSelectorProps) {
  const { activeBranchId, userBranches, setActiveBranch, isLoading } = useBranch();

  // Use controlled value if provided, otherwise use context
  const currentValue = value !== undefined ? value : activeBranchId;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value ? Number(e.target.value) : null;
    
    if (onChange) {
      onChange(newValue === 0 ? null : newValue);
    } else {
      setActiveBranch(newValue === null ? 0 : newValue);
    }
  };

  // Don't show if only one branch and no "all" option
  if (!showAllOption && userBranches.length <= 1) {
    return null;
  }

  if (isLoading) {
    return <div className={cn("animate-pulse bg-stone-100 rounded-lg h-10 w-40", className)} />;
  }

  const sizeClasses = {
    sm: 'h-8 text-xs px-2',
    md: 'h-10 text-sm px-3',
    lg: 'h-12 text-base px-4',
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showIcon && <Building2 className={cn("text-stone-400", size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />}
      {showLabel && <span className="text-sm text-stone-500">Branch:</span>}
      <select
        value={currentValue || ''}
        onChange={handleChange}
        disabled={disabled || isLoading}
        className={cn(
          "bg-stone-50 border border-stone-200 rounded-lg font-medium transition-all cursor-pointer focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400",
          sizeClasses[size],
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {showAllOption && (
          <option value="0">{allOptionLabel}</option>
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

export default BranchSelector;
