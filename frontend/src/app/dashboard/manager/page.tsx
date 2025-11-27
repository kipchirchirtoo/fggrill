'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';

// Legacy manager page - redirects to appropriate dashboard
export default function ManagerDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === UserRole.GENERAL_MANAGER) {
        router.replace('/dashboard/gm');
      } else if (user.role === UserRole.BRANCH_MANAGER) {
        router.replace('/dashboard/branch-manager');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
}
