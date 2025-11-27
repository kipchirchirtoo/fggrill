'use client';

import { useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { stockMonitor } from '@/services/StockMonitor';
import { ProtectedRoute } from '@/components/auth/protected-route';

interface StorekeepingLayoutProps {
  children: React.ReactNode;
}

export function StorekeepingLayout({ children }: StorekeepingLayoutProps) {
  const { user } = useAuth();

  useEffect(() => {
    // Only start monitoring if the user has appropriate role
    if (user && [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.STOREKEEPER].includes(user.role)) {
      stockMonitor.start();
    }

    return () => {
      stockMonitor.stop();
    };
  }, [user]);

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.STOREKEEPER]}>
      {children}
    </ProtectedRoute>
  );
}
