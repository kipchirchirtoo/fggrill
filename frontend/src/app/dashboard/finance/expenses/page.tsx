'use client';

import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ClipboardList } from 'lucide-react';

export default function FinanceExpensesPage() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Expense Management</h1>
            <p className="text-gray-600 mt-1">Track and manage business expenses</p>
          </div>
          <div className="bg-white rounded-lg p-6 border border-gray-100">
            <div className="flex items-center justify-center h-64 text-gray-400">
              <div className="text-center">
                <ClipboardList className="h-12 w-12 mx-auto mb-4" />
                <p>Expense tracking</p>
                <p className="text-sm mt-2">Record expenses, manage budgets, and track spending</p>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
