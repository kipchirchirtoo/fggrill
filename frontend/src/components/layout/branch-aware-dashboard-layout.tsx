'use client';

import { ReactNode, useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { BranchSelector, useBranch, BranchProvider } from '@/lib/branch-context';
import { useAuth, UserRole } from '@/lib/auth-context';
import { Button } from '@/components/ui/minimal/button';
import { RefreshCw } from 'lucide-react';
import { IOSCard } from '@/components/ui/ios-card';
import { BranchInitializer } from '@/components/branch/branch-initializer';

interface BranchAwareDashboardLayoutProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
  requireBranchContext?: boolean;
  headerContent?: ReactNode;
  title?: string;
  subtitle?: string;
  actionButton?: ReactNode;
  hideBranchSelector?: boolean;
}

// Single-branch roles that should NOT see the branch selector
const SINGLE_BRANCH_ROLES = [
  UserRole.BRANCH_MANAGER,
  UserRole.HOUSEKEEPING,
  UserRole.HOUSEKEEPING_SUPERVISOR,
  UserRole.MAINTENANCE,
  UserRole.RECEPTIONIST,
  UserRole.RESTAURANT,
  UserRole.POS_KITCHEN,
  UserRole.BARTENDER,
  UserRole.BRANCH_STOREKEEPER,
];

export function BranchAwareDashboardLayout({
  children,
  allowedRoles,
  requireBranchContext = true,
  headerContent,
  title,
  subtitle,
  actionButton,
  hideBranchSelector: hideBranchSelectorProp
}: BranchAwareDashboardLayoutProps) {
  const { activeBranch, activeBranchId, isLoading: branchLoading, refreshBranches, userBranches } = useBranch();
  const { user } = useAuth();

  // Auto-hide branch selector for single-branch roles or if user has only one branch
  const isSingleBranchRole = user?.role && SINGLE_BRANCH_ROLES.includes(user.role as UserRole);
  const hasOnlyOneBranch = userBranches.length <= 1;
  const hideBranchSelector = hideBranchSelectorProp ?? (isSingleBranchRole || hasOnlyOneBranch);
  const [isBranchRefreshing, setIsBranchRefreshing] = useState(false);

  const handleRefreshBranch = async () => {
    setIsBranchRefreshing(true);
    try {
      await refreshBranches();
    } finally {
      setIsBranchRefreshing(false);
    }
  };

  // Show branch selection prompt if required but no branch is selected
  if (requireBranchContext && !activeBranchId && !branchLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <IOSCard className="p-6 max-w-md mx-auto text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Select a Branch</h2>
            <p className="text-gray-500 mb-6">
              Please select a branch to continue. This feature requires branch context.
            </p>
            <div className="flex justify-center">
              <BranchSelector />
            </div>
            <p className="text-sm text-gray-400 mt-6">
              Note: You can change the active branch at any time using the selector in the navigation bar.
            </p>
          </IOSCard>
        </div>
      </DashboardLayout>
    );
  }

  // Using BranchInitializer to safely handle branch context
  return (
    <BranchInitializer>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header area with branch context */}
          {(title || subtitle || headerContent || activeBranch) && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b">
              <div>
                {title && <h1 className="text-2xl font-bold text-gray-900">{title}</h1>}
                {subtitle && <p className="text-gray-500">{subtitle}</p>}
                {!hideBranchSelector && activeBranch && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                      {activeBranch.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {activeBranch.location}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!hideBranchSelector && <BranchSelector />}
                {actionButton}
                {!hideBranchSelector && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshBranch}
                    disabled={isBranchRefreshing}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${isBranchRefreshing ? 'animate-spin' : ''}`} />
                    {isBranchRefreshing ? 'Refreshing...' : 'Refresh Branch'}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Custom header content if provided */}
          {headerContent}

          {/* Main content */}
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </div>
      </DashboardLayout>
    </BranchInitializer>
  );
}
