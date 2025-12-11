'use client';

import { ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { BranchSelector } from './BranchSelector';
import { IOSButton } from '@/components/ui/ios-button';

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  showBranchSelector?: boolean;
  showRefresh?: boolean;
  onRefresh?: () => void;
  isLoading?: boolean;
  actions?: ReactNode;
}

export function DashboardHeader({
  title,
  subtitle,
  icon,
  showBranchSelector = true,
  showRefresh = true,
  onRefresh,
  isLoading = false,
  actions
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="p-2 bg-amber-50 rounded-xl">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{title}</h1>
          {subtitle && <p className="text-stone-500 text-sm">{subtitle}</p>}
        </div>
      </div>
      
      <div className="flex items-center gap-3 flex-wrap">
        {showBranchSelector && <BranchSelector />}
        
        {showRefresh && onRefresh && (
          <IOSButton 
            variant="secondary" 
            onClick={onRefresh} 
            disabled={isLoading}
            leftIcon={<RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </IOSButton>
        )}
        
        {actions}
      </div>
    </div>
  );
}

export default DashboardHeader;
