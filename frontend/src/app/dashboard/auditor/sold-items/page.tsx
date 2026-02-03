'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { auditAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { BranchSelector, useBranch } from '@/lib/branch-context';
import {
    AlertTriangle, Package, Filter, Download,
    ArrowLeft, Check, X, RefreshCw, Eye,
    Building2, TrendingUp, BarChart3, ChevronRight,
    Search, Calendar, ListFilter, FileDown
} from 'lucide-react';
import { toast } from 'sonner';

export default function SoldItemsAnalyticsPage() {
    const { activeBranchId, setActiveBranch } = useBranch();
    const [auditData, setAuditData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await auditAPI.verifySoldItems({
                branch_id: (activeBranchId === 0 || activeBranchId === null) ? undefined : activeBranchId,
                start_date: dateRange.startDate,
                end_date: dateRange.endDate
            });

            if (res.success) {
                setAuditData(res.data);
            } else {
                toast.error(res.message || 'Failed to fetch sold items analysis');
            }
        } catch (e) {
            console.error(e);
            toast.error("Network error while syncing analytics");
        } finally {
            setIsLoading(false);
        }
    }, [activeBranchId, dateRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredAnalysis = (auditData?.analysis || []).filter((item: any) =>
        item.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-8 pb-12">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <BarChart3 className="h-4 w-4 text-stone-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Yield Analytics</span>
                            </div>
                            <h1 className="text-2xl font-black text-stone-900 tracking-tight leading-none">
                                {activeBranchId !== 0 ? `Branch Sales Performance` : `System-wide Item Analytics`}
                            </h1>
                            <p className="text-stone-500 text-sm mt-2 font-medium italic">Compare item movement and consumption efficiency across departments</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-3 py-2 shadow-sm h-10">
                                <Calendar className="h-3.5 w-3.5 text-stone-400" />
                                <input
                                    type="date"
                                    value={dateRange.startDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                    className="text-[12px] font-black text-stone-700 outline-none w-28"
                                />
                                <span className="text-stone-200 mx-1">→</span>
                                <input
                                    type="date"
                                    value={dateRange.endDate}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                    className="text-[12px] font-black text-stone-700 outline-none w-28"
                                />
                            </div>
                            <BranchSelector />
                            <button onClick={fetchData} className="p-2.5 bg-stone-900 rounded-xl hover:bg-stone-800 transition-colors shadow-sm">
                                <RefreshCw className={`h-4 w-4 text-white ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="card-elevated p-8 border border-stone-100 bg-white shadow-xl shadow-stone-200/20">
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Total Quantity Sold</p>
                            <h3 className="text-3xl font-black text-stone-900 tracking-tighter">{(auditData?.summary?.total_quantity_sold || 0).toLocaleString()}</h3>
                            <div className="flex items-center gap-1.5 mt-3">
                                <TrendingUp className="h-3 w-3 text-emerald-500" />
                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Units Dispatched</p>
                            </div>
                        </div>
                        <div className="card-elevated p-8 border border-stone-100 bg-white shadow-xl shadow-stone-200/20">
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Total Revenue Contribution</p>
                            <h3 className="text-3xl font-black text-stone-900 tracking-tighter">KES {(auditData?.summary?.total_revenue || 0).toLocaleString()}</h3>
                            <div className="flex items-center gap-1.5 mt-3">
                                <BarChart3 className="h-3 w-3 text-blue-500" />
                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Gross Item Value</p>
                            </div>
                        </div>
                        <div className="card-elevated p-8 border border-stone-100 bg-white shadow-xl shadow-stone-200/20">
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Unique SKUs Tracked</p>
                            <h3 className="text-3xl font-black text-stone-900 tracking-tighter">{auditData?.summary?.total_items_sold || 0}</h3>
                            <div className="flex items-center gap-1.5 mt-3">
                                <Package className="h-3 w-3 text-stone-400" />
                                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Active inventory items</p>
                            </div>
                        </div>
                    </div>

                    {activeBranchId === 0 ? (
                        /* BRANCH LIST VIEW */
                        <div className="card-elevated border border-stone-100 bg-white overflow-hidden shadow-2xl shadow-stone-200/30">
                            <div className="px-6 py-5 border-b border-stone-100 bg-stone-50/30 flex items-center justify-between">
                                <h3 className="text-[14px] font-black text-stone-900 uppercase tracking-tight flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-stone-400" />
                                    Performance by Branch
                                </h3>
                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Global Aggregate</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-stone-50/30 border-b border-stone-100 text-[10px] font-black text-stone-400 uppercase tracking-widest">
                                            <th className="px-6 py-4">Branch</th>
                                            <th className="px-6 py-4 text-center">Items Sold</th>
                                            <th className="px-6 py-4 text-right">Revenue Generated</th>
                                            <th className="px-6 py-4 text-right">Avg Item Value</th>
                                            <th className="px-6 py-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-50">
                                        {(auditData?.summary?.branch_summaries || []).map((branch: any) => {
                                            const avgValue = branch.total_quantity > 0 ? branch.total_revenue / branch.total_quantity : 0;
                                            return (
                                                <tr
                                                    key={branch.branch_id}
                                                    onClick={() => setActiveBranch(branch.branch_id)}
                                                    className="hover:bg-stone-50 transition-colors group cursor-pointer"
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 rounded-xl bg-stone-100 text-stone-600 group-hover:bg-stone-900 group-hover:text-white transition-all">
                                                                <Building2 className="h-4 w-4" />
                                                            </div>
                                                            <span className="text-[14px] font-black text-stone-900">{branch.branch_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-[14px] font-bold text-stone-700">{branch.total_quantity.toLocaleString()}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-[15px] font-black text-stone-900">KES {branch.total_revenue.toLocaleString()}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-[13px] font-bold text-stone-400 italic">KES {avgValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-900 transition-all group-hover:translate-x-1" />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {(!auditData?.summary?.branch_summaries || auditData.summary.branch_summaries.length === 0) && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-20 text-center">
                                                    {isLoading ? (
                                                        <div className="flex flex-col items-center gap-2 opacity-50">
                                                            <RefreshCw className="h-6 w-6 animate-spin text-stone-300" />
                                                            <span className="text-[11px] font-black uppercase tracking-widest text-stone-400">Syncing analytics...</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[11px] font-black uppercase tracking-widest text-stone-300">No data found</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        /* DETAILED ANALYSIS VIEW */
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">
                            {/* Search and Filter */}
                            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                                <div className="relative w-full md:w-96">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-300" />
                                    <input
                                        type="text"
                                        placeholder="Search by item name..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-200/60 rounded-2xl text-[13px] font-bold text-stone-700 outline-none focus:border-stone-400 focus:bg-white transition-all shadow-sm"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button className="flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-stone-800 shadow-xl shadow-stone-900/10 transition-all">
                                        <FileDown className="h-4 w-4" /> Export Ledger
                                    </button>
                                </div>
                            </div>

                            <div className="card-elevated border border-stone-100 bg-white overflow-hidden shadow-2xl shadow-stone-200/30">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-stone-50/30 border-b border-stone-100 text-[10px] font-black text-stone-400 uppercase tracking-widest">
                                                <th className="px-6 py-4">Item Details</th>
                                                <th className="px-6 py-4 text-center">Qty Sold</th>
                                                <th className="px-6 py-4 text-right">Gross Revenue</th>
                                                <th className="px-6 py-4 text-center">Stock Req.</th>
                                                <th className="px-6 py-4 text-center">Efficiency Ratio</th>
                                                <th className="px-6 py-4"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-50">
                                            {filteredAnalysis.map((item: any, idx: number) => {
                                                const ratio = item.consumption_ratio * 100;
                                                return (
                                                    <tr key={idx} className="hover:bg-stone-50/50 transition-colors group">
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-[14px] font-black text-stone-900">{item.name}</span>
                                                                <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest">Serial #{(idx + 101)}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="text-[14px] font-bold text-stone-700">{item.quantity.toLocaleString()}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <span className="text-[15px] font-black text-stone-900">KES {item.revenue.toLocaleString()}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="text-[13px] font-bold text-stone-400 italic">{item.stock_requested.toLocaleString()}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="flex flex-col items-center gap-1.5">
                                                                <span className={`text-[11px] font-black uppercase ${ratio > 90 ? 'text-emerald-600' : ratio > 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                                                                    {ratio.toFixed(1)}%
                                                                </span>
                                                                <div className="w-20 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all duration-1000 ${ratio > 90 ? 'bg-emerald-500' : ratio > 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                                        style={{ width: `${Math.min(ratio, 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <button className="p-2 hover:bg-stone-900 hover:text-white rounded-xl transition-all text-stone-300 opacity-0 group-hover:opacity-100">
                                                                <Eye className="h-4 w-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {filteredAnalysis.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-20 text-center text-stone-300 font-bold uppercase tracking-widest text-[11px]">
                                                        {isLoading ? "Syncing analytics..." : "No matching items found"}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
