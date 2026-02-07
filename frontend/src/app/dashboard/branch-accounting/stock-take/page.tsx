'use client';

import StockCountForm from '@/components/accounting/StockCountForm';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole, useAuth } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function StockTakePage() {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const currentBranchId = activeBranchId || user?.branch_id;

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <DashboardLayout>
                <div className="p-6 max-w-7xl mx-auto space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Link href="/dashboard/branch-accounting" className="text-stone-400 hover:text-stone-900 transition-colors">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <span className="text-[12px] font-bold text-stone-400 uppercase tracking-widest">Branch Accounting / Inventory</span>
                    </div>
                    <StockCountForm branchId={currentBranchId || 'current'} isAuditor={false} />
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
