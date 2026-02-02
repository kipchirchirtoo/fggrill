'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Clock, CheckCircle, XCircle, FileText, AlertTriangle, Eye, ArrowRight, User, TrendingUp, Package, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { storeAPI } from '@/lib/api';
import { IOSBadge } from '@/components/ui/ios-badge';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { formatNumber } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

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
            const response = await storeAPI.getBranchRequests('PENDING');
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                        <Shield className="h-6 w-6 text-stone-900" />
                        Stock Request Approvals
                    </h2>
                    <p className="text-sm text-stone-500">Auditor review based on branch sales performance</p>
                </div>
                <IOSButton variant="secondary" onClick={fetchRequests} leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}>
                    Sync Requests
                </IOSButton>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20"><RefreshCw className="h-10 w-10 animate-spin text-stone-200" /></div>
            ) : requests.length === 0 ? (
                <div className="bg-stone-50 rounded-2xl py-20 flex flex-col items-center text-center border border-stone-100">
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
                            <IOSCard key={request.id} className="p-0 overflow-hidden border-none shadow-sm group">
                                <div className="flex flex-col md:flex-row">
                                    <div className="p-5 flex-1">
                                        <div className="flex items-center gap-3 mb-3">
                                            <span className="font-bold text-stone-900">{request.request_number}</span>
                                            <IOSBadge color={request.priority === 'URGENT' ? 'danger' : 'warning'}>{request.priority || 'NORMAL'}</IOSBadge>
                                            <IOSBadge color="info">PENDING AUDIT</IOSBadge>
                                            <span className="text-xs text-stone-400 font-medium ml-auto">{new Date(request.created_at).toLocaleDateString()}</span>
                                        </div>

                                        <div className="flex items-center gap-2 text-stone-700 font-semibold mb-4">
                                            <Package className="h-4 w-4 text-stone-400" />
                                            From: {request.branch_name}
                                        </div>

                                        <p className="text-sm text-stone-500 line-clamp-2 italic mb-4">"{request.reason || 'No reason provided'}"</p>

                                        <div className="flex flex-wrap gap-4 mt-auto">
                                            <div className="bg-stone-50 rounded-ios-lg px-3 py-2 border border-stone-100">
                                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Items</p>
                                                <p className="font-bold text-stone-700">{request.items?.length || 0}</p>
                                            </div>
                                            {perf && (
                                                <div className="bg-emerald-50 rounded-ios-lg px-3 py-2 border border-emerald-100">
                                                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Yesterday Sales</p>
                                                    <p className="font-bold text-emerald-700">KES {formatNumber(perf.totalSales)}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-stone-50/50 p-5 md:w-64 flex flex-col justify-center gap-3 border-t md:border-t-0 md:border-l border-stone-100">
                                        <IOSButton className="w-full" onClick={() => handleOpenReview(request)} rightIcon={<ArrowRight className="h-4 w-4" />}>
                                            Review Request
                                        </IOSButton>
                                    </div>
                                </div>
                            </IOSCard>
                        );
                    })}
                </div>
            )}

            <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0 overflow-hidden">
                    <div className="p-4 border-b border-stone-100 flex-none bg-white">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-base font-bold">
                                <Shield className="h-5 w-5 text-stone-900" />
                                Review: {selectedRequest?.request_number}
                            </DialogTitle>
                        </DialogHeader>
                    </div>

                    <div className="p-4 overflow-y-auto flex-1 min-h-0 bg-white">
                        {selectedRequest && (
                            <div className="space-y-3">
                                {/* Branch Performance Summary */}
                                <div className="grid grid-cols-3 gap-2">
                                    <IOSCard className="p-2 bg-stone-900 border-none">
                                        <TrendingUp className="h-4 w-4 text-emerald-400 mb-1" />
                                        <p className="text-[10px] font-bold text-stone-400 uppercase">Sales</p>
                                        <p className="text-sm font-bold text-white">KES {formatNumber(performance[selectedRequest.requesting_branch_id]?.totalSales || 0)}</p>
                                    </IOSCard>
                                    <IOSCard className="p-2 border-none shadow-sm bg-stone-50">
                                        <Package className="h-4 w-4 text-blue-500 mb-1" />
                                        <p className="text-[10px] font-bold text-stone-400 uppercase">Orders</p>
                                        <p className="text-sm font-bold text-stone-800">{performance[selectedRequest.requesting_branch_id]?.orderCount || 0}</p>
                                    </IOSCard>
                                    <IOSCard className="p-2 border-none shadow-sm bg-stone-50">
                                        <TrendingUp className="h-4 w-4 text-stone-400 mb-1" />
                                        <p className="text-[10px] font-bold text-stone-400 uppercase">Avg</p>
                                        <p className="text-sm font-bold text-stone-800">KES {formatNumber(performance[selectedRequest.requesting_branch_id]?.averageOrder || 0)}</p>
                                    </IOSCard>
                                </div>

                                {/* Items Table */}
                                <div className="border border-stone-100 rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-stone-50">
                                            <tr>
                                                <th className="text-left p-2 font-semibold text-stone-600">Item</th>
                                                <th className="text-left p-2 font-semibold text-stone-600">SKU</th>
                                                <th className="text-center p-2 font-semibold text-stone-600">Requested</th>
                                                <th className="text-right p-2 font-semibold text-stone-600">Approve</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-100">
                                            {selectedRequest.items.map((item) => (
                                                <tr key={item.id} className="hover:bg-stone-50/30">
                                                    <td className="p-2 font-medium text-stone-900">{item.item_name}</td>
                                                    <td className="p-2 text-stone-400 font-mono text-[10px]">{item.item_sku}</td>
                                                    <td className="p-2 text-center">
                                                        <span className="bg-stone-100 px-2 py-0.5 rounded-full text-xs font-semibold text-stone-800">
                                                            {item.requested_quantity} {item.unit}
                                                        </span>
                                                    </td>
                                                    <td className="p-2 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <input
                                                                type="number"
                                                                value={approvedQuantities[item.id] ?? item.requested_quantity}
                                                                onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                                                className="w-20 px-2 py-1 text-xs bg-white border border-stone-200 rounded text-right font-semibold text-stone-900 focus:ring-1 focus:ring-stone-900 focus:outline-none"
                                                                min="0"
                                                                step="0.01"
                                                            />
                                                            <span className="text-[10px] font-semibold text-stone-400">{item.unit}</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-stone-400 uppercase">Notes</label>
                                    <textarea
                                        value={reviewNotes}
                                        onChange={(e) => setReviewNotes(e.target.value)}
                                        placeholder="Add remarks..."
                                        className="w-full px-2 py-2 text-xs bg-stone-50 border border-stone-100 rounded-lg text-stone-900 focus:ring-1 focus:ring-stone-900 focus:outline-none min-h-[50px] resize-none"
                                    />
                                </div>

                                <div className="bg-amber-50 rounded-lg p-2 border border-amber-100 flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                                    <p className="text-[10px] text-amber-800 flex-1">
                                        Base decision on sales data. Adjust quantities as needed.
                                    </p>
                                    <button
                                        onClick={() => {
                                            const fullApprovals: Record<string, number> = {};
                                            selectedRequest.items.forEach(item => {
                                                fullApprovals[item.id] = item.requested_quantity;
                                            });
                                            setApprovedQuantities(fullApprovals);
                                            toast.success('Reset to requested');
                                        }}
                                        className="px-2 py-1 bg-white border border-stone-200 text-stone-600 text-[10px] font-bold rounded hover:bg-stone-50 flex items-center gap-1 whitespace-nowrap"
                                    >
                                        <RefreshCw className="h-3 w-3" />
                                        Reset
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>

                    <div className="p-3 border-t border-stone-100 flex-none bg-white">
                        <DialogFooter className="gap-3 flex-col sm:flex-row">
                            <IOSButton
                                variant="secondary"
                                onClick={() => handleDecision('REJECT')}
                                disabled={isActionLoading}
                                leftIcon={<XCircle className="h-4 w-4" />}
                                className="bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100 font-bold sm:w-auto"
                            >
                                Decline Request
                            </IOSButton>
                            <div className="flex gap-2 flex-1">
                                <IOSButton
                                    onClick={() => {
                                        const fullApprovals: Record<string, number> = {};
                                        selectedRequest?.items.forEach(item => {
                                            fullApprovals[item.id] = item.requested_quantity;
                                        });
                                        setApprovedQuantities(fullApprovals);
                                        handleDecision('APPROVE');
                                    }}
                                    disabled={isActionLoading}
                                    className="bg-white border-2 border-stone-800 text-stone-900 flex-1 font-bold hover:bg-stone-50"
                                >
                                    Approve Fully
                                </IOSButton>
                                <IOSButton
                                    onClick={() => handleDecision('APPROVE')}
                                    disabled={isActionLoading}
                                    leftIcon={<CheckCircle className="h-4 w-4" />}
                                    className="bg-stone-900 text-white flex-1 font-bold"
                                >
                                    {isActionLoading ? 'Processing...' : 'Confirm Adjustments'}
                                </IOSButton>
                            </div>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
