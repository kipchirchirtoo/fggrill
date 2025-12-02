'use client';

import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ReportsPageComponent } from '@/components/reports/ReportsPageComponent';

export default function FinanceReportsPage() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <ReportsPageComponent
          userRole="finance"
          showBranchSelector={true}
          showScheduling={true}
          showKPI={true}
          title="Financial Reports"
          subtitle="Generate branded financial reports and analytics"
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
