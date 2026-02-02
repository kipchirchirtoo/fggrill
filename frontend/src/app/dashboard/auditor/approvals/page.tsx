'use client';

import AuditorApprovalPanel from '@/components/accounting/AuditorApprovalPanel';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function ApprovalsPage() {
    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="p-6 max-w-7xl mx-auto space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Link href="/dashboard/auditor" className="text-stone-400 hover:text-stone-900 transition-colors">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <span className="text-[12px] font-bold text-stone-400 uppercase tracking-widest">Auditor / Pending Approvals</span>
                    </div>
                    <AuditorApprovalPanel />
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
