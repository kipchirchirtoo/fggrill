'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    ClipboardList, Clock, CheckCircle, AlertTriangle,
    RefreshCw, BarChart3, ShoppingBag, Package,
    ChevronRight, Calendar as CalendarIcon,
    ShieldCheck, DollarSign, PieChart, TrendingUp,
    FileCheck, Activity, Search, Filter,
    CreditCard, ShoppingCart, FileText, Scale, Trash2,
    Building2, ArrowRight, Users, UserCheck
} from 'lucide-react';
import { auditAPI, storeAPI, restaurantAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useBranch, BranchSelector } from '@/lib/branch-context';
import { toast } from 'sonner';

export default function AuditorDashboard() {
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({
        totalAudits: 0,
        pendingReviews: 0,
        complianceScore: 92,
        highRiskFindings: 0,
        voidedOrders: 0
    });

    const [watchList, setWatchList] = useState<any[]>([]);
    const router = useRouter();
    const { activeBranchId } = useBranch();

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [logsRes, requestsRes, ordersRes, revenueRes] = await Promise.all([
                auditAPI.getAuditLogs({ branchId: activeBranchId || undefined }),
                storeAPI.getBranchRequests('PENDING_AUDIT', activeBranchId || undefined),
                restaurantAPI.getOrders({ status: 'cancelled', branchId: activeBranchId || undefined }),
                auditAPI.verifyRevenue({ branch_id: activeBranchId || undefined })
            ]);

            if (logsRes.success) {
                const logs = logsRes.data || [];
                const pendingRequests = requestsRes.success ? (requestsRes.data || []).length : 0;
                const voidedCount = ordersRes.success ? (ordersRes.data || []).length : 0;

                // Calculate actual metrics based on branch data
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
            }

            if (revenueRes.success && revenueRes.data?.anomalies) {
                setWatchList(revenueRes.data.anomalies.slice(0, 10));
            }
        } catch (e) {
            console.error("Auditor fetch failed:", e);
            toast.error("Failed to refresh dashboard metrics");
        } finally {
            setIsLoading(false);
        }
    }, [activeBranchId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const auditModules = [
        {
            title: 'Shift Verification',
            desc: 'Verify reconciled shifts',
            icon: ClipboardList,
            href: '/dashboard/auditor/shift-verification',
            badge: 'New'
        },
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
        },
        {
            title: 'Financial Sync',
            desc: 'Gateway reconciliation',
            icon: CreditCard,
            href: '/dashboard/auditor/financial-verification',
        }
    ];

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <DashboardLayout>
                <div className="space-y-8 pb-12">
                    {/* Header */}
                    <div className="page-header flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-stone-900 flex items-center justify-center text-white shadow-lg">
                                <ShieldCheck className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="page-title text-stone-900">Audit Control</h1>
                                <p className="page-subtitle">High-integrity verification and system compliance oversight</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <BranchSelector />
                            <button
                                onClick={fetchData}
                                disabled={isLoading}
                                className="btn-secondary"
                                title="Refresh Dashboard"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">Refresh</span>
                            </button>
                        </div>
                    </div>

                    {/* Elite Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="stat-card">
                            <div className="stat-icon">
                                <PieChart className="h-5 w-5" />
                            </div>
                            <p className="stat-value">{stats.complianceScore}%</p>
                            <p className="stat-label">Compliance Score</p>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon text-rose-500 bg-rose-50">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <p className={`stat-value ${stats.highRiskFindings > 0 ? 'text-rose-600' : ''}`}>
                                {stats.highRiskFindings}
                            </p>
                            <p className="stat-label">High Risk Findings</p>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon text-amber-500 bg-amber-50">
                                <Clock className="h-5 w-5" />
                            </div>
                            <p className="stat-value">{stats.pendingReviews}</p>
                            <p className="stat-label">Pending Reviews</p>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon text-blue-500 bg-blue-50">
                                <Trash2 className="h-5 w-5" />
                            </div>
                            <p className="stat-value">{stats.voidedOrders}</p>
                            <p className="stat-label">Voided Orders</p>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* Audit Modules Grid */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="section-header">
                                <div>
                                    <h2 className="section-title">Audit Modules</h2>
                                    <p className="section-subtitle">System verification and oversight modules</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {auditModules.map((module, i) => (
                                    <Link key={i} href={module.href}>
                                        <div className="action-card group">
                                            <div className="action-card-icon group-hover:bg-stone-900 group-hover:text-white transition-colors">
                                                <module.icon className="h-5 w-5" />
                                            </div>
                                            <p className="action-card-label">{module.title}</p>
                                            <p className="text-[11px] text-stone-400 mt-0.5">{module.desc}</p>
                                            {module.badge && (
                                                <span className="mt-2 text-[8px] font-black px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded uppercase tracking-widest">
                                                    {module.badge}
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>

                            <div className="section-header pt-6">
                                <div>
                                    <h2 className="section-title">Personnel & HR Oversight</h2>
                                    <p className="section-subtitle">Staff management and payroll auditing</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <Link href="/dashboard/hr">
                                    <div className="action-card group border-l-4 border-l-stone-900">
                                        <div className="action-card-icon group-hover:bg-stone-900 group-hover:text-white transition-colors">
                                            <Users className="h-5 w-5" />
                                        </div>
                                        <p className="action-card-label">HR Command</p>
                                        <p className="text-[11px] text-stone-400 mt-0.5">Personnel Dashboard</p>
                                    </div>
                                </Link>
                                <Link href="/dashboard/hr/employees">
                                    <div className="action-card group">
                                        <div className="action-card-icon group-hover:bg-stone-900 group-hover:text-white transition-colors">
                                            <UserCheck className="h-5 w-5" />
                                        </div>
                                        <p className="action-card-label">Employee Repo</p>
                                        <p className="text-[11px] text-stone-400 mt-0.5">Staff directory & records</p>
                                    </div>
                                </Link>
                                <Link href="/dashboard/hr/payroll">
                                    <div className="action-card group">
                                        <div className="action-card-icon group-hover:bg-stone-900 group-hover:text-white transition-colors">
                                            <DollarSign className="h-5 w-5" />
                                        </div>
                                        <p className="action-card-label">Payroll Audit</p>
                                        <p className="text-[11px] text-stone-400 mt-0.5">Verify salary processing</p>
                                    </div>
                                </Link>
                            </div>
                        </div>

                        {/* Recent Activity / Exception Feed */}
                        <div className="card-elevated p-6 space-y-6">
                            <div className="section-header">
                                <div>
                                    <h2 className="section-title">Recent Exceptions</h2>
                                    <p className="section-subtitle">Latest critical system flags</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {watchList.length > 0 ? (
                                    watchList.map((item: any, i: number) => (
                                        <div key={i} className="flex gap-4 items-start group pb-4 border-b border-stone-50 last:border-0 last:pb-0 cursor-pointer"
                                            onClick={() => router.push(`/dashboard/auditor/revenue-oversight/details/${item.id}?type=${item.entity_type}`)}>
                                            <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 transition-transform group-hover:scale-125"
                                                style={{ backgroundColor: item.severity === 'HIGH' ? '#ef4444' : item.severity === 'MEDIUM' ? '#f59e0b' : '#d6d3d1' }} />
                                            <div className="flex-1">
                                                <p className="text-[13px] font-medium text-stone-900 line-clamp-1">
                                                    {item.detail}
                                                </p>
                                                <p className="text-[11px] text-stone-400 mt-1 capitalize">
                                                    {item.type.toLowerCase()} • {new Date(item.time).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-stone-200 group-hover:text-stone-400 transition-colors" />
                                        </div>
                                    ))
                                ) : (
                                    <div className="empty-state py-8">
                                        <div className="empty-state-icon">
                                            <ShieldCheck className="h-5 w-5 text-stone-400" />
                                        </div>
                                        <p className="empty-state-title">No critical findings</p>
                                        <p className="empty-state-description">The system is currently operating within normal parameters.</p>
                                    </div>
                                )}
                            </div>
                            <div className="pt-2">
                                <Link href="/dashboard/auditor/revenue-oversight" className="btn-ghost w-full justify-between">
                                    <span>View Audit Watchlist</span>
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}


