'use client';

import React, { useState, useEffect } from 'react';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { Package, AlertTriangle, ArrowRight, Check, X, Filter, ArrowLeft, RefreshCw, Box, Clock, FileText, Eye, FileDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { auditAPI, storeAPI, auditorReportsAPI, reportsService } from '@/lib/api';
import { toast } from 'sonner';

const RequisitionDetailsModal = ({ request, isOpen, onClose, onAction }: { request: any, isOpen: boolean, onClose: () => void, onAction: (id: string, action: 'APPROVE' | 'REJECT') => void }) => {
    const [centralStock, setCentralStock] = useState<any[]>([]);
    const [isLoadingStock, setIsLoadingStock] = useState(false);

    useEffect(() => {
        if (isOpen && request) {
            fetchCentralStock();
        }
    }, [isOpen, request]);

    const fetchCentralStock = async () => {
        setIsLoadingStock(true);
        try {
            // Assuming branch_id 1 is Central Store
            const res = await storeAPI.getBranchStock(1);
            if (res.success) setCentralStock(res.data || []);
        } catch (e) {
            console.error('Failed to fetch central stock:', e);
        } finally {
            setIsLoadingStock(false);
        }
    };

    if (!isOpen || !request) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-stone-100 animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                    <div>
                        <h3 className="text-[16px] font-bold text-stone-900">Requisition Approval</h3>
                        <p className="text-[11px] text-stone-500">{request.requesting_branch?.name || 'Local'} • {new Date(request.created_at).toLocaleDateString()}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
                        <X className="h-4 w-4 text-stone-500" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Reason for Request</p>
                            <p className="text-[13px] text-stone-900 bg-stone-50 p-3 rounded-lg border border-stone-100 italic">"{request.reason || 'Routine replenishment'}"</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Request Status</p>
                            <div className="flex items-center gap-2 mt-2">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${request.priority === 'URGENT' ? 'bg-rose-100 text-rose-700' : 'bg-stone-100 text-stone-700'}`}>
                                    {request.priority} Priority
                                </span>
                                <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-[10px] font-bold uppercase tracking-wider">
                                    PENDING APPROVAL
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Requested Items & Availability</p>
                            {isLoadingStock && <RefreshCw className="h-3 w-3 animate-spin text-stone-400" />}
                        </div>
                        <div className="bg-stone-50 rounded-xl border border-stone-100 divide-y divide-stone-100 overflow-hidden">
                            {(request.items || []).map((item: any, idx: number) => {
                                const cStock = centralStock.find(cs => cs.item_sku === item.item_sku);
                                const isShortage = cStock ? cStock.quantity < item.quantity : true;

                                return (
                                    <div key={idx} className="px-4 py-3 flex justify-between items-center bg-white group hover:bg-stone-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-stone-100 border border-stone-100 flex items-center justify-center group-hover:bg-white transition-colors">
                                                <Package className="h-4 w-4 text-stone-400" />
                                            </div>
                                            <div>
                                                <p className="text-[13px] font-bold text-stone-800">{item.item_name}</p>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-[10px] text-stone-400">Branch Stock: <span className="font-bold text-stone-600 font-mono">{item.current_stock || 0}</span></p>
                                                    <span className="text-stone-300">•</span>
                                                    <p className="text-[10px] text-stone-400">Par: <span className="font-bold text-stone-600 font-mono">{item.item?.max_stock_level || '--'}</span></p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter">Central Store</p>
                                                <p className={`text-[13px] font-mono font-bold ${isShortage ? 'text-rose-500' : 'text-emerald-600'}`}>
                                                    {cStock ? `${cStock.quantity} ${item.unit || 'pcs'}` : '0 available'}
                                                </p>
                                            </div>
                                            <div className="text-right bg-stone-900 text-white px-3 py-1.5 rounded-lg">
                                                <p className="text-[9px] text-stone-400 uppercase font-black leading-none mb-0.5">REQUESTED</p>
                                                <p className="text-[14px] font-black font-mono">{item.quantity} {item.unit || 'pcs'}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 bg-stone-50/50 flex justify-end gap-3 shadow-[inset_0_1px_0_0_rgba(0,0,0,0.05)]">
                    <button onClick={() => onAction(request.id, 'REJECT')} className="btn-secondary text-rose-600 border-rose-100 hover:bg-rose-50 px-6 py-2.5 text-[12px] font-bold rounded-xl">Reject Requisition</button>
                    <button onClick={() => onAction(request.id, 'APPROVE')} className="btn-primary bg-stone-900 hover:bg-black px-8 py-2.5 text-[12px] font-bold shadow-lg shadow-stone-200 rounded-xl">Approve Stock Release</button>
                </div>
            </div>
        </div>
    );
};

const ConsumptionAuditModal = ({ item, isOpen, onClose }: { item: any, isOpen: boolean, onClose: () => void }) => {
    if (!isOpen || !item) return null;

    const diff = item.actual - item.theoretical;
    const isLeakage = diff > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-stone-100 animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                    <div>
                        <h3 className="text-[16px] font-bold text-stone-900">Consumption Audit</h3>
                        <p className="text-[11px] text-stone-500">{item.item_name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
                        <X className="h-4 w-4 text-stone-500" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Theoretical Use</p>
                            <p className="text-[20px] font-bold text-stone-900">{item.theoretical} <span className="text-[12px] font-medium text-stone-400 font-mono">{item.unit || 'units'}</span></p>
                            <p className="text-[10px] text-stone-400 mt-1 italic">Based on recorded sales</p>
                        </div>
                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Actual Consumption</p>
                            <p className="text-[20px] font-bold text-stone-900">{item.actual} <span className="text-[12px] font-medium text-stone-400 font-mono">{item.unit || 'units'}</span></p>
                            <p className="text-[10px] text-stone-400 mt-1 italic">Based on stock count</p>
                        </div>
                    </div>

                    <div className={`p-5 rounded-2xl border ${isLeakage ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className={`text-[13px] font-bold ${isLeakage ? 'text-rose-700' : 'text-emerald-700'} uppercase tracking-wider`}>Variance Analysis</h4>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isLeakage ? 'bg-rose-200 text-rose-800' : 'bg-emerald-200 text-emerald-800'}`}>
                                {isLeakage ? 'Leakage Detected' : 'Optimal'}
                            </span>
                        </div>
                        <div className="flex items-end justify-between">
                            <div>
                                <p className={`text-[24px] font-black ${isLeakage ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {isLeakage ? '+' : ''}{diff}
                                </p>
                                <p className="text-[11px] text-stone-500 font-medium">Net variance in {item.unit || 'units'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[18px] font-bold text-stone-900">KES {(Math.abs(diff) * (item.unit_cost || 500)).toLocaleString()}</p>
                                <p className="text-[11px] text-stone-500 font-medium uppercase tracking-tight">Est. Value Impact</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Audit Recommendations</p>
                        <ul className="space-y-2">
                            <li className="flex items-start gap-2 text-[12px] text-stone-600">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                                <span>{isLeakage ? "Verify portion control and check for unrecorded wastage." : "Consumption matches sales patterns. No action required."}</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="px-6 py-4 bg-stone-50/50 flex justify-end">
                    <button onClick={onClose} className="btn-secondary px-8 py-2 text-[12px] font-bold">Done</button>
                </div>
            </div>
        </div>
    );
};

export default function StockAuditPage() {
    const router = useRouter();
    const { activeBranchId } = useBranch();
    const [consumptionData, setConsumptionData] = useState<any[]>([]);
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [selectedAuditItem, setSelectedAuditItem] = useState<any>(null);
    const [isReqModalOpen, setIsReqModalOpen] = useState(false);
    const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            const lastDay = today.toISOString().split('T')[0];

            await auditorReportsAPI.exportBrandedPdf('stock_usage', {
                branch_id: activeBranchId === null || activeBranchId === 0 ? 1 : activeBranchId,
                start_date: firstDay,
                end_date: lastDay,
                branch_name: activeBranchId === 0 ? 'All Branches' : `Branch #${activeBranchId}`
            });
            toast.success("Report generated successfully");
        } catch (e) {
            console.error(e);
            toast.error("Failed to export report");
        } finally {
            setIsExporting(false);
        }
    };

    const fetchStockData = async () => {
        setIsLoading(true);
        try {
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
            const lastDay = today.toISOString();

            // Handle All Branches (0) or specific branch
            const effectiveBranchId = activeBranchId === null || activeBranchId === 0 ? undefined : activeBranchId;

            // 1. Fetch Stock Usage vs Requested
            // Note: Currently the backend might require a branch_id. 
            // If activeBranchId is 0, we'll try to fetch for branch 1 as fallback or handle empty
            const varRes = await auditorReportsAPI.getStockUsage({
                branch_id: effectiveBranchId || 1,
                start_date: firstDay,
                end_date: lastDay
            });

            if (varRes.success) {
                // Map the new report format to the UI's expected format
                // Report returns: { sku, requested, used, variance }
                // UI expects: { item_name (use sku), theoretical (requested), actual (used), variance, unit (default 'units') }
                const mappedData = (varRes.data || []).map((item: any) => ({
                    item_name: item.sku, // The report groups by SKU
                    item_sku: item.sku,
                    theoretical: item.requested, // "Expected" based on requests
                    actual: item.used, // "Actual" based on usage/transactions
                    variance: item.variance,
                    unit: 'units' // Default unit
                }));
                setConsumptionData(mappedData);
            }

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
            const res = await storeAPI.reviewStockRequest(id, {
                action,
                approved_items: [] // Empty means approve as requested or reject all
            });
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
                        <button
                            onClick={handleExport}
                            disabled={isExporting || isLoading}
                            className="btn-primary"
                        >
                            <FileDown className={`h-4 w-4 mr-2 ${isExporting ? 'animate-bounce' : ''}`} />
                            {isExporting ? 'Generating...' : 'Export Branded PDF'}
                        </button>
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
                                                        onClick={() => {
                                                            setSelectedRequest(req);
                                                            setIsReqModalOpen(true);
                                                        }}
                                                        className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors text-[11px] font-bold flex items-center gap-1"
                                                        title="View Details"
                                                    >
                                                        <Eye className="h-3.5 w-3.5" /> Items
                                                    </button>
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
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[13px] font-medium text-stone-900">{item.item_name || 'Inventory SKU'}</span>
                                                                    <span className="text-[11px] text-stone-400 font-mono tracking-tighter">{item.item_sku}</span>
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedAuditItem(item);
                                                                        setIsAuditModalOpen(true);
                                                                    }}
                                                                    className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-900 transition-colors opacity-0 group-hover:opacity-100"
                                                                    title="Audit Details"
                                                                >
                                                                    <Eye className="h-3.5 w-3.5" />
                                                                </button>
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

                <RequisitionDetailsModal
                    isOpen={isReqModalOpen}
                    request={selectedRequest}
                    onClose={() => setIsReqModalOpen(false)}
                    onAction={(id, action) => {
                        handleAction(id, action);
                        setIsReqModalOpen(false);
                    }}
                />

                <ConsumptionAuditModal
                    isOpen={isAuditModalOpen}
                    item={selectedAuditItem}
                    onClose={() => setIsAuditModalOpen(false)}
                />
            </BranchAwareDashboardLayout>
        </ProtectedRoute>
    );
}
