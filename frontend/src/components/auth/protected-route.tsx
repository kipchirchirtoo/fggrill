'use client';

import { useEffect, useMemo, useState } from 'react';
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Stabilize the roles array — a literal array like [UserRole.X, UserRole.Y]
  // is a new object every render, so we derive a stable string key instead.
  const rolesKey = useMemo(() => allowedRoles.join(','), [allowedRoles]);

  useEffect(() => {
    if (mounted && !isLoading) {
      if (requireAuth && !user) {
        router.push('/terminal');
        return;
      }

      if (rolesKey && user) {
        const roles = rolesKey.split(',') as UserRole[];
        if (!hasRole(user, roles)) {
          router.push('/unauthorized');
          return;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, user, isLoading, requireAuth, rolesKey, router, pathname]);

  if (!mounted || isLoading) {
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
  if (rolesKey && user && !hasRole(user, rolesKey.split(',') as UserRole[])) return null;

  return <>{children}</>;
}
