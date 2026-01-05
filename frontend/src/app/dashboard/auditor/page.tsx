'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    ClipboardList, Clock, CheckCircle, AlertTriangle,
    RefreshCw, BarChart3, TrendingUp, ShoppingBag, Package,
    Truck, ArrowUpRight, ChevronRight, Calculator
} from 'lucide-react';
import { auditAPI, storeAPI, restaurantAPI } from '@/lib/api';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AuditorDashboard() {
    const { activeBranchId } = useBranch();
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({ totalAudits: 0, pendingReviews: 0, complianceScore: 92, recentFindings: 0, voidedOrders: 0 });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [logsRes, requestsRes, ordersRes] = await Promise.all([
                auditAPI.getAuditLogs({ branchId: activeBranchId || undefined }),
                storeAPI.getBranchRequests(activeBranchId ? 'PENDING' : undefined, activeBranchId || undefined),
                restaurantAPI.getOrders({ status: 'cancelled', branchId: activeBranchId || undefined })
            ]);

            if (logsRes.success) {
                const data = logsRes.data || [];
                const pendingCount = requestsRes.success ? (requestsRes.data || []).length : 0;
                const voidedCount = ordersRes.success ? (ordersRes.data || []).length : 0;

                setStats(prev => ({
                    ...prev,
                    totalAudits: data.length,
                    pendingReviews: pendingCount,
                    recentFindings: data.filter((l: any) => l.severity === 'high').length,
                    voidedOrders: voidedCount
                }));
            }
        } catch (e) {
            console.error("Auditor fetch failed:", e);
        } finally {
            setIsLoading(false);
        }
    }, [activeBranchId]);

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
        { href: '/dashboard/auditor/sales', icon: ShoppingBag, label: 'Sales Audit', desc: 'Verify daily revenue' },
        { href: '/dashboard/auditor/stock', icon: Package, label: 'Stock Audit', desc: 'Inventory & variance' },
        { href: '/dashboard/auditor/orders', icon: Calculator, label: 'Orders & Pay', desc: 'Reconcile payments' },
        { href: '/dashboard/auditor/reports', icon: BarChart3, label: 'Reports', desc: 'Analytics generation' },
    ];

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <BranchAwareDashboardLayout
                title="Internal Audit"
                subtitle="Control and compliance overview"
                requireBranchContext={false}
            >
                <div className="space-y-6">
                    {/* Refresh Header */}
                    <div className="flex justify-end">
                        <button
                            onClick={fetchData}
                            disabled={isLoading}
                            className="btn-secondary"
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            <span>Refresh Data</span>
                        </button>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {statCards.map((stat, i) => (
                            <div key={i} className="stat-card">
                                <div className="stat-icon">
                                    <stat.icon className="h-5 w-5" />
                                </div>
                                <p className="stat-value">{stat.value}</p>
                                <p className="stat-label mt-1">{stat.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Quick Access */}
                    <div className="card-elevated p-6">
                        <div className="section-header mb-4">
                            <div>
                                <h2 className="section-title">Quick Actions</h2>
                                <p className="section-subtitle">Core audit functions</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {quickLinks.map((link) => (
                                <Link key={link.href} href={link.href}>
                                    <div className="action-card group">
                                        <div className="action-card-icon">
                                            <link.icon className="h-5 w-5" />
                                        </div>
                                        <p className="action-card-label">{link.label}</p>
                                        <p className="text-[11px] text-stone-400 mt-0.5">{link.desc}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Risk & Activities Grid */}
                    <div className="grid lg:grid-cols-2 gap-5">
                        <div className="card-elevated p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[15px] font-semibold text-stone-900">Risk Map</h3>
                            </div>
                            <div className="space-y-3">
                                <RiskItem title="Voided Orders" value={stats.voidedOrders.toString()} risk={stats.voidedOrders > 5 ? 'high' : 'medium'} />
                                <RiskItem title="Unconfirmed Deliveries" value="5" risk="medium" />
                                <RiskItem title="Payroll Variances" value="None" risk="low" />
                            </div>
                        </div>

                        <div className="card-elevated p-5">
                            <h3 className="text-[15px] font-semibold text-stone-900 mb-4">Recent Activity</h3>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center">
                                        <RefreshCw className="h-4 w-4 text-stone-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-stone-900">Stock count updated</p>
                                        <p className="text-xs text-stone-500">Kapsoit Branch • 2 mins ago</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center">
                                        <AlertTriangle className="h-4 w-4 text-rose-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-stone-900">High variance detected</p>
                                        <p className="text-xs text-stone-500">Sales vs Bank • 1 hour ago</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </BranchAwareDashboardLayout>
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
