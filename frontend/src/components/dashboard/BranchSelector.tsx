'use client';

import { useBranch } from '@/lib/branch-context';
import { Building2 } from 'lucide-react';

interface BranchSelectorProps {
  className?: string;
  showIcon?: boolean;
  showLabel?: boolean;
}

export function BranchSelector({ 
  className = '', 
  showIcon = true,
  showLabel = false 
}: BranchSelectorProps) {
  const { activeBranchId, userBranches, setActiveBranch, isLoading } = useBranch();

  // Don't show if only one branch or loading
  if (isLoading || userBranches.length <= 1) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showIcon && <Building2 className="h-4 w-4 text-stone-400" />}
      {showLabel && <span className="text-sm text-stone-500">Branch:</span>}
      <select
        value={activeBranchId || ''}
        onChange={(e) => setActiveBranch(Number(e.target.value))}
        className="px-3 py-2 text-sm bg-stone-100 rounded-lg border-0 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
      >
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
