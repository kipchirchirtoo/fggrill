'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { Package, AlertTriangle, ArrowRight, Check, X, Filter, ArrowLeft, RefreshCw, Box } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { auditAPI, storeAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function StockAuditPage() {
    const router = useRouter();
    const [consumptionData, setConsumptionData] = useState<any[]>([]);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchStockData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Consumption Variances
            // Hardcoded branch/dates for now - should be dynamic in full implementation
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
            const lastDay = today.toISOString();
            // Assuming branch_id 1 for main branch if not selectable yet
            // In a real scenario, we might get this from user context or a selector
            const branchId = 1;

            const varRes = await auditAPI.getConsumptionVariances({ branch_id: branchId, from_date: firstDay, to_date: lastDay });
            if (varRes.success) setConsumptionData(varRes.data || []);

            // 2. Fetch Pending Requisitions
            const reqRes = await storeAPI.getBranchRequests('PENDING'); // or 'requested' depending on backend enum
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
    }, []);

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
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <button onClick={() => router.back()} className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
                                <ArrowLeft className="h-5 w-5 text-stone-500" />
                            </button>
                            <div>
                                <h1 className="text-[22px] font-semibold text-stone-900">Stock & Inventory</h1>
                                <p className="text-stone-500 text-sm">Verify levels and approve movements</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={fetchStockData} disabled={isLoading} className="btn-secondary">
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span>Refresh</span>
                            </button>
                            <button className="btn-primary bg-stone-900">
                                <Package className="h-4 w-4" />
                                <span>Spot Check</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Pending Requisitions */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="card-elevated p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="section-title">Pending Requisitions</h3>
                                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded-full">
                                        {pendingRequests.length} Pending
                                    </span>
                                </div>
                                <div className="divide-y divide-stone-100">
                                    {pendingRequests.length === 0 ? (
                                        <p className="text-stone-500 text-sm py-4 italic text-center">No pending requisitions.</p>
                                    ) : (
                                        pendingRequests.map((req) => (
                                            <div key={req.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div className="flex items-start gap-3">
                                                    <div className="p-2 bg-stone-100 rounded-lg text-stone-500">
                                                        <Box className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-stone-900">{req.items?.[0]?.item_name || 'Stock Request'} {req.items?.length > 1 ? `+${req.items.length - 1} more` : ''}</p>
                                                        <p className="text-xs text-stone-500">Requested by {req.requester_name || 'Staff'} • {new Date(req.created_at).toLocaleDateString()}</p>
                                                        <p className="text-xs text-stone-500 mt-1">Note: {req.reason || 'Restock'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                                    <button
                                                        onClick={() => handleAction(req.id, 'REJECT')}
                                                        className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors text-xs font-medium flex items-center gap-1"
                                                    >
                                                        <X className="h-3.5 w-3.5" /> Reject
                                                    </button>
                                                    <button
                                                        onClick={() => handleAction(req.id, 'APPROVE')}
                                                        className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1 shadow-sm"
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
                            <div className="card-elevated overflow-hidden">
                                <div className="p-4 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center">
                                    <h3 className="section-title text-sm">Consumption Variances (This Month)</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-stone-50 text-stone-500 text-xs uppercase font-semibold">
                                            <tr>
                                                <th className="px-4 py-3">Item</th>
                                                <th className="px-4 py-3 text-right">Theoretical</th>
                                                <th className="px-4 py-3 text-right">Actual</th>
                                                <th className="px-4 py-3 text-right">Variance</th>
                                                <th className="px-4 py-3 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-100">
                                            {consumptionData.length === 0 ? (
                                                <tr><td colSpan={5} className="p-4 text-center text-stone-500 italic">No variance data available.</td></tr>
                                            ) : (
                                                consumptionData.map((item, i) => (
                                                    <tr key={i} className="hover:bg-stone-50 transition-colors">
                                                        <td className="px-4 py-3 font-medium text-stone-900">{item.item_name || item.item_sku}</td>
                                                        <td className="px-4 py-3 text-right text-stone-600">{item.theoretical}</td>
                                                        <td className="px-4 py-3 text-right text-stone-600">{item.actual}</td>
                                                        <td className={`px-4 py-3 text-right font-medium ${item.variance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                            {item.variance > 0 ? '+' : ''}{item.variance}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            {Math.abs(item.variance) > (item.theoretical * 0.1) ? ( // 10% tolerance
                                                                <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">
                                                                    <AlertTriangle className="h-3 w-3" /> INVESTIGATE
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">OK</span>
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
                                    <p className="stat-value text-red-700">{consumptionData.filter(i => Math.abs(i.variance) > 5).length}</p>
                                </div>
                                <AlertTriangle className="h-5 w-5 text-red-500" />
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
