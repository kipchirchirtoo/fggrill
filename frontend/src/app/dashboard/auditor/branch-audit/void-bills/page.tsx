'use client';

import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch, BranchSelector } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { VoidBillsContent } from '@/components/dashboard/auditor/reconciliation/VoidBillsContent';
import { AlertCircle } from 'lucide-react';

export default function AuditorVoidBillsPage() {
    const { user } = useAuth();
    const { activeBranchId, activeBranch } = useBranch();

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="max-w-6xl mx-auto space-y-6">
                    <div className="flex items-center justify-between bg-stone-50 p-4 rounded-xl border border-stone-200">
                        <div>
                            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-amber-500" />
                                Audit: Migrated Void Bills
                            </h2>
                            <p className="text-sm text-stone-500">
                                Reviewing migrated orders that were voided: {activeBranch?.name || 'All Branches'}
                            </p>
                        </div>
                        <BranchSelector />
                    </div>

                    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
                        <VoidBillsContent
                            branchId={activeBranchId}
                        />
                    </div>

                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                        <h4 className="text-blue-800 font-medium text-sm mb-1">Audit Policy Reminder</h4>
                        <p className="text-blue-700 text-xs">
                            Voided bills that were migrated after the 8-hour grace period must be reviewed.
                            If a bill was voided legitimately (e.g., error in order), mark as 'Reviewed'.
                            If it appears suspicious, mark as 'Disputed' for further investigation with the branch manager.
                        </p>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
