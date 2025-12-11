'use client';

import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { ReportsPageComponent } from '@/components/reports/ReportsPageComponent';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';

function CentralOperationsReportsContent() {
  return (
    <ProtectedRoute allowedRoles={[
      UserRole.SUPER_ADMIN, 
      UserRole.GENERAL_MANAGER, 
      UserRole.CENTRAL_OPERATIONS_MANAGER,
      UserRole.CENTRAL_STOREKEEPER
    ]}>
      <BranchAwareDashboardLayout requireBranchContext={false}>
        <ReportsPageComponent
          userRole="admin"
          showBranchSelector={true}
          showScheduling={true}
          showKPI={true}
          title="Central Operations Reports"
          subtitle="Generate branded reports across all branches, schedule automation, and view consolidated KPIs"
        />
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

export default function CentralOperationsReportsPage() {
  return (
    <BranchPageWrapper>
      <CentralOperationsReportsContent />
    </BranchPageWrapper>
  );
}
