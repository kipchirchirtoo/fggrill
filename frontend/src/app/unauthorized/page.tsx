'use client';

import { useRouter } from 'next/navigation';
import { ShieldX, ArrowLeft, Home } from 'lucide-react';
import { useAuth, UserRole } from '@/lib/auth-context';

export default function UnauthorizedPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const handleDashboardRedirect = () => {
    if (!user) {
      router.push('/dashboard');
      return;
    }
    
    const roleRedirects: Record<UserRole, string> = {
      [UserRole.SUPER_ADMIN]: '/dashboard/admin',
      [UserRole.GENERAL_MANAGER]: '/dashboard/gm',
      [UserRole.BRANCH_MANAGER]: '/dashboard/branch-manager',
      [UserRole.CENTRAL_STOREKEEPER]: '/dashboard/central-store',
      [UserRole.BRANCH_STOREKEEPER]: '/dashboard/branch-store',
      [UserRole.HOUSEKEEPING]: '/dashboard/housekeeping',
      [UserRole.HOUSEKEEPING_SUPERVISOR]: '/dashboard/housekeeping',
      [UserRole.MAINTENANCE]: '/dashboard/maintenance',
      [UserRole.BRANCH_OPERATIONS_MANAGER]: '/dashboard/branch-operations',
      [UserRole.CENTRAL_OPERATIONS_MANAGER]: '/dashboard/central-store',
      [UserRole.FACILITIES_MANAGER]: '/dashboard/facilities',
      [UserRole.RECEPTIONIST]: '/dashboard/reception',
      [UserRole.RESTAURANT]: '/dashboard/pos-kitchen',
      [UserRole.POS_KITCHEN]: '/dashboard/pos-kitchen',
      [UserRole.KITCHEN]: '/dashboard/kitchen',
      [UserRole.KITCHEN_OPERATIONS]: '/dashboard/kitchen-operations',
      [UserRole.BARTENDER]: '/dashboard/pos-kitchen?tab=bar',
      [UserRole.BARMAN]: '/dashboard/pos-kitchen?tab=bar',
      [UserRole.BARMAID]: '/dashboard/pos-kitchen?tab=bar',
      [UserRole.BAR_MANAGER]: '/dashboard/pos-kitchen?tab=bar',
      [UserRole.WAITER]: '/dashboard/pos-kitchen?tab=restaurant',
      [UserRole.WAITRESS]: '/dashboard/pos-kitchen?tab=restaurant',
      [UserRole.HEAD_WAITER]: '/dashboard/pos-kitchen?tab=restaurant',
      [UserRole.CHEF]: '/dashboard/kitchen',
      [UserRole.HEAD_CHEF]: '/dashboard/kitchen',
      [UserRole.COOK]: '/dashboard/kitchen',
      [UserRole.ACCOUNTANT]: '/dashboard/branch-accounting',
      [UserRole.BRANCH_ACCOUNTANT]: '/dashboard/branch-accounting',
      [UserRole.AUDITOR]: '/dashboard/auditor',
      [UserRole.PROCUREMENT]: '/dashboard/procurement',
      [UserRole.STOREKEEPER]: '/dashboard/storekeeping',
      [UserRole.PURCHASING_MANAGER]: '/dashboard/procurement',
      [UserRole.CASHIER]: '/dashboard/cashier',
      [UserRole.HR_MANAGER]: '/dashboard/hr',
      [UserRole.EMPLOYEE]: '/dashboard/employee',
      [UserRole.DRIVER]: '/dashboard/employee',
      [UserRole.GUEST]: '/dashboard/guest',
      [UserRole.KYOGONG_SPA_CASHIER]: '/dashboard/kyogong/spa',
      [UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER]: '/dashboard/kyogong/executive-bar',
      [UserRole.KYOGONG_SPORTS_BAR_CASHIER]: '/dashboard/kyogong/sports-bar',
      [UserRole.KYOGONG_RECEPTION_CASHIER]: '/dashboard/kyogong/reception',
    };

    const path = roleRedirects[user.role as UserRole] || '/dashboard';
    router.push(path);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-red-100 p-6">
            <ShieldX className="h-16 w-16 text-red-600" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Access Denied
        </h1>

        {/* Message */}
        <p className="text-gray-600 mb-8">
          You don't have permission to access this page. Please contact your administrator if you believe this is an error.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => router.push('/terminal')}
            className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </button>

          <button
            onClick={handleDashboardRedirect}
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            <Home className="h-4 w-4 mr-2" />
            Go to Dashboard
          </button>
        </div>

        {/* Additional Help */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Need help? Contact your system administrator
          </p>
        </div>
      </div>
    </div>
  );
}
