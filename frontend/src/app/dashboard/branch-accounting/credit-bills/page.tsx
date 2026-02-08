'use client';

import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CreditBillsContent } from '@/components/dashboard/branch/CreditBillsContent';

export default function BranchCreditBillsPage() {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <CreditBillsContent branchId={activeBranchId} />
            </DashboardLayout>
        </ProtectedRoute>
    );
}
