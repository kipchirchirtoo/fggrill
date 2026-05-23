"use client";

import React from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranchContext } from '@/lib/branch-context';
import {
  CentralStoreNav,
  DirectorNav,
  GMNav,
  AdminNav,
  BranchStoreNav,
  ProcurementNav,
  AccountingNav,
  BranchOperationsNav,
} from './nav';

interface ConsolidatedNavProps {
  onItemClick?: () => void;
}

export function ConsolidatedNav({ onItemClick }: ConsolidatedNavProps) {
  const { user } = useAuth();
  const { activeBranch } = useBranchContext();

  if (!user) return null;

  // Role-based navigation rendering
  const renderNavigation = () => {
    switch (user.role) {
      case UserRole.SUPER_ADMIN:
        return (
          <>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-3 mb-2">Director View</p>
            <DirectorNav />
            <hr className="my-4 border-stone-100" />
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-3 mb-2">Admin Tools</p>
            <AdminNav />
          </>
        );

      case UserRole.DIRECTOR:
        return <DirectorNav />;

      case UserRole.AUDITOR:
        return <DirectorNav />;

      case UserRole.GENERAL_MANAGER:
        return (
          <>
            <GMNav />
            <hr className="my-4 border-stone-100" />
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-3 mb-2">Inventory & Logistics</p>
            <ProcurementNav />
          </>
        );

      case UserRole.CENTRAL_STOREKEEPER:
        return <CentralStoreNav />;

      case UserRole.BRANCH_STOREKEEPER:
        return <BranchStoreNav />;

      case UserRole.BRANCH_MANAGER:
        return <BranchOperationsNav />;

      case UserRole.ACCOUNTANT:
        return <AccountingNav />;

      case UserRole.PROCUREMENT:
        return <ProcurementNav />;

      default:
        // Fallback for unknown roles - show basic dashboard
        return (
          <div className="px-4 py-8 text-center text-stone-500">
            <p className="text-sm">Navigation not configured for this role.</p>
            <p className="text-xs mt-2 text-stone-400">Role: {user.role}</p>
          </div>
        );
    }
  };

  return (
    <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
      {renderNavigation()}

      {activeBranch && (
        <div className="mt-6 pt-4 border-t border-stone-200">
          <p className="px-3 text-xs font-semibold text-stone-500">Active Branch</p>
          <p className="px-3 text-sm text-stone-700 truncate">{activeBranch.name}</p>
        </div>
      )}
    </nav>
  );
}

export default ConsolidatedNav;
