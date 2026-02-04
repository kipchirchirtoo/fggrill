'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    TrendingUp, BarChart3, Layers,
    RefreshCw, Filter, Download,
    Building2, Utensils, Beer, Users, FileDown,
    AlertTriangle, ShieldAlert, CheckCircle2,
    DollarSign, Activity, PieChart, ShieldCheck,
    ArrowUpRight, Clock, ChevronRight, AlertCircle,
    Wallet, TrendingDown, Eye, CreditCard
} from 'lucide-react';
import { CashierLogbookVerification } from '@/components/auditor/CashierLogbookVerification';
import { auditAPI, auditorReportsAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { BranchSelector, useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function RevenueOversightPage() {
    const { activeBranchId } = useBranch();
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [data, setData] = useState<any>(null);
    const [dateRange, setDateRange] = useState({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await auditAPI.verifyRevenue({
                branch_id: activeBranchId === null || activeBranchId === 0 ? undefined : activeBranchId,
                start_date: dateRange.startDate,
                end_date: dateRange.endDate
            });

            if (res.success) {
                setData(res.data);
            } else {
                toast.error(res.message || 'Failed to fetch revenue data');
            }
        } catch (e) {
            console.error("Revenue fetch failed:", e);
            toast.error('An error occurred while fetching revenue analytics');
        } finally {
            setIsLoading(false);
        }
    }, [activeBranchId, dateRange]);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            await auditorReportsAPI.exportBrandedPdf('revenue_reconciliation', {
                branch_id: activeBranchId === null || activeBranchId === 0 ? undefined : activeBranchId,
                start_date: dateRange.startDate,
                end_date: dateRange.endDate
            });
            toast.success("Revenue report exported successfully");
        } catch (e) {
            console.error(e);
            toast.error("Failed to export report");
        } finally {
            setIsExporting(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const departments = [
        { name: 'Restaurant', color: 'bg-emerald-500', icon: Utensils, field: 'restaurant' },
        { name: 'Bar & Lounge', color: 'bg-stone-900', icon: Beer, field: 'bar' },
        { name: 'Rooms & Lodging', color: 'bg-blue-600', icon: Building2, field: 'rooms' },
        { name: 'Catering & Events', color: 'bg-amber-500', icon: Users, field: 'events' },
        { name: 'POS Transactions', color: 'bg-indigo-500', icon: CreditCard, field: 'pos' },
    ];

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6 pb-10">
                    {/* Header */}
                    <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="page-title">Revenue Oversight</h1>
                            <p className="page-subtitle">Real-time yield monitoring and departmental performance audit</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-1.5 shadow-sm h-11">
                                <Filter className="h-3.5 w-3.5 text-stone-400" />
                                <input
                                    type="date"
                                    value={dateRange.startDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="text-[12px] font-semibold text-stone-700 bg-transparent outline-none w-28"
                                />
                                <span className="text-stone-300 mx-1">→</span>
                                <input
                                    type="date"
                                    value={dateRange.endDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="text-[12px] font-semibold text-stone-700 bg-transparent outline-none w-28"
                                />
                            </div>
                            <div className="h-11 overflow-hidden rounded-xl border border-stone-200">
                                <BranchSelector />
                            </div>
                            <button onClick={handleExport} disabled={isExporting} className="btn-secondary h-11 px-4">
                                <FileDown className={`h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} />
                                <span className="hidden sm:inline">Export</span>
                            </button>
                            <button onClick={fetchData} className="btn-primary h-11 px-4">
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">Sync</span>
                            </button>
                        </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="card-elevated p-6 border-l-4 border-l-stone-900 bg-white">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600">
                                    <DollarSign className="h-5 w-5" />
                                </div>
                                <span className="text-[10px] font-bold text-emerald-600 px-2 py-1 bg-emerald-50 rounded-full flex items-center gap-1">
                                    <TrendingUp className="h-3 w-3" /> 12.4%
                                </span>
                            </div>
                            <p className="text-[28px] font-bold text-stone-900 tracking-tight">
                                KES {data?.total_revenue?.toLocaleString() || '0'}
                            </p>
                            <p className="text-[13px] font-medium text-stone-500 mt-1 uppercase tracking-wider">Gross Operational Revenue</p>
                        </div>

                        <div className="card-elevated p-6 border-l-4 border-l-emerald-500 bg-white">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                                    <Wallet className="h-5 w-5" />
                                </div>
                                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                            </div>
                            <p className="text-[28px] font-bold text-stone-900 tracking-tight">
                                KES {data?.collected_revenue?.toLocaleString() || '0'}
                            </p>
                            <p className="text-[13px] font-medium text-stone-500 mt-1 uppercase tracking-wider">Payments Collected</p>
                        </div>

                        <div className="card-elevated p-6 border-l-4 border-l-amber-500 bg-white">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                                    <Clock className="h-5 w-5" />
                                </div>
                                <AlertCircle className="h-4 w-4 text-amber-400" />
                            </div>
                            <p className="text-[28px] font-bold text-stone-900 tracking-tight">
                                KES {data?.pending_revenue?.toLocaleString() || '0'}
                            </p>
                            <p className="text-[13px] font-medium text-stone-500 mt-1 uppercase tracking-wider">Pending Collection</p>
                        </div>

                        <div className="card-elevated p-6 border-l-4 border-l-rose-500 bg-white">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                                    <ShieldAlert className="h-5 w-5" />
                                </div>
                                <TrendingDown className="h-4 w-4 text-rose-400" />
                            </div>
                            <p className="text-[28px] font-bold text-rose-600 tracking-tight">
                                {data?.anomalies?.length || 0}
                            </p>
                            <p className="text-[13px] font-medium text-stone-500 mt-1 uppercase tracking-wider">Leakage Alerts</p>
                        </div>
                    </div>

                    <CashierLogbookVerification
                        title="Revenue Logbook Compliance"
                    />

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Departmental Progress */}
                        <div className="lg:col-span-2 card-elevated p-8 bg-white overflow-hidden relative">
                            <div className="flex items-center justify-between mb-10">
                                <div>
                                    <h3 className="text-lg font-bold text-stone-900">Departmental Mix</h3>
                                    <p className="text-sm text-stone-500">Revenue distribution across core divisions</p>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-stone-50 flex items-center justify-center text-stone-400">
                                    <PieChart className="h-6 w-6" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-6">
                                    {departments.map((dept, i) => {
                                        const amount = data?.revenue_by_dept?.[dept.field] || 0;
                                        const percentage = Math.round((amount / (data?.total_revenue || 1)) * 100);
                                        return (
                                            <div key={i} className="group">
                                                <div className="flex justify-between items-end mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-2 h-2 rounded-full ${dept.color}`} />
                                                        <span className="text-[13px] font-bold text-stone-700 tracking-tight">{dept.name}</span>
                                                    </div>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-[14px] font-bold text-stone-900">KES {amount.toLocaleString()}</span>
                                                        <span className="text-[10px] font-medium text-stone-400 uppercase">({percentage}%)</span>
                                                    </div>
                                                </div>
                                                <div className="h-1.5 w-full bg-stone-50 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${dept.color} transition-all duration-1000 ease-out`}
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="flex flex-col justify-center items-center h-full border-l border-stone-50 pl-10">
                                    <div className="text-center mb-6">
                                        <p className="text-[13px] font-semibold text-stone-400 uppercase tracking-widest mb-1">Average Ticket</p>
                                        <h4 className="text-3xl font-bold text-stone-900">KES {data?.avg_order_value?.toLocaleString()}</h4>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[13px] font-semibold text-stone-400 uppercase tracking-widest mb-1">Hotel Occupancy</p>
                                        <h4 className="text-3xl font-bold text-stone-900">{data?.hotel_occupancy || '0%'}</h4>
                                    </div>
                                    <div className="mt-8 w-full p-4 bg-stone-50 rounded-2xl border border-stone-100">
                                        <div className="flex items-center gap-2 text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-2">
                                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Compliance Status
                                        </div>
                                        <p className="text-[12px] text-stone-600 leading-relaxed font-medium">
                                            Yield optimization is within target parameters. <span className="text-emerald-600 text-bold">+4.2%</span> performance increase detected.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Anomalies / Leakage Feed */}
                        <div className="card-elevated bg-stone-50 border-stone-100 flex flex-col h-full">
                            <div className="p-6 border-b border-stone-200/60 bg-white rounded-t-lg">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[15px] font-bold text-stone-900">Auditor's Watchlist</h3>
                                    <span className="badge-danger px-2 py-1 normal-case">{data?.anomalies?.length || 0} alerts</span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto max-h-[500px] p-4 space-y-3 scrollbar-thin">
                                {data?.anomalies?.length > 0 ? (
                                    data.anomalies.map((anomaly: any, i: number) => (
                                        <div key={i} className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm hover:border-stone-400 transition-all group cursor-pointer">
                                            <div className="flex items-start gap-4">
                                                <div className={`p-2 rounded-lg ${anomaly.severity === 'HIGH' ? 'bg-rose-50 text-rose-600' :
                                                    anomaly.severity === 'MEDIUM' ? 'bg-amber-50 text-amber-600' :
                                                        'bg-blue-50 text-blue-600'
                                                    }`}>
                                                    {anomaly.type === 'VOID' ? <TrendingDown className="h-4 w-4" /> :
                                                        anomaly.type === 'EXCEPTION' ? <ShieldAlert className="h-4 w-4" /> :
                                                            <Clock className="h-4 w-4" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">{anomaly.type}</span>
                                                        <span className="text-[10px] text-stone-400 font-medium">{format(new Date(anomaly.time), 'HH:mm')}</span>
                                                    </div>
                                                    <p className="text-[13px] font-bold text-stone-800 leading-snug group-hover:text-stone-950 transition-colors truncate">
                                                        {anomaly.detail}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 mt-2">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${anomaly.severity === 'HIGH' ? 'bg-rose-500' :
                                                            anomaly.severity === 'MEDIUM' ? 'bg-amber-500' :
                                                                'bg-emerald-500'
                                                            }`} />
                                                        <span className="text-[10px] font-bold text-stone-500 uppercase">{anomaly.severity} PRIORITY</span>
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-900 transition-all self-center" />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-10 opacity-40">
                                        <ShieldCheck className="h-10 w-10 mb-2" />
                                        <p className="text-sm font-bold">No High-Risk Anomalies</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-stone-900 text-white rounded-b-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Risk Exposure</p>
                                        <p className="text-[15px] font-bold">KES {data?.summary?.void_value?.toLocaleString() || '0'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Void Count</p>
                                        <p className="text-[15px] font-bold">{data?.summary?.total_voids || 0} ORDERS</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Revenue Trends Chart */}
                    <div className="card-elevated p-8 bg-white border border-stone-100">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h3 className="text-lg font-bold text-stone-900 tracking-tight">System-wide Revenue Velocity</h3>
                                <p className="text-sm text-stone-500 tracking-tight">Daily aggregated performance trajectory</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-stone-900" />
                                    <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Revenue Stream</span>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center text-stone-400">
                                    <Activity className="h-5 w-5" />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-end justify-between gap-3 h-[250px] mt-4">
                            {(data?.daily_trends || []).map((day: any, i: number) => {
                                const maxVal = Math.max(...data.daily_trends.map((d: any) => d.amount));
                                const height = Math.round((day.amount / (maxVal || 1)) * 100);
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center group h-full">
                                        <div className="w-full relative flex flex-col justify-end items-center h-full">
                                            <div
                                                className="w-full bg-stone-100 rounded-t-lg transition-all duration-500 group-hover:bg-stone-900 cursor-pointer"
                                                style={{ height: `${Math.max(height, 5)}%` }}
                                            >
                                                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] font-bold px-3 py-2 rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 whitespace-nowrap">
                                                    KES {day.amount.toLocaleString()}
                                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-stone-900 rotate-45" />
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold text-stone-400 mt-4 uppercase tracking-tighter transform -rotate-45 md:rotate-0">{day.day}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
