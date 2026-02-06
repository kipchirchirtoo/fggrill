'use client';

import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch, BranchSelector } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { BusinessMpesaContent } from '@/components/dashboard/branch/BusinessMpesaContent';

export default function AuditorBusinessMpesaPage() {
    const { user } = useAuth();
    const { activeBranchId, activeBranch } = useBranch();

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="max-w-6xl mx-auto space-y-6">
                    <div className="flex items-center justify-between bg-stone-50 p-4 rounded-xl border border-stone-200">
                        <div>
                            <h2 className="text-lg font-bold text-stone-900">Audit: Business & Mpesa</h2>
                            <p className="text-sm text-stone-500">Reviewing: {activeBranch?.name || 'All Branches'}</p>
                        </div>
                        <BranchSelector />
                    </div>

                    <BusinessMpesaContent
                        branchId={activeBranchId}
                        isAuditor={true}
                    />
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
