'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    ClipboardList, Clock, CheckCircle, AlertTriangle,
    RefreshCw, BarChart3, ShoppingBag, Package,
    ChevronRight, Calendar as CalendarIcon,
    ShieldCheck, DollarSign, PieChart, TrendingUp,
    FileCheck, Activity, Search, Filter,
    CreditCard, ShoppingCart, FileText, Scale, Trash2
} from 'lucide-react';
import { auditAPI, storeAPI, restaurantAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { BranchSelector, useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AuditorDashboard() {
    const { activeBranchId, activeBranch } = useBranch();
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({
        totalAudits: 0,
        pendingReviews: 0,
        complianceScore: 92,
        highRiskFindings: 0,
        voidedOrders: 0
    });

    const [recentLogs, setRecentLogs] = useState<any[]>([]);
    const [dateRange, setDateRange] = useState({
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });
    const router = useRouter();

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const effectiveBranchId = activeBranchId === 0 ? undefined : (activeBranchId || undefined);

            const [logsRes, requestsRes, ordersRes] = await Promise.all([
                auditAPI.getAuditLogs({ branchId: effectiveBranchId }),
                storeAPI.getBranchRequests('PENDING_AUDIT', effectiveBranchId),
                restaurantAPI.getOrders({ status: 'cancelled', branchId: effectiveBranchId })
            ]);

            if (logsRes.success) {
                const logs = logsRes.data || [];
                const pendingRequests = requestsRes.success ? (requestsRes.data || []).length : 0;
                const voidedCount = ordersRes.success ? (ordersRes.data || []).length : 0;
                const highRisks = logs.filter((l: any) => l.severity === 'high').length;

                const score = logs.length > 0
                    ? Math.max(60, 100 - (highRisks * 10) - (logs.filter((l: any) => l.severity === 'medium').length * 2))
                    : 100;

                setStats({
                    totalAudits: logs.length,
                    pendingReviews: pendingRequests,
                    complianceScore: Math.round(score),
                    highRiskFindings: highRisks,
                    voidedOrders: voidedCount
                });

                setRecentLogs(logs.slice(0, 5));
            }
        } catch (e) {
            console.error("Auditor fetch failed:", e);
        } finally {
            setIsLoading(false);
        }
    }, [activeBranchId, dateRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const mvpModules = [
        {
            title: 'Approve Stock Requests',
            desc: 'Review and approve/reject stock replenishment requests from branches.',
            icon: CheckCircle,
            href: '/dashboard/auditor/approvals',
            color: 'bg-stone-900 text-white border-stone-800',
            stats: `${stats.pendingReviews} pending requests`
        },
        {
            title: 'Confirm Sales',
            desc: 'Verify daily transactions and reconcile POS records with physical collections.',
            icon: CreditCard,
            href: '/dashboard/auditor/sales',
            color: 'bg-blue-50 text-blue-600 border-blue-100',
            stats: `${stats.voidedOrders} voided orders`
        },
        {
            title: 'Confirm Stock Levels',
            desc: 'Perform spot checks and verify physical stock movements against theoretical use.',
            icon: Package,
            href: '/dashboard/auditor/stock',
            color: 'bg-amber-50 text-amber-600 border-amber-100',
            stats: 'Inventory variance audit'
        },
        {
            title: 'Confirm Branch Orders',
            desc: 'Match orders from branches against actual sales and consumption data.',
            icon: ShoppingCart,
            href: '/dashboard/auditor/orders',
            color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
            stats: 'Order reconciliation'
        },
        {
            title: 'View Items Sold',
            desc: 'Detailed analytics of item performance and sales across all branches.',
            icon: FileText,
            href: '/dashboard/auditor/sold-items',
            color: 'bg-purple-50 text-purple-600 border-purple-100',
            stats: 'Sales performance view'
        },
        {
            title: 'Kitchen Requisitions',
            desc: 'Monitor and review kitchen-to-store requisition activity.',
            icon: ShoppingBag,
            href: '/dashboard/auditor/kitchen-requisitions',
            color: 'bg-orange-50 text-orange-600 border-orange-100',
            stats: 'Requisition oversight'
        },
        {
            title: 'Compare items sold against requisitions',
            desc: 'Compare items sold against requisitions to detect leakage or stock errors.',
            icon: Scale,
            href: '/dashboard/auditor/audit-reports',
            color: 'bg-rose-50 text-rose-600 border-rose-100',
            stats: 'Reconciliation report'
        },
        {
            title: 'Kitchen Usage Oversight',
            desc: 'Analyze manual usage entries and staff meal consumption.',
            icon: ClipboardList,
            href: '/dashboard/auditor/kitchen-usage',
            color: 'bg-indigo-50 text-indigo-600 border-indigo-100',
            stats: 'Usage analysis'
        },
        {
            title: 'Kitchen Wastage Oversight',
            desc: 'Monitor kitchen spoilage and wastage reports across branches.',
            icon: Trash2,
            href: '/dashboard/auditor/kitchen-wastage',
            color: 'bg-red-50 text-red-600 border-red-100',
            stats: 'Wastage analysis'
        }
    ];

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Auditor Dashboard</h1>
                            <p className="text-stone-500 mt-0.5">Internal audit and verification oversight</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <BranchSelector />
                            <button
                                onClick={fetchData}
                                disabled={isLoading}
                                className="btn-secondary"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span>Refresh</span>
                            </button>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="stat-card">
                            <div className="stat-icon"><CheckCircle className="h-5 w-5" /></div>
                            <p className="stat-value">{stats.complianceScore}%</p>
                            <p className="stat-label mt-1">Compliance Score</p>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon"><AlertTriangle className="h-5 w-5" /></div>
                            <p className="stat-value">{stats.highRiskFindings}</p>
                            <p className="stat-label mt-1">High Risk Findings</p>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon"><Clock className="h-5 w-5" /></div>
                            <p className="stat-value">{stats.pendingReviews}</p>
                            <p className="stat-label mt-1">Pending Stock Approvals</p>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon"><Activity className="h-5 w-5" /></div>
                            <p className="stat-value">{stats.voidedOrders}</p>
                            <p className="stat-label mt-1">Voided Transactions</p>
                        </div>
                    </div>

                    {/* Quick Access / Modules */}
                    <div className="card-elevated p-6">
                        <div className="section-header">
                            <div>
                                <h2 className="section-title">Core Modules</h2>
                                <p className="section-subtitle">Primary verification and approval tools</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            {mvpModules.map((module, i) => (
                                <Link key={i} href={module.href}>
                                    <div className="action-card group h-full">
                                        <div className="action-card-icon">
                                            <module.icon className="h-5 w-5" />
                                        </div>
                                        <p className="action-card-label">{module.title}</p>
                                        <p className="text-[11px] text-stone-400 mt-1 leading-tight">{module.stats}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Recent Exceptions & Audit Tools */}
                    <div className="grid lg:grid-cols-3 gap-6">
                        {/* Recent Exceptions Table */}
                        <div className="lg:col-span-2 card-elevated p-6">
                            <div className="section-header">
                                <div>
                                    <h3 className="section-title">Recent Audit Exceptions</h3>
                                    <p className="section-subtitle">Flagged activities requiring attention</p>
                                </div>
                                <Link href="/dashboard/auditor/audit-reports" className="text-[13px] font-medium text-stone-400 hover:text-stone-800 transition-colors">View All</Link>
                            </div>

                            <div className="overflow-x-auto -mx-6">
                                <table className="w-full text-left">
                                    <thead className="bg-stone-50 border-y border-stone-100">
                                        <tr>
                                            <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">Activity / Finding</th>
                                            <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">Dept</th>
                                            <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">Severity</th>
                                            <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-50">
                                        {recentLogs.length > 0 ? (
                                            recentLogs.map((log: any, i: number) => (
                                                <tr key={i} className="hover:bg-stone-50/50 transition-colors group cursor-pointer">
                                                    <td className="px-6 py-4">
                                                        <p className="text-[13px] font-medium text-stone-900">{log.action}</p>
                                                        <p className="text-[11px] text-stone-400 mt-0.5">{new Date(log.performed_at).toLocaleDateString()}</p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-[11px] font-semibold text-stone-500 uppercase">{log.module}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className={`w-2 h-2 rounded-full ${log.severity === 'high' ? 'bg-rose-500' : log.severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-900 transition-colors inline" />
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center text-stone-400 text-[13px] italic">
                                                    No recent findings recorded
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Audit Health Summary */}
                        {/* System Status */}
                        <div className="card-elevated p-6">
                            <h3 className="section-title mb-4">System Status</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                                    <span className="text-[13px] text-stone-600">Active Audits</span>
                                    <span className="text-[14px] font-semibold text-stone-900">{stats.totalAudits}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                                    <span className="text-[13px] text-stone-600">Pending Reviews</span>
                                    <span className="text-[14px] font-semibold text-stone-900">{stats.pendingReviews}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                                    <span className="text-[13px] text-stone-600">Audit System</span>
                                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-stone-700">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        Operational
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}


