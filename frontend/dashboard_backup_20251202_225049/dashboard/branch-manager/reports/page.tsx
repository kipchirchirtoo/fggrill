'use client';

import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ReportsPageComponent } from '@/components/reports/ReportsPageComponent';

export default function BranchReportsPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <ReportsPageComponent
          userRole="branch_manager"
          branchId={user?.branch_id}
          showBranchSelector={false}
          showScheduling={true}
          showKPI={true}
          title="Branch Reports"
          subtitle="Generate and download branch performance reports"
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
