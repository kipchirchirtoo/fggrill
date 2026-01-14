'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { financeAPI, storeAPI, accountingAPI, auditAPI } from '@/lib/api';
import {
    DollarSign, TrendingUp, TrendingDown, FileText,
    PieChart, CreditCard, RefreshCw, Calendar, ArrowUpRight,
    ArrowDownRight, CheckCircle, Clock, AlertTriangle, Receipt,
    Landmark, History, Book, Shield, FileSpreadsheet, ArrowRightLeft
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export default function BranchAccountingDashboard() {
    const { user } = useAuth();
    const { activeBranchId, activeBranch } = useBranch();
    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        pendingInvoices: 0,
        dailyTransactions: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
    const [pendingAlerts, setPendingAlerts] = useState<any[]>([]);

    // Use active branch from context, fallback to user's branch
    const currentBranchId = activeBranchId || user?.branch_id;

    const fetchData = useCallback(async () => {
        if (!currentBranchId) return;

        setIsLoading(true);
        try {
            // Fetch real data from accounting and audit APIs
            const [plRes, auditRes, invoicesRes] = await Promise.allSettled([
                accountingAPI.getProfitAndLoss({ branch_id: currentBranchId }),
                auditAPI.getPendingApprovals(currentBranchId),
                financeAPI.getInvoices({ branch_id: currentBranchId, status: 'pending' })
            ]);

            const plData = plRes.status === 'fulfilled' ? plRes.value?.data || {} : {};
            const auditData = auditRes.status === 'fulfilled' ? auditRes.value?.data || [] : [];
            const pendingInvoicesList = invoicesRes.status === 'fulfilled' ? invoicesRes.value?.data || [] : [];

            setStats({
                totalRevenue: plData.revenue_total || 0,
                totalExpenses: plData.expense_total || 0,
                netProfit: plData.net_profit || 0,
                pendingInvoices: auditData.length,
                dailyTransactions: plData.transaction_count || 0
            });

            setRecentTransactions(pendingInvoicesList.slice(0, 5));

            const newAlerts = [];
            if (auditData.length > 0) {
                newAlerts.push({ type: 'warning', message: `${auditData.length} records requiring audit approval`, time: 'Action required' });
            }
            if (pendingInvoicesList.length > 5) {
                newAlerts.push({ type: 'info', message: `${pendingInvoicesList.length} invoices pending payment`, time: 'Ongoing' });
            }
            setPendingAlerts(newAlerts);

        } catch (error) {
            console.error('Error fetching accounting data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [currentBranchId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const quickLinks = [
        { href: '/dashboard/branch-accounting/stock-take', icon: PieChart, label: 'Stock Take', desc: 'Inventory' },
        { href: '/dashboard/branch-accounting/invoices', icon: FileText, label: 'Invoices', desc: 'Billing' },
        { href: '/dashboard/branch-accounting/payments', icon: CreditCard, label: 'Payments', desc: 'Transactions' },
        { href: '/dashboard/branch-accounting/expenses', icon: Receipt, label: 'Expenses', desc: 'Costs' },
        { href: '/dashboard/branch-accounting/reports', icon: TrendingUp, label: 'Reports', desc: 'Analysis' },
    ];

    const statCards = [
        { label: 'Total Revenue', value: stats.totalRevenue.toLocaleString() + ' KES', icon: DollarSign, color: 'text-emerald-600' },
        { label: 'Total Expenses', value: stats.totalExpenses.toLocaleString() + ' KES', icon: ArrowDownRight, color: 'text-rose-600' },
        { label: 'Net Profit', value: stats.netProfit.toLocaleString() + ' KES', icon: TrendingUp, color: 'text-amber-600' },
        { label: 'Pending Approvals', value: stats.pendingInvoices.toString(), icon: CheckCircle, color: 'text-blue-600' },
        { label: 'Daily Transactions', value: stats.dailyTransactions.toString(), icon: History, color: 'text-stone-500' },
    ];
    const accountingModules = [
        {
            title: 'Stock Management',
            icon: PieChart,
            links: [
                { label: 'Stock Take', href: '/dashboard/branch-accounting/stock-take' },
                { label: 'Stock Valuation', href: '/dashboard/branch-accounting/reports?tab=valuation' }
            ],
            stats: 'Inventory oversight'
        },
        {
            title: 'Credit & Bills',
            icon: CreditCard,
            links: [
                { label: 'Customer Credit', href: '/dashboard/branch-accounting/credit-bills/customer' },
                { label: 'Invoices', href: '/dashboard/branch-accounting/invoices' }
            ],
            stats: 'Receivables'
        },
        {
            title: 'Banking',
            icon: Landmark,
            links: [
                { label: 'Bank Deposits', href: '/dashboard/branch-accounting/banking/deposits' },
                { label: 'Reconciliation', href: '/dashboard/branch-accounting/banking/reconciliation' }
            ],
            stats: 'Cash flow'
        },
        {
            title: 'Audit & Reports',
            icon: History,
            links: [
                { label: 'Verify Daily Sales', href: '/dashboard/branch-accounting/verify-sales' },
                { label: 'Financial Reports', href: '/dashboard/branch-accounting/reports' },
                { label: 'Audit Trail', href: '/dashboard/branch-accounting/audit-trail' }
            ],
            stats: 'Compliance'
        }
    ];

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Financial Dashboard</h1>
                            <p className="text-stone-500 mt-0.5">{activeBranch?.name || user?.branch_name || 'Branch Operations'}</p>
                        </div>
                        <button
                            onClick={fetchData}
                            disabled={isLoading}
                            className="btn-secondary"
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            <span>Refresh</span>
                        </button>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        {statCards.map((stat, i) => (
                            <div key={i} className="stat-card">
                                <div className="stat-icon">
                                    <stat.icon className={`h-5 w-5 ${stat.color || 'text-stone-600'}`} />
                                </div>
                                <p className="stat-value text-[20px] lg:text-[22px] truncate">{stat.value}</p>
                                <p className="stat-label text-[12px] mt-1">{stat.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Modules Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {accountingModules.map((module) => (
                            <div key={module.title} className="card-elevated p-5 hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="h-10 w-10 rounded-xl bg-stone-50 flex items-center justify-center">
                                        <module.icon className="h-5 w-5 text-stone-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-[14px] font-semibold text-stone-900">{module.title}</h3>
                                        <p className="text-[11px] text-stone-500 font-medium">{module.stats}</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {module.links.map((link) => (
                                        <Link key={link.href} href={link.href}>
                                            <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-stone-50 group transition-colors">
                                                <span className="text-[12px] text-stone-600 group-hover:text-stone-900 font-medium">{link.label}</span>
                                                <ArrowUpRight className="h-3 w-3 text-stone-300 group-hover:text-stone-600 transition-all opacity-0 group-hover:opacity-100" />
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Quick Access */}
                    <div className="card-elevated p-5 bg-gradient-to-br from-stone-900 to-stone-800 text-white">
                        <div className="section-header mb-4 border-white/10">
                            <h2 className="section-title text-white">Daily Operations</h2>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            <Link href="/dashboard/branch-accounting/stock-take">
                                <div className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-center transition-all group">
                                    <h4 className="text-[12px] font-semibold mb-1 text-white">New Stock Take</h4>
                                    <p className="text-[10px] text-stone-400">Inventory check</p>
                                </div>
                            </Link>
                            <Link href="/dashboard/branch-accounting/invoices/new">
                                <div className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-center transition-all group">
                                    <h4 className="text-[12px] font-semibold mb-1 text-white">New Invoice</h4>
                                    <p className="text-[10px] text-stone-400">Step-by-step</p>
                                </div>
                            </Link>
                            <Link href="/dashboard/branch-accounting/quotations/new">
                                <div className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-center transition-all group">
                                    <h4 className="text-[12px] font-semibold mb-1 text-white">New Quotation</h4>
                                    <p className="text-[10px] text-stone-400">Draft estimate</p>
                                </div>
                            </Link>
                            <Link href="/dashboard/branch-accounting/accounting-tools/journal-entries/new">
                                <div className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-center transition-all group">
                                    <h4 className="text-[12px] font-semibold mb-1 text-white">New Journal</h4>
                                    <p className="text-[10px] text-stone-400">Record entry</p>
                                </div>
                            </Link>
                            <Link href="/dashboard/branch-accounting/accounting-tools/period-management">
                                <div className="p-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-center transition-all group">
                                    <h4 className="text-[12px] font-semibold mb-1 text-blue-200">Close Period</h4>
                                    <p className="text-[10px] text-blue-400/70">Month-end</p>
                                </div>
                            </Link>
                        </div>
                    </div>

                    {/* Bottom Section */}
                    <div className="grid lg:grid-cols-3 gap-5">
                        {/* Recent Activity/Transactions */}
                        <div className="lg:col-span-2 card-elevated p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[15px] font-semibold text-stone-900">Recent Transactions</h3>
                                <Link href="/dashboard/branch-accounting/payments">
                                    <span className="text-[12px] font-medium text-stone-500 hover:text-stone-900 cursor-pointer">View All</span>
                                </Link>
                            </div>

                            {recentTransactions.length === 0 ? (
                                <div className="text-center py-10 bg-stone-50/50 rounded-xl border border-dashed border-stone-200">
                                    <Receipt className="h-10 w-10 mx-auto mb-2 text-stone-300" />
                                    <p className="text-sm text-stone-500 font-medium">No recent transactions</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {recentTransactions.map((tx, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-stone-50 border border-stone-100">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-full bg-white border border-stone-200 flex items-center justify-center">
                                                    <FileText className="h-4 w-4 text-stone-500" />
                                                </div>
                                                <div>
                                                    <p className="text-[13px] font-semibold text-stone-900">{tx.invoice_number || 'Transaction'}</p>
                                                    <p className="text-[11px] text-stone-500">{tx.supplier?.name || 'Unknown Supplier'}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[13px] font-bold text-stone-900">KES {(tx.amount || 0).toLocaleString()}</p>
                                                <p className="text-[10px] text-amber-600 font-medium">{tx.status || 'Pending'}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Alerts */}
                        <div className="card-elevated p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[15px] font-semibold text-stone-900">Notifications</h3>
                                {pendingAlerts.length > 0 && (
                                    <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{pendingAlerts.length}</span>
                                )}
                            </div>

                            {pendingAlerts.length === 0 ? (
                                <div className="text-center py-6 text-stone-400 text-sm">
                                    <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                    <p>All caught up</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {pendingAlerts.map((alert, i) => (
                                        <div key={i} className="p-3 rounded-lg bg-amber-50 border border-amber-100/50">
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="text-[12px] font-semibold text-stone-900">{alert.message}</p>
                                                    <p className="text-[10px] text-stone-500 mt-0.5">{alert.time}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
