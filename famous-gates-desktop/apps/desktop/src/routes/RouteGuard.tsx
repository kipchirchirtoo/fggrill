'use client';

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppState } from '../state/AppStateProvider';

interface RouteGuardProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

export function RouteGuard({ children, requiredRoles }: RouteGuardProps) {
  const { session, isLoading } = useAppState();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading Famous Gates...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRoles && requiredRoles.length > 0) {
    if (!requiredRoles.includes(session.role)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}
