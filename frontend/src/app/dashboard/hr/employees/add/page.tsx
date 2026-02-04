'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'use';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

/**
 * Add Employee Page - Redirects to main employees page with add modal open
 * This route exists for direct navigation but the actual form is in the employees page
 */
export default function AddEmployeePage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to employees page with add parameter
        router.replace('/dashboard/hr/employees?action=add');
    }, [router]);

    return (
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.HR_MANAGER]}>
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Redirecting to employee management...</p>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
