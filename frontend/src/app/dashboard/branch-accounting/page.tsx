'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { financeAPI, storeAPI, accountingAPI, auditAPI, api } from '@/lib/api';
import {
    DollarSign, TrendingUp, TrendingDown, FileText,
    PieChart, CreditCard, RefreshCw, Calendar, ArrowUpRight,
    ArrowDownRight, CheckCircle, Clock, AlertTriangle, Receipt,
    Landmark, History, Book, Shield, FileSpreadsheet, ArrowRightLeft,
    ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { format } from 'date-fns';

export default function BranchAccountingDashboard() {
    const router = useRouter();
    const { user } = useAuth();
    const { activeBranchId, activeBranch } = useBranch();
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

    // Use active branch from context, fallback to user's branch
    const currentBranchId = activeBranchId || user?.branch_id;

    const fetchData = useCallback(async () => {
        if (!currentBranchId) return;

        setIsLoading(true);
        try {
            // Fetch comprehensive branch financials
            const [profileRes, pendingAuditRes] = await Promise.allSettled([
                financeAPI.getBranchFinancials(currentBranchId),
                auditAPI.getPendingApprovals(currentBranchId)
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

                const newAlerts = [];
                const pendingAuditCount = pendingAuditRes.status === 'fulfilled' ? pendingAuditRes.value?.data?.length || 0 : 0;

                if (pendingAuditCount > 0) {
                    newAlerts.push({
                        type: 'warning',
                        message: `${pendingAuditCount} items awaiting audit`,
                        time: 'Action required'
                    });
                }

                const rejectedCount = data.logbooks?.filter((l: any) => l.status === 'rejected').length || 0;
                if (rejectedCount > 0) {
                    newAlerts.push({
                        type: 'danger',
                        message: `${rejectedCount} rejected logbooks`,
                        time: 'Critical'
                    });
                }

                if (data.receivables > 0) {
                    newAlerts.push({
                        type: 'info',
                        message: `KES ${data.receivables.toLocaleString()} in pending receivables`,
                        time: 'Summary'
                    });
                }

                setPendingAlerts(newAlerts);
            }
        } catch (error) {
            console.error('Error fetching accounting data:', error);
            toast.error('Failed to load financial data');
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
        { label: 'Receivables', value: stats.receivables.toLocaleString() + ' KES', icon: ArrowUpRight, color: 'text-blue-600' },
        { label: 'Pending Approvals', value: stats.pendingApprovals.toString(), icon: CheckCircle, color: 'text-stone-500' },
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

                    {/* Revenue Breakdown */}
                    {financials?.summary?.breakdown && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <div className="card-elevated p-5">
                                <h3 className="text-[14px] font-bold text-stone-900 mb-4 border-l-4 border-amber-500 pl-3 uppercase tracking-wider">Revenue Sources</h3>
                                <div className="space-y-3">
                                    {Object.entries(financials.summary.breakdown)
                                        .filter(([key]) => ['restaurant', 'bar', 'room', 'other_income'].includes(key))
                                        .map(([key, value]: [string, any]) => (
                                            <div key={key} className="space-y-1.5">
                                                <div className="flex justify-between text-[12px] font-semibold">
                                                    <span className="capitalize text-stone-600">{key.replace('_', ' ')}</span>
                                                    <span className="text-stone-900">KES {value.toLocaleString()}</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${key === 'restaurant' ? 'bg-emerald-500' :
                                                                key === 'bar' ? 'bg-amber-500' :
                                                                    key === 'room' ? 'bg-blue-500' : 'bg-stone-400'
                                                            }`}
                                                        style={{ width: `${(value / financials.summary.totalRevenue) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>

                            <div className="card-elevated p-5">
                                <h3 className="text-[14px] font-bold text-stone-900 mb-4 border-l-4 border-rose-500 pl-3 uppercase tracking-wider">Expense Analysis</h3>
                                <div className="space-y-3">
                                    {Object.entries(financials.summary.breakdown)
                                        .filter(([key]) => ['operational_expenses', 'other_expenses'].includes(key))
                                        .map(([key, value]: [string, any]) => (
                                            <div key={key} className="space-y-1.5">
                                                <div className="flex justify-between text-[12px] font-semibold">
                                                    <span className="capitalize text-stone-600">{key.replace('_', ' ')}</span>
                                                    <span className="text-stone-900">KES {value.toLocaleString()}</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${key === 'operational_expenses' ? 'bg-rose-500' : 'bg-stone-500'}`}
                                                        style={{ width: `${(value / financials.summary.totalExpenses) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    }
                                    {/* Net Margin indicator */}
                                    <div className="mt-6 pt-4 border-t border-stone-100">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Net Profit Margin</p>
                                                <p className="text-[20px] font-bold text-stone-900">{financials.summary.profitMargin?.toFixed(1)}%</p>
                                            </div>
                                            <div className={`px-2 py-1 rounded text-[10px] font-bold ${financials.summary.profitMargin > 20 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                {financials.summary.profitMargin > 20 ? 'HEALTHY' : 'MONITOR'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bottom Section */}
                    <div className="grid lg:grid-cols-3 gap-5">
                        {/* Action Required / Rejected Logbooks */}
                        {rejectedLogbooks.length > 0 && (
                            <div className="card-elevated p-5 border-l-4 border-l-rose-500 bg-rose-50/30 mb-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-[15px] font-bold text-rose-900 flex items-center gap-2">
                                        <Shield className="h-4 w-4" /> Action Required: Audit Rejections
                                    </h3>
                                    <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                                        {rejectedLogbooks.length}
                                    </span>
                                </div>
                                <div className="space-y-3">
                                    {rejectedLogbooks.map((log) => (
                                        <div key={log.id} className="bg-white p-3 rounded-xl border border-rose-100 shadow-sm flex items-center justify-between group hover:border-rose-300 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="h-9 w-9 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                                                    <AlertTriangle className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-[13px] font-bold text-stone-900">
                                                        {log.type === 'reception' ? 'Reception' : 'Bar'} Log - {format(new Date(log.log_date), 'MMM d')}
                                                    </p>
                                                    <p className="text-[11px] text-rose-600 font-medium truncate max-w-[200px]">
                                                        Reason: {log.audit_notes || 'Instruction pending'}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                className="p-2 hover:bg-rose-50 rounded-lg text-rose-600 flex items-center gap-1 text-[11px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all"
                                                onClick={() => {
                                                    router.push('/dashboard/cashier?tab=logbook');
                                                }}
                                            >
                                                Fix <ArrowRight className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Recent Activity/Transactions */}
                        <div className="lg:col-span-2 card-elevated p-5">
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <h3 className="text-[15px] font-bold text-stone-900 border-l-4 border-emerald-500 pl-3">Financial Activities</h3>
                                    <p className="text-[11px] text-stone-500 pl-3 mt-1">Recent payments and POS orders</p>
                                </div>
                                <div className="flex gap-2">
                                    <Link href="/dashboard/branch-accounting/payments">
                                        <span className="text-[11px] font-bold text-stone-400 hover:text-stone-900 cursor-pointer uppercase tracking-wider bg-stone-50 px-3 py-1.5 rounded-lg transition-colors">View All</span>
                                    </Link>
                                </div>
                            </div>

                            {!financials || (financials.recentPayments?.length === 0 && financials.recentTransactions?.length === 0) ? (
                                <div className="text-center py-10 bg-stone-50/50 rounded-xl border border-dashed border-stone-200">
                                    <Receipt className="h-10 w-10 mx-auto mb-2 text-stone-300" />
                                    <p className="text-sm text-stone-500 font-medium">No recent activities</p>
                                </div>
                            ) : (
                                <div className="grid md:grid-cols-2 gap-6">
                                    {/* Recent Payments */}
                                    <div>
                                        <h4 className="text-[12px] font-bold text-stone-400 uppercase tracking-widest mb-3 px-1">Recent Payments</h4>
                                        <div className="space-y-2">
                                            {financials.recentPayments?.slice(0, 5).map((pay: any) => (
                                                <div key={pay.id} className="flex items-center justify-between p-3 rounded-xl bg-white border border-stone-100 shadow-sm hover:border-emerald-200 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                                                            <CreditCard className="h-4 w-4 text-emerald-600" />
                                                        </div>
                                                        <div>
                                                            <p className="text-[12px] font-bold text-stone-900">{pay.payment_method}</p>
                                                            <p className="text-[10px] text-stone-500">{format(new Date(pay.created_at), 'MMM d, h:mm a')}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[12px] font-bold text-emerald-600">+{pay.amount.toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* POS Activity */}
                                    <div>
                                        <h4 className="text-[12px] font-bold text-stone-400 uppercase tracking-widest mb-3 px-1">POS Activity</h4>
                                        <div className="space-y-2">
                                            {[...(financials.posActivity?.restaurant || []), ...(financials.posActivity?.bar || [])]
                                                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                                .slice(0, 5)
                                                .map((order: any, i: number) => (
                                                    <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white border border-stone-100 shadow-sm hover:border-blue-200 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                                                <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                                                            </div>
                                                            <div>
                                                                <p className="text-[12px] font-bold text-stone-900">Order #{order.order_number}</p>
                                                                <p className="text-[10px] text-stone-500 capitalize">{order.status}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[12px] font-bold text-stone-900">
                                                                {(order.total_amount || order.total || 0).toLocaleString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
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
