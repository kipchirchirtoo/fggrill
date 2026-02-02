'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    ShieldCheck, FileText, CheckCircle, Clock,
    AlertCircle, RefreshCw, Eye, Search,
    Filter, Download, ChevronRight, CheckSquare,
    DollarSign, Truck, ClipboardList, Info
} from 'lucide-react';
import { auditAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { BranchSelector, useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { toast } from 'sonner';

export default function ExpenditureVerification() {
    const { activeBranchId, activeBranch } = useBranch();
    const [isLoading, setIsLoading] = useState(true);
    const [expenses, setExpenses] = useState<any[]>([]);
    const [filterStatus, setFilterStatus] = useState<'pending' | 'verified' | 'all'>('pending');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await auditAPI.verifyExpenditure({
                branch_id: activeBranchId === 0 ? undefined : activeBranchId,
                status: filterStatus === 'all' ? undefined : filterStatus
            });

            if (res.success) {
                setExpenses(res.data || []);
            } else {
                toast.error(res.message || 'Failed to fetch expenditure data');
            }
        } catch (e) {
            console.error("Expenditure fetch failed:", e);
            toast.error('An error occurred while fetching expenditures');
        } finally {
            setIsLoading(false);
        }
    }, [activeBranchId, filterStatus]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const stats = [
        { label: 'Unverified Expenses', value: expenses.filter(e => e.auditor_verified === false).length, icon: Clock, color: 'text-amber-500 bg-amber-50' },
        { label: 'Compliance Rate', value: '98.2%', icon: CheckCircle, color: 'text-emerald-500 bg-emerald-50' },
        { label: 'High Value Audit', value: expenses.filter(e => (e.amount || 0) > 50000).length, icon: AlertCircle, color: 'text-rose-500 bg-rose-50' },
        { label: 'GRN Mismatch', value: '2 Items', icon: ClipboardList, color: 'text-stone-500 bg-stone-50' },
    ];

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-8 pb-10">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <ShieldCheck className="h-4 w-4 text-stone-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Payment Authorization</span>
                            </div>
                            <h1 className="text-2xl font-black text-stone-900 tracking-tight leading-none text-[32px]">Expenditure Verification & Audit</h1>
                            <p className="text-stone-500 text-sm mt-3 font-medium">Authentication and sign-off for all outgoing payments and operational expenses</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <BranchSelector />
                            <button onClick={fetchData} className="h-[48px] px-6 bg-stone-900 text-white rounded-xl font-bold flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-stone-200">
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                Sync Ledgers
                            </button>
                        </div>
                    </div>

                    {/* Verification Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {stats.map((stat, i) => (
                            <div key={i} className="card-elevated p-5 bg-white border border-stone-100 flex items-center gap-4 group hover:border-stone-400 transition-all">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-stone-50 ${stat.color}`}>
                                    <stat.icon className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">{stat.label}</p>
                                    <p className="text-[20px] font-black text-stone-900 leading-none mt-1">{stat.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Main Interface */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {/* Filters & Controls */}
                        <div className="lg:col-span-1 space-y-6">
                            <div className="card-elevated p-6 bg-white border border-stone-200">
                                <h3 className="text-[15px] font-black text-stone-900 mb-6 flex items-center gap-2">
                                    <Filter className="h-4 w-4 text-stone-400" />
                                    Verification Scope
                                </h3>
                                <div className="space-y-4">
                                    <button
                                        onClick={() => setFilterStatus('pending')}
                                        className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between group ${filterStatus === 'pending' ? 'border-amber-500 bg-amber-50' : 'border-stone-50 hover:border-stone-200'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${filterStatus === 'pending' ? 'bg-amber-500 text-white' : 'bg-stone-100 text-stone-400'}`}>
                                                <Clock className="h-4 w-4" />
                                            </div>
                                            <span className={`text-sm font-bold ${filterStatus === 'pending' ? 'text-amber-900' : 'text-stone-600'}`}>Pending Audit</span>
                                        </div>
                                        <ChevronRight className={`h-4 w-4 transition-transform ${filterStatus === 'pending' ? 'translate-x-1' : ''}`} />
                                    </button>

                                    <button
                                        onClick={() => setFilterStatus('verified')}
                                        className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between group ${filterStatus === 'verified' ? 'border-emerald-500 bg-emerald-50' : 'border-stone-50 hover:border-stone-200'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${filterStatus === 'verified' ? 'bg-emerald-500 text-white' : 'bg-stone-100 text-stone-400'}`}>
                                                <CheckSquare className="h-4 w-4" />
                                            </div>
                                            <span className={`text-sm font-bold ${filterStatus === 'verified' ? 'text-emerald-900' : 'text-stone-600'}`}>Verified History</span>
                                        </div>
                                        <ChevronRight className={`h-4 w-4 transition-transform ${filterStatus === 'verified' ? 'translate-x-1' : ''}`} />
                                    </button>

                                    <button
                                        onClick={() => setFilterStatus('all')}
                                        className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between group ${filterStatus === 'all' ? 'border-stone-900 bg-stone-900' : 'border-stone-50 hover:border-stone-200'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${filterStatus === 'all' ? 'bg-white text-stone-900' : 'bg-stone-100 text-stone-400'}`}>
                                                <Layers className="h-4 w-4" />
                                            </div>
                                            <span className={`text-sm font-bold ${filterStatus === 'all' ? 'text-white' : 'text-stone-600'}`}>All Transactions</span>
                                        </div>
                                        <ChevronRight className={`h-4 w-4 transition-transform ${filterStatus === 'all' ? 'translate-x-1' : ''}`} />
                                    </button>
                                </div>
                            </div>

                            <div className="card-elevated p-6 bg-stone-50 border-none">
                                <h4 className="text-[12px] font-black uppercase text-stone-400 tracking-[0.1em] mb-4">Verification Checklist</h4>
                                <div className="space-y-3">
                                    <CheckItem label="Check GRN for all physical deliveries" checked />
                                    <CheckItem label="Verify invoice against purchase order" checked />
                                    <CheckItem label="Confirm department head authorization" />
                                    <CheckItem label="Verify supplier bank details" />
                                </div>
                            </div>
                        </div>

                        {/* Expenditure Ledger List */}
                        <div className="lg:col-span-3 space-y-4">
                            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-stone-100 shadow-sm">
                                <div className="relative flex-1 max-w-md">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                    <input type="text" placeholder="Search by Voucher, Supplier, or Staff..." className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-transparent rounded-xl text-sm focus:bg-white focus:border-stone-200 outline-none transition-all" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button className="p-2.5 hover:bg-stone-50 rounded-xl transition-colors"><Download className="h-5 w-5 text-stone-400" /></button>
                                    <button className="p-2.5 hover:bg-stone-50 rounded-xl transition-colors"><Info className="h-5 w-5 text-stone-400" /></button>
                                </div>
                            </div>

                            <div className="card-elevated p-0 bg-white border border-stone-200 overflow-hidden shadow-xl shadow-stone-200/40">
                                <table className="w-full text-left">
                                    <thead className="bg-stone-50 border-b border-stone-100">
                                        <tr>
                                            <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-stone-400">Merchant / Supplier</th>
                                            <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-stone-400">Category</th>
                                            <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-stone-400">Amount</th>
                                            <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-stone-400">Verification</th>
                                            <th className="px-6 py-4 text-right"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-50">
                                        {expenses.length > 0 ? (
                                            expenses.map((expense, i) => (
                                                <tr key={i} className="hover:bg-stone-50/50 transition-colors group cursor-pointer">
                                                    <td className="px-6 py-5">
                                                        <p className="text-[14px] font-black text-stone-900 group-hover:text-blue-600 transition-colors">{expense.description || 'General Expense'}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Truck className="h-3 w-3 text-stone-400" />
                                                            <span className="text-[11px] text-stone-400 font-bold uppercase tracking-tight">{expense.supplier || 'Internal Payroll'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <span className="text-[11px] font-black text-stone-500 bg-stone-100 px-2 py-1 rounded tracking-tight uppercase">{expense.category || 'Operations'}</span>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <p className="text-[15px] font-black text-stone-900">KES {expense.amount?.toLocaleString()}</p>
                                                        <p className="text-[10px] text-stone-400 mt-0.5">{new Date(expense.date).toLocaleDateString()}</p>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        {expense.auditor_verified ? (
                                                            <div className="flex items-center gap-1.5 text-emerald-600">
                                                                <CheckCircle className="h-4 w-4" />
                                                                <span className="text-[11px] font-black uppercase tracking-tighter">Verified</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 text-amber-500 animate-pulse">
                                                                <Clock className="h-4 w-4" />
                                                                <span className="text-[11px] font-black uppercase tracking-tighter">Awaiting Sign-off</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-5 text-right">
                                                        <button className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-stone-900 hover:text-white transition-all text-stone-300">
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={5} className="py-32 text-center">
                                                    <FileText className="h-10 w-10 text-stone-100 mx-auto mb-4" />
                                                    <p className="text-stone-300 text-[13px] italic font-medium">No expenditures found in current scope</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}

const Layers = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
    </svg>
);

const CheckItem = ({ label, checked }: { label: string, checked?: boolean }) => (
    <div className="flex items-center gap-3 group cursor-pointer">
        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-300 group-hover:border-stone-900'}`}>
            {checked && <CheckCircle className="h-3 w-3" />}
        </div>
        <span className={`text-[12px] font-medium transition-colors ${checked ? 'text-stone-400 line-through' : 'text-stone-700'}`}>{label}</span>
    </div>
);
