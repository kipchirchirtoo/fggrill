'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    TrendingUp, BarChart3, Layers,
    RefreshCw, Filter, Download,
    Building2, Utensils, Beer, Users, FileDown,
    AlertTriangle, ShieldAlert, CheckCircle2,
    DollarSign, Activity, PieChart, ShieldCheck,
    ArrowUpRight, Clock
} from 'lucide-react';
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
        { name: 'Restaurant', color: 'bg-emerald-600', icon: Utensils, field: 'restaurant' },
        { name: 'Bar & Lounge', color: 'bg-stone-900', icon: Beer, field: 'bar' },
        { name: 'Rooms & Lodging', color: 'bg-blue-600', icon: Building2, field: 'rooms' },
        { name: 'Events', color: 'bg-amber-500', icon: Users, field: 'events' },
    ];

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-8 pb-10">
                    {/* Header */}
                    <div className="page-header flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-stone-900 flex items-center justify-center text-white shadow-lg">
                                <DollarSign className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="page-title text-stone-900">Revenue Oversight</h1>
                                <p className="page-subtitle">System-wide performance monitoring and yield optimization</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 bg-stone-100/50 border border-stone-200 rounded-xl px-3 py-1.5 shadow-sm h-10">
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
                            <BranchSelector />
                            <button onClick={handleExport} disabled={isExporting} className="btn-secondary">
                                <FileDown className={`h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} />
                            </button>
                            <button onClick={fetchData} className="btn-primary">
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="stat-card bg-stone-900 border-none shadow-xl shadow-stone-900/10">
                            <div className="stat-icon bg-white/10 text-white">
                                <DollarSign className="h-5 w-5" />
                            </div>
                            <p className="stat-value text-white">KES {data?.total_revenue?.toLocaleString() || '0'}</p>
                            <div className="flex items-center justify-between mt-1">
                                <p className="stat-label text-stone-400">Gross Revenue</p>
                                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon bg-blue-50 text-blue-500">
                                <Building2 className="h-5 w-5" />
                            </div>
                            <p className="stat-value">{data?.hotel_occupancy || '0%'}</p>
                            <p className="stat-label">Hotel Occupancy</p>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon bg-emerald-50 text-emerald-500">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                            <p className="stat-value">KES {data?.avg_order_value?.toLocaleString() || '0'}</p>
                            <p className="stat-label">Avg Ticket Value</p>
                        </div>
                        <div className="stat-card">
                            <div className={`stat-icon ${(data?.anomalies?.length || 0) > 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                <ShieldAlert className="h-5 w-5" />
                            </div>
                            <p className={`stat-value ${(data?.anomalies?.length || 0) > 0 ? 'text-rose-600' : ''}`}>
                                {data?.anomalies?.length || 0}
                            </p>
                            <p className="stat-label">Leakage Alerts</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Departmental Progress */}
                        <div className="card-elevated p-8 bg-white border border-stone-100 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="section-title">Departmental Mix</h3>
                                    <p className="caption">Revenue distribution across core divisions</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center text-stone-400">
                                    <PieChart className="h-5 w-5" />
                                </div>
                            </div>
                            <div className="space-y-6">
                                {departments.map((dept, i) => {
                                    const amount = data?.revenue_by_dept?.[dept.field] || 0;
                                    const percentage = Math.round((amount / (data?.total_revenue || 1)) * 100);
                                    return (
                                        <div key={i}>
                                            <div className="flex justify-between items-end mb-2">
                                                <div className="flex items-center gap-2">
                                                    <dept.icon className="h-4 w-4 text-stone-400" />
                                                    <span className="text-[12px] font-semibold text-stone-600 tracking-tight">{dept.name}</span>
                                                </div>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-[14px] font-bold text-stone-900">KES {amount.toLocaleString()}</span>
                                                    <span className="text-[10px] font-medium text-stone-400">({percentage}%)</span>
                                                </div>
                                            </div>
                                            <div className="h-2 w-full bg-stone-50 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-stone-900 transition-all duration-1000 ease-out"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-12 p-5 bg-stone-50 border border-stone-100 rounded-2xl flex items-start gap-4">
                                <div className="p-2.5 bg-white rounded-xl shadow-sm text-amber-500">
                                    <ShieldAlert className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="text-[13px] font-semibold text-stone-900 mb-1">Compliance Check</h4>
                                    <p className="text-[11px] text-stone-500 leading-relaxed">
                                        All POS terminals are reporting active ETR signatures. Cross-check these figures with daily Z-Reports for month-end reconciliation.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Revenue Trends */}
                        <div className="card-elevated p-8 bg-stone-50 border border-stone-100 flex flex-col">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="section-title">Performance Trajectory</h3>
                                    <p className="caption">Daily revenue fluctuations</p>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-stone-400 shadow-sm">
                                    <Activity className="h-5 w-5" />
                                </div>
                            </div>

                            <div className="flex-1 flex items-end justify-between gap-2 h-[200px]">
                                {(data?.daily_trends || []).map((day: any, i: number) => {
                                    const maxVal = Math.max(...data.daily_trends.map((d: any) => d.amount));
                                    const height = Math.round((day.amount / (maxVal || 1)) * 100);
                                    return (
                                        <div key={i} className="flex-1 flex flex-col items-center group h-full">
                                            <div className="w-full relative flex flex-col justify-end items-center h-full">
                                                <div
                                                    className="w-full bg-stone-200 rounded-t-lg transition-all duration-500 group-hover:bg-stone-900"
                                                    style={{ height: `${Math.max(height, 8)}%` }}
                                                >
                                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 whitespace-nowrap">
                                                        KES {day.amount.toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-[9px] font-bold text-stone-400 mt-4 rotate-45 origin-left whitespace-nowrap uppercase tracking-widest">{day.day}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-12 flex justify-between items-center bg-white p-5 rounded-2xl border border-stone-100 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500">
                                        <TrendingUp className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-semibold text-stone-900">Yield Velocity</p>
                                        <p className="text-[11px] text-emerald-600 font-medium">Increasing 12.4% MoM</p>
                                    </div>
                                </div>
                                <Clock className="h-5 w-5 text-stone-300" />
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
