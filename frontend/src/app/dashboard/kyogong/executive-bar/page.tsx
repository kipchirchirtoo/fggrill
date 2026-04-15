'use client';

import { KyogongPOSLayout } from '@/components/kyogong/KyogongPOSLayout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/user-roles';

export default function KyogongExecutiveBarPage() {
    return (
        <ProtectedRoute allowedRoles={[UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER, UserRole.SUPER_ADMIN]}>
            <KyogongPOSLayout
                title="Executive Bar POS"
                subtitle="Famous Gates Hotels"
                serviceType="bar"
                salesPointCode="EXEC_BAR"
                allowedRole={UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER}
                supportsPettyCash={false}
            />
        </ProtectedRoute>
    );
}
