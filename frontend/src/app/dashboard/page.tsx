'use client';

import { useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
    const { user, isLoading } = useAuth();

    const router = (require('next/navigation')).useRouter();

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                router.push('/login');
                return;
            }

            // Simple role-based redirection map
            const role = user.role as string;
            if (role === UserRole.SUPER_ADMIN) {
                router.push('/dashboard/admin');
            } else if (role === UserRole.BRANCH_MANAGER || role === UserRole.GENERAL_MANAGER) {
                router.push('/dashboard/branch-manager');
            } else if (role === UserRole.RECEPTIONIST) {
                router.push('/dashboard/reception');
            } else if (role === UserRole.POS_KITCHEN || role === UserRole.RESTAURANT) {
                router.push('/dashboard/pos-kitchen');
            } else if (role === UserRole.CASHIER) {
                router.push('/dashboard/cashier');
            } else if (role === UserRole.HR_MANAGER) {
                router.push('/dashboard/hr');
            } else if (role === UserRole.HOUSEKEEPING || role === UserRole.HOUSEKEEPING_SUPERVISOR) {
                router.push('/dashboard/housekeeping');
            } else {
                // Fallback to profile or home
                router.push('/dashboard/admin'); // Defaulting to admin for safety if role matches but path unknown
            }
        }
    }, [user, isLoading, router]);

    return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
            <div className="flex flex-col items-center space-y-4">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900">Redirecting to your portal...</h2>
                    <p className="text-sm text-gray-500 mt-1">Famous Gates Hotels Management Architecture</p>
                </div>
            </div>
        </div>
    );
}
