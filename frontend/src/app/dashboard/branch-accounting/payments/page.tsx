'use client';

import { useState } from 'react';
import { useBranch } from '@/lib/branch-context';
import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/minimal/button';
import { IOSCard } from '@/components/ui/ios-card';
import {
    CreditCard, Search, ArrowDownLeft,
    ArrowUpRight, Download, Filter
} from 'lucide-react';

export default function PaymentsPage() {
    const { activeBranch } = useBranch();

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Payments</h1>
                            <p className="text-stone-500 text-sm mt-0.5">Verify and track incoming/outgoing payments for <span className="font-semibold">{activeBranch?.name}</span></p>
                        </div>
                        <Button variant="outline" className="bg-white">
                            <Download className="h-4 w-4 mr-2" />
                            Export Statement
                        </Button>
                    </div>

                    {/* Filters */}
                    <div className="flex gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                            <input
                                type="text"
                                placeholder="Search transactions..."
                                className="w-full h-10 pl-9 pr-4 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                            />
                        </div>
                        <Button variant="outline" className="shrink-0 bg-white">
                            <Filter className="h-4 w-4 mr-2" />
                            Filter
                        </Button>
                    </div>

                    {/* Transactions List */}
                    <IOSCard className="overflow-hidden border-stone-200 shadow-sm">
                        <div className="text-center py-16">
                            <CreditCard className="h-12 w-12 text-stone-300 mx-auto mb-3" />
                            <h3 className="text-stone-900 font-semibold">No transactions found</h3>
                            <p className="text-stone-500 text-sm mt-1">Payment history will appear here.</p>
                        </div>
                    </IOSCard>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
