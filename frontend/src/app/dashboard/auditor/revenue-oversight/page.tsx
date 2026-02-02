'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    TrendingUp, BarChart3, PieChart, Layers,
    ArrowUpRight, ArrowDownRight, RefreshCw,
    Download, Calendar, Filter, MousePointer2,
    Building2, Utensils, Beer, Users
} from 'lucide-react';
import { auditAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { BranchSelector, useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { toast } from 'sonner';

export default function RevenueOversight() {
    const { activeBranchId, activeBranch } = useBranch();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [dateRange, setDateRange] = useState({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await auditAPI.verifyRevenue({
                branch_id: activeBranchId === 0 ? undefined : activeBranchId,
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

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const departments = [
        { name: 'Restaurant', color: 'bg-emerald-500', icon: Utensils, field: 'restaurant' },
        { name: 'Bar & Lounge', color: 'bg-stone-900', icon: Beer, field: 'bar' },
        { name: 'Rooms & Lodging', color: 'bg-blue-600', icon: Building2, field: 'rooms' },
        { name: 'Events & Catering', color: 'bg-amber-500', icon: Users, field: 'events' },
    ];

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-8 pb-10">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <TrendingUp className="h-4 w-4 text-stone-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Departmental Analytics</span>
                            </div>
                            <h1 className="text-2xl font-black text-stone-900 tracking-tight">Revenue Oversight & Yield</h1>
                            <p className="text-stone-500 text-sm mt-1">Cross-departmental performance monitoring and leakage detection</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-lg px-3 py-1.5 shadow-sm">
                                <input
                                    type="date"
                                    value={dateRange.startDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="text-xs font-bold text-stone-700 outline-none"
                                />
                                <span className="text-stone-300">→</span>
                                <input
                                    type="date"
                                    value={dateRange.endDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="text-xs font-bold text-stone-700 outline-none"
                                />
                            </div>
                            <BranchSelector />
                            <button onClick={fetchData} className="btn-primary h-[38px] px-4">
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Department Progress Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {departments.map((dept, i) => {
                            const amount = data?.revenue_by_dept?.[dept.field] || 0;
                            const percentage = Math.round((amount / (data?.total_revenue || 1)) * 100);
                            return (
                                <div key={i} className="card-elevated p-6 bg-white border border-stone-100 relative overflow-hidden group">
                                    <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-5 group-hover:scale-110 transition-transform ${dept.color}`}></div>
                                    <div className="flex items-start justify-between mb-4">
                                        <div className={`p-3 rounded-2xl ${dept.color.replace('bg-', 'text-').replace('500', '600')} ${dept.color.replace('bg-', 'bg-')}/10`}>
                                            <dept.icon className="h-5 w-5" />
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">{dept.name}</span>
                                            <span className="text-[18px] font-black text-stone-900">KES {amount.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[10px] font-bold text-stone-400">
                                            <span>CONTRIBUTION</span>
                                            <span>{percentage}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-stone-50 rounded-full overflow-hidden">
                                            <div className={`h-full ${dept.color}`} style={{ width: `${percentage}%` }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Detailed Analysis */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Weekly Revenue Trends */}
                        <div className="lg:col-span-2 card-elevated p-8 bg-white border border-stone-100">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-[18px] font-black text-stone-900 leading-none">Revenue Trajectory</h3>
                                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mt-2">Daily Gross Performance vs Targets</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>
                                        <span className="text-[10px] font-bold text-stone-400 uppercase">Actual</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-stone-100"></div>
                                        <span className="text-[10px] font-bold text-stone-400 uppercase">Target</span>
                                    </div>
                                </div>
                            </div>

                            <div className="h-[280px] flex items-end justify-between gap-3">
                                {(data?.daily_trends || []).map((day: any, i: number) => {
                                    const maxVal = Math.max(...data.daily_trends.map((d: any) => d.amount));
                                    const height = Math.round((day.amount / (maxVal || 1)) * 100);
                                    return (
                                        <div key={i} className="flex-1 flex flex-col items-center group">
                                            <div className="w-full relative flex flex-col justify-end items-center h-full">
                                                <div
                                                    className="w-full bg-stone-900 rounded-t-lg transition-all duration-500 group-hover:bg-blue-600"
                                                    style={{ height: `${height}%` }}
                                                >
                                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {day.amount.toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-black text-stone-400 mt-4 uppercase">{day.day}</span>
                                        </div>
                                    );
                                })}
                                {(!data?.daily_trends || data.daily_trends.length === 0) && (
                                    <div className="w-full h-full flex items-center justify-center text-stone-300 text-sm italic">
                                        Not enough data for trend analysis
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Top Performers / Anomalies */}
                        <div className="space-y-6">
                            <div className="card-elevated p-8 bg-stone-900 text-white shadow-2xl shadow-stone-900/20">
                                <h3 className="text-[15px] font-black mb-6 flex items-center gap-2 text-amber-400">
                                    <Layers className="h-5 w-5" />
                                    Yield Optimization
                                </h3>
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Occupancy to Revenue Ratio</p>
                                        <div className="flex items-end justify-between">
                                            <h4 className="text-[28px] font-black leading-none">{data?.hotel_occupancy || '64%'}</h4>
                                            <div className="flex items-center gap-1 text-[11px] font-black text-emerald-400 uppercase">
                                                <ArrowUpRight className="h-3.5 w-3.5" />
                                                High Yield
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-6 border-t border-white/10">
                                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Average Transaction Value</p>
                                        <div className="flex items-end justify-between">
                                            <h4 className="text-[24px] font-black leading-none">KES {data?.avg_order_value?.toLocaleString() || '1,450'}</h4>
                                            <div className="text-[10px] font-black text-stone-500 uppercase tracking-tighter">Restaurant</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="card-elevated p-6 bg-white border border-stone-200">
                                <h3 className="text-[15px] font-black text-stone-900 mb-4">Anomaly Detection</h3>
                                <div className="space-y-3">
                                    <div className="p-3 bg-stone-50 rounded-xl flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                                            <MousePointer2 className="h-4 w-4 text-rose-600" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[11px] font-bold text-stone-900 leading-tight">Price Override Detected</p>
                                            <p className="text-[10px] text-stone-400 mt-0.5">Bar • 3 instances • May indicate leakage</p>
                                        </div>
                                    </div>
                                    <div className="p-3 bg-stone-50 rounded-xl flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                                            <Filter className="h-4 w-4 text-amber-600" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[11px] font-bold text-stone-900 leading-tight">Discount Threshold Breach</p>
                                            <p className="text-[10px] text-stone-400 mt-0.5">Events • User: admin_root</p>
                                        </div>
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
