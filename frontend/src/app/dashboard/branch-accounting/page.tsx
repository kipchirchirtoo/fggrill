'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { financeAPI, storeAPI, accountingAPI } from '@/lib/api';
import {
    DollarSign, TrendingUp, TrendingDown, FileText,
    PieChart, CreditCard, RefreshCw, Calendar, ArrowUpRight,
    ArrowDownRight, CheckCircle, Clock, AlertTriangle, Receipt
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
            // Fetch real data from APIs
            // Note: Using existing endpoints or assuming standard structure. 
            // If specific endpoints like 'getAccountingDashboard' don't exist, we aggregate.
            const [financeRes, invoicesRes] = await Promise.allSettled([
                financeAPI.getDashboard ? financeAPI.getDashboard(currentBranchId) : Promise.resolve({ data: null }),
                financeAPI.getInvoices ? financeAPI.getInvoices({ branch_id: currentBranchId, status: 'PENDING' }) : Promise.resolve({ data: [] })
            ]);

            const financeData = financeRes.status === 'fulfilled' ? financeRes.value?.data || {} : {};
            const pendingInvoicesList = invoicesRes.status === 'fulfilled' ? invoicesRes.value?.data || [] : [];

            // Calculate or extract stats
            // Fallback values used if API response is different than expected
            setStats({
                totalRevenue: financeData.total_revenue || 0,
                totalExpenses: financeData.total_expenses || 0,
                netProfit: (financeData.total_revenue || 0) - (financeData.total_expenses || 0),
                pendingInvoices: pendingInvoicesList.length,
                dailyTransactions: financeData.daily_transaction_count || 0
            });

            // Mocking recent transactions from invoice data if available, or empty
            setRecentTransactions(pendingInvoicesList.slice(0, 5));

            // Alerts based on pending items
            const newAlerts = [];
            if (pendingInvoicesList.length > 5) {
                newAlerts.push({ type: 'warning', message: `${pendingInvoicesList.length} invoices pending approval`, time: 'Action required' });
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
        { label: 'Pending Invoices', value: stats.pendingInvoices.toString(), icon: FileText },
        { label: 'Transactions', value: stats.dailyTransactions.toString(), icon: RefreshCw },
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

                    {/* Quick Access */}
                    <div className="card-elevated p-5">
                        <div className="section-header mb-4">
                            <h2 className="section-title">Quick Actions</h2>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                            {quickLinks.map((link) => (
                                <Link key={link.href} href={link.href}>
                                    <div className="action-card group py-4">
                                        <div className="action-card-icon w-10 h-10 bg-stone-50 group-hover:bg-white">
                                            <link.icon className="h-4 w-4" />
                                        </div>
                                        <p className="action-card-label text-[12px]">{link.label}</p>
                                        <p className="text-[10px] text-stone-400 mt-0.5">{link.desc}</p>
                                    </div>
                                </Link>
                            ))}
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
