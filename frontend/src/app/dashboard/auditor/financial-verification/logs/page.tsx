'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeft, Search, Filter, Calendar,
    RefreshCw, Download, ChevronRight,
    Wallet, Smartphone, CreditCard, Building2,
    CheckCircle2, AlertCircle, Clock
} from 'lucide-react';
import { auditAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function FinancialLogsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(true);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);

    // Filters
    const dateParam = searchParams.get('date');
    const [selectedDate, setSelectedDate] = useState(dateParam || new Date().toISOString().split('T')[0]);
    const [searchTerm, setSearchTerm] = useState('');
    const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await auditAPI.verifyFinances({
                date: selectedDate,
                limit: 'all' // Fetch all logs
            });

            if (res.success && res.data?.recent_transactions) {
                setTransactions(res.data.recent_transactions);
                setFilteredTransactions(res.data.recent_transactions);
            } else {
                toast.error(res.message || 'Failed to fetch logs');
            }
        } catch (e) {
            console.error("Logs fetch failed:", e);
            toast.error('An error occurred while fetching logs');
        } finally {
            setIsLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Apply filters
    useEffect(() => {
        let result = transactions;

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(t =>
                (t.reference_number?.toLowerCase() || '').includes(lowerTerm) ||
                (t.cashier_name?.toLowerCase() || '').includes(lowerTerm) ||
                (t.branch_name?.toLowerCase() || '').includes(lowerTerm) ||
                (String(t.amount) || '').includes(lowerTerm)
            );
        }

        if (paymentMethodFilter !== 'all') {
            if (paymentMethodFilter === 'mpesa') {
                result = result.filter(t => t.payment_method?.toLowerCase().includes('mpesa'));
            } else if (paymentMethodFilter === 'card') {
                result = result.filter(t => t.payment_method?.toLowerCase().includes('card'));
            } else if (paymentMethodFilter === 'cash') {
                result = result.filter(t => t.payment_method === 'cash');
            } else if (paymentMethodFilter === 'pool') {
                result = result.filter(t => t.is_pool_token);
            }
        }

        if (statusFilter !== 'all') {
            result = result.filter(t => t.status === statusFilter);
        }

        setFilteredTransactions(result);
    }, [transactions, searchTerm, paymentMethodFilter, statusFilter]);

    const getMethodIcon = (method: string, isPool: boolean) => {
        if (isPool) return <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600"><Wallet className="h-4 w-4" /></div>;
        if (method === 'cash') return <div className="p-1.5 rounded-lg bg-stone-100 text-stone-600"><Wallet className="h-4 w-4" /></div>;
        if (method?.includes('mpesa')) return <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600"><Smartphone className="h-4 w-4" /></div>;
        return <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><CreditCard className="h-4 w-4" /></div>;
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6 pb-12">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => router.back()}
                                className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                            >
                                <ArrowLeft className="h-5 w-5 text-stone-500" />
                            </button>
                            <div>
                                <h1 className="page-title">Financial Gateway Logs</h1>
                                <p className="page-subtitle">Full unified transaction history for {format(new Date(selectedDate), 'MMMM d, yyyy')}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-xl px-4 py-1.5 shadow-sm h-11">
                                <Calendar className="h-4 w-4 text-stone-400" />
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="text-[13px] font-bold text-stone-800 bg-transparent outline-none w-32 cursor-pointer"
                                />
                            </div>
                            <button
                                onClick={fetchData}
                                className="btn-white h-11 px-4"
                            >
                                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                                Sync
                            </button>
                            <button className="btn-primary h-11 px-4">
                                <Download className="h-4 w-4 mr-2" />
                                Export
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                            <input
                                type="text"
                                placeholder="Search reference, cashier, or branch..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-11 pl-10 pr-4 rounded-xl border border-stone-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all"
                            />
                        </div>
                        <select
                            value={paymentMethodFilter}
                            onChange={(e) => setPaymentMethodFilter(e.target.value)}
                            className="h-11 px-4 rounded-xl border border-stone-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-stone-900/10 bg-white"
                        >
                            <option value="all">All Payment Methods</option>
                            <option value="cash">Cash</option>
                            <option value="mpesa">M-PESA</option>
                            <option value="card">Card / Bank</option>
                            <option value="pool">Pool Tokens</option>
                        </select>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="h-11 px-4 rounded-xl border border-stone-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-stone-900/10 bg-white"
                        >
                            <option value="all">All Statuses</option>
                            <option value="completed">Completed</option>
                            <option value="pending">Pending</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>

                    {/* Table */}
                    <div className="card-elevated bg-white overflow-hidden shadow-sm border border-stone-200">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center p-20">
                                <RefreshCw className="h-8 w-8 animate-spin text-stone-300 mb-2" />
                                <p className="text-sm font-medium text-stone-400">Loading full log...</p>
                            </div>
                        ) : filteredTransactions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-20 opacity-60">
                                <Filter className="h-10 w-10 text-stone-200 mb-4" />
                                <p className="text-sm font-bold text-stone-400">No transactions match your filters</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-stone-50 border-b border-stone-100">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider">Transaction Ref</th>
                                            <th className="px-6 py-4 text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider">Method</th>
                                            <th className="px-6 py-4 text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider">Amount</th>
                                            <th className="px-6 py-4 text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider">Branch / Cashier</th>
                                            <th className="px-6 py-4 text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-4 text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider">Time</th>
                                            <th className="px-6 py-4 text-right text-[11px] font-bold text-stone-400 uppercase tracking-wider">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {filteredTransactions.map((tx, i) => (
                                            <tr key={tx.id || i} className="group hover:bg-stone-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        {getMethodIcon(tx.payment_method, tx.is_pool_token)}
                                                        <div>
                                                            <p className="text-[13px] font-bold text-stone-900 font-mono">{tx.reference_number}</p>
                                                            {tx.is_pool_token && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">POOL TOKEN</span>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-[13px] font-medium text-stone-700 capitalize">{tx.payment_method?.replace('_', ' ')}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-[13px] font-bold text-stone-900">KES {Number(tx.amount).toLocaleString()}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[13px] font-medium text-stone-900 flex items-center gap-1">
                                                            <Building2 className="h-3 w-3 text-stone-400" /> {tx.branch_name}
                                                        </span>
                                                        <span className="text-[11px] text-stone-500 mt-0.5 ml-4">
                                                            by {tx.cashier_name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${tx.status === 'completed' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                                            tx.status === 'cancelled' ? 'bg-rose-50 border-rose-100 text-rose-700' :
                                                                'bg-amber-50 border-amber-100 text-amber-700'
                                                        }`}>
                                                        {tx.status === 'completed' ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                                        <span className="text-[10px] font-bold uppercase tracking-wide">{tx.status}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1.5 text-stone-500">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        <span className="text-[12px] font-medium">
                                                            {format(new Date(tx.created_at), 'HH:mm:ss')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {tx.id ? (
                                                        <button
                                                            onClick={() => router.push(`/dashboard/auditor/financial-verification/logs/${tx.id}?date=${selectedDate}`)}
                                                            className="p-2 hover:bg-stone-200 rounded-lg transition-colors text-stone-400 hover:text-stone-900"
                                                        >
                                                            <ChevronRight className="h-4 w-4" />
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] text-stone-300 italic">No ID</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
