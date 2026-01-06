'use client';

import { useBranch } from '@/lib/branch-context';
import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/minimal/button';
import { IOSCard } from '@/components/ui/ios-card';
import {
    BarChart3, FileSpreadsheet, Download, Calendar,
    TrendingUp, DollarSign, Store
} from 'lucide-react';

export default function ReportsPage() {
    const { activeBranch } = useBranch();

    const reports = [
        { name: 'Daily Sales Report', desc: 'Summary of daily revenue across all points of sale', icon: TrendingUp },
        { name: 'Expense Summary', desc: 'Detailed breakdown of branch expenses by category', icon: DollarSign },
        { name: 'Stock Valuation', desc: 'Current value of inventory assets', icon: Store },
        { name: 'Profit & Loss', desc: 'Monthly P&L statement', icon: BarChart3 },
    ];

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Financial Reports</h1>
                            <p className="text-stone-500 text-sm mt-0.5">Generate and export reports for <span className="font-semibold">{activeBranch?.name}</span></p>
                        </div>
                    </div>

                    {/* Report Types */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {reports.map((report, i) => (
                            <IOSCard key={i} className="p-5 flex items-start gap-4 hover:shadow-md transition-shadow cursor-pointer border-stone-200">
                                <div className="h-12 w-12 rounded-xl bg-stone-100 flex items-center justify-center shrink-0">
                                    <report.icon className="h-6 w-6 text-stone-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-stone-900">{report.name}</h3>
                                    <p className="text-sm text-stone-500 mt-1">{report.desc}</p>
                                    <Button variant="ghost" size="sm" className="mt-3 p-0 h-auto text-blue-600 hover:text-blue-700 hover:bg-transparent font-medium">
                                        Generate Report →
                                    </Button>
                                </div>
                            </IOSCard>
                        ))}
                    </div>

                    {/* Recent Reports Table Placeholder */}
                    <div className="mt-8">
                        <h3 className="text-lg font-semibold text-stone-900 mb-4">Generated Reports History</h3>
                        <IOSCard className="overflow-hidden border-stone-200 shadow-sm">
                            <div className="text-center py-12">
                                <FileSpreadsheet className="h-10 w-10 text-stone-300 mx-auto mb-2" />
                                <p className="text-sm text-stone-500">No report history available.</p>
                            </div>
                        </IOSCard>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
