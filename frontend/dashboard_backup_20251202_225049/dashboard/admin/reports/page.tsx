'use client';

import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ReportsPageComponent } from '@/components/reports/ReportsPageComponent';

export default function AdminReportsPage() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <ReportsPageComponent
          userRole="admin"
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
