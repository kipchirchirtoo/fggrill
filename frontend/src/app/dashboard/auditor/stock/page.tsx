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
    Search, Boxes, Thermometer, TrendingDown, FileDown, DollarSign
} from 'lucide-react';
import { toast } from 'sonner';

const StockItemDetailsModal = ({ item, isOpen, onClose }: { item: any, isOpen: boolean, onClose: () => void }) => {
    if (!isOpen || !item) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-stone-100 flex flex-col animate-in fade-in zoom-in duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="px-6 py-5 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                    <div>
                        <h3 className="text-lg font-bold text-stone-900 tracking-tight">Stock Item Detail</h3>
                        <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-widest">{item.item_sku || 'No SKU'}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-full transition-colors text-stone-400">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                        <h4 className="text-sm font-bold text-stone-900 mb-1">{item.item?.name || item.item_name}</h4>
                        <div className="flex gap-2 text-xs text-stone-500">
                            <span className="bg-white px-2 py-0.5 rounded border border-stone-200">{item.item?.category || item.item_category || 'General'}</span>
                            <span className="bg-white px-2 py-0.5 rounded border border-stone-200">{item.item?.unit || item.item_unit || 'Unit'}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-3 bg-stone-50 rounded-lg text-center border border-stone-100">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">System</p>
                            <p className="text-xl font-black text-stone-800">{item.current_quantity ?? item.quantity}</p>
                        </div>
                        <div className="p-3 bg-stone-50 rounded-lg text-center border border-stone-100">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Theoretical</p>
                            <p className="text-xl font-black text-stone-500">{item.theoretical_quantity?.toFixed(1) || '0.0'}</p>
                        </div>
                        <div className={`p-3 rounded-lg text-center border ${item.variance !== 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${item.variance !== 0 ? 'text-rose-400' : 'text-emerald-400'}`}>Variance</p>
                            <p className={`text-xl font-black ${item.variance !== 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {item.variance > 0 ? '+' : ''}{item.variance?.toFixed(1) || '0.0'}
                            </p>
                        </div>
                    </div>

                    {Math.abs(item.variance) > 0 && (
                        <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3 text-amber-800 text-sm">
                            <AlertTriangle className="h-5 w-5 shrink-0" />
                            <div>
                                <p className="font-bold mb-1">Discrepancy Detected</p>
                                <p className="text-xs opacity-90">
                                    There is a {item.variance_percentage?.toFixed(1)}% variance between system records and theoretical usage.
                                    This requires investigation.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-6 py-5 bg-stone-50/50 flex justify-end gap-3 border-t border-stone-100">
                    <button onClick={onClose} className="btn-secondary">Close</button>
                </div>
            </div>
        </div>
    );
};

export default function StockAuditPage() {
    const { activeBranchId, setActiveBranch, activeBranch } = useBranch();
    const [auditData, setAuditData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState<any>(null);

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
            await auditAPI.exportStockLedger({
                branch_id: activeBranchId || undefined
            });
            toast.dismiss();
            toast.success("Stock ledger downloaded");
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

    if (isLoading && !auditData) {
        return (
            <DashboardLayout>
                <div className="space-y-8 pb-12 animate-pulse">
                    <div className="flex justify-between items-center mb-6">
                        <div className="space-y-2">
                            <div className="h-8 w-64 bg-gray-200 rounded"></div>
                            <div className="h-4 w-96 bg-gray-200 rounded"></div>
                        </div>
                        <div className="h-10 w-32 bg-gray-200 rounded"></div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="h-48 bg-gray-200 rounded-xl"></div>
                        ))}
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-8 pb-12">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">
                                {activeBranchId === 0 || activeBranchId === null ? "System Stock Oversight" : `Stock Audit: ${activeBranch?.name}`}
                            </h1>
                            <p className="text-stone-500 mt-0.5">Monitor stock integrity, variances, and operational health</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <BranchSelector />
                            <div className="h-8 w-[1px] bg-stone-200 mx-1 hidden sm:block" />
                            <button onClick={fetchData} className="btn-secondary">
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span className="ml-2">Sync</span>
                            </button>
                        </div>
                    </div>

                    {/* High-level Scorecards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="stat-card">
                            <div className="stat-icon bg-stone-50 text-stone-600">
                                <Package className="h-5 w-5" />
                            </div>
                            <p className="stat-value">{auditData?.summary?.total_items || 0}</p>
                            <p className="stat-label">Total Items</p>
                        </div>

                        <div className="stat-card">
                            <div className={`stat-icon ${(auditData?.summary?.items_with_discrepancies || 0) > 0 ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <p className={`stat-value ${(auditData?.summary?.items_with_discrepancies || 0) > 0 ? 'text-rose-600' : ''}`}>
                                {auditData?.summary?.items_with_discrepancies || 0}
                            </p>
                            <p className="stat-label">Discrepancies</p>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon bg-amber-50 text-amber-500">
                                <TrendingDown className="h-5 w-5" />
                            </div>
                            <p className="stat-value">{auditData?.summary?.low_stock_items || 0}</p>
                            <p className="stat-label">Low Stock Items</p>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon bg-blue-50 text-blue-500">
                                <DollarSign className="h-5 w-5" />
                            </div>
                            <p className="stat-value font-mono text-[18px]">
                                KES {auditData?.summary?.total_variance_value?.toLocaleString() || 0}
                            </p>
                            <p className="stat-label">Variance Value</p>
                        </div>
                    </div>

                    {activeBranchId === 0 || activeBranchId === null ? (
                        /* BRANCH HEALTH GRID */
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-[18px] font-semibold text-stone-900">Branch Health</h2>
                                    <p className="text-stone-500 text-sm">Overview of stock integrity per operational node</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {(auditData?.summary?.branch_summaries || []).map((branch: any) => (
                                    <div
                                        key={branch.branch_id}
                                        onClick={() => setActiveBranch(branch.branch_id)}
                                        className="card-elevated hover:border-stone-300 transition-all cursor-pointer group flex flex-col p-5"
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-stone-600 group-hover:bg-stone-900 group-hover:text-white transition-all">
                                                    <Building2 className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-stone-900">{branch.branch_name}</h4>
                                                    <p className="text-[11px] text-stone-400">Node ID: {branch.branch_id}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[18px] font-bold text-stone-900">{branch.health_score || 0}%</div>
                                                <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Score</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 mt-auto">
                                            <div className="bg-stone-50 rounded-lg p-2 text-center">
                                                <p className="text-[9px] text-stone-400 uppercase font-bold">Items</p>
                                                <p className="text-sm font-bold text-stone-800">{branch.total_items}</p>
                                            </div>
                                            <div className="bg-stone-50 rounded-lg p-2 text-center">
                                                <p className="text-[9px] text-stone-400 uppercase font-bold">Variances</p>
                                                <p className={`text-sm font-bold ${branch.items_with_discrepancies > 0 ? 'text-rose-600' : 'text-stone-800'}`}>
                                                    {branch.items_with_discrepancies}
                                                </p>
                                            </div>
                                            <div className="bg-stone-50 rounded-lg p-2 text-center">
                                                <p className="text-[9px] text-stone-400 uppercase font-bold">Value</p>
                                                <p className="text-[10px] font-bold text-blue-600 leading-tight">
                                                    KES {branch.total_variance_value > 1000 ? (branch.total_variance_value / 1000).toFixed(1) + 'k' : branch.total_variance_value}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-stone-100 text-[11px] font-medium text-stone-400 group-hover:text-stone-900 transition-colors">
                                            <span>Enter Branch Audit</span>
                                            <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">
                            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                                <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-lg px-3 h-10 w-full md:w-80 transition-all focus-within:border-stone-400 focus-within:ring-4 focus-within:ring-stone-900/5">
                                    <Search className="h-4 w-4 text-stone-400" />
                                    <input
                                        type="text"
                                        placeholder="Search inventory..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="text-[13px] text-stone-900 outline-none w-full placeholder:text-stone-400"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={handleFlagVariance} className="btn-secondary h-10">
                                        <Activity className="h-4 w-4" />
                                        <span>Flag Variances</span>
                                    </button>
                                    <button onClick={handleExport} className="btn-primary h-10">
                                        <FileDown className="h-4 w-4" />
                                        <span>Export Ledger</span>
                                    </button>
                                </div>
                            </div>

                            <div className="card-elevated overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-stone-50/50 border-b border-stone-100">
                                                <th className="px-5 py-3.5 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Inventory Item</th>
                                                <th className="px-5 py-3.5 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-center">System Stock</th>
                                                <th className="px-5 py-3.5 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-center">Theoretical</th>
                                                <th className="px-5 py-3.5 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-center">Variance</th>
                                                <th className="px-5 py-3.5 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-center">Status</th>
                                                <th className="px-5 py-3.5 text-[11px] font-bold text-stone-400 uppercase tracking-widest"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-50">
                                            {filteredInventory.map((item: any, idx: number) => {
                                                const hasDiscrepancy = Math.abs(item.variance || 0) > 0.01;
                                                return (
                                                    <tr key={idx} className="hover:bg-stone-50/50 transition-colors group">
                                                        <td className="px-5 py-3">
                                                            <div className="flex flex-col">
                                                                <span className="text-[13px] font-semibold text-stone-900">{item.item?.name || item.item_name}</span>
                                                                <span className="text-[11px] text-stone-400 font-medium">{item.item_sku}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3 text-center text-[13px] font-medium text-stone-600">
                                                            {item.current_quantity ?? item.quantity ?? 0}
                                                        </td>
                                                        <td className="px-5 py-3 text-center text-[13px] font-medium text-stone-400">
                                                            {item.theoretical_quantity?.toFixed(2) || item.theoretical?.toFixed(2) || '0.00'}
                                                        </td>
                                                        <td className="px-5 py-3 text-center">
                                                            <span className={`text-[12px] font-bold px-2 py-0.5 rounded ${hasDiscrepancy ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50'}`}>
                                                                {item.variance > 0 ? '+' : ''}{item.variance?.toFixed(2) || '0.00'}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3 text-center">
                                                            {hasDiscrepancy ? (
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 bg-rose-50 px-2 py-1 rounded-full border border-rose-100">Flagged</span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">Balanced</span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3 text-right">
                                                            <button
                                                                onClick={() => setSelectedItem(item)}
                                                                className="p-1.5 hover:bg-white hover:shadow-sm border border-transparent hover:border-stone-200 rounded-md transition-all text-stone-300 hover:text-stone-600"
                                                            >
                                                                <Eye className="h-3.5 w-3.5" />
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
                                                                No inventory data found
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
                {selectedItem && (
                    <StockItemDetailsModal
                        item={selectedItem}
                        isOpen={!!selectedItem}
                        onClose={() => setSelectedItem(null)}
                    />
                )}
            </DashboardLayout>
        </ProtectedRoute>
    );
}
