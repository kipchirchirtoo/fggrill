import { KyogongPOSLayout } from '@/components/kyogong/KyogongPOSLayout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/user-roles';

export default function KyogongReceptionPage() {
    return (
        <ProtectedRoute allowedRoles={[UserRole.KYOGONG_RECEPTION_CASHIER, UserRole.SUPER_ADMIN]}>
            <KyogongPOSLayout
                title="Reception & Car Wash POS"
                subtitle="Kyogong – Kyogong Branch"
                serviceType="car_wash"
                salesPointCode="RECEPTION"
                allowedRole={UserRole.KYOGONG_RECEPTION_CASHIER}
                supportsPettyCash={true}
            />
        </ProtectedRoute>
    );
}
