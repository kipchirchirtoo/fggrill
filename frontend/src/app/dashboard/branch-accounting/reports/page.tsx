'use client';

import FinancialReports from '@/components/accounting/FinancialReports';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ReportsPage() {
    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <div className="p-6 max-w-7xl mx-auto space-y-6">
                <div className="flex items-center gap-2 mb-2">
                    <Link href="/dashboard/branch-accounting" className="text-stone-400 hover:text-stone-900 transition-colors">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <span className="text-[12px] font-bold text-stone-400 uppercase tracking-widest">Branch Accounting / Financial Reports</span>
                </div>
                <FinancialReports />
            </div>
        </ProtectedRoute>
    );
}
