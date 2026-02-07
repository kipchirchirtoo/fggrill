'use client';

import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { DailyAccountantLog } from '@/components/dashboard/branch/DailyAccountantLog';

export default function PaymentsPage() {
    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="max-w-7xl mx-auto">
                    <DailyAccountantLog initialMode="payments" />
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
