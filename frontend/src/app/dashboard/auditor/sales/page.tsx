'use client';

import React, { useState, useEffect } from 'react';
import { restaurantAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { AlertTriangle, ShoppingBag, Filter, Download, ArrowLeft, Check, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SalesAuditPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<any[]>([]);
    const [stats, setStats] = useState({ expected: 0, reported: 0, variance: 0 });
    const [isLoading, setIsLoading] = useState(false);

    const fetchSalesData = async () => {
        setIsLoading(true);
        try {
            // Fetch today's orders
            const ordersRes = await restaurantAPI.getTodayOrders();
            if (ordersRes.success) {
                setOrders(ordersRes.data || []);

                // Calculate expected revenue from orders
                const totalRevenue = (ordersRes.data || []).reduce((sum: number, order: any) =>
                    sum + (order.total_amount || order.total || 0), 0
                );

                // Fetch daily sales report for reconciliation (reported deposits)
                const reportRes = await restaurantAPI.getDailySales();
                const reported = reportRes.success ? (reportRes.data?.total_sales || totalRevenue) : totalRevenue; // Fallback to matched for now

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

    useEffect(() => { fetchSalesData(); }, []);

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <button onClick={() => router.back()} className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
                                <ArrowLeft className="h-5 w-5 text-stone-500" />
                            </button>
                            <div>
                                <h1 className="text-[22px] font-semibold text-stone-900">Sales Confirmation</h1>
                                <p className="text-stone-500 text-sm">Verify daily transactions</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={fetchSalesData} disabled={isLoading} className="btn-secondary">
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span>Refresh</span>
                            </button>
                            <button className="btn-primary bg-emerald-600 hover:bg-emerald-700">
                                <Check className="h-4 w-4" />
                                <span>Confirm All</span>
                            </button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="stat-card border-l-4 border-l-emerald-500">
                            <p className="stat-label">Expected Revenue</p>
                            <p className="stat-value text-emerald-700">KES {stats.expected.toLocaleString()}</p>
                        </div>
                        <div className="stat-card border-l-4 border-l-blue-500">
                            <p className="stat-label">Reported Deposits</p>
                            <p className="stat-value text-blue-700">KES {stats.reported.toLocaleString()}</p>
                        </div>
                        <div className={`stat-card border-l-4 ${stats.variance < 0 ? 'border-l-red-500 bg-red-50/50' : 'border-l-emerald-500 bg-emerald-50/50'}`}>
                            <div className="flex justify-between">
                                <div>
                                    <p className={`stat-label ${stats.variance < 0 ? 'text-red-700' : 'text-emerald-700'}`}>Variance</p>
                                    <p className={`stat-value ${stats.variance < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                                        {stats.variance > 0 ? '+' : ''}KES {stats.variance.toLocaleString()}
                                    </p>
                                </div>
                                {stats.variance !== 0 && <AlertTriangle className={`h-5 w-5 ${stats.variance < 0 ? 'text-red-500' : 'text-emerald-500'}`} />}
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="card-elevated overflow-hidden">
                        <div className="p-4 border-b border-stone-100 flex justify-between items-center">
                            <h3 className="font-semibold text-stone-900">Today's Transactions</h3>
                            <button className="text-sm text-stone-500 hover:text-stone-900 flex items-center gap-1">
                                <Download className="h-4 w-4" /> Export
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-stone-50 text-stone-500 font-medium">
                                    <tr>
                                        <th className="px-4 py-3">Order #</th>
                                        <th className="px-4 py-3">Details</th>
                                        <th className="px-4 py-3 text-right">Amount</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {orders.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-stone-500 italic">
                                                No transactions found for today.
                                            </td>
                                        </tr>
                                    ) : (
                                        orders.map((order) => (
                                            <tr key={order.id} className="hover:bg-stone-50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-stone-900">{order.order_number || order.id?.substr(0, 8)}</td>
                                                <td className="px-4 py-3">
                                                    <div className="text-xs text-stone-500">
                                                        <span className="font-medium text-stone-700">{order.guest_name || order.customer_name || 'Walk-in Guest'}</span>
                                                        <span className="mx-1">•</span>
                                                        {new Date(order.created_at).toLocaleTimeString()}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium">KES {(order.total_amount || order.total || 0).toLocaleString()}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                                            order.status === 'completed' || order.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                                                                'bg-amber-100 text-amber-700'
                                                        }`}>{order.status}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button className="p-1 hover:bg-stone-200 rounded text-emerald-600" title="Confirm"><Check className="h-4 w-4" /></button>
                                                        <button className="p-1 hover:bg-stone-200 rounded text-red-600" title="Flag Issue"><X className="h-4 w-4" /></button>
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
            </DashboardLayout>
        </ProtectedRoute>
    );
}
