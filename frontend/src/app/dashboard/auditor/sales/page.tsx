'use client';

import React, { useState, useEffect } from 'react';
import { auditAPI, auditorReportsAPI } from '@/lib/api';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { AlertTriangle, ShoppingBag, Filter, Download, ArrowLeft, Check, X, RefreshCw, Eye, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

const OrderDetailsModal = ({ order, isOpen, onClose }: { order: any, isOpen: boolean, onClose: () => void }) => {
    if (!isOpen || !order) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-stone-100 animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                    <div>
                        <h3 className="text-[16px] font-bold text-stone-900">Order Details</h3>
                        <p className="text-[11px] text-stone-500">{order.order_number || `#${order.id?.substr(0, 8)}`}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
                        <X className="h-4 w-4 text-stone-500" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Guest</p>
                            <p className="text-[13px] font-medium text-stone-900">{order.guest_name || 'Walk-in Guest'}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Time</p>
                            <p className="text-[13px] font-medium text-stone-900">{new Date(order.created_at).toLocaleString()}</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Items Ordered</p>
                        <div className="bg-stone-50 rounded-xl border border-stone-100 divide-y divide-stone-100 overflow-hidden">
                            {(order.items || []).length > 0 ? (
                                order.items.map((item: any, idx: number) => (
                                    <div key={idx} className="px-4 py-2.5 flex justify-between items-center">
                                        <div>
                                            <p className="text-[13px] font-medium text-stone-800">{item.menu_item?.name || item.item_name || 'Unknown Item'}</p>
                                            <p className="text-[11px] text-stone-400">Qty: {item.quantity}</p>
                                        </div>
                                        <p className="text-[13px] font-bold text-stone-900">KES {(item.quantity * (item.unit_price || item.price || 0)).toLocaleString()}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="px-4 py-8 text-center text-stone-400 text-[12px] italic">
                                    No item breakdown available for this order.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-stone-100 flex justify-between items-center text-[15px]">
                        <span className="font-medium text-stone-500">Total Amount</span>
                        <span className="font-bold text-stone-900">KES {(order.total_amount || order.total || 0).toLocaleString()}</span>
                    </div>
                </div>

                <div className="px-6 py-4 bg-stone-50/50 flex justify-end gap-3">
                    <button onClick={onClose} className="btn-secondary text-[12px]">Close</button>
                    <button className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-[12px] py-1.5 px-4 shadow-sm">
                        <Check className="h-3.5 w-3.5" />
                        <span>Confirm Sale</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function SalesAuditPage() {
    const router = useRouter();
    const { activeBranchId } = useBranch();
    const [orders, setOrders] = useState<any[]>([]);
    const [stats, setStats] = useState({ expected: 0, reported: 0, variance: 0, voidedCount: 0 });
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchSalesData = async () => {
        setIsLoading(true);
        try {
            const today = new Date();
            const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
            const endDate = new Date().toISOString();

            // Use the new audit API endpoint
            const res = await auditAPI.verifySales({
                branch_id: activeBranchId === null || activeBranchId === 0 ? undefined : activeBranchId,
                start_date: startDate,
                end_date: endDate
            });

            if (res.success && res.data) {
                // Extract orders from both restaurant and bar
                const allOrders = [
                    ...(res.data.restaurant_orders || []),
                    ...(res.data.bar_orders || [])
                ];
                setOrders(allOrders);

                // Calculate stats
                const totalRevenue = allOrders
                    .filter((o: any) => o.status !== 'cancelled')
                    .reduce((sum: number, order: any) => sum + (order.total_amount || order.total || 0), 0);

                const voidedCount = allOrders.filter((o: any) => o.status === 'cancelled').length;

                setStats({
                    expected: totalRevenue,
                    reported: totalRevenue, // In real scenario, this would come from payment reconciliation
                    variance: 0,
                    voidedCount
                });
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to fetch sales data");
        } finally {
            setIsLoading(false);
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const today = new Date();
            const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().split('T')[0];
            const endDate = today.toISOString().split('T')[0];

            await auditorReportsAPI.exportBrandedPdf('revenue_reconciliation', {
                branch_id: activeBranchId || 1,
                start_date: startDate,
                end_date: endDate
            });
            toast.success("Sales report exported successfully");
        } catch (e) {
            console.error(e);
            toast.error("Failed to export report");
        } finally {
            setIsExporting(false);
        }
    };

    useEffect(() => { fetchSalesData(); }, [activeBranchId]);

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <BranchAwareDashboardLayout
                title="Sales Confirmation"
                subtitle="Verify daily transactions"
            >
                <div className="space-y-6">
                    {/* Actions */}
                    <div className="flex justify-end gap-2">
                        <button onClick={handleExport} disabled={isExporting} className="btn-primary bg-blue-600 hover:bg-blue-700">
                            <FileDown className={`h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} />
                            <span>{isExporting ? 'Exporting...' : 'Export PDF'}</span>
                        </button>
                        <button onClick={() => router.back()} className="btn-secondary">
                            <ArrowLeft className="h-4 w-4" />
                            <span>Back</span>
                        </button>
                        <button onClick={fetchSalesData} disabled={isLoading} className="btn-secondary">
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            <span>Refresh</span>
                        </button>
                        <button className="btn-primary bg-emerald-600 hover:bg-emerald-700">
                            <Check className="h-4 w-4" />
                            <span>Confirm All</span>
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="stat-card">
                            <div className="flex items-center justify-between mb-2">
                                <div className="stat-icon bg-emerald-100">
                                    <ShoppingBag className="h-5 w-5 text-emerald-600" />
                                </div>
                            </div>
                            <p className="stat-label">Expected Revenue</p>
                            <p className="stat-value text-[22px] text-stone-900">KES {stats.expected.toLocaleString()}</p>
                        </div>

                        <div className="stat-card">
                            <div className="flex items-center justify-between mb-2">
                                <div className="stat-icon bg-blue-100">
                                    <Download className="h-5 w-5 text-blue-600" />
                                </div>
                            </div>
                            <p className="stat-label">Reported Deposits</p>
                            <p className="stat-value text-[22px] text-stone-900">KES {stats.reported.toLocaleString()}</p>
                        </div>

                        <div className={`stat-card transition-colors ${stats.variance < 0 ? 'bg-rose-600 text-white border-none shadow-lg shadow-rose-900/20' : stats.variance > 0 ? 'bg-emerald-50/30' : ''}`}>
                            <div className="flex items-center justify-between mb-2">
                                <div className={`stat-icon ${stats.variance < 0 ? 'bg-rose-500 text-white' : 'bg-emerald-100'}`}>
                                    <AlertTriangle className={`h-5 w-5 ${stats.variance < 0 ? 'text-white' : 'text-emerald-600'}`} />
                                </div>
                                {stats.variance !== 0 && (
                                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${stats.variance < 0 ? 'bg-rose-500 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {stats.variance > 0 ? '+' : ''}{((stats.variance / stats.expected) * 100).toFixed(1)}%
                                    </span>
                                )}
                            </div>
                            <p className={`stat-label ${stats.variance < 0 ? 'text-rose-100' : ''}`}>Variance</p>
                            <p className={`stat-value text-[22px] ${stats.variance < 0 ? 'text-white' : 'text-emerald-600'}`}>
                                KES {stats.variance.toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="card-elevated">
                        <div className="px-5 py-4 border-b border-stone-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-[15px] font-semibold text-stone-900">Today's Transactions</h3>
                                <p className="text-[11px] text-stone-500 mt-0.5">Live restaurant and bar orders</p>
                            </div>
                            <button className="text-[12px] font-medium text-stone-600 hover:text-stone-900 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-stone-100 transition-colors">
                                <Download className="h-3.5 w-3.5" /> Export
                            </button>
                        </div>
                        <div className="overflow-x-auto -mx-6 sm:mx-0">
                            <div className="inline-block min-w-full align-middle">
                                <div className="overflow-hidden">
                                    <table className="min-w-full w-full">
                                        <thead>
                                            <tr className="border-b border-stone-100">
                                                <th className="text-left py-3 px-5 text-[11px] font-medium text-stone-500 uppercase tracking-wider">Order</th>
                                                <th className="text-left py-3 px-5 text-[11px] font-medium text-stone-500 uppercase tracking-wider">Guest & Time</th>
                                                <th className="text-right py-3 px-5 text-[11px] font-medium text-stone-500 uppercase tracking-wider">Amount</th>
                                                <th className="text-center py-3 px-5 text-[11px] font-medium text-stone-500 uppercase tracking-wider">Status</th>
                                                <th className="text-right py-3 px-5 text-[11px] font-medium text-stone-500 uppercase tracking-wider tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-50">
                                            {orders.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="py-12 text-center text-stone-400 text-sm italic">
                                                        {isLoading ? (
                                                            <div className="flex flex-col items-center gap-2">
                                                                <RefreshCw className="h-5 w-5 animate-spin opacity-50" />
                                                                <span>Syncing transaction data...</span>
                                                            </div>
                                                        ) : 'No transactions found for today.'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                orders.map((order) => (
                                                    <tr key={order.id} className="hover:bg-stone-50 transition-colors group">
                                                        <td className="py-3 px-5 font-medium text-stone-900 text-[13px]">
                                                            {order.order_number || `#${order.id?.substr(0, 6)}`}
                                                        </td>
                                                        <td className="py-3 px-5">
                                                            <div className="flex flex-col">
                                                                <span className="text-[13px] text-stone-800">{order.guest_name || order.customer_name || 'Walk-in Guest'}</span>
                                                                <span className="text-[11px] text-stone-400 font-mono">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-5 text-right font-semibold text-stone-900 text-[13px]">
                                                            KES {(order.total_amount || order.total || 0).toLocaleString()}
                                                        </td>
                                                        <td className="py-3 px-5 text-center">
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${order.status === 'cancelled' ? 'bg-rose-100 text-rose-700' :
                                                                order.status === 'completed' || order.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                                                                    'bg-amber-100 text-amber-700'
                                                                }`}>
                                                                {order.status}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-5 text-right">
                                                            <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedOrder(order);
                                                                        setIsModalOpen(true);
                                                                    }}
                                                                    className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors" title="View Items"
                                                                >
                                                                    <Eye className="h-3.5 w-3.5" />
                                                                </button>
                                                                <button className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600 transition-colors" title="Confirm Details">
                                                                    <Check className="h-3.5 w-3.5" />
                                                                </button>
                                                                <button className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-600 transition-colors" title="Flag Issue">
                                                                    <X className="h-3.5 w-3.5" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    <OrderDetailsModal
                        isOpen={isModalOpen}
                        order={selectedOrder}
                        onClose={() => setIsModalOpen(false)}
                    />
                </div>
            </BranchAwareDashboardLayout>
        </ProtectedRoute>
    );
}
