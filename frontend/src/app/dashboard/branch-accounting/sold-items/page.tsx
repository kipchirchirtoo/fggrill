'use client';

import React from 'react';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { SoldItemsAnalytics } from '@/components/analytics/sold-items-analytics';
import { useBranch } from '@/lib/branch-context';

export default function BranchAccountantSoldItemsPage() {
    const { activeBranch } = useBranch();

    return (
        <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <BranchAwareDashboardLayout
                title="Sold Items Analytics"
                subtitle={`Performance analysis for ${activeBranch?.name || 'Current Branch'}`}
            >
                <SoldItemsAnalytics
                    branchId={activeBranch?.id}
                />
            </BranchAwareDashboardLayout>
        </ProtectedRoute>
    );
}
