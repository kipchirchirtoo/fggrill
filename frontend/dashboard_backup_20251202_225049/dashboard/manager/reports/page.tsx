'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ReportsPageComponent } from '@/components/reports/ReportsPageComponent';
import { systemAPI } from '@/lib/api';

export default function ManagerReportsPage() {
  const { user } = useAuth();
  const [branchName, setBranchName] = useState<string>('');

  useEffect(() => {
    // Fetch branch name for display if user has a branch
    const fetchBranchName = async () => {
      if (user?.branch_id) {
        try {
          const res = await systemAPI.getBranches();
          const branches = res.data || res.branches || [];
          const branch = branches.find((b: any) => b.id === user.branch_id);
          if (branch) {
            setBranchName(branch.name);
          }
        } catch (error) {
          console.error('Error fetching branch:', error);
        }
      }
    };
    fetchBranchName();
  }, [user?.branch_id]);

  // Determine if this is a branch manager (locked to branch) or general manager (sees all)
  const isBranchManager = user?.role === 'branch_manager' && user?.branch_id;

  return (
    <ProtectedRoute allowedRoles={[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <ReportsPageComponent
          userRole={isBranchManager ? 'branch_manager' : 'gm'}
          branchId={isBranchManager ? user?.branch_id : undefined}
          branchName={branchName}
          showBranchSelector={!isBranchManager}
          showScheduling={true}
          showKPI={true}
          title="Reports & Analytics"
          subtitle="View operational reports and performance metrics"
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
