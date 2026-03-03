import { KyogongPOSLayout } from '@/components/kyogong/KyogongPOSLayout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/user-roles';

export default function KyogongSpaPage() {
    return (
        <ProtectedRoute allowedRoles={[UserRole.KYOGONG_SPA_CASHIER, UserRole.SUPER_ADMIN]}>
            <KyogongPOSLayout
                title="Spa & Wellness POS"
                subtitle="Kyogong – Kyogong Branch"
                serviceType="spa"
                salesPointCode="SPA"
                allowedRole={UserRole.KYOGONG_SPA_CASHIER}
                supportsPettyCash={false}
            />
        </ProtectedRoute>
    );
}
