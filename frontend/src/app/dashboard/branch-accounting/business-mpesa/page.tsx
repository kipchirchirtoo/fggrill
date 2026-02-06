'use client';

import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { BusinessMpesaContent } from '@/components/dashboard/branch/BusinessMpesaContent';

export default function BusinessMpesaPage() {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();

    // Use active branch from context, fallback to user's branch
    const currentBranchId = activeBranchId || user?.branch_id;

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="max-w-6xl mx-auto space-y-6">
                    <BusinessMpesaContent
                        branchId={currentBranchId || null}
                        isAuditor={false}
                    />
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
