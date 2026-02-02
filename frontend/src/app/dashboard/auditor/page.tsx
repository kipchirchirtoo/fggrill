'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    ClipboardList, Clock, CheckCircle, AlertTriangle,
    RefreshCw, BarChart3, ShoppingBag, Package,
    ChevronRight, Calendar as CalendarIcon,
    ShieldCheck, DollarSign, PieChart, TrendingUp,
    FileCheck, Activity, Search, Filter,
    CreditCard, ShoppingCart, FileText, Scale
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
                storeAPI.getBranchRequests('PENDING', effectiveBranchId),
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
            title: 'Compare items sold against requisitions',
            desc: 'Compare items sold against requisitions to detect leakage or stock errors.',
            icon: Scale,
            href: '/dashboard/auditor/audit-reports',
            color: 'bg-rose-50 text-rose-600 border-rose-100',
            stats: 'Reconciliation report'
        }
    ];

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <DashboardLayout>
                <div className="space-y-8 max-w-[1400px] mx-auto pb-10">
                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-stone-100">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <ShieldCheck className="h-6 w-6 text-stone-900" />
                                <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Auditor Control Center</span>
                            </div>
                            <h1 className="text-[32px] font-black text-stone-900 tracking-tight leading-none">Internal Audit & Verification</h1>
                            <p className="text-stone-500 mt-3 font-medium">
                                {activeBranchId === 0 ? "Corporate-wide oversight across all branches" : `Comprehensive verification for ${activeBranch?.name}`}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <BranchSelector />
                            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-4 py-2 h-[48px] shadow-sm">
                                <CalendarIcon className="h-4 w-4 text-stone-400" />
                                <span className="text-sm font-bold text-stone-600">Period:</span>
                                <input
                                    type="date"
                                    value={dateRange.startDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="text-sm font-semibold text-stone-900 outline-none bg-transparent"
                                />
                                <span className="text-stone-300">→</span>
                                <input
                                    type="date"
                                    value={dateRange.endDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="text-sm font-semibold text-stone-900 outline-none bg-transparent"
                                />
                            </div>
                            <button
                                onClick={fetchData}
                                disabled={isLoading}
                                className="h-[48px] px-6 bg-stone-900 text-white rounded-xl font-bold flex items-center gap-2 transition-transform active:scale-95 hover:bg-black shadow-md shadow-stone-200"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                Refresh Oversight
                            </button>
                        </div>
                    </div>

                    {/* Key Metrics Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <MetricCard
                            label="Compliance Score"
                            value={`${stats.complianceScore}%`}
                            trend={2.4}
                            icon={CheckCircle}
                            color="emerald"
                        />
                        <MetricCard
                            label="Audit Findings"
                            value={stats.highRiskFindings.toString()}
                            subLabel="High risk exceptions"
                            icon={AlertTriangle}
                            color="rose"
                            invertTrend
                        />
                        <MetricCard
                            label="Pending Approvals"
                            value={stats.pendingReviews.toString()}
                            subLabel="Stock & inventory"
                            icon={Clock}
                            color="amber"
                        />
                        <MetricCard
                            label="Voided Transactions"
                            value={stats.voidedOrders.toString()}
                            subLabel="POS cancellations"
                            icon={Activity}
                            color="stone"
                        />
                    </div>

                    {/* MVP Core Modules Grid */}
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-px bg-stone-200 flex-1"></div>
                            <h2 className="text-[14px] font-black uppercase tracking-[0.2em] text-stone-400">Core Verification Modules</h2>
                            <div className="h-px bg-stone-200 flex-1"></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {mvpModules.map((module, i) => (
                                <Link key={i} href={module.href} className="group">
                                    <div className="h-full border border-stone-200 bg-white rounded-2xl p-6 transition-all duration-300 group-hover:border-stone-900 group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] flex flex-col relative overflow-hidden">
                                        {/* Background accent */}
                                        <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-[0.03] transition-transform duration-500 group-hover:scale-150 ${module.color}`}></div>

                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border mb-6 group-hover:animate-pulse transition-colors ${module.color}`}>
                                            <module.icon className="h-7 w-7" />
                                        </div>

                                        <h3 className="text-[20px] font-black text-stone-900 mb-2 leading-tight group-hover:text-stone-900 transition-colors">{module.title}</h3>
                                        <p className="text-stone-500 text-[14px] leading-relaxed mb-6 flex-grow ">
                                            {module.desc}
                                        </p>

                                        <div className="flex items-center justify-between mt-auto pt-6 border-t border-stone-50">
                                            <span className="text-[12px] font-black tracking-tight text-stone-400 group-hover:text-stone-700 transition-colors">
                                                {module.stats}
                                            </span>
                                            <div className="w-8 h-8 rounded-full border border-stone-200 flex items-center justify-center group-hover:bg-stone-900 group-hover:border-stone-900 group-hover:text-white transition-all">
                                                <ChevronRight className="h-4 w-4" />
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}

                            {/* Audit Plan Quick Action */}
                            <div className="border-2 border-dashed border-stone-200 rounded-2xl p-6 flex flex-col justify-center items-center text-center group cursor-pointer hover:border-stone-400 transition-colors">
                                <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mb-4 group-hover:bg-stone-200 transition-colors">
                                    <ClipboardList className="h-5 w-5 text-stone-500" />
                                </div>
                                <h3 className="text-[16px] font-bold text-stone-900">Initiate Audit Plan</h3>
                                <p className="text-xs text-stone-400 mt-1 max-w-[150px]">Define scope and schedule for upcoming internal audits</p>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Section: Recent Findings & Tools */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-8">
                        <div className="lg:col-span-2">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-[18px] font-black text-stone-900">Recent Audit Exceptions</h3>
                                <Link href="/dashboard/auditor/exceptions" className="text-[13px] font-bold text-stone-400 hover:text-stone-800 transition-colors">View All Exceptions</Link>
                            </div>

                            <div className="bg-white border border-stone-200 rounded-3xl overflow-hidden shadow-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-stone-50 border-b border-stone-100">
                                        <tr>
                                            <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-stone-400">Activity / Finding</th>
                                            <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-stone-400">Department</th>
                                            <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-stone-400">Severity</th>
                                            <th className="px-6 py-4 text-[11px] font-black uppercase tracking-widest text-stone-400">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-50">
                                        {recentLogs.length > 0 ? (
                                            recentLogs.map((log: any, i: number) => (
                                                <tr key={i} className="hover:bg-stone-50/50 transition-colors group cursor-pointer">
                                                    <td className="px-6 py-4">
                                                        <p className="text-[14px] font-bold text-stone-900">{log.action}</p>
                                                        <p className="text-[11px] text-stone-400 mt-0.5">{new Date(log.performed_at).toLocaleString()}</p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-[12px] font-bold text-stone-600 px-2 py-0.5 bg-stone-100 rounded">{log.module}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className={`w-2.5 h-2.5 rounded-full ${log.severity === 'high' ? 'bg-rose-500' : log.severity === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <ChevronRight className="h-4 w-4 text-stone-200 group-hover:text-stone-900 transition-colors" />
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-20 text-center text-stone-400 text-sm italic">
                                                    No recent audit findings recorded
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-[18px] font-black text-stone-900">Audit Health</h3>
                            <div className="bg-stone-900 rounded-3xl p-8 text-white relative overflow-hidden">
                                <PieChart className="absolute -right-6 -bottom-6 w-32 h-32 opacity-10 " />
                                <h4 className="text-[13px] font-bold uppercase tracking-widest text-stone-400 mb-6">Transparency Overview</h4>

                                <div className="space-y-6 relative z-10">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-bold uppercase">
                                            <span className="text-stone-400">Operational Consistency</span>
                                            <span>94%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-stone-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 w-[94%]" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-bold uppercase">
                                            <span className="text-stone-400">Documentation Coverage</span>
                                            <span>87%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-stone-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 w-[87%]" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-bold uppercase">
                                            <span className="text-stone-400">Leakage Defense</span>
                                            <span>72%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-stone-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-amber-500 w-[72%]" />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-10 pt-8 border-t border-stone-800 flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-stone-800 flex items-center justify-center font-black text-stone-400">
                                        KES
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-tighter text-stone-400">Calculated Leakage Risk</p>
                                        <p className="text-[18px] font-black">42,500.00</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}

const MetricCard = ({ label, value, subLabel, trend, icon: Icon, color, invertTrend }: any) => {
    const colorMap: any = {
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        rose: 'bg-rose-50 text-rose-600 border-rose-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        stone: 'bg-stone-50 text-stone-600 border-stone-100'
    };

    return (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm hover:border-stone-300 transition-colors">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 rounded-xl border ${colorMap[color]}`}>
                    <Icon className="h-5 w-5" />
                </div>
                {trend && (
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${trend > 0 ? (invertTrend ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700') : 'bg-stone-100 text-stone-600'
                        }`}>
                        {trend > 0 ? '+' : ''}{trend}%
                    </span>
                )}
            </div>
            <div>
                <p className="text-[28px] font-black text-stone-900 tracking-tight leading-none mb-1">{value}</p>
                <p className="text-[13px] font-bold text-stone-500 uppercase tracking-tight">{label}</p>
                {subLabel && <p className="text-[11px] text-stone-400 mt-1">{subLabel}</p>}
            </div>
        </div>
    );
};
