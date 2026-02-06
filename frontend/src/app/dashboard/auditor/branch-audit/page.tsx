'use client';

import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch, BranchSelector } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { BranchAccountingOverview } from '@/components/dashboard/branch/BranchAccountingOverview';

export default function AuditorBranchAuditPage() {
    const { user } = useAuth();
    const { activeBranchId, activeBranch } = useBranch();

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="max-w-6xl mx-auto space-y-8">
                    <div className="flex items-center justify-between bg-stone-50 p-4 rounded-xl border border-stone-200">
                        <div>
                            <h2 className="text-lg font-bold text-stone-900">Branch Audit Console</h2>
                            <p className="text-sm text-stone-500">Select a branch to audit its operations</p>
                        </div>
                        <BranchSelector />
                    </div>

                    <BranchAccountingOverview
                        branchId={activeBranchId}
                        branchName={activeBranch?.name}
                        basePath="/dashboard/auditor/branch-audit"
                        isAuditor={true}
                    />
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
