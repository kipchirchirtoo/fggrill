'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    ClipboardList, Clock, CheckCircle, AlertTriangle,
    RefreshCw, BarChart3, ShoppingBag, Package,
    ChevronRight, Calendar as CalendarIcon
} from 'lucide-react';
import { auditAPI, storeAPI, restaurantAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout'; // Changed from BranchAware...
import { BranchSelector, useBranch } from '@/lib/branch-context'; // Import BranchSelector direct
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
        recentFindings: 0,
        voidedOrders: 0,
        estimatedLeakage: 0
    });

    const [recentLogs, setRecentLogs] = useState<any[]>([]);
    const [analytics, setAnalytics] = useState<any>(null);
    const [dateRange, setDateRange] = useState({
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });
    const router = useRouter();

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Use undefined for branchId if activeBranchId is 0 or null to fetch all
            const effectiveBranchId = activeBranchId === 0 ? undefined : (activeBranchId || undefined);

            const [logsRes, requestsRes, ordersRes, reconRes, analyticsRes] = await Promise.all([
                auditAPI.getAuditLogs({ branchId: effectiveBranchId }),
                storeAPI.getBranchRequests('PENDING', effectiveBranchId),
                restaurantAPI.getOrders({ status: 'cancelled', branchId: effectiveBranchId }),
                auditAPI.getReconciliationAudit({ branch_id: effectiveBranchId }),
                auditAPI.getSoldItemsAnalytics({
                    branch_id: effectiveBranchId,
                    from_date: dateRange.startDate,
                    to_date: dateRange.endDate
                })
            ]);

            if (logsRes.success) {
                const logs = logsRes.data || [];
                const pendingCount = requestsRes.success ? (requestsRes.data || []).length : 0;
                const voidedCount = ordersRes.success ? (ordersRes.data || []).length : 0;
                const leakageValue = reconRes.success ? (reconRes.data?.total_leakage_value || 0) : 0;
                const highRisks = logs.filter((l: any) => l.severity === 'high').length + (leakageValue > 5000 ? 1 : 0);

                // Dynamic compliance score calculation
                const score = logs.length > 0
                    ? Math.max(60, 100 - (highRisks * 10) - (logs.filter((l: any) => l.severity === 'medium').length * 2))
                    : 100;

                setStats({
                    totalAudits: logs.length,
                    pendingReviews: pendingCount,
                    complianceScore: Math.round(score),
                    recentFindings: highRisks,
                    voidedOrders: voidedCount,
                    estimatedLeakage: leakageValue
                });

                setRecentLogs(logs.slice(0, 5));
            }

            if (analyticsRes.success) {
                setAnalytics(analyticsRes.data);
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

    const statCards = [
        { label: 'Total Audits', value: stats.totalAudits.toString(), icon: ClipboardList },
        { label: 'Pending Reviews', value: stats.pendingReviews.toString(), icon: Clock },
        { label: 'Compliance Score', value: `${stats.complianceScore}%`, icon: CheckCircle },
        { label: 'High Risks', value: stats.recentFindings.toString(), icon: AlertTriangle },
    ];

    const quickLinks = [
        { href: '/dashboard/auditor/approvals', icon: CheckCircle, label: 'Financial Approvals', desc: 'Expense & Stock sign-off' },
        { href: '/dashboard/auditor/audit-trail', icon: ClipboardList, label: 'Audit Trail', desc: 'Immutable activity logs' },
        { href: '/dashboard/auditor/stock', icon: Package, label: 'Stock Audit', desc: 'Inventory & variance' },
        { href: '/dashboard/auditor/reports', icon: BarChart3, label: 'Reports & Analytics', desc: 'Statement generation' },
    ];

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Internal Audit Oversight</h1>
                            <p className="text-stone-500 mt-0.5">{activeBranchId === 0 ? "Viewing all branches" : `Monitoring ${activeBranch?.name || 'Loading...'}`}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-lg px-3 py-1.5 h-[42px]">
                                <CalendarIcon className="h-4 w-4 text-stone-400" />
                                <input
                                    type="date"
                                    value={dateRange.startDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="text-xs font-medium text-stone-600 outline-none"
                                />
                                <span className="text-stone-300">to</span>
                                <input
                                    type="date"
                                    value={dateRange.endDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="text-xs font-medium text-stone-600 outline-none"
                                />
                            </div>
                            <BranchSelector />
                            <button
                                onClick={fetchData}
                                disabled={isLoading}
                                className="btn-secondary h-[42px]"
                            >
                                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">Refresh</span>
                            </button>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {statCards.map((stat, i) => (
                            <div key={i} className="stat-card">
                                <div className="stat-icon">
                                    <stat.icon className="h-5 w-5" />
                                </div>
                                <p className="stat-value text-[22px]">{stat.value}</p>
                                <p className="stat-label text-[12px] mt-1">{stat.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Custom Analytics Section */}
                    {analytics && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                            <div className="lg:col-span-2 card-elevated p-6 bg-white overflow-hidden relative">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="text-[17px] font-bold text-stone-900 flex items-center gap-2">
                                            <BarChart3 className="h-5 w-5 text-amber-500" />
                                            Sold Items Analytics
                                        </h3>
                                        <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mt-1">Volume Performance by Category</p>
                                    </div>
                                    <button className="text-[11px] font-bold text-stone-400 hover:text-stone-900 uppercase tracking-widest transition-colors">
                                        View Full Report
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {(analytics.category_performance || []).slice(0, 5).map((cat: any, i: number) => (
                                        <div key={i} className="space-y-1.5">
                                            <div className="flex justify-between text-[13px] font-medium">
                                                <span className="text-stone-700">{cat.category || 'Uncategorized'}</span>
                                                <span className="text-stone-900">{cat.total_sold} items</span>
                                            </div>
                                            <div className="h-2 bg-stone-50 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-stone-900 rounded-full transition-all duration-1000"
                                                    style={{ width: `${Math.min(100, (cat.total_sold / (analytics.total_sold || 1)) * 100 * 2)}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    {(!analytics.category_performance || analytics.category_performance.length === 0) && (
                                        <div className="py-20 text-center text-stone-400 text-sm italic">
                                            No sales data captured for this period/branch.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="card-elevated p-6 bg-stone-50 border-none">
                                <h3 className="text-[15px] font-bold text-stone-900 mb-6 flex items-center gap-2">
                                    <ShoppingBag className="h-5 w-5 text-stone-400" />
                                    Top Revenue Drivers
                                </h3>
                                <div className="space-y-4">
                                    {(analytics.top_items || []).slice(0, 3).map((item: any, i: number) => (
                                        <div key={i} className="p-4 bg-white rounded-xl shadow-sm border border-stone-100">
                                            <p className="text-[13px] font-bold text-stone-900">{item.item_name}</p>
                                            <div className="flex justify-between items-end mt-2">
                                                <div>
                                                    <p className="text-[10px] text-stone-400 uppercase font-bold tracking-tight">Units Sold</p>
                                                    <p className="text-[15px] font-black text-stone-700">{item.total_quantity}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] text-stone-400 uppercase font-bold tracking-tight">Revenue</p>
                                                    <p className="text-[15px] font-black text-stone-900">KES {item.total_revenue?.toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {(!analytics.top_items || analytics.top_items.length === 0) && (
                                        <p className="text-center py-10 text-stone-300 text-xs italic">No items recorded</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quick Access */}
                    <div className="card-elevated p-6">
                        <div className="section-header mb-4">
                            <div>
                                <h2 className="section-title">Audit Modules</h2>
                                <p className="section-subtitle">Core compliance tracking</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                            {quickLinks.map((link) => (
                                <Link key={link.href} href={link.href}>
                                    <div className="action-card group py-3">
                                        <div className="action-card-icon w-10 h-10">
                                            <link.icon className="h-4 w-4" />
                                        </div>
                                        <p className="action-card-label text-[12px]">{link.label}</p>
                                        <p className="text-[11px] text-stone-400 mt-0.5">{link.desc}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Risk & Activities Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="card-elevated p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[15px] font-semibold text-stone-900">Live Risk Indicators</h3>
                            </div>
                            <div className="space-y-3">
                                <RiskItem title="Voided Orders (Today)" value={stats.voidedOrders.toString()} risk={stats.voidedOrders > 5 ? 'high' : stats.voidedOrders > 0 ? 'medium' : 'low'} />
                                <RiskItem title="Pending Stock Requests" value={stats.pendingReviews.toString()} risk={stats.pendingReviews > 10 ? 'high' : stats.pendingReviews > 0 ? 'medium' : 'low'} />
                                <RiskItem title="Stock vs Sales Leakage" value={`KES ${stats.estimatedLeakage.toLocaleString()}`} risk={stats.estimatedLeakage > 5000 ? 'high' : stats.estimatedLeakage > 0 ? 'medium' : 'low'} />
                                <RiskItem title="Audit Exceptions" value={stats.recentFindings.toString()} risk={stats.recentFindings > 0 ? 'high' : 'low'} />
                            </div>
                        </div>

                        <div className="card-elevated p-5">
                            <h3 className="text-[15px] font-semibold text-stone-900 mb-4">Recent Audit Activity</h3>
                            <div className="space-y-3">
                                {recentLogs.length > 0 ? (
                                    recentLogs.map((log: any) => (
                                        <div key={log.id} className="p-3 rounded-lg bg-stone-50 hover:bg-stone-100 transition-colors cursor-pointer group">
                                            <div className="flex items-start gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${log.severity === 'high' ? 'bg-rose-100/50' : 'bg-stone-200'
                                                    }`}>
                                                    {log.severity === 'high' ? (
                                                        <AlertTriangle className="h-4 w-4 text-rose-600" />
                                                    ) : (
                                                        <RefreshCw className="h-4 w-4 text-stone-600" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[12px] font-medium text-stone-800 truncate">{log.action}</p>
                                                    <p className="text-[10px] text-stone-400 mt-0.5">
                                                        {log.module} • {new Date(log.performed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                <ChevronRight className="h-3.5 w-3.5 text-stone-300 group-hover:text-stone-400 transition-colors mt-1" />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-stone-400 text-sm">
                                        No recent activity detected
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}

const RiskItem = ({ title, value, risk }: { title: string, value: string, risk: 'high' | 'medium' | 'low' }) => {
    const colors = {
        high: 'text-rose-600 bg-rose-50',
        medium: 'text-amber-600 bg-amber-50',
        low: 'text-emerald-600 bg-emerald-50'
    };
    return (
        <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
            <span className="text-[13px] font-medium text-stone-700">{title}</span>
            <span className={`text-[12px] font-bold px-2 py-0.5 rounded ${colors[risk]}`}>{value}</span>
        </div>
    );
};
