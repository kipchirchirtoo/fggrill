'use client';

import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { BranchAccountingOverview } from '@/components/dashboard/branch/BranchAccountingOverview';

export default function BranchAccountingDashboard() {
    const { user } = useAuth();
    const { activeBranchId, activeBranch } = useBranch();

    // Use active branch from context, fallback to user's branch
    const currentBranchId = activeBranchId || user?.branch_id;

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="max-w-6xl mx-auto space-y-8">
                    <BranchAccountingOverview
                        branchId={currentBranchId || null}
                        branchName={activeBranch?.name}
                        basePath="/dashboard/branch-accounting"
                    />
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
