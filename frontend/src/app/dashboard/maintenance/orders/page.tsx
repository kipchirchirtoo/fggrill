'use client';

import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Wrench } from 'lucide-react';

export default function MaintenanceOrdersPage() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.MAINTENANCE]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Work Orders</h1>
            <p className="text-gray-600 mt-1">Manage maintenance requests and work orders</p>
          </div>
          <div className="bg-white rounded-lg p-6 border border-gray-100">
            <div className="flex items-center justify-center h-64 text-gray-400">
              <div className="text-center">
                <Wrench className="h-12 w-12 mx-auto mb-4" />
                <p>Work order management</p>
                <p className="text-sm mt-2">View, update, and complete maintenance tasks</p>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
