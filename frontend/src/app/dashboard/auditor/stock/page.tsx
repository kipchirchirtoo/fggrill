'use client';

import React, { useState, useEffect } from 'react';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { Package, AlertTriangle, ArrowRight, Check, X, Filter, ArrowLeft, RefreshCw, Box, Clock, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { auditAPI, storeAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function StockAuditPage() {
    const router = useRouter();
    const { activeBranchId } = useBranch();
    const [consumptionData, setConsumptionData] = useState<any[]>([]);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchStockData = async () => {
        setIsLoading(true);
        try {
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
            const lastDay = today.toISOString();

            // Handle All Branches (0) or specific branch
            const effectiveBranchId = activeBranchId === 0 ? undefined : activeBranchId;

            // 1. Fetch Consumption Variances
            // Note: Currently the backend might require a branch_id for variances. 
            // If activeBranchId is 0, we'll try to fetch for branch 1 as fallback or handle empty
            const varRes = await auditAPI.getConsumptionVariances({
                branch_id: effectiveBranchId || 1,
                from_date: firstDay,
                to_date: lastDay
            });
            if (varRes.success) setConsumptionData(varRes.data || []);

            // 2. Fetch Pending Requisitions
            const reqRes = await storeAPI.getBranchRequests('PENDING', effectiveBranchId || undefined);
            if (reqRes.success) setPendingRequests(reqRes.data || []);

        } catch (e) {
            console.error(e);
            toast.error("Failed to fetch stock audit data");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStockData();
    }, [activeBranchId]);

    const handleAction = async (id: string, action: 'APPROVE' | 'REJECT') => {
        try {
            const res = await storeAPI.reviewStockRequest(id, { action });
            if (res.success) {
                toast.success(`Request ${action === 'APPROVE' ? 'approved' : 'rejected'}`);
                fetchStockData(); // Refresh list
            } else {
                toast.error(res.message || "Action failed");
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to process request");
        }
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <BranchAwareDashboardLayout
                title="Inventory Quality Control"
                subtitle={activeBranchId === 0 ? "Consolidated view of all branches" : "Branch-specific stock audit"}
            >
                <div className="space-y-6">
                    {/* Header Actions */}
                    <div className="flex justify-end gap-2">
                        <button onClick={() => router.back()} className="btn-secondary">
                            <ArrowLeft className="h-4 w-4" />
                            <span>Dashboard</span>
                        </button>
                        <button onClick={fetchStockData} disabled={isLoading} className="btn-secondary">
                            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                            <span>Sync Stock Data</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Pending Requisitions */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="card-elevated">
                                <div className="px-5 py-4 border-b border-stone-100 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-[15px] font-semibold text-stone-900">Critical Requisitions</h3>
                                        <p className="text-[11px] text-stone-500 mt-0.5">Pending stock replenishment reviews</p>
                                    </div>
                                    <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        {pendingRequests.length} Pending
                                    </span>
                                </div>
                                <div className="divide-y divide-stone-50">
                                    {pendingRequests.length === 0 ? (
                                        <div className="py-12 text-center text-stone-400 text-sm italic">
                                            <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                            <p>No pending requisitions for this selection.</p>
                                        </div>
                                    ) : (
                                        pendingRequests.map((req) => (
                                            <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-stone-50/50 transition-colors">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center text-stone-500 group-hover:bg-stone-200 transition-colors">
                                                        <Box className="h-5 w-5" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="text-[14px] font-semibold text-stone-900 truncate">
                                                                {req.items?.[0]?.item_name || 'Multi-item Request'}
                                                                {req.items?.length > 1 ? <span className="text-stone-400 font-normal ml-1">(+{req.items.length - 1} more)</span> : ''}
                                                            </p>
                                                            <span className="text-[9px] px-1.5 py-0.5 bg-stone-200 text-stone-700 rounded-md font-bold uppercase tracking-tighter">
                                                                {req.requesting_branch?.name || 'Local'}
                                                            </span>
                                                        </div>
                                                        <p className="text-[12px] text-stone-500 mt-0.5 italic line-clamp-1 truncate">
                                                            "{req.reason || 'Routine replenishment'}"
                                                        </p>
                                                        <div className="flex items-center gap-3 mt-1.5">
                                                            <span className="flex items-center gap-1 text-[10px] text-stone-400 tracking-tight">
                                                                <Clock className="h-3 w-3" />
                                                                {new Date(req.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                            <span className="text-[10px] text-stone-400">•</span>
                                                            <span className="text-[10px] text-stone-400 font-medium">By {req.requester_name || 'Staff'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 self-end sm:self-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleAction(req.id, 'REJECT')}
                                                        className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors text-[11px] font-bold flex items-center gap-1"
                                                    >
                                                        <X className="h-3.5 w-3.5" /> Reject
                                                    </button>
                                                    <button
                                                        onClick={() => handleAction(req.id, 'APPROVE')}
                                                        className="py-1.5 px-3 bg-stone-900 hover:bg-black text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-sm transition-all"
                                                    >
                                                        <Check className="h-3.5 w-3.5" /> Approve
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Consumption Analysis Table */}
                            <div className="card-elevated">
                                <div className="px-5 py-4 border-b border-stone-100 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-[15px] font-semibold text-stone-900">Consumption variances</h3>
                                        <p className="text-[11px] text-stone-500 mt-0.5">Monthly variance analysis and audit status</p>
                                    </div>
                                    {activeBranchId === 0 && (
                                        <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded tracking-tighter">Branch 1 Sample Data</span>
                                    )}
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-stone-100">
                                                <th className="text-left py-3 px-5 text-[11px] font-medium text-stone-500 uppercase tracking-wider">Item Catalog</th>
                                                <th className="text-right py-3 px-5 text-[11px] font-medium text-stone-500 uppercase tracking-wider">Expected</th>
                                                <th className="text-right py-3 px-5 text-[11px] font-medium text-stone-500 uppercase tracking-wider">Actual Used</th>
                                                <th className="text-right py-3 px-5 text-[11px] font-medium text-stone-500 uppercase tracking-wider">Variance</th>
                                                <th className="text-center py-3 px-5 text-[11px] font-medium text-stone-500 uppercase tracking-wider">Audit Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-50">
                                            {consumptionData.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="py-12 text-center text-stone-400 text-sm italic">
                                                        No variance data available for auditing. Please configure consumption maps.
                                                    </td>
                                                </tr>
                                            ) : (
                                                consumptionData.map((item, i) => (
                                                    <tr key={i} className="hover:bg-stone-50 transition-colors group">
                                                        <td className="py-3 px-5">
                                                            <div className="flex flex-col">
                                                                <span className="text-[13px] font-medium text-stone-900">{item.item_name || 'Inventory SKU'}</span>
                                                                <span className="text-[11px] text-stone-400 font-mono tracking-tighter">{item.item_sku}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-5 text-right text-stone-600 font-mono text-[13px]">{item.theoretical}</td>
                                                        <td className="py-3 px-5 text-right text-stone-600 font-mono text-[13px]">{item.actual}</td>
                                                        <td className={`py-3 px-5 text-right font-bold text-[13px] font-mono ${item.variance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                            {item.variance > 0 ? '+' : ''}{item.variance}
                                                        </td>
                                                        <td className="py-3 px-5 text-center">
                                                            {Math.abs(item.variance) > ((item.theoretical || 1) * 0.1) ? (
                                                                <span className="inline-flex items-center gap-1.5 text-[9px] bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full font-bold border border-rose-100 uppercase tracking-tighter">
                                                                    <AlertTriangle className="h-3 w-3" /> INVESTIGATE
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 text-[9px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-bold border border-emerald-100 uppercase tracking-tighter">
                                                                    <Check className="h-3 w-3" /> VERIFIED
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Inventory Value Stats */}
                        <div className="space-y-3">
                            <div className="stat-card">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="stat-icon bg-stone-100">
                                        <Package className="h-5 w-5 text-stone-600" />
                                    </div>
                                </div>
                                <p className="stat-label">Inventory Value</p>
                                <p className="stat-value text-stone-900 text-[22px]">KES 1.2M</p>
                            </div>

                            <div className={`stat-card ${consumptionData.filter(i => Math.abs(i.variance) > (i.theoretical * 0.1)).length > 0 ? 'bg-rose-50/50' : ''}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="stat-icon bg-rose-100">
                                        <AlertTriangle className="h-5 w-5 text-rose-600" />
                                    </div>
                                    <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">High Variance</span>
                                </div>
                                <p className="stat-label text-rose-800">Flagged Items</p>
                                <p className="stat-value text-rose-700 text-[22px]">
                                    {consumptionData.filter(i => Math.abs(i.variance) > (i.theoretical * 0.1)).length}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </BranchAwareDashboardLayout>
        </ProtectedRoute>
    );
}
