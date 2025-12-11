'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { KitchenInventory } from '@/components/kitchen/KitchenInventory';
import { UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';

export default function RestaurantInventoryPage() {
  const { activeBranchId } = useBranch();
  
  return (
    <ProtectedRoute allowedRoles={[UserRole.RESTAURANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <KitchenInventory branchId={activeBranchId || undefined} />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
