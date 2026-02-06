'use client';

import StockCountForm from '@/components/accounting/StockCountForm';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole, useAuth } from '@/lib/auth-context';
import { useBranch, BranchSelector } from '@/lib/branch-context';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function AuditorStockTakePage() {
    const { user } = useAuth();
    const { activeBranchId, activeBranch } = useBranch();

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <DashboardLayout>
                <div className="p-6 max-w-7xl mx-auto space-y-8">
                    <div className="flex items-center justify-between bg-stone-50 p-4 rounded-xl border border-stone-200">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Link href="/dashboard/auditor/branch-audit" className="text-stone-400 hover:text-stone-900 transition-colors">
                                    <ArrowLeft className="h-4 w-4" />
                                </Link>
                                <h2 className="text-lg font-bold text-stone-900">Audit: Stock Take</h2>
                            </div>
                            <p className="text-sm text-stone-500 pl-6">Reviewing: {activeBranch?.name || 'All Branches'}</p>
                        </div>
                        <BranchSelector />
                    </div>

                    <StockCountForm branchId={activeBranchId || 'current'} isAuditor={true} />
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
