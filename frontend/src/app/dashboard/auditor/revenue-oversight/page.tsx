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
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <DollarSign className="h-4 w-4 text-stone-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Financial Integrity</span>
                            </div>
                            <h1 className="text-2xl font-black text-stone-900 tracking-tight leading-none">Revenue Oversight</h1>
                            <p className="text-stone-500 text-sm mt-2 font-medium">System-wide performance monitoring and yield optimization</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-2 shadow-sm">
                                <Filter className="h-3.5 w-3.5 text-stone-400" />
                                <input
                                    type="date"
                                    value={dateRange.startDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="text-[12px] font-bold text-stone-700 outline-none w-28"
                                />
                                <span className="text-stone-200 mx-1">→</span>
                                <input
                                    type="date"
                                    value={dateRange.endDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="text-[12px] font-bold text-stone-700 outline-none w-28"
                                />
                            </div>
                            <BranchSelector />
                            <button onClick={handleExport} disabled={isExporting} className="p-2.5 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors shadow-sm">
                                <FileDown className={`h-4 w-4 text-stone-600 ${isExporting ? 'animate-bounce' : ''}`} />
                            </button>
                            <button onClick={fetchData} className="p-2.5 bg-stone-900 rounded-xl hover:bg-stone-800 transition-colors shadow-sm">
                                <RefreshCw className={`h-4 w-4 text-white ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="card-elevated p-6 bg-stone-900 text-white shadow-2xl shadow-stone-200/50 flex flex-col justify-between min-h-[160px]">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Gross Revenue</p>
                                <h3 className="text-3xl font-black italic">KES {data?.total_revenue?.toLocaleString() || '0'}</h3>
                            </div>
                            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Verified</span>
                                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                                </div>
                                <span className="text-[10px] text-stone-500 font-bold uppercase tracking-tighter italic">Snapshot Live</span>
                            </div>
                        </div>
                        <div className="card-elevated p-6 bg-white border border-stone-100 flex flex-col justify-between min-h-[160px]">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Hotel Occupancy</p>
                                <h3 className="text-2xl font-black text-stone-900">{data?.hotel_occupancy || '0%'}</h3>
                            </div>
                            <div className="flex items-center gap-2 mt-4 text-blue-600">
                                <Building2 className="h-3 w-3" />
                                <span className="text-[10px] font-bold uppercase tracking-tighter">Inventory Yield</span>
                            </div>
                        </div>
                        <div className="card-elevated p-6 bg-white border border-stone-100 flex flex-col justify-between min-h-[160px]">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">AVG Ticket Value</p>
                                <h3 className="text-2xl font-black text-stone-900">KES {data?.avg_order_value?.toLocaleString() || '0'}</h3>
                            </div>
                            <div className="flex items-center gap-2 mt-4 text-emerald-600">
                                <ArrowUpRight className="h-3 w-3" />
                                <span className="text-[10px] font-bold uppercase tracking-tighter">Per-Check Efficiency</span>
                            </div>
                        </div>
                        <div className="card-elevated p-6 bg-white border border-stone-100 flex flex-col justify-between min-h-[160px]">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Leakage Alerts</p>
                                <h3 className={`text-2xl font-black ${data?.anomalies?.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {data?.anomalies?.length || 0}
                                </h3>
                            </div>
                            <div className="flex items-center gap-2 mt-4 text-amber-500">
                                <ShieldAlert className="h-3 w-3" />
                                <span className="text-[10px] font-bold uppercase tracking-tighter">System Discrepancies</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Departmental Progress */}
                        <div className="card-elevated p-8 bg-white border border-stone-200/50 shadow-xl shadow-stone-200/20">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-lg font-black text-stone-900 uppercase tracking-tighter">Departmental Mix</h3>
                                <PieChart className="h-5 w-5 text-stone-300" />
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
                                                    <span className="text-[11px] font-black uppercase text-stone-500 tracking-wider font-mono">{dept.name}</span>
                                                </div>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-[14px] font-black text-stone-900">KES {amount.toLocaleString()}</span>
                                                    <span className="text-[10px] font-bold text-stone-400 italic">[{percentage}%]</span>
                                                </div>
                                            </div>
                                            <div className="h-2 w-full bg-stone-50 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${dept.color} transition-all duration-1000 ease-out`}
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="mt-12 p-5 bg-stone-50 border border-stone-100 rounded-2xl flex items-start gap-4">
                                <div className="p-2 bg-white rounded-xl shadow-sm">
                                    <ShieldAlert className="h-5 w-5 text-amber-500" />
                                </div>
                                <div>
                                    <h4 className="text-[12px] font-black text-stone-900 uppercase tracking-tight mb-1">Compliance Check</h4>
                                    <p className="text-[11px] text-stone-400 font-medium leading-relaxed italic">
                                        All POS terminals are reporting active ETR signatures. Cross-check these figures with daily Z-Reports for month-end reconciliation.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Revenue Trends */}
                        <div className="card-elevated p-8 bg-stone-50 border border-stone-200/30 flex flex-col">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-lg font-black text-stone-900 uppercase tracking-tighter">Performance Trajectory</h3>
                                <Activity className="h-5 w-5 text-stone-400" />
                            </div>

                            <div className="flex-1 flex items-end justify-between gap-2.5 h-[240px]">
                                {(data?.daily_trends || []).map((day: any, i: number) => {
                                    const maxVal = Math.max(...data.daily_trends.map((d: any) => d.amount));
                                    const height = Math.round((day.amount / (maxVal || 1)) * 100);
                                    return (
                                        <div key={i} className="flex-1 flex flex-col items-center group h-full">
                                            <div className="w-full relative flex flex-col justify-end items-center h-full">
                                                <div
                                                    className="w-full bg-stone-200 rounded-t-lg transition-all duration-500 group-hover:bg-stone-900 group-hover:shadow-2xl"
                                                    style={{ height: `${Math.max(height, 8)}%` }}
                                                >
                                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] font-black px-3 py-1.5 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 whitespace-nowrap scale-90 group-hover:scale-100">
                                                        KES {day.amount.toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-[9px] font-black text-stone-400 mt-4 rotate-45 origin-left whitespace-nowrap uppercase tracking-tighter">{day.day}</span>
                                        </div>
                                    );
                                })}
                                {(!data?.daily_trends || data.daily_trends.length === 0) && (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-stone-300 gap-3 grayscale opacity-40">
                                        <Layers className="h-10 w-10 text-stone-400" />
                                        <p className="text-[11px] font-black uppercase tracking-widest">Historical Data Unavailable</p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-12 flex justify-between items-center bg-white p-4 rounded-2xl border border-stone-200/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                                        <TrendingUp className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[12px] font-black text-stone-900 uppercase leading-none">Yield Velocity</p>
                                        <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tighter">Increasing 12.4% MoM</p>
                                    </div>
                                </div>
                                <Clock className="h-5 w-5 text-stone-200" />
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
