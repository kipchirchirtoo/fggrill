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
                            <div className="card-elevated p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="section-title">Critical Requisitions</h3>
                                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded-full">
                                        {pendingRequests.length} Waiting Review
                                    </span>
                                </div>
                                <div className="divide-y divide-stone-100">
                                    {pendingRequests.length === 0 ? (
                                        <div className="py-12 text-center text-stone-400">
                                            <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                            <p className="text-sm italic">No pending requisitions for this selection.</p>
                                        </div>
                                    ) : (
                                        pendingRequests.map((req) => (
                                            <div key={req.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                                                <div className="flex items-start gap-4">
                                                    <div className="p-3 bg-stone-100 rounded-xl text-stone-500 group-hover:bg-stone-200 transition-colors">
                                                        <Box className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-semibold text-stone-900">{req.items?.[0]?.item_name || 'Multi-item Request'} {req.items?.length > 1 ? `(+${req.items.length - 1})` : ''}</p>
                                                            <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-bold uppercase">
                                                                {req.requesting_branch?.name || 'Unknown Branch'}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-stone-500 mt-0.5 italic">"{(req.reason || 'Routine replenishment').slice(0, 60)}{req.reason?.length > 60 ? '...' : ''}"</p>
                                                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-stone-400">
                                                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(req.created_at).toLocaleDateString()}</span>
                                                            <span>By: {req.requester_name || 'Branch Storekeeper'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                                    <button
                                                        onClick={() => handleAction(req.id, 'REJECT')}
                                                        className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg transition-colors text-xs font-bold flex items-center gap-1"
                                                    >
                                                        <X className="h-3.5 w-3.5" /> Reject
                                                    </button>
                                                    <button
                                                        onClick={() => handleAction(req.id, 'APPROVE')}
                                                        className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                                                    >
                                                        <Check className="h-3.5 w-3.5" /> Review & Approve
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Consumption Analysis Table */}
                            <div className="card-elevated overflow-hidden border-t-2 border-t-stone-200">
                                <div className="p-4 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center">
                                    <h3 className="section-title text-sm">Consumption Variances (Monthly Analysis)</h3>
                                    {activeBranchId === 0 && (
                                        <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded">Partial View: Branch 1 Only</span>
                                    )}
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-stone-50 text-stone-500 text-xs uppercase font-bold tracking-wider">
                                            <tr>
                                                <th className="px-4 py-4">Item Catalog</th>
                                                <th className="px-4 py-4 text-right">Expected</th>
                                                <th className="px-4 py-4 text-right">Actual Used</th>
                                                <th className="px-4 py-4 text-right">Variance</th>
                                                <th className="px-4 py-4 text-center">Audit Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-100">
                                            {consumptionData.length === 0 ? (
                                                <tr><td colSpan={5} className="p-8 text-center text-stone-400 italic">No variance data available for auditing. Please configure consumption maps.</td></tr>
                                            ) : (
                                                consumptionData.map((item, i) => (
                                                    <tr key={i} className="hover:bg-stone-50/80 transition-colors border-l-2 border-l-transparent hover:border-l-blue-500">
                                                        <td className="px-4 py-4">
                                                            <div className="font-medium text-stone-900">{item.item_name || 'Inventory SKU'}</div>
                                                            <div className="text-[10px] text-stone-400 font-mono">{item.item_sku}</div>
                                                        </td>
                                                        <td className="px-4 py-4 text-right text-stone-600 font-medium">{item.theoretical}</td>
                                                        <td className="px-4 py-4 text-right text-stone-600 font-medium">{item.actual}</td>
                                                        <td className={`px-4 py-4 text-right font-bold ${item.variance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                            {item.variance > 0 ? '+' : ''}{item.variance}
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            {Math.abs(item.variance) > ((item.theoretical || 1) * 0.1) ? ( // 10% tolerance
                                                                <span className="inline-flex items-center gap-1.5 text-[10px] bg-rose-50 text-rose-700 px-3 py-1 rounded-full font-bold border border-rose-100">
                                                                    <AlertTriangle className="h-3 w-3" /> INVESTIGATE
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 text-[10px] bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full font-bold border border-emerald-100">
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
                        <div className="space-y-4">
                            <div className="stat-card border-l-4 border-l-stone-900">
                                <div>
                                    <p className="stat-label">Total Inventory Value</p>
                                    <p className="stat-value">KES 1.2M</p>
                                </div>
                                <Package className="h-5 w-5 text-stone-400" />
                            </div>
                            <div className="stat-card border-l-4 border-l-red-500 bg-red-50/50">
                                <div>
                                    <p className="stat-label text-red-800">High Variance Items</p>
                                    <p className="stat-value text-red-700">{consumptionData.filter(i => Math.abs(i.variance) > (i.theoretical * 0.1)).length}</p>
                                </div>
                                <AlertTriangle className="h-5 w-5 text-red-500" />
                            </div>
                        </div>
                    </div>
                </div>
            </BranchAwareDashboardLayout>
        </ProtectedRoute>
    );
}
