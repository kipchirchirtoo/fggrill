'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auditAPI, auditorReportsAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import {
    AlertTriangle, ShoppingBag, Filter, Download,
    ArrowLeft, Check, X, RefreshCw, Eye, FileDown,
    Building2, TrendingUp, BarChart3, ChevronRight,
    Utensils, Beer, ShieldCheck
} from 'lucide-react';
import { CashierLogbookVerification } from '@/components/auditor/CashierLogbookVerification';
import { toast } from 'sonner';

import { OrderDetailsModal } from '@/components/auditor/OrderDetailsModal';

export default function SalesAuditPage() {
    const router = useRouter();
    const [auditData, setAuditData] = useState<any>(null);
    // const [drillDownBranchId, setDrillDownBranchId] = useState<number | null>(null); // Removed in favor of routing
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [dateRange, setDateRange] = useState({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await auditAPI.verifySales({
                start_date: dateRange.startDate,
                end_date: dateRange.endDate
            });

            if (res.success) {
                setAuditData(res.data);
            } else {
                toast.error(res.message || 'Failed to fetch sales audit data');
            }
        } catch (e) {
            console.error(e);
            toast.error("Network error while syncing data");
        } finally {
            setIsLoading(false);
        }
    }, [dateRange]);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            await auditorReportsAPI.exportBrandedPdf('revenue_reconciliation', {
                start_date: dateRange.startDate,
                end_date: dateRange.endDate
            });
            toast.success("Sales report generated");
        } catch (e) {
            console.error(e);
            toast.error("Failed to generate report");
        } finally {
            setIsExporting(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const totalExpected = (auditData?.restaurant?.total_value || 0) + (auditData?.bar?.total_value || 0) + (auditData?.pool?.total_value || 0);
    const voidedCount = (auditData?.restaurant?.voided || 0) + (auditData?.bar?.voided || 0);

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6 pb-12">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">System Sales Audit</h1>
                            <p className="text-stone-500 mt-0.5">Verify transactions and departmental reconciled revenue totals</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-lg px-3 h-10 shadow-sm transition-all focus-within:border-stone-400">
                                <Filter className="h-4 w-4 text-stone-400" />
                                <input
                                    type="date"
                                    value={dateRange.startDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="text-[13px] font-medium text-stone-700 bg-transparent outline-none w-28"
                                />
                                <span className="text-stone-300 mx-1">→</span>
                                <input
                                    type="date"
                                    value={dateRange.endDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="text-[13px] font-medium text-stone-700 bg-transparent outline-none w-28"
                                />
                            </div>
                            <div className="h-8 w-[1px] bg-stone-200 mx-1 hidden sm:block" />
                            <button onClick={handleExport} disabled={isExporting} className="btn-secondary h-10">
                                <Download className={`h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} />
                            </button>
                            <button onClick={fetchData} className="btn-secondary h-10">
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Bird's Eye Statistics */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="stat-card">
                            <div className="stat-icon bg-stone-900 text-white">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                            <p className="stat-value">KES {totalExpected.toLocaleString()}</p>
                            <p className="stat-label">Total Revenue</p>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon bg-emerald-50 text-emerald-600">
                                <Utensils className="h-5 w-5" />
                            </div>
                            <p className="stat-value text-stone-900">KES {(auditData?.restaurant?.total_value || 0).toLocaleString()}</p>
                            <p className="stat-label">Restaurant</p>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon bg-amber-50 text-amber-600">
                                <Beer className="h-5 w-5" />
                            </div>
                            <p className="stat-value text-stone-900">KES {(auditData?.bar?.total_value || 0).toLocaleString()}</p>
                            <p className="stat-label">Bar & Lounge</p>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon bg-indigo-50 text-indigo-600">
                                <ShieldCheck className="h-5 w-5" />
                            </div>
                            <p className="stat-value text-stone-900">KES {(auditData?.pool?.total_value || 0).toLocaleString()}</p>
                            <p className="stat-label">Pool Table</p>
                        </div>
                        <div className="stat-card">
                            <div className={`stat-icon ${voidedCount > 0 ? 'bg-rose-50 text-rose-500' : 'bg-stone-50 text-stone-500'}`}>
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <p className={`stat-value ${voidedCount > 0 ? 'text-rose-600' : 'text-stone-900'}`}>{voidedCount}</p>
                            <p className="stat-label">Voided Orders</p>
                        </div>
                    </div>

                    <CashierLogbookVerification
                        title="Sales Verification Queue"
                    />


                    {/* BRANCH SUMMARIES VIEW */}
                    <div className="card-elevated overflow-hidden">
                        <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/30">
                            <div>
                                <h2 className="text-[15px] font-semibold text-stone-900">Branch Performance</h2>
                                <p className="text-[12px] text-stone-500">Comparative revenue analysis across nodes</p>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-stone-50/50 border-b border-stone-100">
                                        <th className="px-5 py-3.5 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Branch</th>
                                        <th className="px-5 py-3.5 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-center">Restaurant</th>
                                        <th className="px-5 py-3.5 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-center">Bar & Lounge</th>
                                        <th className="px-5 py-3.5 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-center">Pool Table</th>
                                        <th className="px-5 py-3.5 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-center">Voided</th>
                                        <th className="px-5 py-3.5 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-right">Gross Total</th>
                                        <th className="px-5 py-3.5 text-[11px] font-bold text-stone-400 uppercase tracking-widest"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {(auditData?.branch_summaries || []).map((branch: any) => (
                                        <tr
                                            key={branch.branch_id}
                                            onClick={() => router.push(`/dashboard/auditor/sales/${branch.branch_id}`)}
                                            className="hover:bg-stone-50/50 transition-colors group cursor-pointer"
                                        >
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-500 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                                                        <Building2 className="h-4 w-4" />
                                                    </div>
                                                    <span className="text-[13px] font-semibold text-stone-900">{branch.branch_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <div className="flex flex-col">
                                                    <span className="text-[13px] font-bold text-stone-900">KES {branch.restaurant.total_value.toLocaleString()}</span>
                                                    <span className="text-[10px] text-stone-400 font-medium">{branch.restaurant.total_orders} orders</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <div className="flex flex-col">
                                                    <span className="text-[13px] font-bold text-stone-900">KES {(branch.bar?.total_value || 0).toLocaleString()}</span>
                                                    <span className="text-[10px] text-stone-400 font-medium">{branch.bar?.total_orders || 0} orders</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <div className="flex flex-col">
                                                    <span className="text-[13px] font-bold text-stone-900">KES {(branch.pool?.total_value || 0).toLocaleString()}</span>
                                                    <span className="text-[10px] text-stone-400 font-medium">{branch.pool?.total_sales || 0} sales</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span className={`text-[13px] font-bold ${branch.restaurant.voided + branch.bar.voided > 0 ? 'text-rose-600' : 'text-stone-300'}`}>
                                                    {branch.restaurant.voided + branch.bar.voided}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <span className="text-[13px] font-bold text-stone-900">KES {branch.total_revenue.toLocaleString()}</span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-900 transition-colors" />
                                            </td>
                                        </tr>
                                    ))}
                                    {(!auditData?.branch_summaries || auditData.branch_summaries.length === 0) && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-20 text-center">
                                                {isLoading ? (
                                                    <div className="flex flex-col items-center gap-2 opacity-50">
                                                        <RefreshCw className="h-6 w-6 animate-spin text-stone-300" />
                                                        <span className="text-[11px] font-black uppercase tracking-widest text-stone-400">Syncing branch data...</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[11px] font-black uppercase tracking-widest text-stone-300">No records found</span>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {/* Removed Detailed View from this page as it's now in dynamic route */}

                    <OrderDetailsModal
                        isOpen={isModalOpen}
                        order={selectedOrder}
                        onClose={() => setIsModalOpen(false)}
                    />
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
