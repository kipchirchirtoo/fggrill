'use client';

import { useState } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import {
    BarChart3, TrendingUp, TrendingDown, DollarSign,
    Percent, AlertTriangle, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

export default function ReportsPage() {
    const [dateRange, setDateRange] = useState('today');

    return (
        <ProtectedRoute allowedRoles={[
            UserRole.SUPER_ADMIN,
            UserRole.GENERAL_MANAGER,
            UserRole.BRANCH_MANAGER,
            UserRole.RESTAURANT
        ]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard/kitchen-operations">
                                <button className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                                    <ArrowLeft className="h-5 w-5 text-stone-600" />
                                </button>
                            </Link>
                            <div>
                                <h1 className="text-[22px] sm:text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">
                                    Kitchen Reports
                                </h1>
                                <p className="text-stone-500 text-sm mt-0.5">
                                    Food cost analysis and variance reports
                                </p>
                            </div>
                        </div>
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                            className="h-10 px-3 rounded-ios-lg border border-stone-200"
                        >
                            <option value="today">Today</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                        </select>
                    </div>

                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <IOSCard className="p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center">
                                    <Percent className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Food Cost %</p>
                                    <p className="text-2xl font-bold text-green-600">28.5%</p>
                                </div>
                            </div>
                            <p className="text-xs text-stone-500">Target: 30%</p>
                        </IOSCard>

                        <IOSCard className="p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <DollarSign className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Total Cost</p>
                                    <p className="text-2xl font-bold text-stone-900">KES 45,230</p>
                                </div>
                            </div>
                            <p className="text-xs text-stone-500">Ingredients used</p>
                        </IOSCard>

                        <IOSCard className="p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center">
                                    <TrendingDown className="h-5 w-5 text-red-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Wastage</p>
                                    <p className="text-2xl font-bold text-red-600">KES 2,150</p>
                                </div>
                            </div>
                            <p className="text-xs text-stone-500">4.8% of total</p>
                        </IOSCard>

                        <IOSCard className="p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
                                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Variances</p>
                                    <p className="text-2xl font-bold text-amber-600">3</p>
                                </div>
                            </div>
                            <p className="text-xs text-stone-500">Items flagged</p>
                        </IOSCard>
                    </div>

                    {/* Charts Placeholder */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <IOSCard className="p-6">
                            <h3 className="font-bold text-stone-900 mb-4">Food Cost Trend</h3>
                            <div className="h-64 flex items-center justify-center bg-stone-50 rounded-lg">
                                <div className="text-center text-stone-400">
                                    <BarChart3 className="h-12 w-12 mx-auto mb-2" />
                                    <p className="text-sm">Chart visualization coming soon</p>
                                </div>
                            </div>
                        </IOSCard>

                        <IOSCard className="p-6">
                            <h3 className="font-bold text-stone-900 mb-4">Wastage by Category</h3>
                            <div className="h-64 flex items-center justify-center bg-stone-50 rounded-lg">
                                <div className="text-center text-stone-400">
                                    <BarChart3 className="h-12 w-12 mx-auto mb-2" />
                                    <p className="text-sm">Chart visualization coming soon</p>
                                </div>
                            </div>
                        </IOSCard>
                    </div>

                    {/* Variance Report */}
                    <IOSCard>
                        <div className="p-4 border-b">
                            <h3 className="font-bold text-stone-900">Daily Variance Report</h3>
                            <p className="text-sm text-stone-500">Items with discrepancies between expected and actual stock</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-stone-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase">Item</th>
                                        <th className="px-4 py-3 text-right text-xs font-bold text-stone-500 uppercase">Expected</th>
                                        <th className="px-4 py-3 text-right text-xs font-bold text-stone-500 uppercase">Actual</th>
                                        <th className="px-4 py-3 text-right text-xs font-bold text-stone-500 uppercase">Variance</th>
                                        <th className="px-4 py-3 text-right text-xs font-bold text-stone-500 uppercase">%</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    <tr className="hover:bg-stone-50">
                                        <td className="px-4 py-3 font-medium">White Rice</td>
                                        <td className="px-4 py-3 text-right font-mono">50.0 kg</td>
                                        <td className="px-4 py-3 text-right font-mono">47.5 kg</td>
                                        <td className="px-4 py-3 text-right font-mono text-red-600">-2.5 kg</td>
                                        <td className="px-4 py-3 text-right font-mono text-red-600">-5.0%</td>
                                    </tr>
                                    <tr className="hover:bg-stone-50">
                                        <td className="px-4 py-3 font-medium">Cooking Oil</td>
                                        <td className="px-4 py-3 text-right font-mono">20.0 L</td>
                                        <td className="px-4 py-3 text-right font-mono">18.5 L</td>
                                        <td className="px-4 py-3 text-right font-mono text-red-600">-1.5 L</td>
                                        <td className="px-4 py-3 text-right font-mono text-red-600">-7.5%</td>
                                    </tr>
                                    <tr className="hover:bg-stone-50">
                                        <td className="px-4 py-3 font-medium">Tomatoes</td>
                                        <td className="px-4 py-3 text-right font-mono">15.0 kg</td>
                                        <td className="px-4 py-3 text-right font-mono">14.2 kg</td>
                                        <td className="px-4 py-3 text-right font-mono text-red-600">-0.8 kg</td>
                                        <td className="px-4 py-3 text-right font-mono text-red-600">-5.3%</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </IOSCard>

                    {/* Info */}
                    <IOSCard className="p-4 bg-blue-50 border-blue-200">
                        <p className="text-sm text-stone-700">
                            <strong>Note:</strong> Reports are generated from ledger data. Variance reports help identify discrepancies between expected and actual stock, flagging potential issues for investigation.
                        </p>
                    </IOSCard>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
