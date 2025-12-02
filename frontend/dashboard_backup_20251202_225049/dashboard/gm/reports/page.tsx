'use client';

import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ReportsPageComponent } from '@/components/reports/ReportsPageComponent';

export default function GMReportsPage() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <ReportsPageComponent
          userRole="gm"
          showBranchSelector={true}
          showScheduling={true}
          showKPI={true}
          title="Reports & Analytics"
          subtitle="Generate branded reports, schedule automation, and view KPIs"
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
