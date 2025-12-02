'use client';

import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ReportsPageComponent } from '@/components/reports/ReportsPageComponent';

export default function ReportsPage() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]}>
      <DashboardLayout>
        <ReportsPageComponent
          userRole="storekeeper"
          showBranchSelector={true}
          showScheduling={true}
          showKPI={false}
          title="Storekeeping Reports"
          subtitle="Generate and download inventory reports"
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
