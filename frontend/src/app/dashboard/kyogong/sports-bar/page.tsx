import { KyogongPOSLayout } from '@/components/kyogong/KyogongPOSLayout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/user-roles';

export default function KyogongSportsBarPage() {
    return (
        <ProtectedRoute allowedRoles={[UserRole.KYOGONG_SPORTS_BAR_CASHIER, UserRole.SUPER_ADMIN]}>
            <KyogongPOSLayout
                title="Sports Bar POS"
                subtitle="Kyogong – Kyogong Branch"
                serviceType="bar"
                salesPointCode="SPORTS_BAR"
                allowedRole={UserRole.KYOGONG_SPORTS_BAR_CASHIER}
                supportsPettyCash={false}
            />
        </ProtectedRoute>
    );
}
