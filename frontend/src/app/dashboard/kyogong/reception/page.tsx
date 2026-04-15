'use client';

import { KyogongPOSLayout } from '@/components/kyogong/KyogongPOSLayout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/user-roles';

export default function KyogongReceptionPage() {
    return (
        <ProtectedRoute allowedRoles={[UserRole.KYOGONG_RECEPTION_CASHIER, UserRole.SUPER_ADMIN]}>
            <KyogongPOSLayout
                title="Reception & Car Wash POS"
                subtitle="Famous Gates Hotels"
                serviceType="car_wash"
                salesPointCode="RECEPTION"
                allowedRole={UserRole.KYOGONG_RECEPTION_CASHIER}
                supportsPettyCash={true}
            />
        </ProtectedRoute>
    );
}
