'use client';

import React, { useState, useEffect } from 'react';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { auditorReportsAPI, reportsService } from '@/lib/api';
import { toast } from 'sonner';
import { Calendar, TrendingUp, DollarSign, ArrowLeft, RefreshCw, BarChart3, CreditCard, ShoppingCart, FileDown } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function BranchPerformancePage() {
    const router = useRouter();
    const { activeBranchId } = useBranch();
    const [reportData, setReportData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(1)).toISOString().split('T')[0], // First day of current month
        end: new Date().toISOString().split('T')[0] // Today
    });

    const handleExport = async () => {
        setIsExporting(true);
        try {
            await reportsService.downloadReport('branch_performance', {
                branch_id: activeBranchId,
                start_date: dateRange.start,
                end_date: dateRange.end,
                branch_name: activeBranchId === 0 ? 'All Branches' : `Branch #${activeBranchId}`
            });
            toast.success("Report downloaded successfully");
        } catch (e) {
            console.error(e);
            toast.error("Failed to export report");
        } finally {
            setIsExporting(false);
        }
    };

    const fetchReport = async () => {
        setIsLoading(true);
        try {
            // If activeBranchId is 0 (All branches), the API handles it (returns aggregate or list?)
            // My controller implementation handles branch_id. If missing, it might error or return all.
            // Let's assume we pass what we have. API expects branch_id string/number.
            const res = await auditorReportsAPI.getBranchPerformance({
                branch_id: activeBranchId,
                start_date: dateRange.start,
                end_date: dateRange.end
            });

            if (res.success) {
                setReportData(res.data);
            } else {
                toast.error(res.message || "Failed to fetch report");
            }
        } catch (e) {
            console.error(e);
            toast.error("Error loading performance report");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [activeBranchId, dateRange]);

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <BranchAwareDashboardLayout
                title="Branch Performance Report"
                subtitle={`Performance metrics from ${dateRange.start} to ${dateRange.end}`}
            >
                <div className="space-y-6">
                    {/* Header Controls */}
                    <div className="flex flex-col sm:flex-row justify-between gap-4 bg-white p-4 rounded-xl border border-stone-100 shadow-sm">
                        <div className="flex items-center gap-2">
                            <button onClick={() => router.back()} className="p-2 hover:bg-stone-100 rounded-lg text-stone-500">
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                            <div className="flex items-center gap-2 bg-stone-50 px-3 py-2 rounded-lg border border-stone-200">
                                <Calendar className="h-4 w-4 text-stone-500" />
                                <input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                    className="bg-transparent text-[13px] font-medium outline-none"
                                />
                                <span className="text-stone-400">-</span>
                                <input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                    className="bg-transparent text-[13px] font-medium outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleExport}
                                disabled={isExporting || isLoading}
                                className="btn-primary"
                            >
                                <FileDown className={`h-4 w-4 mr-2 ${isExporting ? 'animate-bounce' : ''}`} />
                                {isExporting ? 'Generating...' : 'Export Branded PDF'}
                            </button>
                            <button onClick={fetchReport} disabled={isLoading} className="btn-secondary">
                                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                                Refresh Data
                            </button>
                        </div>
                    </div>

                    {reportData ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                            <div className="stat-card">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="stat-icon bg-emerald-100">
                                        <DollarSign className="h-5 w-5 text-emerald-600" />
                                    </div>
                                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Revenue</span>
                                </div>
                                <p className="stat-label">Total Sales</p>
                                <p className="stat-value text-stone-900">KES {reportData.sales?.total?.toLocaleString() ?? 0}</p>
                                <div className="text-xs text-stone-400 mt-1 flex gap-2">
                                    <span>Res: {reportData.sales?.restaurant?.toLocaleString() ?? 0}</span>
                                    <span>Bar: {reportData.sales?.bar?.toLocaleString() ?? 0}</span>
                                </div>
                            </div>

                            <div className="stat-card">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="stat-icon bg-red-100">
                                        <ArrowLeft className="h-5 w-5 text-red-600" />
                                    </div>
                                    <span className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-bold">Outflow</span>
                                </div>
                                <p className="stat-label">Total Expenses</p>
                                <p className="stat-value text-stone-900">KES {reportData.expenses?.total?.toLocaleString() ?? 0}</p>
                            </div>

                            <div className="stat-card">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="stat-icon bg-amber-100">
                                        <DollarSign className="h-5 w-5 text-amber-600" />
                                    </div>
                                </div>
                                <p className="stat-label">Net Profit</p>
                                <p className="stat-value text-stone-900">KES {reportData.netProfit?.toLocaleString() ?? 0}</p>
                            </div>

                            <div className="stat-card">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="stat-icon bg-purple-100">
                                        <TrendingUp className="h-5 w-5 text-purple-600" />
                                    </div>
                                </div>
                                <p className="stat-label">Profit Margin</p>
                                <p className="stat-value text-stone-900">{reportData.profitMargin?.toFixed(1) ?? 0}%</p>
                            </div>
                        </div>
                    ) : (
                        <div className="p-12 text-center text-stone-400">
                            {isLoading ? "Loading performance data..." : "Select a date range to view branch performance."}
                        </div>
                    )}

                    {reportData?.expenses?.breakdown && (
                        <div className="bg-white p-6 rounded-xl border border-stone-100 shadow-sm">
                            <h3 className="text-lg font-bold text-stone-800 mb-4">Expense Breakdown</h3>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                {Object.entries(reportData.expenses.breakdown).map(([category, amount]: [string, any]) => (
                                    <div key={category} className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
                                        <span className="text-sm font-medium text-stone-600">{category}</span>
                                        <span className="text-sm font-bold text-stone-900">KES {Number(amount).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </BranchAwareDashboardLayout>
        </ProtectedRoute >
    );
}
