'use client';

import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ReportsPageComponent } from '@/components/reports/ReportsPageComponent';

export default function CentralReportsPage() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <ReportsPageComponent
          userRole="central_store"
          showBranchSelector={true}
          showScheduling={false}
          showHistory={false}
          showKPI={false}
          title="Central Store Reports"
          subtitle="Generate branded inventory and stock reports with PDF/Excel export"
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
