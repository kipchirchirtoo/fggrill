'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        // Redirect to appropriate dashboard based on role
        router.push(`/dashboard/${getRolePath(user.role)}`);
      } else {
        // Redirect to login if not authenticated
        router.push('/login');
      }
    }
  }, [user, isLoading, router]);

  const getRolePath = (role: string) => {
    const paths: Record<string, string> = {
      'super_admin': 'admin',
      'manager': 'manager',
      'receptionist': 'reception',
      'housekeeping': 'housekeeping',
      'restaurant': 'restaurant',
      'accountant': 'finance',
      'maintenance': 'maintenance',
      'guest': 'guest'
    };
    return paths[role] || 'guest';
  };

  // Show loading state while checking auth
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
