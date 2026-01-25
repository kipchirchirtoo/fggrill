'use client';

import React from 'react';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole, useAuth } from '@/lib/auth-context';
import { SoldItemsAnalytics } from '@/components/analytics/sold-items-analytics';

export default function BranchAccountantSoldItemsPage() {
    const { branch } = useAuth();

    return (
        <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN]}>
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
