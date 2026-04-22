'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Clock, CheckCircle, XCircle, FileText, AlertTriangle, Eye, ArrowRight, User, TrendingUp, Package, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { storeAPI } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

interface RequestItem { id: string; item_name: string; item_sku: string; requested_quantity: number; approved_quantity?: number; unit: string; }
interface StockRequest {
    id: string;
    request_number: string;
    requesting_branch_id: number;
    branch_name: string;
    status: string;
    priority: string;
    created_at: string;
    reason: string;
    items: RequestItem[];
}

interface PerformanceData {
    totalSales: number;
    orderCount: number;
    averageOrder: number;
    startDate: string;
}

export default function AuditorApprovalPanel() {
    const [requests, setRequests] = useState<StockRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
    const [performance, setPerformance] = useState<Record<number, PerformanceData>>({});
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [approvedQuantities, setApprovedQuantities] = useState<Record<string, number>>({});
    const [reviewNotes, setReviewNotes] = useState('');

    const fetchRequests = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await storeAPI.getBranchRequests('PENDING_AUDIT');
            if (response.success) {
                const pendingRequests = response.data || [];
                setRequests(pendingRequests);

                // Fetch performance for unique branches
                const branchIds = [...new Set(pendingRequests.map((r: any) => r.requesting_branch_id))];
                for (const bId of branchIds as number[]) {
                    if (!bId) continue;
                    const perfRes = await storeAPI.getBranchPerformance(bId, 1);
                    if (perfRes.success) {
                        setPerformance(prev => ({ ...prev, [bId]: perfRes.data }));
                    }
                }
            }
        } catch (error) { console.error('Error fetching requests:', error); }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    const handleOpenReview = (request: StockRequest) => {
        setSelectedRequest(request);
        // Initialize approved quantities with requested quantities
        const initialQuantities: Record<string, number> = {};
        request.items?.forEach(item => {
            initialQuantities[item.id] = item.requested_quantity;
        });
        setApprovedQuantities(initialQuantities);
        setReviewNotes('');
        setReviewModalOpen(true);
    };

    const handleQuantityChange = (itemId: string, value: string) => {
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && numValue >= 0) {
            setApprovedQuantities(prev => ({ ...prev, [itemId]: numValue }));
        } else if (value === '') {
            setApprovedQuantities(prev => ({ ...prev, [itemId]: 0 }));
        }
    };

    const handleDecision = async (action: 'APPROVE' | 'REJECT') => {
        if (!selectedRequest) return;
        setIsActionLoading(true);
        try {
            const item_approvals = Object.entries(approvedQuantities).map(([id, approved_quantity]) => ({
                id,
                approved_quantity
            }));

            const response = action === 'APPROVE'
                ? await storeAPI.approveStockRequest(selectedRequest.id, {
                    item_approvals,
                    approved_quantity_notes: reviewNotes
                })
                : await storeAPI.rejectStockRequest(selectedRequest.id, {
                    review_notes: reviewNotes
                });

            if (response.success) {
                toast.success(`Request ${action.toLowerCase()}d successfully`);
                setReviewModalOpen(false);
                fetchRequests();
            } else {
                toast.error(response.message || 'Operation failed');
            }
        } catch (error: any) {
            toast.error(error.message || 'Error occurred');
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleApproveAll = async () => {
        if (requests.length === 0) {
            toast.error('No requests to approve');
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to approve ALL ${requests.length} pending stock requests?\n\nThis will approve all items at their full requested quantities.`
        );

        if (!confirmed) return;

        setIsLoading(true);
        try {
            const requestIds = requests.map(r => r.id);
            const response = await storeAPI.bulkApproveStockRequests(
                requestIds,
                'Bulk approved by auditor - all requests approved at full requested quantities'
            );

            if (response.success) {
                const { successful, failed, total } = response.data;
                if (failed > 0) {
                    toast.warning(`Approved ${successful}/${total} requests. ${failed} failed.`);
                } else {
                    toast.success(`Successfully approved all ${successful} requests!`);
                }
                fetchRequests();
            } else {
                toast.error(response.message || 'Bulk approval failed');
            }
        } catch (error: any) {
            console.error('Error in bulk approval:', error);
            toast.error(error.message || 'Error occurred during bulk approval');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="page-header flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-stone-900 flex items-center justify-center text-white shadow-lg">
                        <Shield className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="page-title text-stone-900">Stock Request Approvals</h1>
                        <p className="page-subtitle">Auditor review based on branch sales performance</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    {requests.length > 0 && (
                        <button 
                            onClick={handleApproveAll} 
                            disabled={isLoading}
                            className="btn-primary shadow-lg"
                        >
                            <ShieldCheck className={`h-4 w-4 ${isLoading ? 'animate-pulse' : ''}`} />
                            <span className="ml-2">Approve All ({requests.length})</span>
                        </button>
                    )}
                    <button onClick={fetchRequests} className="btn-secondary">
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        <span className="ml-2">Sync Requests</span>
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20 px-6">
                    <div className="flex flex-col items-center gap-2 opacity-50">
                        <RefreshCw className="h-6 w-6 animate-spin text-stone-300" />
                        <span className="text-[11px] font-black uppercase tracking-widest text-stone-400">Loading requests...</span>
                    </div>
                </div>
            ) : requests.length === 0 ? (
                <div className="table-container py-20 flex flex-col items-center text-center">
                    <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                        <CheckCircle className="h-8 w-8 text-emerald-500" />
                    </div>
                    <h3 className="text-lg font-bold text-stone-900">Queue is Clear</h3>
                    <p className="text-sm text-stone-500">No pending stock requests require your attention.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {requests.map((request) => {
                        const perf = performance[request.requesting_branch_id];
                        return (
                            <div key={request.id} className="card-elevated p-0 overflow-hidden border border-stone-100 group">
                                <div className="flex flex-col md:flex-row">
                                    <div className="p-6 flex-1">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="font-mono font-bold text-stone-900 tracking-tight">{request.request_number}</span>
                                            <span className={request.priority === 'URGENT' ? 'badge-danger' : 'badge-warning'}>{request.priority || 'NORMAL'}</span>
                                            <span className="badge-info">PENDING AUDIT</span>
                                            <span className="text-[11px] text-stone-400 font-bold uppercase tracking-widest ml-auto">{new Date(request.created_at).toLocaleDateString()}</span>
                                        </div>

                                        <div className="flex items-center gap-2 text-stone-900 font-bold mb-4">
                                            <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-500">
                                                <Package className="h-4 w-4" />
                                            </div>
                                            From: {request.branch_name}
                                        </div>

                                        <div className="bg-stone-50 p-4 rounded-xl border border-stone-100 mb-6">
                                            <p className="text-[13px] text-stone-600 font-medium italic">"{request.reason || 'No specific operational reason provided.'}"</p>
                                        </div>

                                        <div className="flex flex-wrap gap-4">
                                            <div className="bg-stone-50 rounded-xl px-4 py-2 border border-stone-100 min-w-[80px]">
                                                <p className="caption uppercase tracking-widest text-[10px]">SKUs</p>
                                                <p className="font-bold text-stone-900">{request.items?.length || 0}</p>
                                            </div>
                                            {perf && (
                                                <div className="bg-emerald-50/50 rounded-xl px-4 py-2 border border-emerald-100 min-w-[120px]">
                                                    <p className="caption uppercase tracking-widest text-[10px] text-emerald-600">Daily Sales</p>
                                                    <p className="font-bold text-emerald-700">KES {formatNumber(perf.totalSales)}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-stone-50/50 p-6 md:w-64 flex flex-col justify-center gap-3 border-t md:border-t-0 md:border-l border-stone-100">
                                        <button className="btn-primary w-full shadow-lg shadow-stone-900/10" onClick={() => handleOpenReview(request)}>
                                            Review & Sign-off
                                            <ArrowRight className="h-4 w-4 ml-2" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
                <DialogContent className="max-w-3xl bg-white rounded-3xl border-none shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="bg-stone-50 p-8 border-b border-stone-200/60 relative shrink-0">
                        <DialogHeader>
                            <div className="flex items-center gap-4 mb-2">
                                <div className="w-12 h-12 rounded-xl bg-stone-900 flex items-center justify-center text-white shrink-0 shadow-sm">
                                    <Shield className="h-6 w-6" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Security Review</span>
                                    <DialogTitle className="text-2xl font-black tracking-tight text-stone-900">{selectedRequest?.request_number || 'Review Request'}</DialogTitle>
                                </div>
                            </div>
                            <DialogDescription className="text-stone-500 font-semibold mt-1">
                                Evaluating inventory movement for <span className="text-stone-900">{selectedRequest?.branch_name}</span>
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    <div className="p-8 space-y-8 overflow-y-auto min-h-0 flex-1">
                        {selectedRequest && (
                            <>
                                {/* Branch Performance Summary */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="stat-card bg-stone-50 border-stone-100">
                                        <div className="stat-icon bg-white text-emerald-500 shadow-sm border border-stone-100">
                                            <TrendingUp className="h-4 w-4" />
                                        </div>
                                        <p className="stat-value text-lg">KES {formatNumber(performance[selectedRequest.requesting_branch_id]?.totalSales || 0)}</p>
                                        <p className="stat-label">Daily Sales</p>
                                    </div>
                                    <div className="stat-card bg-stone-50 border-stone-100">
                                        <div className="stat-icon bg-white text-blue-500 shadow-sm border border-stone-100">
                                            <Package className="h-4 w-4" />
                                        </div>
                                        <p className="stat-value text-lg">{performance[selectedRequest.requesting_branch_id]?.orderCount || 0}</p>
                                        <p className="stat-label">Daily Orders</p>
                                    </div>
                                    <div className="stat-card bg-stone-50 border-stone-100">
                                        <div className="stat-icon bg-white text-stone-400 shadow-sm border border-stone-100">
                                            <RefreshCw className="h-4 w-4" />
                                        </div>
                                        <p className="stat-value text-lg">KES {formatNumber(performance[selectedRequest.requesting_branch_id]?.averageOrder || 0)}</p>
                                        <p className="stat-label">Order Average</p>
                                    </div>
                                </div>

                                {/* Items Table */}
                                <div className="table-container shadow-sm border border-stone-100 overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="table-header">
                                                <th className="table-header-cell">Stock Item</th>
                                                <th className="table-header-cell">SKU</th>
                                                <th className="table-header-cell text-center">Requested</th>
                                                <th className="table-header-cell text-right">Approval</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-50">
                                            {selectedRequest.items.map((item) => (
                                                <tr key={item.id} className="table-row">
                                                    <td className="table-cell font-bold text-stone-900">{item.item_name}</td>
                                                    <td className="table-cell">
                                                        <span className="text-[10px] font-mono text-stone-400 font-bold uppercase tracking-wider">{item.item_sku}</span>
                                                    </td>
                                                    <td className="table-cell text-center">
                                                        <span className="badge-warning">
                                                            {item.requested_quantity} {item.unit}
                                                        </span>
                                                    </td>
                                                    <td className="table-cell text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <input
                                                                type="number"
                                                                value={approvedQuantities[item.id] ?? item.requested_quantity}
                                                                onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                                                className="w-24 px-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg text-right font-black text-stone-900 focus:ring-2 focus:ring-stone-900 focus:bg-white outline-none transition-all"
                                                                min="0"
                                                                step="0.01"
                                                            />
                                                            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest w-8">{item.unit}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="space-y-2">
                                    <p className="caption uppercase tracking-[0.2em]">Audit Decision Notes</p>
                                    <textarea
                                        value={reviewNotes}
                                        onChange={(e) => setReviewNotes(e.target.value)}
                                        placeholder="Add operational remarks justification for adjustments..."
                                        className="w-full px-4 py-3 text-sm bg-stone-50 border border-stone-100 rounded-2xl text-stone-900 focus:ring-2 focus:ring-stone-900 focus:bg-white outline-none min-h-[80px] transition-all resize-none shadow-inner"
                                    />
                                </div>

                                <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100/50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                            <AlertTriangle className="h-5 w-5" />
                                        </div>
                                        <p className="text-[11px] text-stone-600 font-bold leading-tight">
                                            Base decisions on branch sales velocity. <br /><span className="text-amber-700">Audit adjust quantities as necessary.</span>
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const fullApprovals: Record<string, number> = {};
                                            selectedRequest.items.forEach(item => {
                                                fullApprovals[item.id] = item.requested_quantity;
                                            });
                                            setApprovedQuantities(fullApprovals);
                                            toast.success('Reset to requested levels');
                                        }}
                                        className="h-10 px-4 bg-white border border-stone-200 text-stone-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-stone-50 transition-colors shadow-sm flex items-center gap-2"
                                    >
                                        <RefreshCw className="h-3 w-3" />
                                        Full Reset
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="p-8 bg-white border-t border-stone-100 shrink-0">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => handleDecision('REJECT')}
                                disabled={isActionLoading}
                                className="flex-1 h-12 bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-100 transition-colors flex items-center justify-center gap-2 border border-rose-100/50"
                            >
                                <XCircle className="h-4 w-4" />
                                Terminate Request
                            </button>
                            <div className="flex gap-3 flex-[2]">
                                <button
                                    onClick={() => {
                                        const fullApprovals: Record<string, number> = {};
                                        selectedRequest?.items.forEach(item => {
                                            fullApprovals[item.id] = item.requested_quantity;
                                        });
                                        setApprovedQuantities(fullApprovals);
                                        handleDecision('APPROVE');
                                    }}
                                    disabled={isActionLoading}
                                    className="flex-1 h-12 bg-white border-2 border-stone-900 text-stone-900 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-stone-50 transition-colors shadow-sm"
                                >
                                    Approve Maximum
                                </button>
                                <button
                                    onClick={() => handleDecision('APPROVE')}
                                    disabled={isActionLoading}
                                    className="flex-[1.5] h-12 bg-stone-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/20 flex items-center justify-center gap-2"
                                >
                                    {isActionLoading ? <RefreshCw className="h-4 w-4 animate-spin text-white" /> : <ShieldCheck className="h-4 w-4" />}
                                    Finalize Audit
                                </button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
