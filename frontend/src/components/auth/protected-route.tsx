'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole, hasRole } from '@/lib/auth-context';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireAuth?: boolean;
}

export function ProtectedRoute({
  children,
  allowedRoles = [],
  requireAuth = true
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      // If auth is required and user is not logged in
      if (requireAuth && !user) {
        router.push('/login');
        return;
      }

      // If specific roles are required and user doesn't have them
      if (allowedRoles.length > 0 && user && !hasRole(user, allowedRoles)) {
        router.push('/unauthorized');
        return;
      }
    }
  }, [user, isLoading, requireAuth, allowedRoles, router]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If auth is required and user is not logged in
  if (requireAuth && !user) {
    return null;
  }

  // If specific roles are required and user doesn't have them
  if (allowedRoles.length > 0 && user && !hasRole(user, allowedRoles)) {
    return null;
  }

  return <>{children}</>;
}
