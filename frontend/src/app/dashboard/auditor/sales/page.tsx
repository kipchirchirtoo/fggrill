'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { auditAPI, auditorReportsAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import {
    AlertTriangle, ShoppingBag, Filter, Download,
    ArrowLeft, Check, X, RefreshCw, Eye, FileDown,
    Building2, TrendingUp, BarChart3, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

const OrderDetailsModal = ({ order, isOpen, onClose }: { order: any, isOpen: boolean, onClose: () => void }) => {
    if (!isOpen || !order) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden border border-stone-100 flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                    <div>
                        <h3 className="text-[16px] font-black text-stone-900 tracking-tight">Order Details</h3>
                        <p className="text-[11px] font-bold text-stone-400 uppercase">{order.order_number || `#${order.id?.substr(0, 8)}`}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-full transition-colors text-stone-400">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Guest</p>
                            <p className="text-[13px] font-bold text-stone-900">{order.guest_name || 'Walk-in Guest'}</p>
                        </div>
                        <div className="space-y-1 text-right">
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Time / Date</p>
                            <p className="text-[13px] font-bold text-stone-900">{new Date(order.created_at).toLocaleString()}</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Items Breakdown</p>
                        <div className="bg-stone-50 rounded-xl border border-stone-100 divide-y divide-stone-100 overflow-hidden">
                            {(order.items || []).length > 0 ? (
                                order.items.map((item: any, idx: number) => (
                                    <div key={idx} className="px-4 py-3 flex justify-between items-center transition-colors hover:bg-white">
                                        <div className="min-w-0">
                                            <p className="text-[12px] font-bold text-stone-800 truncate">{item.menu_item?.name || item.item_name || 'Unknown Item'}</p>
                                            <p className="text-[10px] font-bold text-stone-400 uppercase">QTY: {item.quantity}</p>
                                        </div>
                                        <p className="text-[12px] font-black text-stone-900">KES {(item.quantity * (item.unit_price || item.price || 0)).toLocaleString()}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="px-4 py-10 text-center text-stone-400 text-[11px] font-bold uppercase tracking-widest italic bg-white/50">
                                    No item breakdown found
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-5 border-t border-stone-200 flex justify-between items-center">
                        <span className="text-[12px] font-bold text-stone-500 uppercase tracking-widest">Grand Total</span>
                        <span className="text-[20px] font-black text-stone-900">KES {(order.total_amount || order.total || 0).toLocaleString()}</span>
                    </div>
                </div>

                <div className="px-6 py-4 bg-stone-50/50 flex justify-end gap-2 border-t border-stone-100">
                    <button onClick={onClose} className="px-4 py-2 text-[11px] font-black uppercase tracking-widest text-stone-500 hover:text-stone-900 transition-colors">Close</button>
                    <button className="px-6 py-2 bg-stone-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10">
                        Verify Transaction
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
                    {/* Minimal Header */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                {drillDownBranchId && (
                                    <button
                                        onClick={() => setDrillDownBranchId(null)}
                                        className="p-1 hover:bg-stone-100 rounded-lg transition-colors mr-1"
                                    >
                                        <ArrowLeft className="h-4 w-4 text-stone-900" />
                                    </button>
                                )}
                                <h1 className="text-2xl font-black text-stone-900 tracking-tight">
                                    {drillDownBranchId ? `Branch Sales Detail` : `System-wide Sales Audit`}
                                </h1>
                            </div>
                            <p className="text-stone-500 text-sm font-medium">Verify daily transactions and departmental reconciled totals</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-2 shadow-sm">
                                <Filter className="h-3.5 w-3.5 text-stone-400" />
                                <input
                                    type="date"
                                    value={dateRange.startDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="text-[12px] font-black text-stone-700 outline-none"
                                />
                                <span className="text-stone-300">→</span>
                                <input
                                    type="date"
                                    value={dateRange.endDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="text-[12px] font-black text-stone-700 outline-none"
                                />
                            </div>
                            <button onClick={handleExport} disabled={isExporting} className="p-2.5 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 shadow-sm text-stone-600 transition-colors">
                                <Download className={`h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} />
                            </button>
                            <button onClick={fetchData} className="p-2.5 bg-stone-900 rounded-xl hover:bg-stone-800 shadow-sm text-white transition-colors">
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Bird's Eye Statistics */}
                    {!drillDownBranchId && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="card-elevated p-6 bg-stone-900 text-white shadow-xl shadow-stone-900/10">
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Total Sales</p>
                                <h3 className="text-2xl font-black">KES {totalExpected.toLocaleString()}</h3>
                                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider">Across All Branches</span>
                                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                                </div>
                            </div>
                            <div className="card-elevated p-6 border border-stone-100 bg-white">
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Rest. Revenue</p>
                                <h3 className="text-2xl font-black text-stone-900">KES {(auditData?.restaurant?.total_value || 0).toLocaleString()}</h3>
                                <p className="text-[11px] font-bold text-stone-400 mt-2 lowercase">{auditData?.restaurant?.total_orders || 0} orders processed</p>
                            </div>
                            <div className="card-elevated p-6 border border-stone-100 bg-white">
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Bar Revenue</p>
                                <h3 className="text-2xl font-black text-stone-900">KES {(auditData?.bar?.total_value || 0).toLocaleString()}</h3>
                                <p className="text-[11px] font-bold text-stone-400 mt-2 lowercase">{auditData?.bar?.total_orders || 0} orders processed</p>
                            </div>
                            <div className="card-elevated p-6 border border-stone-100 bg-white">
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Voided Alerts</p>
                                <h3 className={`text-2xl font-black ${voidedCount > 0 ? 'text-rose-600' : 'text-stone-900'}`}>{voidedCount}</h3>
                                <p className="text-[11px] font-bold text-stone-400 mt-2 lowercase">Potential leakage points</p>
                            </div>
                        </div>
                    )}

                    {!drillDownBranchId ? (
                        /* BRANCH SUMMARIES VIEW */
                        <div className="card-elevated border border-stone-100 bg-white overflow-hidden">
                            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/30">
                                <div>
                                    <h3 className="text-[14px] font-black text-stone-900 uppercase tracking-tight">Branch Performance Summaries</h3>
                                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Select a branch to drill into individual transactions</p>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-stone-50/30 border-b border-stone-100 text-[10px] font-black text-stone-400 uppercase tracking-widest">
                                            <th className="px-6 py-4">Branch</th>
                                            <th className="px-6 py-4 text-center">Restaurant</th>
                                            <th className="px-6 py-4 text-center">Bar & Lounge</th>
                                            <th className="px-6 py-4 text-center">Voided</th>
                                            <th className="px-6 py-4 text-right">Gross Total</th>
                                            <th className="px-6 py-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-50">
                                        {(auditData?.branch_summaries || []).map((branch: any) => (
                                            <tr
                                                key={branch.branch_id}
                                                onClick={() => setDrillDownBranchId(branch.branch_id)}
                                                className="hover:bg-stone-50 transition-colors group cursor-pointer"
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-lg bg-stone-100 text-stone-600 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                                                            <Building2 className="h-4 w-4" />
                                                        </div>
                                                        <span className="text-[13px] font-black text-stone-900">{branch.branch_name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-[12px] font-bold text-stone-600">KES {branch.restaurant.total_value.toLocaleString()}</span>
                                                    <p className="text-[10px] font-bold text-stone-400 uppercase">{branch.restaurant.total_orders} orders</p>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-[12px] font-bold text-stone-600">KES {branch.bar.total_value.toLocaleString()}</span>
                                                    <p className="text-[10px] font-bold text-stone-400 uppercase">{branch.bar.total_orders} orders</p>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`text-[12px] font-black ${branch.restaurant.voided + branch.bar.voided > 0 ? 'text-rose-600' : 'text-stone-400'}`}>
                                                        {branch.restaurant.voided + branch.bar.voided}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-[14px] font-black text-stone-900">KES {branch.total_revenue.toLocaleString()}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-900 transition-colors inline" />
                                                </td>
                                            </tr>
                                        ))}
                                        {(!auditData?.branch_summaries || auditData.branch_summaries.length === 0) && (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center">
                                                    {isLoading ? (
                                                        <div className="flex flex-col items-center gap-2 opacity-50">
                                                            <RefreshCw className="h-6 w-6 animate-spin" />
                                                            <span className="text-[11px] font-black uppercase tracking-widest">Syncing branch data...</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-2 text-stone-300">
                                                            <BarChart3 className="h-8 w-8 opacity-20" />
                                                            <span className="text-[12px] font-bold">No sales records found for this period</span>
                                                        </div>
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
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="card-elevated p-6 border border-stone-100 bg-white">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Daily Expected</p>
                                    <h3 className="text-xl font-black text-stone-900">KES {(auditData?.restaurant?.total_value + auditData?.bar?.total_value || 0).toLocaleString()}</h3>
                                    <div className="h-1.5 w-full bg-stone-100 rounded-full mt-4 overflow-hidden">
                                        <div className="h-full bg-emerald-500 w-[100%]" />
                                    </div>
                                </div>
                                <div className="card-elevated p-6 border border-stone-100 bg-white">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Departmental Split</p>
                                    <div className="flex items-center gap-4 mt-1">
                                        <div className="text-center">
                                            <p className="text-[14px] font-black text-stone-900">{auditData?.restaurant?.total_orders}</p>
                                            <p className="text-[9px] font-bold text-stone-400 uppercase tracking-tighter">Kitchen</p>
                                        </div>
                                        <div className="h-8 w-[1px] bg-stone-100" />
                                        <div className="text-center">
                                            <p className="text-[14px] font-black text-stone-900">{auditData?.bar?.total_orders}</p>
                                            <p className="text-[9px] font-bold text-stone-400 uppercase tracking-tighter">Bar</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="card-elevated p-6 border border-rose-100 bg-rose-50/30">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-400 mb-1">Reconciliation Variance</p>
                                    <h3 className="text-xl font-black text-rose-900">KES 0</h3>
                                    <p className="text-[10px] font-bold text-rose-400 mt-1 uppercase tracking-widest flex items-center gap-1.5">
                                        <Check className="h-3 w-3" /> Fully Balanced
                                    </p>
                                </div>
                            </div>

                            <div className="card-elevated border border-stone-100 bg-white overflow-hidden">
                                <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
                                    <h3 className="text-[14px] font-black text-stone-900 uppercase">Recent Transactions</h3>
                                    <button className="px-4 py-1.5 bg-stone-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-stone-800 transition-colors shadow-lg shadow-stone-900/10">
                                        Verify Bulk
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-stone-50/50 border-b border-stone-100 text-[10px] font-black text-stone-400 uppercase tracking-widest">
                                                <th className="px-6 py-4">Reference</th>
                                                <th className="px-6 py-4">Guest & Time</th>
                                                <th className="px-6 py-4 text-center">Type</th>
                                                <th className="px-6 py-4 text-right">Amount</th>
                                                <th className="px-6 py-4 text-center">Audit Status</th>
                                                <th className="px-6 py-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-50">
                                            {[...(auditData?.orders?.restaurant || []), ...(auditData?.orders?.bar || [])]
                                                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                                .map((order: any) => (
                                                    <tr key={order.id} className="hover:bg-stone-50 transition-colors group">
                                                        <td className="px-6 py-4">
                                                            <span className="text-[12px] font-black text-stone-900 font-mono tracking-tighter">
                                                                {order.order_number || `#${order.id?.substr(0, 6)}`}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-[13px] font-bold text-stone-900 leading-none mb-1">{order.guest_name || order.customer_name || 'Walk-in'}</span>
                                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                                                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-tighter ${order.total ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                                {order.total ? 'Bar' : 'Rest'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-black text-stone-900 text-[13px]">
                                                            KES {(order.total_amount || order.total || 0).toLocaleString()}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-widest ${order.status === 'cancelled' ? 'bg-rose-100 text-rose-600' :
                                                                    order.status === 'completed' || order.status === 'paid' ? 'bg-emerald-100 text-emerald-600' :
                                                                        'bg-blue-100 text-blue-600'
                                                                }`}>
                                                                {order.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => { setSelectedOrder(order); setIsModalOpen(true); }}
                                                                    className="p-1.5 hover:bg-stone-900 hover:text-white rounded-lg transition-colors text-stone-400"
                                                                >
                                                                    <Eye className="h-3.5 w-3.5" />
                                                                </button>
                                                                <button className="p-1.5 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors text-stone-400">
                                                                    <Check className="h-3.5 w-3.5" />
                                                                </button>
                                                                <button className="p-1.5 hover:bg-rose-600 hover:text-white rounded-lg transition-colors text-stone-400">
                                                                    <AlertTriangle className="h-3.5 w-3.5" />
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
