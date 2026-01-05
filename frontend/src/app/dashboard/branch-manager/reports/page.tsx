'use client';

import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ReportsPageComponent } from '@/components/reports/ReportsPageComponent';

export default function BranchReportsPage() {
  const { user } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();

  // Use active branch from context, fallback to user's branch
  const currentBranchId = activeBranchId || user?.branch_id;

  return (
    <ProtectedRoute allowedRoles={[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <ReportsPageComponent
          userRole="branch_manager"
          branchId={currentBranchId}
          showBranchSelector={false}
          showScheduling={true}
          showKPI={true}
          title="Branch Reports"
          subtitle={`Reports for ${activeBranch?.name || 'your branch'}`}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
