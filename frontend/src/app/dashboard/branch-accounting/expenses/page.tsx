'use client';

import { useState } from 'react';
import { useBranch } from '@/lib/branch-context';
import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/minimal/button';
import { IOSCard } from '@/components/ui/ios-card';
import {
    Receipt, Plus, Search, Calendar,
    TrendingDown, PieChart, Wallet
} from 'lucide-react';

export default function ExpensesPage() {
    const { activeBranch } = useBranch();

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Expenses</h1>
                            <p className="text-stone-500 text-sm mt-0.5">Track petty cash and operational expenses for <span className="font-semibold">{activeBranch?.name}</span></p>
                        </div>
                        <Button className="btn-primary">
                            <Plus className="h-4 w-4 mr-2" />
                            Record Expense
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Chart Placeholder */}
                        <IOSCard className="p-6 h-64 flex flex-col items-center justify-center text-center bg-white border-stone-200">
                            <PieChart className="h-10 w-10 text-stone-300 mb-3" />
                            <p className="text-sm font-medium text-stone-500">Expense breakdown chart will appear here</p>
                        </IOSCard>

                        {/* Petty Cash Summary */}
                        <IOSCard className="p-6 bg-stone-900 text-white">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-stone-400 text-xs font-bold uppercase tracking-wider">Petty Cash Balance</p>
                                    <h2 className="text-3xl font-bold mt-2">KES 0.00</h2>
                                </div>
                                <div className="h-10 w-10 rounded-full bg-stone-800 flex items-center justify-center">
                                    <Wallet className="h-5 w-5 text-stone-300" />
                                </div>
                            </div>
                            <div className="mt-8 pt-6 border-t border-stone-800 flex flex-col gap-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-stone-400">Replenished this month</span>
                                    <span className="font-medium">KES 0.00</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-stone-400">Total Spent</span>
                                    <span className="font-medium text-red-300">- KES 0.00</span>
                                </div>
                            </div>
                        </IOSCard>
                    </div>

                    {/* List */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-stone-900">Recent Expenses</h3>
                        <IOSCard className="overflow-hidden border-stone-200 shadow-sm">
                            <div className="text-center py-12">
                                <Receipt className="h-12 w-12 text-stone-300 mx-auto mb-3" />
                                <p className="text-stone-500 text-sm">No expenses recorded recently.</p>
                            </div>
                        </IOSCard>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
