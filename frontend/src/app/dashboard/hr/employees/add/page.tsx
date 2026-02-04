'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RefreshCw } from 'lucide-react';

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
                <div className="flex items-center justify-center min-h-[60vh] font-sf-pro-display">
                    <div className="text-center space-y-4">
                        <RefreshCw className="h-8 w-8 text-stone-900 animate-spin mx-auto" />
                        <p className="text-stone-500 font-medium text-sm tracking-tight italic">Redirecting to personnel modules...</p>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
