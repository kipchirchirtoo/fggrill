'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    DollarSign, CreditCard, Wallet, AlertCircle,
    RefreshCw, Filter, Download, ArrowUpRight,
    TrendingUp, ShieldCheck, Search, Info, Smartphone, FileDown, CheckCircle
} from 'lucide-react';
import { auditAPI, auditorReportsAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { BranchSelector, useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { toast } from 'sonner';

export default function FinancialVerification() {
    const { activeBranchId, activeBranch } = useBranch();
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [data, setData] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

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
            await auditorReportsAPI.exportBrandedPdf('expenditure_audit', {
                branch_id: activeBranchId === null || activeBranchId === 0 ? 1 : activeBranchId,
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
        { name: 'Credit / Other', amount: data?.payments_by_mode?.credit || 0, icon: Info, color: 'text-stone-600 bg-stone-50' },
    ];

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-8 pb-10">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <DollarSign className="h-4 w-4 text-stone-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Fiscal Oversight</span>
                            </div>
                            <h1 className="text-2xl font-black text-stone-900 tracking-tight leading-none">Financial Control & Reconciliation</h1>
                            <p className="text-stone-500 text-sm mt-2">Daily verification of payment modes vs processed sales</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm font-bold text-stone-900 shadow-sm outline-none focus:ring-2 focus:ring-stone-900 transition-all"
                            />
                            <BranchSelector />
                            <button onClick={handleExport} disabled={isExporting} className="btn-primary bg-blue-600 hover:bg-blue-700 h-[42px] px-6">
                                <FileDown className={`h-4 w-4 mr-2 ${isExporting ? 'animate-bounce' : ''}`} />
                                <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export PDF'}</span>
                            </button>
                            <button onClick={fetchData} className="btn-primary h-[42px] px-6">
                                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">Refresh Data</span>
                            </button>
                        </div>
                    </div>

                    {/* Highlights */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                        <div className="lg:col-span-2 card-elevated p-8 bg-stone-900 text-white flex flex-col justify-between overflow-hidden relative">
                            <TrendingUp className="absolute -right-8 -bottom-8 w-48 h-48 opacity-10" />
                            <div>
                                <h4 className="text-[11px] font-black uppercase tracking-widest text-stone-400 mb-2">Total Managed Revenue</h4>
                                <h2 className="text-[42px] font-black tracking-tighter leading-none">
                                    KES {data?.total_payments?.toLocaleString() || '0'}
                                </h2>
                                <p className="text-stone-400 text-sm mt-3 font-medium">Verified across all payment gateways for {selectedDate}</p>
                            </div>
                            <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs font-bold text-stone-400">
                                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                                    Security Status: Verified
                                </div>
                                <button className="text-[11px] font-black uppercase tracking-widest hover:text-emerald-400 transition-colors">Audit Analytics →</button>
                            </div>
                        </div>

                        <div className="card-elevated p-6 bg-white border-l-4 border-l-amber-500 flex flex-col justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Sales Surplus/Deficit</p>
                                <h3 className={`text-2xl font-black ${(data?.variance || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    KES {data?.variance?.toLocaleString() || '0'}
                                </h3>
                            </div>
                            <p className="text-[11px] text-stone-400 font-medium leading-relaxed">Difference between theoretical sale and physical collection</p>
                        </div>

                        <div className="card-elevated p-6 bg-white flex flex-col justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Auditor Note</p>
                                <div className="flex items-start gap-2 mt-2">
                                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-[12px] text-stone-600 font-medium italic">"Reconcile M-Pesa statements with daily settlements."</p>
                                </div>
                            </div>
                            <button className="w-full py-2 bg-stone-50 rounded-lg text-[10px] font-black uppercase text-stone-600 hover:bg-stone-100 transition-colors mt-4">Add Audit Comment</button>
                        </div>
                    </div>

                    {/* Payment Modes Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {paymentModes.map((mode, i) => (
                            <div key={i} className="card-elevated p-5 bg-white border border-stone-100 hover:border-stone-900 transition-all group">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${mode.color}`}>
                                    <mode.icon className="h-5 w-5" />
                                </div>
                                <h4 className="text-[13px] font-black text-stone-900">{mode.name}</h4>
                                <div className="flex items-baseline justify-between mt-1">
                                    <span className="text-[18px] font-black text-stone-900">KES {mode.amount.toLocaleString()}</span>
                                    <span className="text-[10px] text-stone-400 font-bold">{Math.round((mode.amount / (data?.total_payments || 1)) * 100)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Detailed Transaction Log */}
                    <div className="card-elevated p-0 bg-white overflow-hidden shadow-xl shadow-stone-200/50">
                        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                            <h3 className="text-[17px] font-black text-stone-900 flex items-center gap-2">
                                <Info className="h-5 w-5 text-stone-400" />
                                Payment Verification Log
                            </h3>
                            <div className="flex items-center gap-2">
                                <button className="p-2 border border-stone-100 rounded-lg hover:bg-stone-50"><Filter className="h-4 w-4 text-stone-400" /></button>
                                <button className="p-2 border border-stone-100 rounded-lg hover:bg-stone-50"><Download className="h-4 w-4 text-stone-400" /></button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-stone-50 text-[10px] font-black uppercase tracking-widest text-stone-400 border-b border-stone-100">
                                    <tr>
                                        <th className="px-6 py-4">Transaction Ref</th>
                                        <th className="px-6 py-4">Mode</th>
                                        <th className="px-6 py-4 text-right">Amount</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Cashier</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {data?.recent_transactions?.length > 0 ? (
                                        data.recent_transactions.map((tx: any, i: number) => (
                                            <tr key={i} className="hover:bg-stone-50/50 transition-colors">
                                                <td className="px-6 py-4 text-[13px] font-bold text-stone-900">{tx.reference_number || 'Internal Transfer'}</td>
                                                <td className="px-6 py-4">
                                                    <span className="text-[12px] font-bold text-stone-600 uppercase tracking-tighter px-2 py-0.5 bg-stone-100 rounded">{tx.payment_method}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right text-[14px] font-black text-stone-900">KES {tx.amount.toLocaleString()}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full w-fit">
                                                        <CheckCircle className="h-3 w-3" />
                                                        RECONCILED
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-[12px] text-stone-400 font-medium">{tx.cashier_name || 'System'}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center text-stone-300 text-sm italic">
                                                No payments recorded for this selection
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
