'use client';

import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ReportsPageComponent } from '@/components/reports/ReportsPageComponent';

export default function BranchReportsPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <ReportsPageComponent
          userRole="branch_store"
          branchId={user?.branch_id}
          showBranchSelector={false}
          showScheduling={true}
          showKPI={false}
          title="Branch Store Reports"
          subtitle="Generate branded stock and inventory reports with PDF/Excel export"
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
