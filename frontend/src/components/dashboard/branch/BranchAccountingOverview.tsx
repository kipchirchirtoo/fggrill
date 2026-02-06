'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    DollarSign, TrendingUp, TrendingDown, FileText,
    PieChart, CreditCard, RefreshCw, Calculator, Wallet,
    AlertTriangle, ArrowDownRight, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { financeAPI, auditAPI } from '@/lib/api';

interface BranchAccountingOverviewProps {
    branchId: number | null;
    branchName?: string;
    basePath: string; // e.g. "/dashboard/branch-accounting" or "/dashboard/auditor/branch-audit"
    isAuditor?: boolean;
}

export function BranchAccountingOverview({ branchId, branchName, basePath, isAuditor = false }: BranchAccountingOverviewProps) {
    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        pendingApprovals: 0,
        receivables: 0,
        payables: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [financials, setFinancials] = useState<any>(null);
    const [pendingAlerts, setPendingAlerts] = useState<any[]>([]);
    const [rejectedLogbooks, setRejectedLogbooks] = useState<any[]>([]);
    const [pendingAudits, setPendingAudits] = useState<any[]>([]);

    const fetchData = useCallback(async () => {
        if (!branchId) return;

        setIsLoading(true);
        try {
            // Fetch comprehensive branch financials
            const [profileRes, pendingAuditRes] = await Promise.allSettled([
                financeAPI.getBranchFinancials(branchId),
                auditAPI.getPendingApprovals(branchId)
            ]);

            if (profileRes.status === 'fulfilled' && profileRes.value.success) {
                const data = profileRes.value.data;
                setFinancials(data);

                setStats({
                    totalRevenue: data.summary?.totalRevenue || 0,
                    totalExpenses: data.summary?.totalExpenses || 0,
                    netProfit: data.summary?.netProfit || 0,
                    pendingApprovals: pendingAuditRes.status === 'fulfilled' ? pendingAuditRes.value?.data?.length || 0 : 0,
                    receivables: data.receivables || 0,
                    payables: data.payables || 0
                });

                setRejectedLogbooks(data.logbooks?.filter((l: any) => l.status === 'rejected') || []);

                if (pendingAuditRes.status === 'fulfilled' && pendingAuditRes.value.success) {
                    setPendingAudits(pendingAuditRes.value.data || []);
                }
            }
        } catch (error) {
            console.error('Error fetching accounting data:', error);
            toast.error('Failed to load financial data');
        } finally {
            setIsLoading(false);
        }
    }, [branchId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const workflowCards = [
        {
            title: 'Stock Taking',
            desc: 'Physical inventory verification',
            icon: PieChart,
            color: 'bg-emerald-50 text-emerald-600',
            href: `${basePath}/stock-take`,
            action: isAuditor ? 'Audit Count' : 'Start Count'
        },
        {
            title: 'Credit & Paid Bills',
            desc: 'Staff credits, loans & advances',
            icon: Wallet,
            color: 'bg-blue-50 text-blue-600',
            href: `${basePath}/credit-bills`,
            action: isAuditor ? 'Review' : 'Manage'
        },
        {
            title: 'Business & Mpesa',
            desc: 'Revenue & mobile transactions',
            icon: Calculator,
            color: 'bg-purple-50 text-purple-600',
            href: `${basePath}/business-mpesa`,
            action: isAuditor ? 'Verify' : 'Reconcile'
        },
        {
            title: 'Invoices & Payments',
            desc: 'Billing & payment processing',
            icon: FileText,
            color: 'bg-amber-50 text-amber-600',
            href: `${basePath}/invoices`,
            action: isAuditor ? 'View' : 'Create'
        }
    ];

    if (!branchId) {
        return (
            <div className="text-center py-12 bg-stone-50 rounded-xl border border-stone-200 border-dashed">
                <AlertTriangle className="h-10 w-10 text-stone-400 mx-auto mb-3" />
                <h3 className="text-stone-900 font-medium">No Branch Selected</h3>
                <p className="text-stone-500 text-sm">Please select a branch to view its financial overview.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header with clear context */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900">
                        {isAuditor ? 'Branch Audit Overview' : 'Accounting Overview'}
                    </h1>
                    <p className="text-stone-500">{branchName || 'Branch Financials'}</p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={isLoading}
                    className="bg-white border border-stone-200 text-stone-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors flex items-center gap-2"
                >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Key Health Metrics - Simplified */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-stone-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <DollarSign className="h-24 w-24 text-emerald-600" />
                    </div>
                    <p className="text-sm font-medium text-stone-500 mb-1">Total Revenue</p>
                    <h3 className="text-3xl font-bold text-stone-900">
                        {stats.totalRevenue.toLocaleString()} <span className="text-base font-normal text-stone-400">KES</span>
                    </h3>
                    <div className="mt-4 flex items-center gap-2 text-emerald-600 text-sm font-medium bg-emerald-50 w-fit px-2 py-1 rounded-full">
                        <TrendingUp className="h-4 w-4" />
                        <span>Income</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-stone-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <ArrowDownRight className="h-24 w-24 text-rose-600" />
                    </div>
                    <p className="text-sm font-medium text-stone-500 mb-1">Total Expenses</p>
                    <h3 className="text-3xl font-bold text-stone-900">
                        {stats.totalExpenses.toLocaleString()} <span className="text-base font-normal text-stone-400">KES</span>
                    </h3>
                    <div className="mt-4 flex items-center gap-2 text-rose-600 text-sm font-medium bg-rose-50 w-fit px-2 py-1 rounded-full">
                        <ArrowDownRight className="h-4 w-4" />
                        <span>Outflow</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-stone-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Wallet className="h-24 w-24 text-amber-600" />
                    </div>
                    <p className="text-sm font-medium text-stone-500 mb-1">Net Profit</p>
                    <h3 className={`text-3xl font-bold ${stats.netProfit >= 0 ? 'text-stone-900' : 'text-rose-600'}`}>
                        {stats.netProfit.toLocaleString()} <span className="text-base font-normal text-stone-400">KES</span>
                    </h3>
                    <div className={`mt-4 flex items-center gap-2 text-sm font-medium w-fit px-2 py-1 rounded-full ${stats.netProfit >= 0 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                        <PieChart className="h-4 w-4" />
                        <span>Margin: {financials?.summary?.profitMargin?.toFixed(1) || 0}%</span>
                    </div>
                </div>
            </div>

            {/* Action Items - Consolidated Warnings */}
            {(rejectedLogbooks.length > 0 || pendingAudits.length > 0) && (
                <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-orange-900 mb-4 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" />
                        Attention Required
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        {pendingAudits.length > 0 && (
                            <div className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-orange-900 font-bold">{pendingAudits.length} Shift Logbooks Pending Audit</p>
                                    <p className="text-orange-700/70 text-sm">Review cashier shifts</p>
                                </div>
                                <Link href={`${basePath}/audit-trail`}>
                                    <button className="bg-orange-100 text-orange-700 hover:bg-orange-200 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">
                                        Audit Now
                                    </button>
                                </Link>
                            </div>
                        )}

                        {rejectedLogbooks.length > 0 && (
                            <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-red-900 font-bold">{rejectedLogbooks.length} Rejected Logbooks</p>
                                    <p className="text-red-700/70 text-sm">Waiting for cashier fix</p>
                                </div>
                                <Link href={`${basePath}/audit-trail`}>
                                    <button className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors">
                                        View
                                    </button>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            )}


            {/* Operations Hub - Command Center Style */}
            <div>
                <h2 className="text-lg font-bold text-stone-900 mb-4">Operations Hub</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {workflowCards.map((card) => (
                        <Link key={card.title} href={card.href} className="group">
                            <div className="bg-white h-full p-6 rounded-2xl border border-stone-100 shadow-sm hover:shadow-md hover:border-stone-200 transition-all cursor-pointer relative">
                                {card.action === 'Verify' && pendingApprovalsCount(card.title) > 0 && (
                                    <div className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full z-10">
                                        {pendingApprovalsCount(card.title)}
                                    </div>
                                )}
                                <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 ${card.color}`}>
                                    <card.icon className="h-6 w-6" />
                                </div>

                                <h3 className="text-lg font-bold text-stone-900 mb-1 group-hover:text-blue-600 transition-colors">
                                    {card.title}
                                </h3>
                                <p className="text-stone-500 text-sm mb-4">
                                    {card.desc}
                                </p>

                                <div className="flex items-center text-sm font-medium text-stone-400 group-hover:text-stone-900 transition-colors">
                                    {card.action} <ArrowRight className="h-4 w-4 ml-1 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Quick Links / Secondary Actions - Only for Branch Accountant / Not Auditor? Or Auditor needs summary too? */}
            {!isAuditor && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-8 border-t border-stone-100">
                    <Link href={`${basePath}/stock-take`} className="p-4 rounded-xl bg-stone-50 hover:bg-stone-100 text-center transition-colors group">
                        <PieChart className="h-6 w-6 mx-auto mb-2 text-stone-400 group-hover:text-stone-600" />
                        <span className="text-sm font-medium text-stone-600 group-hover:text-stone-900">Stock Take</span>
                    </Link>
                    <Link href={`${basePath}/credit-bills`} className="p-4 rounded-xl bg-stone-50 hover:bg-stone-100 text-center transition-colors group">
                        <CreditCard className="h-6 w-6 mx-auto mb-2 text-stone-400 group-hover:text-stone-600" />
                        <span className="text-sm font-medium text-stone-600 group-hover:text-stone-900">Credit Bills</span>
                    </Link>
                    <Link href={`${basePath}/banking`} className="p-4 rounded-xl bg-stone-50 hover:bg-stone-100 text-center transition-colors group">
                        <DollarSign className="h-6 w-6 mx-auto mb-2 text-stone-400 group-hover:text-stone-600" />
                        <span className="text-sm font-medium text-stone-600 group-hover:text-stone-900">Banking</span>
                    </Link>
                    <Link href={`${basePath}/settings`} className="p-4 rounded-xl bg-stone-50 hover:bg-stone-100 text-center transition-colors group">
                        <RefreshCw className="h-6 w-6 mx-auto mb-2 text-stone-400 group-hover:text-stone-600" />
                        <span className="text-sm font-medium text-stone-600 group-hover:text-stone-900">Settings</span>
                    </Link>
                </div>
            )}
        </div>
    );

    function pendingApprovalsCount(title: string) {
        // Mock implementation or use data from stats
        if (title === 'Credit & Paid Bills' && stats.pendingApprovals > 0) return stats.pendingApprovals;
        return 0;
    }
}
