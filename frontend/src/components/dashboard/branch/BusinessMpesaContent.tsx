'use client';

import { useState, useEffect, useCallback } from 'react';
import { financeAPI } from '@/lib/api';
import {
    Calculator, Smartphone, RefreshCw, Search,
    ArrowUpRight, ArrowDownRight, CheckCircle, AlertTriangle,
    CreditCard, DollarSign, Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface BusinessMpesaContentProps {
    branchId: number | null;
    isAuditor?: boolean;
}

export function BusinessMpesaContent({ branchId, isAuditor = false }: BusinessMpesaContentProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [mpesaLogs, setMpesaLogs] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalMpesa: 0,
        totalCash: 0,
        totalRevenue: 0,
        unreconciled: 0
    });

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            if (!branchId) return;

            // In a real implementation, we'd fetch from specific endpoints
            // For now, we'll try to fetch recent payments filtered by method
            // Or use a new endpoint if available

            // Fallback to basic financials just to show something
            // Ideally passing branchId to getBranchFinancials if it supports it, or use a new method
            const res = await financeAPI.getBranchFinancials(branchId);

            if (res.success) {
                const logs = res.data.recentPayments?.filter((p: any) => p.payment_method === 'mpesa') || [];
                setMpesaLogs(logs);

                setStats({
                    totalMpesa: logs.reduce((sum: number, log: any) => sum + Number(log.amount), 0),
                    totalCash: res.data.recentPayments?.filter((p: any) => p.payment_method === 'cash')
                        .reduce((sum: number, log: any) => sum + Number(log.amount), 0) || 0,
                    totalRevenue: res.data.summary?.totalRevenue || 0,
                    unreconciled: 0 // Placeholder
                });
            }
        } catch (error) {
            console.error('Failed to load Mpesa data', error);
            toast.error('Could not load Mpesa transactions');
        } finally {
            setIsLoading(false);
        }
    }, [branchId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
                        <Calculator className="h-6 w-6 text-purple-600" />
                        {isAuditor ? 'Audit: Business & Mpesa' : 'Business & Mpesa'}
                    </h1>
                    <p className="text-stone-500">
                        {isAuditor ? 'reconciliation and revenue verification' : 'Revenue tracking and mobile money reconciliation'}
                    </p>
                </div>
                <button
                    onClick={loadData}
                    disabled={isLoading}
                    className="bg-white border border-stone-200 text-stone-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors flex items-center gap-2"
                >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                            <Smartphone className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-medium text-stone-500">Mpesa Collection</span>
                    </div>
                    <p className="text-2xl font-bold text-stone-900">{stats.totalMpesa.toLocaleString()}</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                            <DollarSign className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-medium text-stone-500">Cash Collection</span>
                    </div>
                    <p className="text-2xl font-bold text-stone-900">{stats.totalCash.toLocaleString()}</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                            <CreditCard className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-medium text-stone-500">Total Revenue</span>
                    </div>
                    <p className="text-2xl font-bold text-stone-900">{stats.totalRevenue.toLocaleString()}</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <span className="text-sm font-medium text-stone-500">Unreconciled</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-600">{stats.unreconciled}</p>
                </div>
            </div>

            {/* Transactions Table */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-stone-200 bg-stone-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h3 className="font-bold text-stone-900">Mpesa Transactions</h3>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                        <input
                            type="text"
                            placeholder="Search receipt number..."
                            className="pl-9 pr-4 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-full sm:w-64"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-stone-500 uppercase bg-stone-50/50">
                            <tr>
                                <th className="px-4 py-3 font-medium">Receipt No</th>
                                <th className="px-4 py-3 font-medium">Date</th>
                                <th className="px-4 py-3 font-medium">Customer</th>
                                <th className="px-4 py-3 font-medium text-right">Amount</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {mpesaLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-stone-500">
                                        No Mpesa transactions found for this period.
                                    </td>
                                </tr>
                            ) : (
                                mpesaLogs.map((log, i) => (
                                    <tr key={log.id || i} className="hover:bg-purple-50/30 transition-colors">
                                        <td className="px-4 py-3 font-medium text-stone-900">
                                            {log.payment_reference || log.id?.substring(0, 8)}
                                        </td>
                                        <td className="px-4 py-3 text-stone-600">
                                            {format(new Date(log.created_at), 'MMM d, h:mm a')}
                                        </td>
                                        <td className="px-4 py-3 text-stone-600">
                                            {log.customer_name || 'Guest'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-stone-900">
                                            {Number(log.amount).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-bold">
                                                Confirmed
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button className="text-purple-600 hover:text-purple-700 font-medium text-xs">
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

