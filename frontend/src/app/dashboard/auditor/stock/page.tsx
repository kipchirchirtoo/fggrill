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
    Building2, Activity, ShieldCheck, ChevronRight,
    Search, Boxes, Thermometer, TrendingDown, FileDown
} from 'lucide-react';
import { toast } from 'sonner';

export default function StockAuditPage() {
    const { activeBranchId, setActiveBranch } = useBranch();
    const [auditData, setAuditData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await auditAPI.verifyStockLevels({
                branch_id: (activeBranchId === 0 || activeBranchId === null) ? undefined : activeBranchId
            });

            if (res.success) {
                setAuditData(res.data);
            } else {
                toast.error(res.message || 'Failed to fetch stock audit data');
            }
        } catch (e) {
            console.error(e);
            toast.error("Network error while syncing stock levels");
        } finally {
            setIsLoading(false);
        }
    }, [activeBranchId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredInventory = (auditData?.inventory || []).filter((item: any) =>
        item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.item_sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-8 pb-12">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Boxes className="h-4 w-4 text-stone-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Inventory Health</span>
                            </div>
                            <h1 className="text-2xl font-black text-stone-900 tracking-tight leading-none">
                                {activeBranchId !== 0 ? `Inventory Health Audit` : `System Stock Oversight`}
                            </h1>
                            <p className="text-stone-500 text-sm mt-2 font-medium italic">Monitor stock integrity, variances, and operational health across all nodes</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <BranchSelector />
                            <button className="flex items-center gap-2 h-10 px-4 py-2.5 bg-stone-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-stone-800 shadow-xl shadow-stone-900/10 transition-all">
                                <FileDown className="h-4 w-4" /> Export Global Health
                            </button>
                            <button onClick={fetchData} className="p-2.5 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors shadow-sm">
                                <RefreshCw className={`h-4 w-4 text-stone-600 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* High-level Scorecards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="card-elevated p-8 border border-stone-100 bg-white shadow-xl shadow-stone-200/20">
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Critical Variances</p>
                            <h3 className={`text-3xl font-black tracking-tighter ${(auditData?.summary?.total_discrepancies || 0) > 0 ? 'text-rose-600' : 'text-stone-900'}`}>
                                {auditData?.summary?.total_discrepancies || 0}
                            </h3>
                            <div className="flex items-center gap-1.5 mt-3">
                                <AlertTriangle className={`h-3 w-3 ${(auditData?.summary?.total_discrepancies || 0) > 0 ? 'text-rose-500' : 'text-stone-300'}`} />
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Items with count mismatch</p>
                            </div>
                        </div>
                        <div className="card-elevated p-8 border border-stone-100 bg-white shadow-xl shadow-stone-200/20">
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Low Stock Points</p>
                            <h3 className="text-3xl font-black text-stone-900 tracking-tighter">{auditData?.summary?.total_low_stock || 0}</h3>
                            <div className="flex items-center gap-1.5 mt-3">
                                <TrendingDown className="h-3 w-3 text-amber-500" />
                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Requires replenishment</p>
                            </div>
                        </div>
                        <div className="card-elevated p-8 border border-stone-100 bg-white shadow-xl shadow-stone-200/20">
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">System Integrity</p>
                            <div className="flex items-center gap-2">
                                <h3 className="text-3xl font-black text-stone-900 tracking-tighter">98.4%</h3>
                                <ShieldCheck className="h-6 w-6 text-emerald-500" />
                            </div>
                            <div className="flex items-center gap-1.5 mt-3">
                                <Check className="h-3 w-3 text-emerald-500" />
                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Tracking accuracy score</p>
                            </div>
                        </div>
                    </div>

                    {activeBranchId === 0 ? (
                        /* BRANCH HEALTH GRID */
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {(auditData?.branch_summaries || []).map((branch: any) => (
                                <div
                                    key={branch.branch_id}
                                    onClick={() => setActiveBranch(branch.branch_id)}
                                    className="card-elevated border border-stone-100 bg-white hover:border-stone-300 transition-all cursor-pointer group flex flex-col shadow-xl shadow-stone-200/20 overflow-hidden"
                                >
                                    <div className="p-8 flex items-start justify-between border-b border-stone-50">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-600 group-hover:bg-stone-900 group-hover:text-white transition-all shadow-inner">
                                                <Building2 className="h-7 w-7" />
                                            </div>
                                            <div>
                                                <h4 className="text-[18px] font-black text-stone-900 tracking-tight">{branch.branch_name}</h4>
                                                <p className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest">Node ID: {branch.branch_id}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[22px] font-black text-stone-900 italic tracking-tighter">{branch.health_score || 0}%</div>
                                            <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Audit Score</p>
                                        </div>
                                    </div>
                                    <div className="p-8 grid grid-cols-3 gap-6 bg-stone-50/40">
                                        <div>
                                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-tighter mb-1.5">Tracked Items</p>
                                            <p className="text-[16px] font-black text-stone-800">{branch.total_items.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-tighter mb-1.5">Variances</p>
                                            <p className={`text-[16px] font-black ${branch.discrepancies > 0 ? 'text-rose-600' : 'text-stone-800'}`}>
                                                {branch.discrepancies}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-stone-400 uppercase tracking-tighter mb-1.5">Low Stock</p>
                                            <p className="text-[16px] font-black text-amber-600 italic">{branch.low_stock_items}</p>
                                        </div>
                                    </div>
                                    <div className="px-8 py-4 border-t border-stone-50 flex items-center justify-between group-hover:bg-stone-900 group-hover:text-white transition-all duration-300">
                                        <span className="text-[10px] font-black text-stone-400 group-hover:text-stone-500 uppercase tracking-widest">Click to audit branch inventory</span>
                                        <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-white group-hover:translate-x-1 transition-all" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* DETAILED STOCK LIST */
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">
                            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                                <div className="relative w-full md:w-96">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-300" />
                                    <input
                                        type="text"
                                        placeholder="Search inventory by name or SKU..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-200/60 rounded-2xl text-[13px] font-bold text-stone-700 outline-none focus:border-stone-400 focus:bg-white transition-all shadow-sm"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-stone-200 rounded-xl text-[11px] font-black uppercase tracking-widest text-stone-600 hover:bg-stone-50 transition-all shadow-sm">
                                        <Activity className="h-4 w-4" /> Flag Variances
                                    </button>
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
                                                <th className="px-6 py-4">Inventory Item</th>
                                                <th className="px-6 py-4 text-center">System Stock</th>
                                                <th className="px-6 py-4 text-center">Theoretical</th>
                                                <th className="px-6 py-4 text-center">Variance</th>
                                                <th className="px-6 py-4 text-center">Audit Status</th>
                                                <th className="px-6 py-4"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-50">
                                            {filteredInventory.map((item: any, idx: number) => {
                                                const hasDiscrepancy = item.variance !== 0;
                                                return (
                                                    <tr key={idx} className="hover:bg-stone-50/50 transition-colors group">
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-[14px] font-black text-stone-900">{item.item_name}</span>
                                                                <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-widest font-mono italic">{item.item_sku}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center font-mono font-bold text-[14px] text-stone-700">
                                                            {item.quantity}
                                                        </td>
                                                        <td className="px-6 py-4 text-center font-mono font-bold text-[14px] text-stone-400">
                                                            {item.theoretical?.toFixed(1) || '0.0'}
                                                        </td>
                                                        <td className={`px-6 py-4 text-center font-mono font-black text-[15px] ${hasDiscrepancy ? 'text-rose-600 bg-rose-50/30' : 'text-emerald-600'}`}>
                                                            {item.variance > 0 ? '+' : ''}{item.variance?.toFixed(1) || '0.0'}
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            {hasDiscrepancy ? (
                                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-700 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all shadow-sm">
                                                                    <AlertTriangle className="h-3.5 w-3.5" /> Flagged
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all shadow-sm">
                                                                    <Check className="h-3.5 w-3.5" /> Balanced
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <button className="p-2 hover:bg-stone-900 hover:text-white rounded-xl transition-all text-stone-300 opacity-0 group-hover:opacity-100">
                                                                <Eye className="h-4 w-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {filteredInventory.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-20 text-center text-stone-300 font-bold uppercase tracking-widest text-[11px]">
                                                        {isLoading ? (
                                                            <div className="flex flex-col items-center gap-2 opacity-50">
                                                                <RefreshCw className="h-6 w-6 animate-spin text-stone-300" />
                                                                <span className="text-[11px] font-black uppercase tracking-widest text-stone-400">Syncing health...</span>
                                                            </div>
                                                        ) : "No inventory data found"}
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
