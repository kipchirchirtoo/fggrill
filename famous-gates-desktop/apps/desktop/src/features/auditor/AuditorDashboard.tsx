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
import { auditAPI, storeAPI, restaurantAPI } from '../../services/api/api';
import { useBranch } from '../../hooks/useBranch';
import { toast } from 'sonner';
import { cn } from '../../utils/cn';
import { motion } from 'framer-motion';

export function AuditorDashboard() {
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({
        totalAudits: 0,
        pendingReviews: 0,
        complianceScore: 92,
        highRiskFindings: 0,
        voidedOrders: 0
    });

    const [watchList, setWatchList] = useState<any[]>([]);
    const { activeBranchId, activeBranch } = useBranch();

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [logsRes, requestsRes, ordersRes, revenueRes] = await Promise.all([
                auditAPI.getAuditLogs({ branch_id: activeBranchId || undefined }) as any,
                storeAPI.getBranchRequests('PENDING_AUDIT', Number(activeBranchId) || undefined) as any,
                restaurantAPI.getOrders({ status: 'cancelled', branch_id: activeBranchId || undefined }) as any,
                auditAPI.verifyRevenue({ branch_id: activeBranchId || undefined }) as any
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
        { title: 'Shift Verification', desc: 'Verify reconciled shifts', icon: ClipboardList, badge: 'New' },
        { title: 'Inventory Flow', desc: 'Physical vs theoretical audit', icon: Package, badge: 'Critical' },
        { title: 'Revenue Audit', desc: 'Transaction verification', icon: DollarSign, badge: 'Live' },
        { title: 'Banking Review', desc: 'Approve banking transactions', icon: Building2, badge: 'New' },
        { title: 'Invoice Verification', desc: 'Review & verify invoices', icon: FileText, badge: 'New' },
        { title: 'Order Tracking', desc: 'Branch requisition audit', icon: ShoppingCart },
        { title: 'Item Analytics', desc: 'Volume & performance', icon: BarChart3 },
        { title: 'Leakage Control', desc: 'Wastage & usage oversight', icon: Scale },
        { title: 'Kitchen Flow', desc: 'Back-of-house requests', icon: ShoppingBag },
        { title: 'Financial Sync', desc: 'Gateway reconciliation', icon: CreditCard }
    ];

    return (
        <div className="h-full bg-stone-50 overflow-y-auto no-scrollbar p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8 pb-12">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-stone-900 flex items-center justify-center text-white shadow-xl">
                            <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-stone-900 tracking-tight">Audit Control</h1>
                            <p className="text-stone-500 text-sm font-medium">{activeBranch?.name || 'All Branches'} Oversight</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchData}
                            disabled={isLoading}
                            className="h-11 px-6 rounded-xl bg-white border border-stone-200 font-bold text-sm flex items-center gap-2 hover:bg-stone-50 transition-all shadow-sm disabled:opacity-50"
                        >
                            <RefreshCw className={cn("h-4 w-4 text-stone-600", isLoading && "animate-spin")} />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'Compliance', value: `${stats.complianceScore}%`, icon: PieChart, color: 'text-stone-900', bg: 'bg-white' },
                        { label: 'High Risk', value: stats.highRiskFindings, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50/30' },
                        { label: 'Pending', value: stats.pendingReviews, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50/30' },
                        { label: 'Voided', value: stats.voidedOrders, icon: Trash2, color: 'text-blue-600', bg: 'bg-blue-50/30' }
                    ].map((s, i) => (
                        <div key={i} className={cn("p-6 rounded-3xl border border-stone-200 shadow-sm", s.bg)}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2 rounded-xl bg-stone-100/50">
                                    <s.icon className={cn("h-5 w-5", s.color)} />
                                </div>
                            </div>
                            <p className={cn("text-3xl font-black tracking-tighter", s.color)}>{s.value}</p>
                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">{s.label}</p>
                        </div>
                    ))}
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Modules */}
                    <div className="lg:col-span-2 space-y-8">
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em]">Audit Modules</h2>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {auditModules.map((module, i) => (
                                    <div key={i} className="group bg-white border border-stone-200 p-5 rounded-2xl hover:border-stone-900 transition-all cursor-pointer shadow-sm active:scale-95">
                                        <div className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center mb-4 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                                            <module.icon className="h-5 w-5" />
                                        </div>
                                        <p className="text-sm font-bold text-stone-900">{module.title}</p>
                                        <p className="text-[10px] text-stone-400 font-medium leading-tight mt-1">{module.desc}</p>
                                        {module.badge && (
                                            <span className="inline-block mt-3 text-[8px] font-black px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded uppercase tracking-widest">
                                                {module.badge}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em]">HR Oversight</h2>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {[
                                    { title: 'HR Command', desc: 'Personnel Dashboard', icon: Users },
                                    { title: 'Employee Repo', desc: 'Staff directory', icon: UserCheck },
                                    { title: 'Payroll Audit', desc: 'Verify salary processing', icon: DollarSign }
                                ].map((item, i) => (
                                    <div key={i} className="group bg-white border border-stone-200 p-5 rounded-2xl hover:border-stone-900 transition-all cursor-pointer shadow-sm active:scale-95">
                                        <div className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center mb-4 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                                            <item.icon className="h-5 w-5" />
                                        </div>
                                        <p className="text-sm font-bold text-stone-900">{item.title}</p>
                                        <p className="text-[10px] text-stone-400 font-medium leading-tight mt-1">{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Exceptions */}
                    <div className="bg-white border border-stone-200 rounded-[2rem] p-8 shadow-sm h-fit">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em]">System Exceptions</h2>
                        </div>
                        <div className="space-y-6">
                            {watchList.length > 0 ? (
                                watchList.map((item, i) => (
                                    <div key={i} className="flex gap-4 group cursor-pointer">
                                        <div className={cn(
                                            "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                                            item.severity === 'HIGH' ? "bg-red-500" : "bg-amber-500"
                                        )} />
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-stone-900 leading-tight group-hover:underline">{item.detail}</p>
                                            <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest mt-1">
                                                {item.type} • {new Date(item.time).toLocaleTimeString()}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-12 flex flex-col items-center text-center opacity-30">
                                    <ShieldCheck className="w-12 h-12 mb-4" />
                                    <p className="text-xs font-black uppercase tracking-widest">No Critical Flags</p>
                                </div>
                            )}
                        </div>
                        <button className="w-full h-12 mt-8 bg-stone-50 rounded-xl text-[10px] font-black tracking-widest text-stone-400 uppercase hover:bg-stone-100 hover:text-stone-600 transition-all flex items-center justify-center gap-2">
                            <span>View Full Audit Feed</span>
                            <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
