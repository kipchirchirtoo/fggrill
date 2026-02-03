'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    ClipboardList, Clock, CheckCircle, AlertTriangle,
    RefreshCw, BarChart3, ShoppingBag, Package,
    ChevronRight, Calendar as CalendarIcon,
    ShieldCheck, DollarSign, PieChart, TrendingUp,
    FileCheck, Activity, Search, Filter,
    CreditCard, ShoppingCart, FileText, Scale, Trash2,
    Building2, ArrowRight
} from 'lucide-react';
import { auditAPI, storeAPI, restaurantAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AuditorDashboard() {
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({
        totalAudits: 0,
        pendingReviews: 0,
        complianceScore: 92,
        highRiskFindings: 0,
        voidedOrders: 0
    });

    const [recentLogs, setRecentLogs] = useState<any[]>([]);
    const router = useRouter();

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [logsRes, requestsRes, ordersRes] = await Promise.all([
                auditAPI.getAuditLogs({}),
                storeAPI.getBranchRequests('PENDING_AUDIT'),
                restaurantAPI.getOrders({ status: 'cancelled' })
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
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const auditModules = [
        {
            title: 'Inventory Flow',
            desc: 'Physical vs theoretical audit',
            icon: Package,
            href: '/dashboard/auditor/stock',
            badge: 'Critical'
        },
        {
            title: 'Revenue Audit',
            desc: 'Transaction verification',
            icon: DollarSign,
            href: '/dashboard/auditor/sales',
            badge: 'Live'
        },
        {
            title: 'Order Tracking',
            desc: 'Branch requisition audit',
            icon: ShoppingCart,
            href: '/dashboard/auditor/orders',
        },
        {
            title: 'Item Analytics',
            desc: 'Volume & performance',
            icon: BarChart3,
            href: '/dashboard/auditor/sold-items',
        },
        {
            title: 'Leakage Control',
            desc: 'Wastage & usage oversight',
            icon: Scale,
            href: '/dashboard/auditor/audit-reports',
        },
        {
            title: 'Kitchen Flow',
            desc: 'Back-of-house requests',
            icon: ShoppingBag,
            href: '/dashboard/auditor/kitchen-requisitions',
        }
    ];

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <DashboardLayout>
                <div className="space-y-8 pb-12">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-black text-stone-900 tracking-tight">Audit Control</h1>
                            <p className="text-stone-500 text-sm font-medium italic">High-integrity verification and system compliance oversight</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={fetchData}
                                disabled={isLoading}
                                className="p-2.5 bg-stone-900 text-white rounded-xl hover:bg-stone-800 shadow-sm transition-colors"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Elite Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="card-elevated p-6 border border-stone-100 bg-white">
                            <div className="flex items-center gap-3 mb-2">
                                <ShieldCheck className="h-4 w-4 text-stone-400" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Compliance</p>
                            </div>
                            <h3 className="text-3xl font-black text-stone-900">{stats.complianceScore}%</h3>
                        </div>
                        <div className="card-elevated p-6 border border-stone-100 bg-white">
                            <div className="flex items-center gap-3 mb-2">
                                <AlertTriangle className="h-4 w-4 text-rose-500" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">High Risk</p>
                            </div>
                            <h3 className={`text-3xl font-black ${stats.highRiskFindings > 0 ? 'text-rose-600' : 'text-stone-900'}`}>
                                {stats.highRiskFindings}
                            </h3>
                        </div>
                        <div className="card-elevated p-6 border border-stone-100 bg-white">
                            <div className="flex items-center gap-3 mb-2">
                                <Clock className="h-4 w-4 text-amber-500" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Pending Actions</p>
                            </div>
                            <h3 className="text-3xl font-black text-stone-900">{stats.pendingReviews}</h3>
                        </div>
                        <div className="card-elevated p-6 border border-stone-100 bg-white">
                            <div className="flex items-center gap-3 mb-2">
                                <Activity className="h-4 w-4 text-blue-500" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Voids & Vetoes</p>
                            </div>
                            <h3 className="text-3xl font-black text-stone-900">{stats.voidedOrders}</h3>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* Audit Modules Grid */}
                        <div className="lg:col-span-2 space-y-6">
                            <h3 className="text-[14px] font-black text-stone-900 uppercase tracking-tight">Audit Modules</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {auditModules.map((module, i) => (
                                    <Link key={i} href={module.href}>
                                        <div className="group p-5 bg-white border border-stone-100 rounded-2xl hover:border-stone-900 hover:shadow-xl hover:shadow-stone-900/5 transition-all flex items-center justify-between cursor-pointer">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-stone-50 flex items-center justify-center text-stone-600 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                                                    <module.icon className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="text-[15px] font-black text-stone-900 tracking-tight">{module.title}</h4>
                                                        {module.badge && (
                                                            <span className="text-[8px] font-black px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded uppercase tracking-widest">
                                                                {module.badge}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[12px] font-medium text-stone-400">{module.desc}</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-stone-200 group-hover:text-stone-900 group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Recent Activity / Exception Feed */}
                        <div className="space-y-6 text-right">
                            <h3 className="text-[14px] font-black text-stone-900 uppercase tracking-tight">Recent Exceptions</h3>
                            <div className="space-y-4">
                                {recentLogs.length > 0 ? (
                                    recentLogs.map((log: any, i: number) => (
                                        <div key={i} className="flex gap-4 items-start group">
                                            <div className="flex-1 text-right">
                                                <p className="text-[13px] font-black text-stone-900 leading-tight group-hover:text-stone-600 transition-colors">
                                                    {log.action}
                                                </p>
                                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">
                                                    {log.module} • {new Date(log.performed_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${log.severity === 'high' ? 'bg-rose-500 shadow-lg shadow-rose-200' :
                                                log.severity === 'medium' ? 'bg-amber-500 shadow-lg shadow-amber-200' :
                                                    'bg-stone-200'
                                                }`} />
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-[12px] text-stone-400 italic font-medium">No critical findings recorded</p>
                                )}
                            </div>
                            <div className="pt-4 border-t border-stone-100">
                                <Link href="/dashboard/auditor/audit-reports">
                                    <button className="text-[11px] font-black text-stone-900 uppercase tracking-widest flex items-center gap-2 ml-auto hover:gap-3 transition-all">
                                        All Reports <ArrowRight className="h-3 w-3" />
                                    </button>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}


