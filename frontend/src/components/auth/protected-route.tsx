'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
  const pathname = usePathname();

  useEffect(() => {
    // VERSION 2026-02-19-22-40 (V4)
    console.log('--- [ProtectedRoute V4 DEBUG START] ---');
    console.log('[ProtectedRoute V4] Pathname:', pathname);
    console.log('[ProtectedRoute V4] isLoading:', isLoading);
    console.log('[ProtectedRoute V4] User:', user ? `${user.firstName} (${user.role})` : 'NONE');
    console.log('[ProtectedRoute V4] Allowed Roles (raw):', allowedRoles);

    if (!isLoading) {
      if (requireAuth && !user) {
        console.warn('[ProtectedRoute V4] NO USER - REDIRECTING TO /terminal');
        router.push('/terminal');
        return;
      }

      if (allowedRoles.length > 0 && user) {
        const isAllowed = hasRole(user, allowedRoles);
        console.log('[ProtectedRoute V4] hasRole Check Result:', isAllowed);

        if (!isAllowed) {
          console.error('!!! [ProtectedRoute V4] ACCESS DENIED !!!');
          console.error('[ProtectedRoute V4] User Role:', `"${user.role}"`);
          console.error('[ProtectedRoute V4] NOT IN:', allowedRoles);
          router.push('/unauthorized');
          return;
        }
      }
      console.log('[ProtectedRoute V4] ACCESS GRANTED');
    }
    console.log('--- [ProtectedRoute V4 DEBUG END] ---');
  }, [user, isLoading, requireAuth, allowedRoles, router, pathname]);

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

  if (requireAuth && !user) return null;
  if (allowedRoles.length > 0 && user && !hasRole(user, allowedRoles)) return null;

  return <>{children}</>;
}
