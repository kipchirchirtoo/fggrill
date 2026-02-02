'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { storeAPI } from '@/lib/api';
import { Package, RefreshCw, Truck, CheckCircle2, AlertCircle, ClipboardList, Box, ArrowRight, Check, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface RequestItem { id: string; item_sku: string; item_name: string; requested_quantity: number; approved_quantity: number; unit: string; packed?: boolean; }
interface StockRequest { id: string; request_number: string; status: string; branch_name: string; to_branch_id: number; created_at: string; items: RequestItem[]; }

export default function PackingPage() {
    const [requests, setRequests] = useState<StockRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
    const [packingModalOpen, setPackingModalOpen] = useState(false);
    const [packedItems, setPackedItems] = useState<Record<string, boolean>>({});
    const [isProcessing, setIsProcessing] = useState(false);
    const router = useRouter();

    const fetchApprovedRequests = useCallback(async () => {
        setIsLoading(true);
        try {
            const [approvedRes, partialRes] = await Promise.all([
                storeAPI.getBranchRequests('APPROVED'),
                storeAPI.getBranchRequests('PARTIALLY_APPROVED')
            ]);
            let combinedRequests: StockRequest[] = [];
            if (approvedRes.success) combinedRequests = [...combinedRequests, ...(approvedRes.data || [])];
            if (partialRes.success) combinedRequests = [...combinedRequests, ...(partialRes.data || [])];

            setRequests(combinedRequests);
        } catch (error) { console.error('Error:', error); }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchApprovedRequests(); }, [fetchApprovedRequests]);

    const handleStartPacking = (request: StockRequest) => {
        setSelectedRequest(request);
        setPackedItems({});
        setPackingModalOpen(true);
    };

    const togglePacked = (id: string) => {
        setPackedItems(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const allPacked = selectedRequest?.items.every(item => packedItems[item.id]);

    const handleConfirmPacked = async () => {
        if (!selectedRequest || !allPacked) return;
        setIsProcessing(true);
        try {
            const dispatchData = {
                request_id: selectedRequest.id,
                to_branch_id: selectedRequest.to_branch_id,
                items: selectedRequest.items.map(i => ({
                    item_sku: i.item_sku,
                    dispatched_quantity: i.approved_quantity
                })),
                notes: `Packed from request ${selectedRequest.request_number}`
            };

            const response = await storeAPI.createDispatch(dispatchData);
            if (response.success) {
                toast.success('Items packed and ready for dispatch');
                setPackingModalOpen(false);
                fetchApprovedRequests();

                toast.info('Redirecting to Dispatch Station...');
                setTimeout(() => {
                    router.push('/dashboard/central-store/dispatch');
                }, 1500);
            } else {
                toast.error(response.message || 'Failed to create dispatch');
            }
        } catch (error: any) {
            toast.error(error.message || 'Error occurred');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Packing Station</h1>
                            <p className="text-stone-500 mt-0.5">Prepare approved branch requisitions for delivery</p>
                        </div>
                        <button onClick={fetchApprovedRequests} disabled={isLoading} className="btn-secondary h-10 px-3">
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            <span>Refresh</span>
                        </button>
                    </div>

                    {/* Request Grid - Minimal Stone */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {isLoading ? (
                            <div className="col-span-full py-20 text-center text-stone-300">Loading pending requests...</div>
                        ) : requests.length === 0 ? (
                            <div className="col-span-full bg-white border border-stone-100 p-20 text-center flex flex-col items-center rounded-lg">
                                <Box className="h-12 w-12 text-stone-100 mb-4" />
                                <h3 className="text-lg font-medium text-stone-400">Queue is empty</h3>
                                <p className="text-stone-300 text-sm">No approved requests waiting to be packed.</p>
                            </div>
                        ) : (
                            requests.map((req) => (
                                <div key={req.id} className="bg-white border border-stone-100 p-5 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">REQ # {req.request_number}</p>
                                            <h3 className="text-lg font-semibold text-stone-900 mt-1 uppercase">{req.branch_name}</h3>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${req.status === 'PARTIALLY_APPROVED' ? 'bg-amber-100 text-amber-600' : 'bg-stone-100 text-stone-500'
                                            }`}>
                                            {req.status === 'PARTIALLY_APPROVED' ? 'Partial' : 'Approved'}
                                        </span>
                                    </div>
                                    <div className="space-y-3 mb-5">
                                        <div className="flex items-center gap-2 text-[13px] text-stone-600">
                                            <ClipboardList className="h-4 w-4 text-stone-400" />
                                            <span>{req.items.length} unique line items</span>
                                        </div>
                                        <p className="text-[11px] text-stone-400">Created: {new Date(req.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <button onClick={() => handleStartPacking(req)} className="w-full flex items-center justify-center gap-2 py-2.5 bg-stone-900 text-white text-[13px] font-medium rounded-lg hover:bg-stone-800 transition-colors">
                                        <span>Start Packing</span>
                                        <ArrowRight className="h-4 w-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Packing Modal - Minimal Light UI */}
                <Dialog open={packingModalOpen} onOpenChange={setPackingModalOpen}>
                    <DialogContent className="max-w-xl bg-white border-none shadow-2xl p-0 overflow-hidden rounded-xl max-h-[85vh] flex flex-col">
                        <div className="bg-stone-900 p-4 text-white pb-6 shrink-0">
                            <DialogHeader>
                                <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                                    <ClipboardList className="h-5 w-5 text-stone-400" />
                                    Checklist: {selectedRequest?.request_number}
                                </DialogTitle>
                                <p className="text-stone-400 text-[11px] mt-0.5 uppercase tracking-wider font-bold">Destination: {selectedRequest?.branch_name}</p>
                            </DialogHeader>
                        </div>

                        <div className="px-4 -mt-4 shrink-0 relative z-10">
                            <div className="bg-white border border-stone-100 shadow-lg rounded-lg p-3">
                                <p className="text-[11px] text-stone-600 leading-relaxed">
                                    Confirm all quantities physically before proceeding.
                                    Once all items are checked, you can generate the dispatch notice.
                                </p>
                            </div>
                        </div>

                        <div className="p-4 space-y-2 overflow-y-auto min-h-0 flex-1">
                            {selectedRequest?.items.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => togglePacked(item.id)}
                                    className={`group flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all duration-300 ${packedItems[item.id]
                                        ? 'bg-emerald-50 border-emerald-200 shadow-sm'
                                        : 'bg-white border-stone-100 hover:border-stone-300 hover:shadow-md'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 shrink-0 ${packedItems[item.id]
                                            ? 'bg-emerald-500 border-emerald-500 scale-110'
                                            : 'border-stone-200 group-hover:border-stone-900 group-hover:scale-105'
                                            }`}>
                                            {packedItems[item.id] && <Check className="h-3.5 w-3.5 text-white stroke-[3px]" />}
                                        </div>
                                        <div>
                                            <p className={`text-sm font-bold ${packedItems[item.id] ? 'text-emerald-900' : 'text-stone-900'}`}>
                                                {item.item_name}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <p className="text-[10px] text-stone-400 font-mono uppercase tracking-tighter">{item.item_sku}</p>
                                                {item.requested_quantity !== item.approved_quantity && (
                                                    <span className="text-[9px] bg-rose-50 text-rose-600 px-1.5 py-px rounded-full font-bold border border-rose-100 italic">Adjusted</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end pl-2">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest leading-none mb-0.5">To Pack</span>
                                            <p className={`text-base font-black ${packedItems[item.id] ? 'text-emerald-600' : 'text-stone-900'}`}>
                                                {item.approved_quantity} <span className="text-[9px] font-bold">{item.unit}</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-2 shrink-0">
                            <button onClick={() => setPackingModalOpen(false)} className="btn-secondary h-9 text-sm">Cancel</button>
                            <button
                                onClick={handleConfirmPacked}
                                disabled={!allPacked || isProcessing}
                                className={`h-9 px-4 rounded-lg text-sm font-medium transition-colors ${allPacked
                                    ? 'bg-stone-900 text-white hover:bg-stone-800'
                                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                                    }`}
                            >
                                {isProcessing ? 'Processing...' : 'Mark as Ready'}
                            </button>
                        </div>
                    </DialogContent>
                </Dialog>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
