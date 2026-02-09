'use client';

import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ShiftReviewPanel } from '@/components/cashier/shift-review-panel';

export default function AuditorShiftVerificationPage() {
    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <ShiftReviewPanel role="auditor" />
            </DashboardLayout>
        </ProtectedRoute>
    );
}
