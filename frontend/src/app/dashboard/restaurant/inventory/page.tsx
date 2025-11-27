'use client';

import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Package } from 'lucide-react';

export default function RestaurantInventoryPage() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.RESTAURANT]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Kitchen Inventory</h1>
            <p className="text-gray-600 mt-1">Manage food supplies and ingredients</p>
          </div>
          <div className="bg-white rounded-lg p-6 border border-gray-100">
            <div className="flex items-center justify-center h-64 text-gray-400">
              <div className="text-center">
                <Package className="h-12 w-12 mx-auto mb-4" />
                <p>Inventory tracking</p>
                <p className="text-sm mt-2">Track ingredients, manage stock, and order supplies</p>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
