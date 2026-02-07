'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    DollarSign, RefreshCw, Building2, ChevronRight,
    TrendingUp, AlertCircle, ShieldCheck, Filter,
    Calendar, Wallet, CreditCard, ArrowUpRight,
    Search, FileText, CheckCircle2, History,
    Clock, Smartphone, ShieldAlert, Users
} from 'lucide-react';
import { CashierLogbookVerification } from '@/components/auditor/CashierLogbookVerification';
import { DailyLogVerification } from '@/components/auditor/DailyLogVerification';
import { auditAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function FinancialVerificationPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await auditAPI.verifyFinances({
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
    }, [selectedDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const branchSummaries = data?.branch_summaries || [];
    const totalPayments = data?.total_payments || 0;
    const totalVariance = data?.variance || 0;
    const recentTransactions = data?.recent_transactions || [];

    if (isLoading && !data) {
        return (
            <DashboardLayout>
                <div className="space-y-6 pb-12 animate-pulse">
                    <div className="flex justify-between items-center mb-6">
                        <div className="h-10 w-48 bg-gray-200 rounded"></div>
                        <div className="flex gap-2">
                            <div className="h-10 w-32 bg-gray-200 rounded"></div>
                            <div className="h-10 w-32 bg-gray-200 rounded"></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
                        ))}
                    </div>
                    <div className="h-48 bg-gray-200 rounded-xl"></div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 h-96 bg-gray-200 rounded-xl"></div>
                        <div className="h-96 bg-gray-200 rounded-xl"></div>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6 pb-12">
                    {/* Page Header */}
                    <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="page-title">Financial Verification</h1>
                            <p className="page-subtitle">Reconciling daily collection gateways against operational sales records</p>
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
                                className="btn-primary h-11 px-4 shadow-lg shadow-stone-900/10"
                            >
                                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline tracking-tight">Sync Records</span>
                            </button>
                        </div>
                    </div>

                    {/* Integrated Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="card-elevated p-6 border-l-4 border-l-stone-900 bg-white shadow-sm relative overflow-hidden group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600">
                                    <DollarSign className="h-5 w-5" />
                                </div>
                                <div className="p-1 px-2 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3" /> VERIFIED
                                </div>
                            </div>
                            <p className="text-[26px] font-bold text-stone-900 tracking-tight">
                                KES {totalPayments.toLocaleString()}
                            </p>
                            <p className="text-[12px] font-medium text-stone-400 uppercase tracking-widest mt-1">Total Collections</p>
                            <div className="absolute top-0 right-0 w-16 h-16 bg-stone-50 rounded-bl-full -mr-8 -mt-8 opacity-50 group-hover:bg-stone-100 transition-colors" />
                        </div>

                        <div className={`card-elevated p-6 border-l-4 ${totalVariance < 0 ? 'border-l-rose-500' : 'border-l-emerald-500'} bg-white shadow-sm`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${totalVariance < 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                    {totalVariance < 0 ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                                </div>
                                {totalVariance !== 0 && (
                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${totalVariance < 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                        {totalPayments > 0 ? Math.abs(Math.round((totalVariance / totalPayments) * 100)) : 0}% VARIANCE
                                    </span>
                                )}
                            </div>
                            <p className={`text-[26px] font-bold tracking-tight ${totalVariance < 0 ? 'text-rose-600' : 'text-emerald-500'}`}>
                                KES {Math.abs(totalVariance).toLocaleString()}
                            </p>
                            <p className="text-[12px] font-medium text-stone-400 uppercase tracking-widest mt-1">
                                {totalVariance < 0 ? 'Suspense / Shortage' : 'Audit Surplus'}
                            </p>
                        </div>

                        <div className="card-elevated p-6 border-l-4 border-l-blue-500 bg-white shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                                    <Building2 className="h-5 w-5" />
                                </div>
                                <span className="text-[10px] font-bold text-blue-600 px-2 py-1 bg-blue-50 rounded-full">ACTIVE NODES</span>
                            </div>
                            <p className="text-[26px] font-bold text-stone-900 tracking-tight">
                                {branchSummaries.length}
                            </p>
                            <p className="text-[12px] font-medium text-stone-400 uppercase tracking-widest mt-1">Operational Branches</p>
                        </div>

                        <div className="card-elevated p-6 border-l-4 border-l-amber-500 bg-white shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                                    <History className="h-5 w-5" />
                                </div>
                                <span className="text-[10px] font-bold text-amber-600 px-2 py-1 bg-amber-50 rounded-full">LIVE FEED</span>
                            </div>
                            <p className="text-[26px] font-bold text-stone-900 tracking-tight">
                                {recentTransactions.length}
                            </p>
                            <p className="text-[12px] font-medium text-stone-400 uppercase tracking-widest mt-1">Gateway Interactions</p>
                        </div>
                    </div>

                    <CashierLogbookVerification
                        title="Cashier Logbook Audits"
                    />

                    <DailyLogVerification
                        title="Accountant Daily Log Audits"
                    />

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Branch Reconciliation List */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="section-title text-[14px]">Branch Performance Audit</h3>
                                <span className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Sort: By Variance</span>
                            </div>

                            {branchSummaries.length === 0 ? (
                                <div className="card-elevated p-12 flex flex-col items-center justify-center bg-white opacity-60">
                                    <Building2 className="h-10 w-10 text-stone-200 mb-4" />
                                    <p className="text-[14px] font-bold text-stone-400">No reconciled data for this cycle</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {branchSummaries.map((branch: any) => (
                                        <div
                                            key={branch.branch_id}
                                            className="card-elevated bg-white border border-stone-100 p-5 hover:border-stone-400 transition-all group cursor-pointer"
                                            onClick={() => router.push(`/dashboard/auditor/financial-verification/${branch.branch_id}?date=${selectedDate}`)}
                                        >
                                            <div className="flex items-start justify-between mb-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-11 h-11 rounded-2xl bg-stone-50 flex items-center justify-center text-stone-500 border border-stone-100 group-hover:bg-stone-900 group-hover:text-white transition-colors shadow-sm">
                                                        <Building2 className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[15px] font-bold text-stone-900 tracking-tight">{branch.branch_name}</p>
                                                        <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">ID: {branch.branch_id.toString().slice(0, 8)}</p>
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-5 w-5 text-stone-300 group-hover:text-stone-900 group-hover:translate-x-1 transition-all" />
                                            </div>

                                            <div className="grid grid-cols-3 gap-2 mb-6">
                                                <div className="p-2 bg-stone-50 rounded-lg text-center">
                                                    <Wallet className="h-3.5 w-3.5 mx-auto mb-1 text-stone-400" />
                                                    <p className="text-[10px] font-bold text-stone-900">KES {branch.cash?.toLocaleString()}</p>
                                                    <p className="text-[9px] font-bold text-stone-400 uppercase">Cash</p>
                                                </div>
                                                <div className="p-2 bg-emerald-50 rounded-lg text-center">
                                                    <Smartphone className="h-3.5 w-3.5 mx-auto mb-1 text-emerald-500" />
                                                    <p className="text-[10px] font-bold text-emerald-700">KES {branch.mpesa?.toLocaleString()}</p>
                                                    <p className="text-[9px] font-bold text-emerald-500 uppercase">M-PESA</p>
                                                </div>
                                                <div className="p-2 bg-blue-50 rounded-lg text-center">
                                                    <CreditCard className="h-3.5 w-3.5 mx-auto mb-1 text-blue-500" />
                                                    <p className="text-[10px] font-bold text-blue-700">KES {branch.card?.toLocaleString()}</p>
                                                    <p className="text-[9px] font-bold text-blue-500 uppercase">Bank/ID</p>
                                                </div>
                                            </div>

                                            <div className="space-y-2.5 pt-4 border-t border-stone-100">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[12px] font-medium text-stone-500">Gateway Collection</span>
                                                    <span className="text-[13px] font-bold text-stone-900">KES {branch.total_payments?.toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[12px] font-medium text-stone-500">Operational Sales</span>
                                                    <span className="text-[13px] font-bold text-stone-900">KES {branch.total_sales?.toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-center justify-between pt-1">
                                                    <span className="text-[12px] font-bold text-stone-900 uppercase tracking-tighter">Variance Audit</span>
                                                    <span className={`text-[13px] font-black ${branch.variance < 0 ? 'text-rose-600' : branch.variance > 0 ? 'text-emerald-600' : 'text-stone-400'}`}>
                                                        {branch.variance > 0 && '+'}KES {branch.variance?.toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-4 flex items-center gap-2">
                                                <div className={`flex-1 h-1 rounded-full ${branch.variance === 0 ? 'bg-emerald-500' : 'bg-stone-100 overflow-hidden'}`}>
                                                    {branch.variance !== 0 && (
                                                        <div
                                                            className={`h-full ${branch.variance < 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                                            style={{ width: `${Math.min(Math.abs((branch.variance / (branch.total_payments || 1)) * 100), 100)}%` }}
                                                        />
                                                    )}
                                                </div>
                                                <span className={`text-[10px] font-bold uppercase ${branch.variance === 0 ? 'text-emerald-600' : 'text-stone-400'}`}>
                                                    {branch.variance === 0 ? 'Fully Reconciled' : 'Review Required'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Recent Transactions Feed */}
                        <div className="card-elevated bg-stone-50 border-stone-100 flex flex-col h-full overflow-hidden">
                            <div className="p-6 bg-white border-b border-stone-200/60 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-[15px] font-bold text-stone-900">Gateway Log</h3>
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                </div>
                                <Activity className="h-4 w-4 text-stone-300" />
                            </div>

                            <div className="flex-1 overflow-y-auto max-h-[600px] p-4 space-y-3 scrollbar-thin">
                                {recentTransactions.length > 0 ? (
                                    recentTransactions.map((tx: any, i: number) => (
                                        <div
                                            key={i}
                                            onClick={() => tx.id && router.push(`/dashboard/auditor/financial-verification/logs/${tx.id}?date=${selectedDate}`)}
                                            className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm hover:ring-1 hover:ring-stone-900/5 transition-all group cursor-pointer"
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={`p-1.5 rounded-lg ${tx.payment_method === 'cash' ? 'bg-stone-100 text-stone-600' :
                                                        tx.payment_method?.includes('mpesa') ? 'bg-emerald-50 text-emerald-600' :
                                                            'bg-blue-50 text-blue-600'
                                                        }`}>
                                                        {tx.payment_method === 'cash' ? <Wallet className="h-3.5 w-3.5" /> :
                                                            tx.payment_method?.includes('mpesa') ? <Smartphone className="h-3.5 w-3.5" /> :
                                                                <CreditCard className="h-3.5 w-3.5" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">{tx.payment_method || 'Payment'}</p>
                                                        <p className="text-[13px] font-black text-stone-900">KES {tx.amount?.toLocaleString()}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="flex items-center gap-1 justify-end">
                                                        <Clock className="h-3 w-3 text-stone-300" />
                                                        <span className="text-[10px] text-stone-400 font-medium">
                                                            {format(new Date(tx.created_at), 'HH:mm')}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1 justify-end mt-1">
                                                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                                        <span className="text-[10px] font-bold text-emerald-600 uppercase">Confirmed</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between pt-3 border-t border-stone-50">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-4 h-4 rounded-full bg-stone-100 flex items-center justify-center">
                                                        <Building2 className="h-2 w-2 text-stone-500" />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-stone-500 truncate max-w-[80px]">{tx.branch_name}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-4 h-4 rounded-full bg-stone-100 flex items-center justify-center">
                                                        <Users className="h-2 w-2 text-stone-500" />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-stone-500 truncate max-w-[80px]">{tx.cashier_name}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 opacity-40">
                                        <History className="h-10 w-10 mb-2" />
                                        <p className="text-sm font-bold">No recent gateway activity</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-stone-900 text-white rounded-b-lg flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                                    <span className="text-[11px] font-bold uppercase tracking-widest">Gateway Verified</span>
                                </div>
                                <button
                                    onClick={() => router.push(`/dashboard/auditor/financial-verification/logs?date=${selectedDate}`)}
                                    className="text-[11px] font-bold hover:underline"
                                >
                                    Full Log →
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}

// Separate icon for clarity (Activity should be imported or created)
function Activity(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
    )
}
