'use client';

import React, { useState, useEffect } from 'react';
import { restaurantAPI } from '@/lib/api';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { AlertTriangle, ShoppingBag, Filter, Download, ArrowLeft, Check, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function SalesAuditPage() {
    const router = useRouter();
    const { activeBranchId } = useBranch();
    const [orders, setOrders] = useState<any[]>([]);
    const [stats, setStats] = useState({ expected: 0, reported: 0, variance: 0 });
    const [isLoading, setIsLoading] = useState(false);

    const fetchSalesData = async () => {
        setIsLoading(true);
        try {
            // Fetch today's orders
            const ordersRes = await restaurantAPI.getTodayOrders(activeBranchId || undefined);
            if (ordersRes.success) {
                setOrders(ordersRes.data || []);

                // Calculate expected revenue from orders
                const totalRevenue = (ordersRes.data || []).reduce((sum: number, order: any) =>
                    sum + (order.total_amount || order.total || 0), 0
                );

                // Fetch daily sales report for reconciliation (reported deposits)
                const reportRes = await restaurantAPI.getDailySales(activeBranchId || undefined);
                const reported = reportRes.success ? (reportRes.data?.total_sales || totalRevenue) : totalRevenue;

                setStats({
                    expected: totalRevenue,
                    reported: reported,
                    variance: reported - totalRevenue
                });
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to fetch sales data");
        } finally {
            setIsLoading(false);
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

                        <div className={`stat-card ${stats.variance < 0 ? 'bg-rose-50/30' : ''}`}>
                            <div className="flex items-center justify-between mb-2">
                                <div className={`stat-icon ${stats.variance < 0 ? 'bg-rose-100' : 'bg-emerald-100'}`}>
                                    <AlertTriangle className={`h-5 w-5 ${stats.variance < 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
                                </div>
                                {stats.variance !== 0 && (
                                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${stats.variance < 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {stats.variance > 0 ? '+' : ''}{((stats.variance / stats.expected) * 100).toFixed(1)}%
                                    </span>
                                )}
                            </div>
                            <p className="stat-label">Variance</p>
                            <p className={`stat-value text-[22px] ${stats.variance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
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
                        <div className="overflow-x-auto">
                            <table className="w-full">
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
            </BranchAwareDashboardLayout>
        </ProtectedRoute>
    );
}
