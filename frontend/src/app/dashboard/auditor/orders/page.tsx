'use client';

import React, { useState, useEffect } from 'react';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { ShoppingBag, CreditCard, Calendar, ArrowLeft, Filter, CheckCircle, Calculator, RefreshCw, Beer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { restaurantAPI, barAPI, bookingsAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function OrdersAuditPage() {
    const router = useRouter();
    const { activeBranchId } = useBranch();
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
                res = await restaurantAPI.getOrders({ from_date, to_date, branchId: activeBranchId || undefined });
            } else if (activeTab === 'bar') {
                res = await barAPI.getOrders({ status: 'paid', from_date, to_date, branchId: activeBranchId || undefined });
            } else if (activeTab === 'bookings') {
                res = await bookingsAPI.getBookings({ checkIn: from_date, checkOut: to_date, limit: 50, branch_id: activeBranchId || undefined });
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
    }, [activeTab, filter, activeBranchId]); // Re-fetch when tab, filter, or branch changes

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
            <BranchAwareDashboardLayout
                title="Orders & Reconciliation"
                subtitle="Match orders to payments"
            >
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
                        <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                            {/* Filter Toggle */}
                            <div className="bg-stone-100 p-1 rounded-lg flex text-[11px] font-medium overflow-x-auto no-scrollbar">
                                {['daily', 'weekly', 'monthly'].map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setFilter(f as any)}
                                        className={`px-3 py-1.5 rounded-md capitalize transition-all whitespace-nowrap ${filter === f ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
                                            }`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-2">
                                <button onClick={fetchOrders} disabled={isLoading} className="p-2.5 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition-colors disabled:opacity-50">
                                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                </button>
                                <button onClick={confirmAll} className="btn-primary bg-stone-900 h-[38px] px-3 text-xs">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    <span className="hidden xs:inline">Confirm All</span>
                                    <span className="xs:hidden">All</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Main list */}
                        <div className="lg:col-span-2 card-elevated p-6">
                            <div className="overflow-x-auto no-scrollbar -mx-2 px-2 sm:mx-0 sm:px-0">
                                <div className="flex gap-1.5 p-1 bg-stone-100 rounded-lg w-fit mb-6">
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id as any)}
                                            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-[13px] font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                                                ? 'bg-white text-stone-900 shadow-sm'
                                                : 'text-stone-500 hover:text-stone-800'
                                                }`}
                                        >
                                            <tab.icon className="h-4 w-4" />
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center bg-stone-50 border border-stone-100 p-4 rounded-xl mb-6 gap-4">
                                <div>
                                    <span className="text-[11px] font-bold text-stone-500 uppercase tracking-tight block">Total Pipeline Value</span>
                                    <span className="text-[20px] sm:text-[22px] font-semibold text-stone-900">KES {stats.totalOrders.toLocaleString()}</span>
                                </div>
                                <div className="text-left xs:text-right">
                                    <span className="text-[11px] font-bold text-stone-500 uppercase tracking-tight block">Confirmation Log</span>
                                    <span className="text-[16px] sm:text-[18px] font-semibold text-stone-900">
                                        {confirmedOrders.size} <span className="text-stone-400 font-normal">/ {orders.length}</span>
                                    </span>
                                </div>
                            </div>

                            <div className="divide-y divide-stone-50">
                                {orders.length === 0 ? (
                                    <div className="py-12 text-center text-stone-400 text-sm italic">
                                        {isLoading ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <RefreshCw className="h-5 w-5 animate-spin opacity-50" />
                                                <span>Synchronizing ledger...</span>
                                            </div>
                                        ) : 'No records found for this period.'}
                                    </div>
                                ) : (
                                    orders.map((order, i) => {
                                        const isConfirmed = confirmedOrders.has(order.id);
                                        return (
                                            <div key={i} className={`py-3.5 flex flex-col xs:flex-row xs:items-center justify-between group rounded-lg px-2 transition-colors gap-3 ${isConfirmed ? 'bg-emerald-50/40' : 'hover:bg-stone-50/80'}`}>
                                                <div className="flex items-center gap-3 sm:gap-4">
                                                    <button
                                                        onClick={() => toggleConfirm(order.id)}
                                                        className={`w-5 h-5 sm:w-4.5 sm:h-4.5 rounded flex items-center justify-center transition-all ${isConfirmed ? 'bg-stone-900 border-stone-900 text-white shadow-sm' : 'border border-stone-300 text-transparent hover:border-stone-900'
                                                            }`}
                                                    >
                                                        <CheckCircle className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                                                    </button>
                                                    <div className="h-9 w-9 rounded-lg bg-stone-100 flex items-center justify-center text-stone-600 font-bold text-[13px] uppercase flex-shrink-0">
                                                        {(order.order_number || order.id).substr(0, 1)}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-stone-900 text-[13px] truncate max-w-[150px] sm:max-w-none">{order.order_number || `#${order.id.substr(0, 6)}`}</p>
                                                        <p className="text-[11px] text-stone-400 font-medium tracking-tight uppercase">
                                                            {order.branch} <span className="mx-1">•</span> {order.details}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-row xs:flex-col items-center xs:items-end justify-between xs:justify-start gap-2 xs:gap-0 pl-8 xs:pl-0">
                                                    <div className="text-left xs:text-right">
                                                        <p className="font-bold text-stone-900 text-[14px]">KES {order.amount.toLocaleString()}</p>
                                                        {order.amount !== order.paid_amount && (
                                                            <p className="text-[10px] text-rose-500 font-medium tracking-tight">Paid: {order.paid_amount?.toLocaleString() || 0}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center justify-end gap-1.5 mt-1">
                                                        <span className="text-[9px] font-bold text-stone-400 uppercase bg-stone-100 px-1.5 py-0.5 rounded tracking-tighter">{order.payment_method}</span>
                                                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full tracking-tighter ${order.status === 'Paid' || order.status === 'completed' || order.status === 'checked_out' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
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
                        <div className="card-elevated p-5 h-fit">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="p-1.5 bg-stone-100 rounded-lg">
                                    <CreditCard className="h-4 w-4 text-stone-600" />
                                </div>
                                <h3 className="text-[15px] font-semibold text-stone-900">Payment Summary</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-[13px]">
                                        <span className="text-stone-500">Gross Pipeline</span>
                                        <span className="font-bold text-stone-900">KES {stats.totalOrders.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[13px]">
                                        <span className="text-stone-500">Total Collected</span>
                                        <span className="font-bold text-emerald-600">KES {stats.totalCollected.toLocaleString()}</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="h-2 bg-stone-100 rounded-full overflow-hidden shadow-inner">
                                            <div
                                                className="h-full bg-emerald-500 transition-all duration-700 ease-out shadow-sm"
                                                style={{ width: `${stats.totalOrders > 0 ? (stats.totalCollected / stats.totalOrders * 100) : 0}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-stone-500 font-bold uppercase tracking-tight text-right">
                                            {stats.totalOrders > 0 ? ((stats.totalCollected / stats.totalOrders * 100).toFixed(1)) : 0}% Efficiency
                                        </p>
                                    </div>
                                </div>

                                <div className="p-4 bg-stone-50 border border-stone-100 rounded-xl">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-1 h-3 bg-stone-400 rounded-full" />
                                        <p className="text-[11px] font-bold text-stone-700 uppercase tracking-wide">Verification Note</p>
                                    </div>
                                    <p className="text-[12px] text-stone-500 leading-relaxed">
                                        These records are pulled from live restaurant, bar, and booking transactions.
                                        Cross-verify with physical till reports before final sign-off.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </BranchAwareDashboardLayout>
        </ProtectedRoute>
    );
}
