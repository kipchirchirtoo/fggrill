'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    DollarSign, CreditCard, Wallet, AlertCircle,
    RefreshCw, Filter, Download, ArrowUpRight,
    TrendingUp, ShieldCheck, Search, Info, Smartphone, FileDown, CheckCircle, Building2
} from 'lucide-react';
import { auditAPI, auditorReportsAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { BranchSelector, useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { toast } from 'sonner';

export default function FinancialVerification() {
    const { activeBranchId, setActiveBranch } = useBranch();
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [data, setData] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedCashier, setSelectedCashier] = useState<any>(null);

    // Automatically set to All Branches (0) on mount for this specific auditing page
    useEffect(() => {
        if (activeBranchId !== 0) {
            setActiveBranch(0);
        }
    }, []);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await auditAPI.verifyFinances({
                branch_id: activeBranchId === null || activeBranchId === 0 ? undefined : activeBranchId,
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
    }, [activeBranchId, selectedDate]);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            // Updated to handle All Branches (passed as undefined if 0)
            await auditorReportsAPI.exportBrandedPdf('expenditure_audit', {
                branch_id: activeBranchId === null || activeBranchId === 0 ? undefined : activeBranchId,
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

    if (selectedCashier) {
        return (
            <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
                <DashboardLayout>
                    <div className="space-y-8 pb-10">
                        {/* Sub-Header */}
                        <div className="flex items-center justify-between">
                            <button
                                onClick={() => setSelectedCashier(null)}
                                className="btn-secondary"
                            >
                                <RefreshCw className="h-4 w-4 rotate-180" />
                                <span className="ml-2">Back to Summaries</span>
                            </button>
                            <div className="text-right">
                                <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Auditing Cashier</span>
                                <h2 className="text-xl font-black text-stone-900">{selectedCashier.cashier_name}</h2>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="stat-card bg-stone-900 text-white border-none shadow-xl shadow-stone-900/10">
                                <div className="stat-icon bg-white/10 text-white border-none">
                                    <DollarSign className="h-5 w-5" />
                                </div>
                                <p className="stat-value text-white text-3xl">KES {selectedCashier.total_amount.toLocaleString()}</p>
                                <p className="stat-label text-stone-400">Session Total Collected</p>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon bg-blue-50 text-blue-500">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <p className="stat-value text-3xl">{selectedCashier.payment_count}</p>
                                <p className="stat-label">Transaction Count</p>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon bg-stone-50 text-stone-500">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <p className="stat-value text-3xl">{selectedCashier.branch_name}</p>
                                <p className="stat-label">Originating Node</p>
                            </div>
                        </div>

                        <div className="table-container shadow-sm border border-stone-100">
                            <div className="section-header p-5 border-b border-stone-100">
                                <div>
                                    <h2 className="section-title">Detailed Payment Log</h2>
                                    <p className="section-subtitle">Chronological ledger of all verified session transactions</p>
                                </div>
                            </div>
                            <div className="table-responsive">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="table-header">
                                            <th className="table-header-cell">Reference</th>
                                            <th className="table-header-cell">Mode</th>
                                            <th className="table-header-cell text-right">Amount</th>
                                            <th className="table-header-cell">Status</th>
                                            <th className="table-header-cell">Time</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-50">
                                        {selectedCashier.payments.map((p: any, i: number) => (
                                            <tr key={i} className="table-row">
                                                <td className="table-cell">
                                                    <span className="font-mono font-bold text-stone-900">{p.reference || 'Manual Entry'}</span>
                                                </td>
                                                <td className="table-cell">
                                                    <span className="text-[10px] font-black text-stone-500 bg-stone-100 px-2 py-1 rounded-lg uppercase tracking-tight">{p.payment_method}</span>
                                                </td>
                                                <td className="table-cell text-right font-black text-stone-900">KES {p.amount.toLocaleString()}</td>
                                                <td className="table-cell">
                                                    <span className={p.status === 'completed' ? 'badge-success' : 'badge-warning'}>
                                                        {p.status}
                                                    </span>
                                                </td>
                                                <td className="table-cell text-stone-400 font-semibold group-hover:text-stone-900 transition-colors">
                                                    {new Date(p.created_at).toLocaleTimeString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-8 pb-10">
                    {/* Header */}
                    <div className="page-header flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-stone-900 flex items-center justify-center text-white shadow-lg">
                                <DollarSign className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="page-title text-stone-900">Financial Verification</h1>
                                <p className="page-subtitle">Daily reconciliation of payment gateways vs sales data</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-white border border-stone-200 rounded-xl px-4 h-[42px] text-sm font-black text-stone-900 uppercase tracking-tighter shadow-sm outline-none focus:ring-2 focus:ring-stone-900 transition-all"
                            />
                            <BranchSelector />
                            <button onClick={handleExport} disabled={isExporting} className="btn-secondary h-[42px]">
                                <FileDown className={`h-4 w-4 ${isExporting ? 'animate-bounce text-blue-500' : ''}`} />
                            </button>
                            <button onClick={fetchData} className="btn-primary h-[42px] shadow-lg shadow-stone-900/10">
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span className="ml-2">Refresh</span>
                            </button>
                        </div>
                    </div>

                    {/* Highlights */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        <div className="lg:col-span-2 stat-card bg-stone-900 text-white border-none shadow-2xl shadow-stone-900/20 flex flex-col justify-between overflow-hidden relative">
                            <TrendingUp className="absolute -right-8 -bottom-8 w-48 h-48 opacity-10" />
                            <div className="relative z-10">
                                <h4 className="caption uppercase tracking-widest text-stone-400 mb-2">Total Combined Revenue</h4>
                                <h2 className="text-[48px] font-black tracking-tighter leading-none mb-4">
                                    KES {data?.total_payments?.toLocaleString() || '0'}
                                </h2>
                                <p className="text-stone-400 text-sm font-bold bg-white/5 py-1.5 px-3 rounded-lg w-fit">Verified against terminal ledger for {selectedDate}</p>
                            </div>
                            <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-500">
                                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                                    Integrity: Validated
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-black uppercase text-stone-600">Sales: {data?.sales?.toLocaleString() || '0'}</span>
                                    <button className="text-[10px] font-black uppercase tracking-widest text-white hover:text-emerald-400 transition-colors">Audit Detail →</button>
                                </div>
                            </div>
                        </div>

                        <div className="stat-card border-l-4 border-l-rose-500">
                            <div className="stat-icon bg-rose-50 text-rose-500">
                                <AlertCircle className="h-5 w-5" />
                            </div>
                            <p className={`stat-value text-2xl ${(data?.variance || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                KES {data?.variance?.toLocaleString() || '0'}
                            </p>
                            <p className="stat-label">System Variance</p>
                            <p className="text-[10px] text-stone-400 font-bold mt-4 uppercase tracking-tight">Gap vs Registered Sales</p>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon bg-amber-50 text-amber-500">
                                <Info className="h-5 w-5" />
                            </div>
                            <p className="text-[11px] text-stone-700 font-bold leading-relaxed italic mb-4">
                                "Audit all M-Pesa statements with bank settlements daily."
                            </p>
                            <button className="btn-secondary w-full text-[9px] h-8">Modify Audit Note</button>
                        </div>
                    </div>

                    {/* Payment Modes Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {paymentModes.map((mode, i) => (
                            <div key={i} className="stat-card group">
                                <div className={`stat-icon transition-transform group-hover:scale-110 ${mode.color}`}>
                                    <mode.icon className="h-5 w-5" />
                                </div>
                                <p className="stat-value text-xl">KES {mode.amount.toLocaleString()}</p>
                                <div className="flex items-center justify-between mt-1">
                                    <p className="stat-label">{mode.name}</p>
                                    <span className="text-[10px] text-stone-300 font-black">{Math.round((mode.amount / (data?.total_payments || 1)) * 100)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Cashier Summaries */}
                    <div className="table-container shadow-sm border border-stone-100">
                        <div className="section-header p-5 border-b border-stone-100 bg-stone-50/30">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                                    <div>
                                        <h2 className="section-title">Collection Analytics</h2>
                                        <p className="section-subtitle">Attributed revenue per cashier terminal</p>
                                    </div>
                                </div>
                                <p className="text-[9px] text-stone-400 font-black uppercase tracking-[0.2em] bg-stone-100 px-3 py-1 rounded-full">Auditor Clearance Required</p>
                            </div>
                        </div>
                        <div className="table-responsive">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="table-header">
                                        <th className="table-header-cell">Cashier Identifier</th>
                                        <th className="table-header-cell text-center">TX Volume</th>
                                        <th className="table-header-cell text-right">Total Revenue</th>
                                        <th className="table-header-cell"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {data?.cashier_summaries?.length > 0 ? (
                                        data.cashier_summaries.map((cas: any, i: number) => (
                                            <tr key={i} className="table-row group">
                                                <td className="table-cell">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-[11px] font-black text-stone-500 group-hover:bg-stone-900 group-hover:text-white transition-all">
                                                            {cas.cashier_name.split(' ').map((n: string) => n[0]).join('')}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-stone-900">{cas.cashier_name}</span>
                                                            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-tighter">{cas.branch_name}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="table-cell text-center font-bold text-stone-500">{cas.payment_count} TX</td>
                                                <td className="table-cell text-right font-black text-stone-900">KES {cas.total_amount.toLocaleString()}</td>
                                                <td className="table-cell text-right">
                                                    <button
                                                        onClick={() => setSelectedCashier(cas)}
                                                        className="btn-secondary h-8 px-4 opacity-0 group-hover:opacity-100"
                                                    >
                                                        Review →
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-20 text-center">
                                                <p className="text-[11px] font-black uppercase tracking-widest text-stone-300">No session collections active</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Detailed Transaction Log */}
                    <div className="table-container shadow-sm border border-stone-100">
                        <div className="section-header p-5 border-b border-stone-100">
                            <div>
                                <h2 className="section-title">System Payment Verification</h2>
                                <p className="section-subtitle">Real-time gateway receipts vs terminal sales records</p>
                            </div>
                        </div>
                        <div className="table-responsive">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="table-header">
                                        <th className="table-header-cell">Transaction Ref</th>
                                        <th className="table-header-cell">Node</th>
                                        <th className="table-header-cell text-right">Amount</th>
                                        <th className="table-header-cell">Status</th>
                                        <th className="table-header-cell">Cashier</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {data?.recent_transactions?.length > 0 ? (
                                        data.recent_transactions.map((tx: any, i: number) => (
                                            <tr key={i} className="table-row">
                                                <td className="table-cell">
                                                    <div className="flex flex-col">
                                                        <span className="font-mono font-bold text-stone-900">{tx.reference_number || 'Internal Transfer'}</span>
                                                        <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{tx.payment_method}</span>
                                                    </div>
                                                </td>
                                                <td className="table-cell text-[12px] text-stone-400 font-black uppercase tracking-tighter">{tx.branch_name}</td>
                                                <td className="table-cell text-right font-black text-stone-900">KES {tx.amount.toLocaleString()}</td>
                                                <td className="table-cell">
                                                    <span className="badge-success">
                                                        {tx.status}
                                                    </span>
                                                </td>
                                                <td className="table-cell text-[12px] text-stone-900 font-bold">{tx.cashier_name}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center">
                                                <p className="text-[11px] font-black uppercase tracking-widest text-stone-300">No payment verification history</p>
                                            </td>
                                        </tr>
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
