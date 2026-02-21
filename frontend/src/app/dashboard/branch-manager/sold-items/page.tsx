'use client';

import React from 'react';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole, useAuth } from '@/lib/auth-context';
import { SoldItemsAnalytics } from '@/components/analytics/sold-items-analytics';

export default function BranchManagerSoldItemsPage() {
    const { branch } = useAuth();

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <BranchAwareDashboardLayout
                title="Sold Items Analytics"
                subtitle={`Performance analysis for ${branch?.name || 'Current Branch'}`}
            >
                <SoldItemsAnalytics
                    branchId={branch?.id}
                />
            </BranchAwareDashboardLayout>
        </ProtectedRoute>
    );
}
