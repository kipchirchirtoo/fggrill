'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Package, ArrowRight, AlertTriangle, CheckCircle,
    Search, Filter, Download, RefreshCw, ChevronRight,
    SearchIcon, TrendingUp, History, ClipboardCheck
} from 'lucide-react';
import { auditAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { BranchSelector, useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { toast } from 'sonner';

export default function SalesStockVerification() {
    const { activeBranchId, activeBranch } = useBranch();
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateRange, setDateRange] = useState({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await auditAPI.verifySales({
                branch_id: activeBranchId === 0 ? undefined : activeBranchId,
                start_date: dateRange.startDate,
                end_date: dateRange.endDate
            });

            if (res.success) {
                setData(res.data);
            } else {
                toast.error(res.message || 'Failed to fetch verification data');
            }
        } catch (e) {
            console.error("Verification fetch failed:", e);
            toast.error('An error occurred while fetching data');
        } finally {
            setIsLoading(false);
        }
    }, [activeBranchId, dateRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredVoids = (data?.suspicious_voids || []).filter((v: any) =>
        v.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.waiter?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6 pb-10">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Package className="h-4 w-4 text-stone-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Inventory Oversight</span>
                            </div>
                            <h1 className="text-2xl font-black text-stone-900 tracking-tight">Sales & Stock Verification</h1>
                            <p className="text-stone-500 text-sm mt-1">Cross-referencing POS sales data with physical stock movements</p>
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
                                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                                Verify
                            </button>
                        </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="card-elevated p-5 bg-white">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Total Sales Items</p>
                            <div className="flex items-end justify-between">
                                <h3 className="text-2xl font-black text-stone-900">{data?.total_sales_count || 0}</h3>
                                <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">+12% vs last period</div>
                            </div>
                        </div>
                        <div className="card-elevated p-5 bg-white border-l-4 border-l-rose-500">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Suspicious Voids</p>
                            <div className="flex items-end justify-between">
                                <h3 className="text-2xl font-black text-stone-900">{data?.suspicious_voids?.length || 0}</h3>
                                <div className="text-[10px] font-bold text-rose-600 uppercase">High Risk Flag</div>
                            </div>
                        </div>
                        <div className="card-elevated p-5 bg-white">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Stock Reconciliation</p>
                            <div className="flex items-end justify-between">
                                <h3 className="text-2xl font-black text-stone-900">{data?.reconciliation_status || '92% Concordance'}</h3>
                                <div className="flex gap-1">
                                    <div className="w-1 h-3 bg-stone-100 rounded-full"></div>
                                    <div className="w-1 h-3 bg-stone-900 rounded-full"></div>
                                    <div className="w-1 h-3 bg-stone-900 rounded-full"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Tabs/Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Suspicious Transactions */}
                        <div className="lg:col-span-2 card-elevated p-0 bg-white overflow-hidden">
                            <div className="p-6 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <h3 className="text-[16px] font-black text-stone-900 flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-rose-500" />
                                    Suspicious Voids & Deletions
                                </h3>
                                <div className="relative">
                                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by order or staff..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium w-full sm:w-[240px] focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-stone-50 text-[10px] font-black uppercase tracking-widest text-stone-400 border-b border-stone-100">
                                        <tr>
                                            <th className="px-6 py-4">Order #</th>
                                            <th className="px-6 py-4">Waiter / Cashier</th>
                                            <th className="px-6 py-4">Amount</th>
                                            <th className="px-6 py-4">Time</th>
                                            <th className="px-6 py-4 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-50">
                                        {filteredVoids.length > 0 ? (
                                            filteredVoids.map((voidItem: any, i: number) => (
                                                <tr key={i} className="hover:bg-stone-50/50 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <span className="text-[13px] font-bold text-stone-900">{voidItem.order_number}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-[12px] font-medium text-stone-600">{voidItem.waiter}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-[13px] font-black text-rose-600">KES {voidItem.total_amount?.toLocaleString()}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-[11px] text-stone-400">{new Date(voidItem.created_at).toLocaleString()}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button className="text-[11px] font-black uppercase text-stone-400 hover:text-stone-900 transition-colors">Investigate</button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-20 text-center text-stone-300 text-sm italic">
                                                    No suspicious transactions found for this period
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Inventory Context */}
                        <div className="space-y-6">
                            <div className="card-elevated p-6 bg-stone-900 text-white relative overflow-hidden">
                                <TrendingUp className="absolute -right-4 -bottom-4 w-24 h-24 opacity-10" />
                                <h3 className="text-[15px] font-black mb-4">Branch Stock Alerts</h3>
                                <div className="space-y-4">
                                    {(data?.low_stock_items || []).slice(0, 4).map((item: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                                            <div>
                                                <p className="text-[12px] font-bold">{item.item_name}</p>
                                                <p className="text-[10px] text-stone-400">Current Stock: {item.stock_level}</p>
                                            </div>
                                            <div className="text-xs font-black text-amber-400">REORDER</div>
                                        </div>
                                    ))}
                                    {(!data?.low_stock_items || data.low_stock_items.length === 0) && (
                                        <p className="text-xs text-stone-500 italic">No critical stock alerts</p>
                                    )}
                                </div>
                            </div>

                            <div className="card-elevated p-6 bg-white border border-stone-200">
                                <h3 className="text-[15px] font-black text-stone-900 mb-4 flex items-center gap-2">
                                    <ClipboardCheck className="h-5 w-5 text-emerald-500" />
                                    Verification Tools
                                </h3>
                                <div className="grid grid-cols-1 gap-2">
                                    <button className="flex items-center justify-between p-3 rounded-xl border border-stone-100 hover:border-stone-400 transition-all text-left group">
                                        <div>
                                            <p className="text-[12px] font-bold text-stone-900">Download Sales Export</p>
                                            <p className="text-[10px] text-stone-400">Raw POS transaction data</p>
                                        </div>
                                        <Download className="h-4 w-4 text-stone-300 group-hover:text-stone-900" />
                                    </button>
                                    <button className="flex items-center justify-between p-3 rounded-xl border border-stone-100 hover:border-stone-400 transition-all text-left group">
                                        <div>
                                            <p className="text-[12px] font-bold text-stone-900">Generate Variance Report</p>
                                            <p className="text-[10px] text-stone-400">Stock vs Sales delta analysis</p>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-stone-300 group-hover:text-stone-900" />
                                    </button>
                                    <button className="flex items-center justify-between p-3 rounded-xl border border-stone-100 hover:border-stone-400 transition-all text-left group">
                                        <div>
                                            <p className="text-[12px] font-bold text-stone-900">Log Audit Finding</p>
                                            <p className="text-[10px] text-stone-400">Manual entry for discrepancies</p>
                                        </div>
                                        <History className="h-4 w-4 text-stone-300 group-hover:text-stone-900" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
