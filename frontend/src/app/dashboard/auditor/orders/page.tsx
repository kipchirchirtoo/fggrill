'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { ShoppingBag, CreditCard, Calendar, ArrowLeft, Filter, CheckCircle, Calculator, RefreshCw, Beer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { restaurantAPI, barAPI, bookingsAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function OrdersAuditPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'restaurant' | 'bar' | 'bookings'>('restaurant');
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [stats, setStats] = useState({ totalOrders: 0, totalCollected: 0 });
    const [filter, setFilter] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const [confirmedOrders, setConfirmedOrders] = useState<Set<string>>(new Set());

    const getDateRange = (filterType: string) => {
        const to = new Date();
        const from = new Date();
        if (filterType === 'weekly') {
            from.setDate(to.getDate() - 7);
        } else if (filterType === 'monthly') {
            from.setDate(1); // 1st of current month
        }
        // for 'daily', from = to = today
        return {
            from_date: from.toISOString().split('T')[0],
            to_date: to.toISOString().split('T')[0]
        };
    };

    const fetchOrders = async () => {
        setIsLoading(true);
        setOrders([]); // Clear previous
        try {
            const { from_date, to_date } = getDateRange(filter);
            let res;

            if (activeTab === 'restaurant') {
                res = await restaurantAPI.getOrders({ from_date, to_date });
            } else if (activeTab === 'bar') {
                res = await barAPI.getOrders({ status: 'paid', from_date, to_date }); // Prioritize paid but maybe allow all for audit
            } else if (activeTab === 'bookings') {
                res = await bookingsAPI.getBookings({ checkIn: from_date, checkOut: to_date, limit: 50 });
            }

            if (res && res.success) {
                // Normalize data structure
                const data = (res.data || []).map((item: any) => ({
                    id: item.id,
                    order_number: item.order_number || item.id, // Bookings might not have order_number
                    branch: item.branch_name || 'Main', // Adjust based on actual API
                    amount: item.total_amount || item.total || 0,
                    paid_amount: item.amount_paid ?? (item.status === 'Paid' || item.status === 'completed' ? (item.total_amount || item.total) : 0),
                    status: item.status,
                    payment_method: item.payment_method || 'Cash', // Default mock if missing
                    type: activeTab,
                    details: activeTab === 'bookings' ? `${item.guest_name} (Room ${item.room_number})` : `Table ${item.table_number || 'N/A'}`
                }));
                setOrders(data);

                // Reset confirmed if filter changes (optional, but safer)
                // setConfirmedOrders(new Set()); 

                // Recalculate stats based on fetched data
                const total = data.reduce((sum: number, o: any) => sum + o.amount, 0);
                // Calculate total collected based on paid_amount
                const collected = data.reduce((sum: number, o: any) => sum + (o.paid_amount || 0), 0);

                setStats({ totalOrders: total, totalCollected: collected });
            }
        } catch (e) {
            console.error(e);
            toast.error(`Failed to fetch ${activeTab} data`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [activeTab, filter]); // Re-fetch when tab or filter changes

    const toggleConfirm = (id: string) => {
        const newSet = new Set(confirmedOrders);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setConfirmedOrders(newSet);
    };

    const confirmAll = () => {
        const allIds = orders.map(o => o.id);
        setConfirmedOrders(new Set(allIds));
        toast.success("All items marked as confirmed");
    };

    const tabs = [
        { id: 'restaurant', label: 'Restaurant', icon: ShoppingBag },
        { id: 'bar', label: 'Bar', icon: Beer },
        { id: 'bookings', label: 'Bookings', icon: Calendar },
    ];

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
                                <h1 className="text-[22px] font-semibold text-stone-900">Orders & Reconciliation</h1>
                                <p className="text-stone-500 text-sm">Match orders to payments</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Filter Toggle */}
                            <div className="bg-stone-100 p-1 rounded-lg flex text-xs font-medium">
                                {['daily', 'weekly', 'monthly'].map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setFilter(f as any)}
                                        className={`px-3 py-1.5 rounded-md capitalize transition-all ${filter === f ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
                                            }`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>

                            <button onClick={fetchOrders} disabled={isLoading} className="btn-secondary">
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                            <button onClick={confirmAll} className="btn-primary bg-stone-900">
                                <CheckCircle className="h-4 w-4" />
                                <span>Confirm All</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main list */}
                        <div className="lg:col-span-2 card-elevated p-6">
                            <div className="flex gap-2 mb-6 border-b border-stone-100 pb-1 overflow-x-auto">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                                            ? 'bg-stone-100 text-stone-900'
                                            : 'text-stone-500 hover:text-stone-900'
                                            }`}
                                    >
                                        <tab.icon className="h-4 w-4" />
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex justify-between items-center bg-stone-50 p-4 rounded-lg mb-4">
                                <div>
                                    <span className="text-sm font-medium text-stone-600 block">Total Value ({activeTab})</span>
                                    <span className="text-xl font-bold text-stone-900">KES {stats.totalOrders.toLocaleString()}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-medium text-stone-600 block">Confirmed</span>
                                    <span className="text-lg font-bold text-emerald-600">
                                        {confirmedOrders.size} / {orders.length}
                                    </span>
                                </div>
                            </div>

                            <div className="divide-y divide-stone-100">
                                {orders.length === 0 ? (
                                    <p className="py-8 text-center text-stone-400 italic">
                                        {isLoading ? 'Loading records...' : 'No records found for this period.'}
                                    </p>
                                ) : (
                                    orders.map((order, i) => {
                                        const isConfirmed = confirmedOrders.has(order.id);
                                        return (
                                            <div key={i} className={`py-3 flex items-center justify-between group rounded px-2 transition-colors ${isConfirmed ? 'bg-emerald-50/50' : 'hover:bg-stone-50'}`}>
                                                <div className="flex items-center gap-4">
                                                    <button
                                                        onClick={() => toggleConfirm(order.id)}
                                                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isConfirmed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-300 text-transparent hover:border-emerald-500'
                                                            }`}
                                                    >
                                                        <CheckCircle className="h-3.5 w-3.5" />
                                                    </button>

                                                    <div className="h-9 w-9 rounded-lg bg-white border border-stone-200 flex items-center justify-center text-stone-500 font-bold text-xs">
                                                        {(order.order_number || order.id).substr(0, 1)}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-stone-900 text-sm">{order.order_number || order.id}</p>
                                                        <p className="text-xs text-stone-500">{order.branch} • {order.details}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-medium text-stone-900 text-sm">KES {order.amount.toLocaleString()}</p>
                                                    {order.amount !== order.paid_amount && (
                                                        <p className="text-[10px] text-stone-500">Paid: {order.paid_amount?.toLocaleString() || 0}</p>
                                                    )}
                                                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                                        <span className="text-[10px] text-stone-400 uppercase">{order.payment_method}</span>
                                                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${order.status === 'Paid' || order.status === 'completed' || order.status === 'checked_out' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                                            }`}>{order.status}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>

                        {/* Summary / Reconciliation Card */}
                        <div className="card-elevated p-6 h-fit">
                            <h3 className="section-title mb-4 flex items-center gap-2">
                                <CreditCard className="h-4 w-4" /> Payment Summary
                            </h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-stone-600">Total Orders</span>
                                        <span className="font-medium">KES {stats.totalOrders.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-stone-600">Total Collected</span>
                                        <span className="font-medium text-emerald-600">KES {stats.totalCollected.toLocaleString()}</span>
                                    </div>
                                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden mt-2">
                                        <div
                                            className="h-full bg-emerald-500 transition-all duration-500"
                                            style={{ width: `${stats.totalOrders > 0 ? (stats.totalCollected / stats.totalOrders * 100) : 0}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-stone-400 text-right mt-1">
                                        {stats.totalOrders > 0 ? ((stats.totalCollected / stats.totalOrders * 100).toFixed(1)) : 0}% Collected
                                    </p>
                                </div>

                                <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                                    <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wide mb-2">Note</p>
                                    <p className="text-xs text-amber-800">
                                        Transactions displayed here are fetched directly from live records.
                                        Ensure physical receipts match these system totals.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
