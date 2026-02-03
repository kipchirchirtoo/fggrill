'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import { toast } from 'sonner';

const OrderDetailsModal = ({ order, isOpen, onClose }: { order: any, isOpen: boolean, onClose: () => void }) => {
    if (!isOpen || !order) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden border border-stone-100 flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-5 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                    <div>
                        <h3 className="text-lg font-bold text-stone-900 tracking-tight">Transaction Detail</h3>
                        <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-widest">{order.order_number || `#${order.id?.substr(0, 8)}`}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-full transition-colors text-stone-400">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <p className="caption mb-1">Guest / Customer</p>
                            <p className="text-[14px] font-bold text-stone-900">{order.guest_name || 'Walk-in Guest'}</p>
                        </div>
                        <div className="text-right">
                            <p className="caption mb-1">Time / Date</p>
                            <p className="text-[14px] font-bold text-stone-900">{new Date(order.created_at).toLocaleString()}</p>
                        </div>
                    </div>

                    <div>
                        <p className="caption mb-3">Items Breakdown</p>
                        <div className="bg-stone-50/50 rounded-xl border border-stone-100 divide-y divide-stone-100 overflow-hidden">
                            {(order.items || []).length > 0 ? (
                                order.items.map((item: any, idx: number) => (
                                    <div key={idx} className="px-4 py-3.5 flex justify-between items-center transition-colors hover:bg-white/80">
                                        <div className="min-w-0">
                                            <p className="text-[13px] font-semibold text-stone-800 truncate">{item.menu_item?.name || item.item_name || 'Unknown Item'}</p>
                                            <p className="text-[10px] font-medium text-stone-400">Quantity: {item.quantity}</p>
                                        </div>
                                        <p className="text-[13px] font-bold text-stone-900">KES {(item.quantity * (item.unit_price || item.price || 0)).toLocaleString()}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="px-4 py-12 text-center text-stone-400 text-[11px] font-medium italic">
                                    No itemized breakdown available
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-6 border-t border-stone-100 flex justify-between items-center">
                        <span className="text-[12px] font-bold text-stone-500 uppercase tracking-widest">Grand Total</span>
                        <span className="text-2xl font-bold text-stone-900">KES {(order.total_amount || order.total || 0).toLocaleString()}</span>
                    </div>
                </div>

                <div className="px-6 py-5 bg-stone-50/50 flex justify-end gap-3 border-t border-stone-100">
                    <button onClick={onClose} className="btn-secondary">Dismiss</button>
                    <button className="btn-primary">
                        Flag for Review
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function SalesAuditPage() {
    const [auditData, setAuditData] = useState<any>(null);
    const [drillDownBranchId, setDrillDownBranchId] = useState<number | null>(null);
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
                branch_id: drillDownBranchId || undefined,
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
    }, [drillDownBranchId, dateRange]);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            await auditorReportsAPI.exportBrandedPdf('revenue_reconciliation', {
                branch_id: drillDownBranchId || undefined,
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

    const totalExpected = auditData?.restaurant?.total_value + auditData?.bar?.total_value || 0;
    const voidedCount = auditData?.restaurant?.voided + auditData?.bar?.voided || 0;

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6 pb-12">
                    {/* Header */}
                    <div className="page-header flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-stone-900 flex items-center justify-center text-white shadow-lg">
                                <ShoppingBag className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="page-title text-stone-900">
                                    {drillDownBranchId ? `Branch Sales Detail` : `System Sales Audit`}
                                </h1>
                                <p className="page-subtitle">Verify transactions and departmental reconciled revenue totals</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 bg-stone-100/50 border border-stone-200 rounded-xl px-3 py-1.5 shadow-sm h-10">
                                <Filter className="h-3.5 w-3.5 text-stone-400" />
                                <input
                                    type="date"
                                    value={dateRange.startDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="text-[12px] font-semibold text-stone-700 bg-transparent outline-none w-28"
                                />
                                <span className="text-stone-300 mx-1">→</span>
                                <input
                                    type="date"
                                    value={dateRange.endDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="text-[12px] font-semibold text-stone-700 bg-transparent outline-none w-28"
                                />
                            </div>
                            <button onClick={handleExport} disabled={isExporting} className="btn-secondary">
                                <Download className={`h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} />
                            </button>
                            <button onClick={fetchData} className="btn-primary">
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Bird's Eye Statistics */}
                    {!drillDownBranchId && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="stat-card bg-stone-900 border-none shadow-xl shadow-stone-900/10">
                                <div className="stat-icon bg-white/10 text-white">
                                    <TrendingUp className="h-5 w-5" />
                                </div>
                                <p className="stat-value text-white">KES {totalExpected.toLocaleString()}</p>
                                <p className="stat-label text-stone-400">Total Sales Reconciled</p>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon bg-stone-50 text-stone-500">
                                    <BarChart3 className="h-5 w-5" />
                                </div>
                                <p className="stat-value text-stone-900">KES {(auditData?.restaurant?.total_value || 0).toLocaleString()}</p>
                                <p className="stat-label">Restaurant Revenue</p>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon bg-stone-50 text-stone-500">
                                    <BarChart3 className="h-5 w-5" />
                                </div>
                                <p className="stat-value text-stone-900">KES {(auditData?.bar?.total_value || 0).toLocaleString()}</p>
                                <p className="stat-label">Bar & Lounge Revenue</p>
                            </div>
                            <div className="stat-card">
                                <div className={`stat-icon ${voidedCount > 0 ? 'bg-rose-50 text-rose-500' : 'bg-stone-50 text-stone-500'}`}>
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <p className={`stat-value ${voidedCount > 0 ? 'text-rose-600' : 'text-stone-900'}`}>{voidedCount}</p>
                                <p className="stat-label">Voided Alerts</p>
                            </div>
                        </div>
                    )}

                    {!drillDownBranchId ? (
                        /* BRANCH SUMMARIES VIEW */
                        <div className="table-container shadow-sm border border-stone-100">
                            <div className="section-header p-5 border-b border-stone-100">
                                <div>
                                    <h2 className="section-title">Branch Performance</h2>
                                    <p className="section-subtitle">Comparative revenue analysis across operational nodes</p>
                                </div>
                            </div>
                            <div className="table-responsive">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="table-header">
                                            <th className="table-header-cell">Branch</th>
                                            <th className="table-header-cell text-center">Restaurant</th>
                                            <th className="table-header-cell text-center">Bar & Lounge</th>
                                            <th className="table-header-cell text-center">Voided</th>
                                            <th className="table-header-cell text-right">Gross Total</th>
                                            <th className="table-header-cell"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-50">
                                        {(auditData?.branch_summaries || []).map((branch: any) => (
                                            <tr
                                                key={branch.branch_id}
                                                onClick={() => setDrillDownBranchId(branch.branch_id)}
                                                className="table-row cursor-pointer"
                                            >
                                                <td className="table-cell">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-500 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                                                            <Building2 className="h-4 w-4" />
                                                        </div>
                                                        <span className="font-semibold text-stone-900">{branch.branch_name}</span>
                                                    </div>
                                                </td>
                                                <td className="table-cell text-center">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-stone-900">KES {branch.restaurant.total_value.toLocaleString()}</span>
                                                        <span className="text-[10px] text-stone-400 font-medium">{branch.restaurant.total_orders} orders</span>
                                                    </div>
                                                </td>
                                                <td className="table-cell text-center">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-stone-900">KES {branch.bar.total_value.toLocaleString()}</span>
                                                        <span className="text-[10px] text-stone-400 font-medium">{branch.bar.total_orders} orders</span>
                                                    </div>
                                                </td>
                                                <td className="table-cell text-center">
                                                    <span className={`font-bold ${branch.restaurant.voided + branch.bar.voided > 0 ? 'text-rose-600' : 'text-stone-300'}`}>
                                                        {branch.restaurant.voided + branch.bar.voided}
                                                    </span>
                                                </td>
                                                <td className="table-cell text-right">
                                                    <span className="font-bold text-stone-900">KES {branch.total_revenue.toLocaleString()}</span>
                                                </td>
                                                <td className="table-cell text-right">
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
                    ) : (
                        /* DETAILED TRANSACTION DRILL-DOWN */
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">
                            {/* Detailed Stats for the Branch */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="stat-card">
                                    <div className="stat-icon bg-stone-50 text-stone-500">
                                        <TrendingUp className="h-5 w-5" />
                                    </div>
                                    <p className="stat-value">KES {(auditData?.restaurant?.total_value + auditData?.bar?.total_value || 0).toLocaleString()}</p>
                                    <p className="stat-label">Daily Expected</p>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon bg-stone-50 text-stone-500">
                                        <Utensils className="h-5 w-5" />
                                    </div>
                                    <p className="stat-value">{auditData?.restaurant?.total_orders || 0}</p>
                                    <p className="stat-label">Kitchen Orders</p>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon bg-stone-50 text-stone-500">
                                        <Beer className="h-5 w-5" />
                                    </div>
                                    <p className="stat-value">{auditData?.bar?.total_orders || 0}</p>
                                    <p className="stat-label">Bar Orders</p>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-icon bg-emerald-50 text-emerald-500">
                                        <ShieldCheck className="h-5 w-5" />
                                    </div>
                                    <p className="stat-value">BALANCED</p>
                                    <p className="stat-label">Rec. Status</p>
                                </div>
                            </div>

                            <div className="table-container shadow-sm border border-stone-100">
                                <div className="section-header p-5 border-b border-stone-100 flex items-center justify-between">
                                    <div>
                                        <h2 className="section-title">Recent Transactions</h2>
                                        <p className="section-subtitle">Real-time verification of operational checks</p>
                                    </div>
                                    <button className="btn-primary">
                                        Verify Bulk
                                    </button>
                                </div>
                                <div className="table-responsive">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="table-header">
                                                <th className="table-header-cell">Reference</th>
                                                <th className="table-header-cell">Guest & Time</th>
                                                <th className="table-header-cell text-center">Type</th>
                                                <th className="table-header-cell text-right">Amount</th>
                                                <th className="table-header-cell text-center">Audit Status</th>
                                                <th className="table-header-cell text-right"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-50">
                                            {[...(auditData?.orders?.restaurant || []), ...(auditData?.orders?.bar || [])]
                                                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                                .map((order: any) => (
                                                    <tr key={order.id} className="table-row group">
                                                        <td className="table-cell">
                                                            <span className="font-mono font-bold text-stone-900 tracking-tight">
                                                                {order.order_number || `#${order.id?.substr(0, 6)}`}
                                                            </span>
                                                        </td>
                                                        <td className="table-cell">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-stone-900">{order.guest_name || order.customer_name || 'Walk-in'}</span>
                                                                <span className="text-[10px] text-stone-400 uppercase font-black tracking-widest">
                                                                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="table-cell text-center">
                                                            <span className={order.total ? 'badge-warning' : 'badge-info'}>
                                                                {order.total ? 'Bar' : 'Rest'}
                                                            </span>
                                                        </td>
                                                        <td className="table-cell text-right font-bold text-stone-900">
                                                            KES {(order.total_amount || order.total || 0).toLocaleString()}
                                                        </td>
                                                        <td className="table-cell text-center">
                                                            <span className={
                                                                order.status === 'cancelled' ? 'badge-danger' :
                                                                    order.status === 'completed' || order.status === 'paid' ? 'badge-success' :
                                                                        'badge-info'
                                                            }>
                                                                {order.status}
                                                            </span>
                                                        </td>
                                                        <td className="table-cell text-right">
                                                            <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => { setSelectedOrder(order); setIsModalOpen(true); }}
                                                                    className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors text-stone-400"
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </button>
                                                                <button className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors text-stone-400">
                                                                    <Check className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

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
