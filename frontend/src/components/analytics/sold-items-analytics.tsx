'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Filter, Download, ArrowUpRight, ArrowDownRight,
    BarChart3, PieChart, TrendingUp, Calendar, MapPin,
    Package, RefreshCw, ChevronRight, Eye, MoreHorizontal
} from 'lucide-react';
import { auditAPI } from '@/lib/api';
import { toast } from 'sonner';

interface SoldItemsAnalyticsProps {
    branchId?: number;
    title?: string;
    subtitle?: string;
}

export function SoldItemsAnalytics({ branchId, title, subtitle }: SoldItemsAnalyticsProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any>({ items: [], total_revenue: 0, total_quantity: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({
        from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
    });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await auditAPI.getSoldItemsAnalytics({
                from_date: dateRange.from,
                to_date: dateRange.to,
                branch_id: branchId
            });
            if (res.success) {
                setData(res.data);
            } else {
                toast.error(res.message || 'Failed to fetch analytics data');
            }
        } catch (error) {
            console.error('Error fetching analytics:', error);
            toast.error('Connect failed to analytics service');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [dateRange, branchId]);

    const filteredItems = useMemo(() => {
        if (!data.items) return [];
        return data.items.filter((item: any) =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.sku.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [data.items, searchTerm]);

    const topPerformers = useMemo(() => {
        return [...(data.items || [])].sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 5);
    }, [data.items]);

    return (
        <div className="space-y-6">
            {/* Headers if provided (usually handled by layout, but optional here) */}
            {(title || subtitle) && (
                <div className="mb-6">
                    {title && <h1 className="text-2xl font-bold text-stone-900">{title}</h1>}
                    {subtitle && <p className="text-stone-500">{subtitle}</p>}
                </div>
            )}

            {/* Filters & Stats Row */}
            <div className="flex flex-col md:flex-row gap-4 items-end justify-between bg-white p-6 rounded-2xl border border-stone-100 shadow-sm">
                <div className="flex flex-wrap gap-4 items-end">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Date Range</label>
                        <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2">
                            <Calendar className="h-4 w-4 text-stone-400" />
                            <input
                                type="date"
                                value={dateRange.from}
                                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                                className="bg-transparent border-none text-[13px] text-stone-600 focus:ring-0 p-0"
                            />
                            <span className="text-stone-300">to</span>
                            <input
                                type="date"
                                value={dateRange.to}
                                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                                className="bg-transparent border-none text-[13px] text-stone-600 focus:ring-0 p-0"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider ml-1">Search Products</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                            <input
                                type="text"
                                placeholder="Name or SKU..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-[13px] focus:ring-2 focus:ring-stone-900/10 transition-all w-[240px]"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchData}
                        className="p-2.5 hover:bg-stone-100 rounded-xl border border-stone-200 text-stone-600 transition-colors"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-stone-900 text-white rounded-xl text-[13px] font-bold hover:bg-black transition-all shadow-sm">
                        <Download className="h-4 w-4" /> Export Report
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm transition-all hover:border-stone-200">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <TrendingUp className="h-5 w-5 text-emerald-600" />
                        </div>
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-bold uppercase tracking-tight">Active Items</span>
                    </div>
                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Total Revenue</p>
                    <p className="text-[24px] font-black text-stone-900">KES {(data.total_revenue || 0).toLocaleString()}</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm transition-all hover:border-stone-200">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                            <Package className="h-5 w-5 text-blue-600" />
                        </div>
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-bold uppercase tracking-tight">Volume</span>
                    </div>
                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Units Sold</p>
                    <p className="text-[24px] font-black text-stone-900">{(data.total_quantity || 0).toLocaleString()}</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm col-span-1 lg:col-span-2 overflow-hidden">
                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-4">Top Performing Products (Revenue)</p>
                    <div className="space-y-3">
                        {topPerformers.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-bold text-stone-300 w-4">#{idx + 1}</span>
                                    <span className="text-[13px] font-medium text-stone-700 truncate max-w-[150px]">{item.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="w-24 h-1.5 bg-stone-50 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-stone-900 rounded-full"
                                            style={{ width: `${(item.total_revenue / topPerformers[0].total_revenue) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-[12px] font-bold text-stone-900">KES {item.total_revenue.toLocaleString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main List */}
            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/30">
                    <h3 className="text-[15px] font-bold text-stone-900">Sold Items Inventory</h3>
                    <button className="text-[11px] font-bold text-stone-400 hover:text-stone-900 transition-colors uppercase tracking-wider flex items-center gap-1">
                        <Filter className="h-3.5 w-3.5" /> Advance Filters
                    </button>
                </div>

                <div className="overflow-x-auto -mx-6 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                        <div className="overflow-hidden">
                            <table className="min-w-full w-full">
                                <thead>
                                    <tr className="bg-stone-50/50 border-b border-stone-100">
                                        <th className="py-3 px-6 text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider">Product Info</th>
                                        <th className="py-3 px-6 text-center text-[11px] font-bold text-stone-400 uppercase tracking-wider">Qty Sold</th>
                                        <th className="py-3 px-6 text-right text-[11px] font-bold text-stone-400 uppercase tracking-wider">Total Revenue</th>
                                        <th className="py-3 px-6 text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider">Branch Activity</th>
                                        <th className="py-3 px-6 text-center text-[11px] font-bold text-stone-400 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {isLoading ? (
                                        Array(5).fill(0).map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td colSpan={5} className="py-4 px-6"><div className="h-10 bg-stone-50 rounded-lg w-full" /></td>
                                            </tr>
                                        ))
                                    ) : filteredItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center text-stone-400 text-[13px]">No sales data found for the selected criteria.</td>
                                        </tr>
                                    ) : (
                                        filteredItems.map((item: any, i: number) => (
                                            <tr key={i} className="hover:bg-stone-50/50 transition-colors group">
                                                <td className="py-4 px-6">
                                                    <div className="flex flex-col">
                                                        <span className="text-[13px] font-bold text-stone-900">{item.name}</span>
                                                        <span className="text-[11px] text-stone-400 font-mono italic">{item.sku}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6 text-center">
                                                    <span className="text-[14px] font-bold text-stone-900">{item.total_quantity}</span>
                                                </td>
                                                <td className="py-4 px-6 text-right">
                                                    <span className="text-[14px] font-black text-stone-900">KES {item.total_revenue.toLocaleString()}</span>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {(item.branches || []).map((b: any, bi: number) => (
                                                            <div key={bi} className="flex items-center gap-1 bg-stone-100 px-2 py-0.5 rounded-full text-[10px] font-medium text-stone-600 border border-stone-200">
                                                                <MapPin className="h-2.5 w-2.5" /> {b.name}: {b.qty}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6 text-center">
                                                    <button className="p-2 hover:bg-stone-200 rounded-lg text-stone-400 hover:text-stone-900 transition-colors" title="View Trends">
                                                        <Eye className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
