'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
    DollarSign, CreditCard, Wallet, AlertCircle,
    RefreshCw, ArrowLeft, Smartphone, Info,
    TrendingUp, ShieldCheck, FileDown, Building2
} from 'lucide-react';
import { auditAPI, auditorReportsAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { toast } from 'sonner';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';

export default function BranchFinancialVerificationPage() {
    const router = useRouter();
    const params = useParams();
    const branchId = params?.branchId as string;

    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [data, setData] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedCashier, setSelectedCashier] = useState<any>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await auditAPI.verifyFinances({
                branch_id: parseInt(branchId),
                date: selectedDate
            });

            if (res.success) {
                setData(res.data);
            } else {
                toast.error(res.message || 'Failed to fetch financial data');
            }
        } catch (e) {
            console.error("Financial fetch failed:", e);
            toast.error('An error occurred while fetching finances');
        } finally {
            setIsLoading(false);
        }
    }, [branchId, selectedDate]);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            await auditorReportsAPI.exportBrandedPdf('revenue_reconciliation', {
                branch_id: parseInt(branchId),
                start_date: selectedDate,
                end_date: selectedDate
            });
            toast.success("Financial report exported successfully");
        } catch (e) {
            console.error(e);
            toast.error("Failed to export report");
        } finally {
            setIsExporting(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const paymentModes = [
        { name: 'M-Pesa', amount: data?.payments_by_mode?.mpesa || 0, icon: Smartphone, color: 'text-emerald-600 bg-emerald-50' },
        { name: 'Cash', amount: data?.payments_by_mode?.cash || 0, icon: Wallet, color: 'text-amber-600 bg-amber-50' },
        { name: 'Bank Card', amount: data?.payments_by_mode?.card || 0, icon: CreditCard, color: 'text-blue-600 bg-blue-50' },
        { name: 'Credit / Other', amount: data?.payments_by_mode?.other || 0, icon: Info, color: 'text-stone-600 bg-stone-50' },
    ];

    // Cashier Detail View
    if (selectedCashier) {
        return (
            <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
                <DashboardLayout>
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <IOSButton variant="secondary" onClick={() => setSelectedCashier(null)} leftIcon={<ArrowLeft />}>
                                Back to Branch Overview
                            </IOSButton>
                            <div className="text-right">
                                <p className="text-xs text-gray-400 uppercase tracking-wider">Auditing Cashier</p>
                                <h2 className="text-xl font-bold text-gray-900">{selectedCashier.cashier_name}</h2>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <IOSCard className="p-6 bg-stone-900 text-white">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                                        <DollarSign className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-stone-400 uppercase tracking-wider">Session Total</p>
                                        <p className="text-2xl font-bold">KES {selectedCashier.total_amount.toLocaleString()}</p>
                                    </div>
                                </div>
                            </IOSCard>
                            <IOSCard className="p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                                        <ShieldCheck className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wider">Transactions</p>
                                        <p className="text-2xl font-bold text-gray-900">{selectedCashier.payment_count}</p>
                                    </div>
                                </div>
                            </IOSCard>
                            <IOSCard className="p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-lg bg-stone-50 flex items-center justify-center">
                                        <Building2 className="h-5 w-5 text-stone-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wider">Branch</p>
                                        <p className="text-lg font-bold text-gray-900">{selectedCashier.branch_name}</p>
                                    </div>
                                </div>
                            </IOSCard>
                        </div>

                        <IOSCard>
                            <div className="p-4 border-b border-stone-100 flex items-center justify-between">
                                <div>
                                    <h2 className="font-bold text-gray-900">Detailed Payment Log</h2>
                                    <p className="text-sm text-gray-500">Chronological ledger of all verified session transactions</p>
                                </div>
                                <div className="flex gap-2 text-xs">
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Verified</span>
                                    <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Pending Audit</span>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-stone-50 border-b border-stone-100">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Audit</th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                                            <th className="px-4 py-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-50">
                                        {selectedCashier.payments.map((p: any, i: number) => {
                                            const isVerified = p.auditor_id || (p.metadata?.auditor_id);
                                            return (
                                                <tr key={i} className={`hover:bg-stone-50 ${isVerified ? 'bg-stone-50/30' : ''}`}>
                                                    <td className="px-4 py-3">
                                                        <span className="font-mono text-sm font-bold text-gray-900">{p.reference || (p.id ? p.id.slice(0, 8) : 'Manual')}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <IOSBadge variant="light" className="text-xs">{p.payment_method}</IOSBadge>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-gray-900">KES {p.amount.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        {isVerified ? (
                                                            <div className="flex flex-col items-center">
                                                                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                                                                <span className="text-[10px] text-gray-400">Verified</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center">
                                                                <AlertCircle className="h-4 w-4 text-amber-500" />
                                                                <span className="text-[10px] text-gray-400">Pending</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-500">
                                                        {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {!isVerified && (
                                                            <IOSButton
                                                                variant="secondary"
                                                                className="h-7 text-[10px] px-2"
                                                                onClick={async () => {
                                                                    try {
                                                                        const id = p.restaurant_order_id || p.bar_order_id || p.pos_transaction_id || p.id;
                                                                        const type = p.restaurant_order_id ? 'restaurant_order' :
                                                                            (p.bar_order_id ? 'bar_order' :
                                                                                (p.pos_transaction_id ? 'pos_transaction' : 'payment'));

                                                                        const res = await auditAPI.verifyAnomaly({ id, type, notes: 'Verified via financial session review' });
                                                                        if (res.success) {
                                                                            toast.success("Transaction verified successfully");
                                                                            // Update local state or re-fetch
                                                                            fetchData();
                                                                        } else {
                                                                            toast.error(res.message || "Failed to verify transaction");
                                                                        }
                                                                    } catch (err) {
                                                                        toast.error("An error occurred");
                                                                    }
                                                                }}
                                                            >
                                                                Verify
                                                            </IOSButton>
                                                        )}
                                                        {isVerified && (
                                                            <span className="text-[10px] text-emerald-600 font-medium">Cleared</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </IOSCard>
                    </div>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    // Main Branch View
    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <IOSButton variant="secondary" onClick={() => router.back()} leftIcon={<ArrowLeft />}>
                                Back
                            </IOSButton>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Branch Financial Verification</h1>
                                <p className="text-gray-500">Branch #{branchId} - Payment reconciliation for {selectedDate}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-white border border-stone-200 rounded-lg px-4 h-10 text-sm font-medium text-stone-900"
                            />
                            <IOSButton variant="secondary" onClick={handleExport} disabled={isExporting} leftIcon={<FileDown />}>
                                Export
                            </IOSButton>
                            <IOSButton onClick={fetchData} leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}>
                                Refresh
                            </IOSButton>
                        </div>
                    </div>

                    {/* Highlights */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <IOSCard className="p-6 bg-stone-900 text-white lg:col-span-2">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                                    <TrendingUp className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-xs text-stone-400 uppercase tracking-wider">Total Combined Revenue</p>
                                    <p className="text-4xl font-bold">KES {data?.total_payments?.toLocaleString() || '0'}</p>
                                </div>
                            </div>
                            <p className="text-sm text-stone-400 bg-white/5 py-2 px-3 rounded-lg w-fit">
                                Verified against terminal ledger for {selectedDate}
                            </p>
                            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-stone-500">
                                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                                    Integrity: Validated
                                </div>
                                <span className="text-xs text-stone-600">Sales: {data?.sales?.toLocaleString() || '0'}</span>
                            </div>
                        </IOSCard>

                        <IOSCard className="p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${(data?.variance || 0) < 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                                    <AlertCircle className={`h-5 w-5 ${(data?.variance || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wider">System Variance</p>
                                    <p className={`text-2xl font-bold ${(data?.variance || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        KES {data?.variance?.toLocaleString() || '0'}
                                    </p>
                                </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-3">Gap vs Registered Sales</p>
                        </IOSCard>
                    </div>

                    {/* Payment Modes Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {paymentModes.map((mode, i) => (
                            <IOSCard key={i} className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${mode.color}`}>
                                        <mode.icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs text-gray-500">{mode.name}</p>
                                        <p className="text-lg font-bold text-gray-900">KES {mode.amount.toLocaleString()}</p>
                                        <p className="text-xs text-gray-400">{Math.round((mode.amount / (data?.total_payments || 1)) * 100)}%</p>
                                    </div>
                                </div>
                            </IOSCard>
                        ))}
                    </div>

                    {/* Cashier Summaries */}
                    <IOSCard>
                        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                                <div>
                                    <h2 className="font-bold text-gray-900">Collection Analytics</h2>
                                    <p className="text-sm text-gray-500">Attributed revenue per cashier terminal</p>
                                </div>
                            </div>
                            <IOSBadge variant="light" color="warning" className="text-xs">
                                Auditor Clearance Required
                            </IOSBadge>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-stone-50 border-b border-stone-100">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cashier Identifier</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">TX Volume</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Revenue</th>
                                        <th className="px-4 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {data?.cashier_summaries?.length > 0 ? (
                                        data.cashier_summaries.map((cas: any, i: number) => (
                                            <tr key={i} className="hover:bg-stone-50 group">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-xs font-bold text-stone-600">
                                                            {cas.cashier_name.split(' ').map((n: string) => n[0]).join('')}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-gray-900">{cas.cashier_name}</p>
                                                            <p className="text-xs text-gray-400">{cas.branch_name}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center font-semibold text-gray-700">{cas.payment_count} TX</td>
                                                <td className="px-4 py-3 text-right font-bold text-gray-900">KES {cas.total_amount.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <IOSButton
                                                        variant="secondary"
                                                        onClick={() => setSelectedCashier(cas)}
                                                        className="opacity-0 group-hover:opacity-100 h-8 text-xs"
                                                    >
                                                        Review →
                                                    </IOSButton>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                                                No session collections active
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </IOSCard>

                    {/* Detailed Transaction Log */}
                    <IOSCard>
                        <div className="p-4 border-b border-stone-100">
                            <h2 className="font-bold text-gray-900">System Payment Verification</h2>
                            <p className="text-sm text-gray-500">Real-time gateway receipts vs terminal sales records</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-stone-50 border-b border-stone-100">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction Ref</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Node</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cashier</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {data?.recent_transactions?.length > 0 ? (
                                        data.recent_transactions.map((tx: any, i: number) => (
                                            <tr key={i} className="hover:bg-stone-50">
                                                <td className="px-4 py-3">
                                                    <div>
                                                        <p className="font-mono text-sm font-bold text-gray-900">{tx.reference_number || 'Internal Transfer'}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <p className="text-xs text-gray-400 uppercase">{tx.payment_method}</p>
                                                            {tx.is_pool_token && (
                                                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase">Pool Token</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{tx.branch_name}</td>
                                                <td className="px-4 py-3 text-right font-bold text-gray-900">KES {tx.amount.toLocaleString()}</td>
                                                <td className="px-4 py-3">
                                                    <IOSBadge variant="light" color="success">{tx.status}</IOSBadge>
                                                </td>
                                                <td className="px-4 py-3 text-sm font-semibold text-gray-900">{tx.cashier_name}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                                No payment verification history
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </IOSCard>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}