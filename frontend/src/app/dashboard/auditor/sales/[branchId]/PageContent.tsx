'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { auditAPI, auditorReportsAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import {
    AlertTriangle, ShoppingBag, Filter, Download,
    ArrowLeft, Check, X, RefreshCw, Eye, FileDown,
    Building2, TrendingUp, BarChart3, ChevronRight,
    Utensils, Beer, ShieldCheck, CreditCard, Smartphone,
    DollarSign, Wallet
} from 'lucide-react';
import { toast } from 'sonner';

import { OrderDetailsModal } from '@/components/auditor/OrderDetailsModal';

export default function BranchSalesDetailPage() {
    const router = useRouter();
    const params = useParams();
    const branchId = params?.branchId as string;

    const [auditData, setAuditData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'restaurant' | 'bar' | 'pos' | 'payments'>('restaurant');

    const [dateRange, setDateRange] = useState({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await auditAPI.verifySales({
                branch_id: parseInt(branchId),
                start_date: dateRange.startDate,
                end_date: dateRange.endDate
            });

            if (res.success) {
                setAuditData(res);
            } else {
                toast.error(res.message || 'Failed to fetch sales audit data');
            }
        } catch (e) {
            console.error(e);
            toast.error("Network error while syncing data");
        } finally {
            setIsLoading(false);
        }
    }, [branchId, dateRange]);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            await auditorReportsAPI.exportBrandedPdf('revenue_reconciliation', {
                branch_id: parseInt(branchId),
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

    const restaurantOrders = auditData?.orders?.restaurant || [];
    const barOrders = auditData?.orders?.bar || [];
    const posTransactions = auditData?.pos_transactions || [];
    const payments = auditData?.payments || [];

    const totalExpected = (auditData?.data?.restaurant?.total_value || 0) + (auditData?.data?.bar?.total_value || 0) + (auditData?.data?.pos?.total_value || 0);
    const voidedCount = (auditData?.data?.restaurant?.voided || 0) + (auditData?.data?.bar?.voided || 0);

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6 pb-12">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <button onClick={() => router.back()} className="p-2 hover:bg-stone-100 rounded-lg transition-all text-stone-400 hover:text-stone-900 border border-transparent hover:border-stone-200">
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                            <div>
                                <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Branch Sales Audit</h1>
                                <p className="text-stone-500 mt-0.5">Comprehensive financial verification for Branch #{branchId}</p>
                            </div>
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

                    {/* Statistics */}
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
                            <p className="stat-value">{auditData?.data?.restaurant?.total_orders || 0}</p>
                            <p className="stat-label">Restaurant Orders</p>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon bg-amber-50 text-amber-600">
                                <Beer className="h-5 w-5" />
                            </div>
                            <p className="stat-value">{auditData?.data?.bar?.total_orders || 0}</p>
                            <p className="stat-label">Bar Orders</p>
                        </div>
                        <div className="stat-card">
                            <div className={`stat-icon ${voidedCount > 0 ? 'bg-rose-50 text-rose-500' : 'bg-stone-50 text-stone-500'}`}>
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <p className={`stat-value ${voidedCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{voidedCount}</p>
                            <p className="stat-label">Voids</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 border-b border-stone-200 px-1 overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => setActiveTab('restaurant')}
                            className={`px-4 py-3 font-semibold text-sm transition-all border-b-2 whitespace-nowrap ${activeTab === 'restaurant' ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400 hover:text-stone-600 hover:border-stone-200'}`}
                        >
                            <Utensils className="h-4 w-4 inline mr-2" />
                            Restaurant ({restaurantOrders.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('bar')}
                            className={`px-4 py-3 font-semibold text-sm transition-all border-b-2 whitespace-nowrap ${activeTab === 'bar' ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400 hover:text-stone-600 hover:border-stone-200'}`}
                        >
                            <Beer className="h-4 w-4 inline mr-2" />
                            Bar & Lounge ({barOrders.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('pos')}
                            className={`px-4 py-3 font-semibold text-sm transition-all border-b-2 whitespace-nowrap ${activeTab === 'pos' ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400 hover:text-stone-600 hover:border-stone-200'}`}
                        >
                            <Smartphone className="h-4 w-4 inline mr-2" />
                            POS Transactions ({posTransactions.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('payments')}
                            className={`px-4 py-3 font-semibold text-sm transition-all border-b-2 whitespace-nowrap ${activeTab === 'payments' ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400 hover:text-stone-600 hover:border-stone-200'}`}
                        >
                            <CreditCard className="h-4 w-4 inline mr-2" />
                            Payments ({payments.length})
                        </button>
                    </div>

                    {/* Transactions Table */}
                    <div className="card-elevated overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-stone-50/50 border-b border-stone-100">
                                        <th className="px-5 py-3.5 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Reference</th>
                                        <th className="px-5 py-3.5 text-[11px] font-bold text-stone-400 uppercase tracking-widest">{activeTab === 'payments' ? 'Description' : 'Guest & Time'}</th>
                                        <th className="px-5 py-3.5 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-center">{activeTab === 'payments' ? 'Method' : 'Type'}</th>
                                        <th className="px-5 py-3.5 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-right">Amount</th>
                                        <th className="px-5 py-3.5 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-center">Status</th>
                                        <th className="px-5 py-3.5 text-[11px] font-bold text-stone-400 uppercase tracking-widest"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {activeTab === 'restaurant' && restaurantOrders.map((order: any) => (
                                        <tr key={order.id} className="hover:bg-stone-50/50 transition-colors group">
                                            <td className="px-5 py-4">
                                                <span className="text-[13px] font-bold text-stone-900 tracking-tight">
                                                    {order.order_number || `#${order.id?.substr(0, 6)}`}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-[13px] font-semibold text-stone-900">{order.guest_name || 'Walk-in'}</span>
                                                    <span className="text-[10px] text-stone-400 uppercase font-bold tracking-widest">
                                                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">Restaurant</span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <span className="text-[13px] font-bold text-stone-900">KES {(order.total_amount || 0).toLocaleString()}</span>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${order.status === 'cancelled' ? 'text-rose-500 bg-rose-50 border-rose-100' :
                                                    order.status === 'completed' || order.status === 'paid' ? 'text-emerald-500 bg-emerald-50 border-emerald-100' :
                                                        'text-blue-500 bg-blue-50 border-blue-100'
                                                    }`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <button
                                                    onClick={() => { setSelectedOrder(order); setIsModalOpen(true); }}
                                                    className="p-1.5 hover:bg-white hover:shadow-sm border border-transparent hover:border-stone-200 rounded-md transition-all text-stone-300 hover:text-stone-600"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}

                                    {activeTab === 'bar' && barOrders.map((order: any) => (
                                        <tr key={order.id} className="hover:bg-stone-50/50 transition-colors group">
                                            <td className="px-5 py-4">
                                                <span className="text-[13px] font-bold text-stone-900 tracking-tight">
                                                    {order.order_number || `#${order.id?.substr(0, 6)}`}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-[13px] font-semibold text-stone-900">{order.customer_name || 'Walk-in'}</span>
                                                    <span className="text-[10px] text-stone-400 uppercase font-bold tracking-widest">
                                                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">Bar</span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <span className="text-[13px] font-bold text-stone-900">KES {(order.total || 0).toLocaleString()}</span>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${order.status === 'cancelled' ? 'text-rose-500 bg-rose-50 border-rose-100' :
                                                    order.status === 'completed' || order.status === 'paid' ? 'text-emerald-500 bg-emerald-50 border-emerald-100' :
                                                        'text-blue-500 bg-blue-50 border-blue-100'
                                                    }`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <button
                                                    onClick={() => { setSelectedOrder(order); setIsModalOpen(true); }}
                                                    className="p-1.5 hover:bg-white hover:shadow-sm border border-transparent hover:border-stone-200 rounded-md transition-all text-stone-300 hover:text-stone-600"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}

                                    {activeTab === 'pos' && posTransactions.map((txn: any) => (
                                        <tr key={txn.id} className="hover:bg-stone-50/50 transition-colors group">
                                            <td className="px-5 py-4">
                                                <span className="text-[13px] font-bold text-stone-900 tracking-tight">
                                                    {txn.transaction_id || `#${txn.id?.substr(0, 6)}`}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-[13px] font-semibold text-stone-900">{txn.customer_name || 'POS Sale'}</span>
                                                    <span className="text-[10px] text-stone-400 uppercase font-bold tracking-widest">
                                                        {new Date(txn.transaction_date || txn.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 bg-blue-50 px-2 py-1 rounded-full border border-blue-100">POS</span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <span className="text-[13px] font-bold text-stone-900">KES {(txn.amount || 0).toLocaleString()}</span>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">Completed</span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <button
                                                    onClick={() => { setSelectedOrder(txn); setIsModalOpen(true); }}
                                                    className="p-1.5 hover:bg-white hover:shadow-sm border border-transparent hover:border-stone-200 rounded-md transition-all text-stone-300 hover:text-stone-600"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}

                                    {activeTab === 'payments' && payments.map((payment: any) => (
                                        <tr key={payment.id} className="hover:bg-stone-50/50 transition-colors group">
                                            <td className="px-5 py-4">
                                                <span className="text-[13px] font-bold text-stone-900 tracking-tight">
                                                    {payment.payment_reference || `#${payment.id?.substr(0, 6)}`}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-[13px] font-semibold text-stone-900">{payment.description || payment.payment_type || 'Payment'}</span>
                                                    <span className="text-[10px] text-stone-400 uppercase font-bold tracking-widest">
                                                        {new Date(payment.payment_date || payment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500 bg-purple-50 px-2 py-1 rounded-full border border-purple-100">{payment.payment_method || payment.payment_mode || 'N/A'}</span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <span className="text-[13px] font-bold text-stone-900">KES {(payment.amount || 0).toLocaleString()}</span>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${payment.status === 'completed' ? 'text-emerald-500 bg-emerald-50 border-emerald-100' : 'text-blue-500 bg-blue-50 border-blue-100'
                                                    }`}>
                                                    {payment.status || 'Recorded'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <button
                                                    onClick={() => { setSelectedOrder(payment); setIsModalOpen(true); }}
                                                    className="p-1.5 hover:bg-white hover:shadow-sm border border-transparent hover:border-stone-200 rounded-md transition-all text-stone-300 hover:text-stone-600"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}

                                    {((activeTab === 'restaurant' && restaurantOrders.length === 0) ||
                                        (activeTab === 'bar' && barOrders.length === 0) ||
                                        (activeTab === 'pos' && posTransactions.length === 0) ||
                                        (activeTab === 'payments' && payments.length === 0)) && (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-20 text-center">
                                                    {isLoading ? (
                                                        <div className="flex flex-col items-center gap-2 opacity-50">
                                                            <RefreshCw className="h-6 w-6 animate-spin text-stone-300" />
                                                            <span className="text-[11px] font-black uppercase tracking-widest text-stone-400">Loading...</span>
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