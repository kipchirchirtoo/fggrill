'use client';

import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch, BranchSelector } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';

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

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <IOSCard className="p-6 cursor-pointer hover:shadow-lg transition-all" onClick={() => window.location.href = '/dashboard/auditor/stock'}>
                            <h3 className="text-lg font-bold mb-2">Stock Audit</h3>
                            <p className="text-sm text-stone-500">Verify branch stock takes and variances.</p>
                        </IOSCard>
                        <IOSCard className="p-6 cursor-pointer hover:shadow-lg transition-all" onClick={() => window.location.href = '/dashboard/auditor/financial-verification'}>
                            <h3 className="text-lg font-bold mb-2">Financial Verification</h3>
                            <p className="text-sm text-stone-500">Audit payments and transactions.</p>
                        </IOSCard>
                        <IOSCard className="p-6 cursor-pointer hover:shadow-lg transition-all" onClick={() => window.location.href = '/dashboard/auditor/staff-audit'}>
                            <h3 className="text-lg font-bold mb-2">Staff & Credit Audit</h3>
                            <p className="text-sm text-stone-500">Audit staff credits, loans, and advances.</p>
                        </IOSCard>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
