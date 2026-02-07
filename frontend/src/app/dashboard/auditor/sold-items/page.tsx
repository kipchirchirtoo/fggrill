'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { auditAPI, auditorReportsAPI } from '@/lib/api';
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
    const [isExporting, setIsExporting] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);

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

    const handleExport = async () => {
        setIsExporting(true);
        try {
            await auditorReportsAPI.exportBrandedPdf('sales_performance', {
                branch_id: activeBranchId === 0 ? undefined : activeBranchId,
                start_date: dateRange.startDate,
                end_date: dateRange.endDate
            });
            toast.success("Sales performance report exported successfully");
        } catch (e) {
            console.error(e);
            toast.error("Failed to export sales performance report");
        } finally {
            setIsExporting(false);
        }
    };

    const filteredAnalysis = (auditData?.analysis || []).filter((item: any) =>
        item.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading && !auditData) {
        return (
            <DashboardLayout>
                <div className="space-y-8 pb-12 animate-pulse">
                    <div className="flex justify-between items-end gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gray-200"></div>
                            <div className="space-y-2">
                                <div className="h-8 w-64 bg-gray-200 rounded"></div>
                                <div className="h-4 w-96 bg-gray-200 rounded"></div>
                            </div>
                        </div>
                        <div className="h-10 w-32 bg-gray-200 rounded"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
                        ))}
                    </div>

                    <div className="h-96 bg-gray-200 rounded-xl"></div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="relative space-y-8 pb-12">
                    {/* Header */}
                    <div className="page-header flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-stone-900 flex items-center justify-center text-white shadow-lg">
                                <BarChart3 className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="page-title text-stone-900">
                                    {activeBranchId !== 0 ? `Branch Sales Performance` : `System Item Analytics`}
                                </h1>
                                <p className="page-subtitle">Compare item movement and consumption efficiency across departments</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 bg-stone-100/50 border border-stone-200 rounded-xl px-3 py-1.5 shadow-sm h-10">
                                <Calendar className="h-3.5 w-3.5 text-stone-400" />
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
                            <button onClick={fetchData} className="btn-primary">
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="stat-card">
                            <div className="stat-icon bg-emerald-50 text-emerald-500">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                            <p className="stat-value">{(auditData?.summary?.total_quantity_sold || 0).toLocaleString()}</p>
                            <p className="stat-label">Total Quantity Sold</p>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon bg-stone-50 text-stone-500">
                                <BarChart3 className="h-5 w-5" />
                            </div>
                            <p className="stat-value">KES {(auditData?.summary?.total_revenue || 0).toLocaleString()}</p>
                            <p className="stat-label">Revenue Contribution</p>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon bg-stone-50 text-stone-500">
                                <Package className="h-5 w-5" />
                            </div>
                            <p className="stat-value">{auditData?.summary?.total_items_sold || 0}</p>
                            <p className="stat-label">Unique SKUs Tracked</p>
                        </div>
                    </div>

                    {activeBranchId === 0 ? (
                        /* BRANCH LIST VIEW */
                        <div className="table-container shadow-sm border border-stone-100">
                            <div className="section-header p-5 border-b border-stone-100">
                                <div>
                                    <h2 className="section-title">Performance by Branch</h2>
                                    <p className="section-subtitle">Aggregate metrics across operational nodes</p>
                                </div>
                            </div>
                            <div className="table-responsive">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="table-header">
                                            <th className="table-header-cell">Branch</th>
                                            <th className="table-header-cell text-center">Items Sold</th>
                                            <th className="table-header-cell text-right">Revenue Generated</th>
                                            <th className="table-header-cell text-right">Avg Item Value</th>
                                            <th className="table-header-cell"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-50">
                                        {(auditData?.summary?.branch_summaries || []).map((branch: any) => {
                                            const avgValue = branch.total_quantity > 0 ? branch.total_revenue / branch.total_quantity : 0;
                                            return (
                                                <tr
                                                    key={branch.branch_id}
                                                    onClick={() => setActiveBranch(branch.branch_id)}
                                                    className="table-row cursor-pointer"
                                                >
                                                    <td className="table-cell">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-500 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                                                                <Building2 className="h-4 w-4" />
                                                            </div>
                                                            <span className="font-semibold text-stone-900">{branch.branch_name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="table-cell text-center font-semibold text-stone-700">
                                                        {branch.total_quantity.toLocaleString()}
                                                    </td>
                                                    <td className="table-cell text-right font-bold text-stone-900">
                                                        KES {branch.total_revenue.toLocaleString()}
                                                    </td>
                                                    <td className="table-cell text-right font-medium text-stone-400 italic">
                                                        KES {avgValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                    </td>
                                                    <td className="table-cell text-right">
                                                        <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-900 transition-colors" />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {(!auditData?.summary?.branch_summaries || auditData.summary.branch_summaries.length === 0) && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-20 text-center">
                                                    <span className="text-[11px] font-black uppercase tracking-widest text-stone-300">No data found</span>
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
                                <div className="flex items-center gap-3 bg-white border border-stone-100 rounded-xl px-4 h-12 w-full md:w-96 shadow-sm group focus-within:ring-2 focus-within:ring-stone-900/5 transition-all">
                                    <Search className="h-4 w-4 text-stone-300 group-focus-within:text-stone-900 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Search by item name..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="text-sm font-bold text-stone-900 outline-none w-full placeholder:text-stone-300 placeholder:font-semibold"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleExport}
                                        disabled={isExporting}
                                        className="btn-primary"
                                    >
                                        <FileDown className={`h-4 w-4 ${isExporting ? 'animate-bounce' : ''}`} />
                                        {isExporting ? 'Exporting...' : 'Export Ledger'}
                                    </button>
                                </div>
                            </div>

                            <div className="table-container shadow-sm border border-stone-100">
                                <div className="table-responsive">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="table-header">
                                                <th className="table-header-cell">Item Details</th>
                                                <th className="table-header-cell text-center">Qty Sold</th>
                                                <th className="table-header-cell text-right">Gross Revenue</th>
                                                <th className="table-header-cell text-center">Stock Req.</th>
                                                <th className="table-header-cell text-center">Efficiency</th>
                                                <th className="table-header-cell"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-50">
                                            {filteredAnalysis.map((item: any, idx: number) => {
                                                const ratio = item.consumption_ratio * 100;
                                                return (
                                                    <tr
                                                        key={idx}
                                                        className="table-row group cursor-pointer transition-all active:scale-[0.99] hover:bg-stone-50"
                                                        onClick={() => setSelectedItem(item)}
                                                    >
                                                        <td className="table-cell">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-stone-900">{item.name}</span>
                                                                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{item.category || (idx + 1).toString().padStart(3, '0')}</span>
                                                            </div>
                                                        </td>
                                                        <td className="table-cell text-center font-semibold text-stone-700">
                                                            {item.quantity.toLocaleString()}
                                                        </td>
                                                        <td className="table-cell text-right font-bold text-stone-900">
                                                            KES {item.revenue.toLocaleString()}
                                                        </td>
                                                        <td className="table-cell text-center font-medium text-stone-400 italic">
                                                            {item.stock_requested ? item.stock_requested.toLocaleString() : '-'}
                                                        </td>
                                                        <td className="table-cell text-center">
                                                            <div className="flex flex-col items-center gap-1.5 min-w-[100px]">
                                                                <span className={`text-[11px] font-bold uppercase tracking-tight ${ratio > 90 ? 'text-emerald-600' : ratio > 50 ? 'text-amber-600' : ratio === 0 ? 'text-stone-300' : 'text-rose-600'}`}>
                                                                    {item.stock_requested ? `${ratio.toFixed(1)}%` : 'N/A'}
                                                                </span>
                                                                <div className="w-full h-1 bg-stone-100 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all duration-1000 ${ratio > 90 ? 'bg-emerald-500' : ratio > 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                                        style={{ width: `${Math.min(ratio, 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="table-cell text-right">
                                                            <button
                                                                className="p-2 hover:bg-stone-200 rounded-lg transition-colors text-stone-400 opacity-0 group-hover:opacity-100"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedItem(item);
                                                                }}
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {filteredAnalysis.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-20 text-center text-stone-300 font-bold uppercase tracking-widest text-[11px]">
                                                        No matching items found
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

            {/* Item Details Side Panel */}
            {selectedItem && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    <div
                        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300"
                        onClick={() => setSelectedItem(null)}
                    />
                    <div className="relative w-full max-w-lg bg-white h-full shadow-2xl animate-in slide-in-from-right duration-300 border-l border-stone-100 overflow-y-auto">
                        {/* Panel Header */}
                        <div className="sticky top-0 z-10 p-6 bg-white/80 backdrop-blur-md border-b border-stone-100 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-stone-900 flex items-center justify-center text-white">
                                    <Package className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-stone-900 leading-tight">{selectedItem.name}</h3>
                                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{selectedItem.category} Analysis</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="w-10 h-10 rounded-full hover:bg-stone-100 flex items-center justify-center text-stone-400 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Panel Content */}
                        <div className="p-8 space-y-8">
                            {/* Key Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100">
                                    <TrendingUp className="h-4 w-4 text-emerald-500 mb-2" />
                                    <p className="text-xl font-bold text-stone-900">{selectedItem.quantity.toLocaleString()}</p>
                                    <p className="text-[11px] font-semibold text-stone-400">Total Units Sold</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100">
                                    <BarChart3 className="h-4 w-4 text-stone-500 mb-2" />
                                    <p className="text-xl font-bold text-stone-900">KES {selectedItem.revenue.toLocaleString()}</p>
                                    <p className="text-[11px] font-semibold text-stone-400">Revenue Contribution</p>
                                </div>
                            </div>

                            {/* Efficiency Breakdown */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-stone-900">Operational Efficiency</h4>
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-stone-100">
                                        <div className={`w-1.5 h-1.5 rounded-full ${selectedItem.consumption_ratio > 0.9 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                        <span className="text-[10px] font-bold text-stone-600">Real-time Data</span>
                                    </div>
                                </div>

                                <div className="p-6 rounded-2xl border border-stone-100 bg-white shadow-sm space-y-6">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <p className="text-sm font-semibold text-stone-600">Stock Utilization</p>
                                            <p className="text-lg font-black text-stone-900">{(selectedItem.consumption_ratio * 100).toFixed(1)}%</p>
                                        </div>
                                        <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${selectedItem.consumption_ratio > 0.9 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                                style={{ width: `${Math.min(selectedItem.consumption_ratio * 100, 100)}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 pt-4 border-t border-stone-50 gap-8">
                                        <div>
                                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Stock Requested</p>
                                            <p className="text-lg font-bold text-stone-900">{selectedItem.stock_requested || '0'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Consumption Gap</p>
                                            <p className="text-lg font-bold text-stone-900">
                                                {selectedItem.stock_requested ? Math.max(0, selectedItem.stock_requested - selectedItem.quantity) : '-'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>



                            {/* Meta */}
                            <div className="pt-8 flex flex-col items-center gap-2 border-t border-stone-50">
                                <p className="text-[10px] font-black text-stone-300 uppercase tracking-[0.2em]">Item Identifier</p>
                                <code className="text-[10px] font-mono font-bold text-stone-400 bg-stone-50 px-3 py-1 rounded-full border border-stone-100 outline-none">
                                    {selectedItem.item_id || 'INTERNAL_REF_NOT_SET'}
                                </code>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </ProtectedRoute>
    );
}
