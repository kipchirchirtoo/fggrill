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
import { auditorReportsAPI } from '@/lib/api'; // Added import for report export


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

    const filteredInventory = (auditData?.stock_items || auditData?.inventory || []).filter((item: any) =>
        item.item?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || // Check nested item.name
        item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.item_sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleExport = async () => {
        try {
            toast.loading("Generating stock ledger...");
            await auditorReportsAPI.exportBrandedPdf('inventory_status_report', {
                branch_id: activeBranchId || 0,
                start_date: new Date().toISOString().split('T')[0],
                end_date: new Date().toISOString().split('T')[0]
            });
            toast.dismiss();
            toast.success("Export completed successfully");
        } catch (error) {
            console.error(error);
            toast.dismiss();
            toast.error("Failed to export ledger");
        }
    };

    const handleFlagVariance = async () => {
        const inventory = auditData?.stock_items || auditData?.inventory || [];
        const discrepancies = inventory.filter((i: any) => i.is_discrepancy || Math.abs(i.variance) > 0);

        if (discrepancies.length === 0) {
            toast.info("No variances to flag.");
            return;
        }

        toast.loading(`Flagging ${discrepancies.length} variances...`);
        let count = 0;

        // Process top 20 to avoid timeout/spam
        for (const item of discrepancies.slice(0, 20)) {
            try {
                await auditAPI.createException({
                    audit_session_id: 'MANUAL_FLAG_' + new Date().getTime(),
                    exception_type: 'STOCK_VARIANCE',
                    severity: Math.abs(item.variance_percentage) > 20 ? 'critical' : 'medium',
                    description: `Stock variance for ${item.item?.name || item.item_name}. System: ${item.current_quantity}, Theoretical: ${item.theoretical_quantity}`,
                    amount: Math.abs(item.variance),
                    reference_type: 'item',
                    reference_id: item.item?.id || item.id,
                });
                count++;
            } catch (e) {
                console.error("Failed to flag item", item, e);
            }
        }

        toast.dismiss();
        if (count > 0) toast.success(`Successfully flagged ${count} items.`);
        else toast.error("Failed to flag variances. Check console.");
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-8 pb-12">
                    {/* Header */}
                    <div className="page-header flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-stone-900 flex items-center justify-center text-white shadow-lg">
                                <Boxes className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="page-title text-stone-900">
                                    {activeBranchId !== 0 ? `Inventory Health: Branch Audit` : `System Stock Oversight`}
                                </h1>
                                <p className="page-subtitle">Monitor stock integrity, variances, and operational health across nodes</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="hidden md:flex items-center gap-2 bg-stone-100/50 border border-stone-200 rounded-xl px-3 py-1.5 shadow-sm h-[42px]">
                                <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Live Audit Mode</span>
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            </div>
                            <BranchSelector />
                            <button className="btn-secondary h-[42px]">
                                <FileDown className="h-4 w-4" />
                            </button>
                            <button onClick={fetchData} className="btn-primary h-[42px] shadow-lg shadow-stone-900/10">
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span className="ml-2">Sync</span>
                            </button>
                        </div>
                    </div>

                    {/* High-level Scorecards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="stat-card bg-stone-900 text-white border-none shadow-xl shadow-stone-900/10 relative overflow-hidden group">
                            <Activity className="absolute -right-4 -bottom-4 w-24 h-24 opacity-10 group-hover:scale-110 transition-transform" />
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="stat-label text-stone-400">System Integrity</p>
                                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                                </div>
                                <p className="stat-value text-white text-4xl">98.4%</p>
                                <p className="text-[10px] text-stone-400 mt-2 font-medium">Weighted score across all active nodes</p>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className={`stat-icon ${(auditData?.summary?.total_discrepancies || 0) > 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <p className={`stat-value ${(auditData?.summary?.total_discrepancies || 0) > 0 ? 'text-rose-600' : ''}`}>
                                {auditData?.summary?.total_discrepancies || 0}
                            </p>
                            <p className="stat-label">Critical Variances</p>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon bg-amber-50 text-amber-500">
                                <TrendingDown className="h-5 w-5" />
                            </div>
                            <p className="stat-value">{auditData?.summary?.total_low_stock || 0}</p>
                            <p className="stat-label">Low Stock Points</p>
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
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">
                            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                                <div className="flex items-center gap-3 bg-white border border-stone-100 rounded-xl px-4 h-12 w-full md:w-96 shadow-sm group focus-within:ring-2 focus-within:ring-stone-900/5 transition-all">
                                    <Search className="h-4 w-4 text-stone-300 group-focus-within:text-stone-900 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Search inventory by name or SKU..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="text-sm font-bold text-stone-900 outline-none w-full placeholder:text-stone-300 placeholder:font-semibold"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={handleFlagVariance} className="btn-secondary h-12 px-5">
                                        <Activity className="h-4 w-4 mr-2" /> Flag Variances
                                    </button>
                                    <button onClick={handleExport} className="btn-primary h-12 px-5 shadow-lg shadow-stone-900/10">
                                        <FileDown className="h-4 w-4 mr-2" /> Export Ledger
                                    </button>
                                </div>
                            </div>

                            <div className="table-container shadow-sm border border-stone-100">
                                <div className="table-responsive">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="table-header">
                                                <th className="table-header-cell">Inventory Item</th>
                                                <th className="table-header-cell text-center">System Stock</th>
                                                <th className="table-header-cell text-center">Theoretical</th>
                                                <th className="table-header-cell text-center">Variance</th>
                                                <th className="table-header-cell text-center">Audit Status</th>
                                                <th className="table-header-cell"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-50">
                                            {filteredInventory.map((item: any, idx: number) => {
                                                const hasDiscrepancy = item.variance !== 0;
                                                return (
                                                    <tr key={idx} className="table-row group">
                                                        <td className="table-cell">
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-stone-900 tracking-tight">{item.item?.name || item.item_name}</span>
                                                                <span className="text-[10px] text-stone-400 font-mono tracking-tighter uppercase mt-0.5">{item.item_sku}</span>
                                                            </div>
                                                        </td>
                                                        <td className="table-cell text-center font-mono font-bold text-stone-700">
                                                            {item.current_quantity ?? item.quantity}
                                                        </td>
                                                        <td className="table-cell text-center font-mono font-medium text-stone-400">
                                                            {item.theoretical_quantity?.toFixed(1) || item.theoretical?.toFixed(1) || '0.0'}
                                                        </td>
                                                        <td className="table-cell text-center">
                                                            <span className={`font-mono font-black py-1 px-2 rounded-lg ${hasDiscrepancy ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50/50'}`}>
                                                                {item.variance > 0 ? '+' : ''}{item.variance?.toFixed(1) || '0.0'}
                                                            </span>
                                                        </td>
                                                        <td className="table-cell text-center">
                                                            {hasDiscrepancy ? (
                                                                <span className="badge-danger">Flagged</span>
                                                            ) : (
                                                                <span className="badge-success">Balanced</span>
                                                            )}
                                                        </td>
                                                        <td className="table-cell text-right">
                                                            <button className="w-8 h-8 rounded-lg hover:bg-stone-900 hover:text-white transition-all flex items-center justify-center text-stone-300">
                                                                <Eye className="h-4 w-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {filteredInventory.length === 0 && (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-20 text-center">
                                                        <div className="flex flex-col items-center gap-2 opacity-30">
                                                            <Boxes className="h-10 w-10 mb-2" />
                                                            <p className="text-[11px] font-black uppercase tracking-widest text-stone-300">
                                                                {isLoading ? "Auditing stock..." : "No inventory data found"}
                                                            </p>
                                                        </div>
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
