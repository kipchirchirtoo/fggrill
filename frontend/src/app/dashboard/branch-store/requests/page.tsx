'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { storeAPI, auditorReportsAPI, auditAPI } from '@/lib/api';
import { ClipboardList, RefreshCw, Plus, Package, Search, AlertCircle, Clock, FileDown, Activity, AlertTriangle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';

interface StockRequest {
    id: string;
    request_number: string;
    request_type: string;
    priority: string;
    status: string;
    created_at: string;
    items: any[];
    auditor_id?: string;
    audited_at?: string;
    audit_notes?: string;
}

export default function BranchRequestsPage() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<StockRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
    const [items, setItems] = useState<any[]>([]);
    const [requestItems, setRequestItems] = useState<{ item_sku: string; requested_quantity: number }[]>([]);
    const [requestReason, setRequestReason] = useState('');
    const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const fetchRequests = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await storeAPI.getBranchRequests();
            if (response.success) setRequests(response.data || []);
        } catch (error) { console.error('Error:', error); }
        finally { setIsLoading(false); }
    }, []);

    const handleExport = async () => {
        try {
            toast.loading("Generating requisition ledger...");
            await auditorReportsAPI.exportBrandedPdf('stock_requests', {
                branch_id: user?.branch_id
            });
            toast.dismiss();
            toast.success("Ledger generated successfully");
        } catch (error) {
            console.error(error);
            toast.dismiss();
            toast.error("Failed to export ledger");
        }
    };

    const stats = useMemo(() => {
        const pending = requests.filter(r => r.status === 'PENDING').length;
        const totalItems = requests.reduce((acc, r) => acc + (r.items?.length || 0), 0);
        const hasRejections = requests.filter(r => r.items?.some((i: any) => i.status === 'REJECTED')).length;
        return { pending, totalItems, hasRejections };
    }, [requests]);

    const fetchItems = useCallback(async () => {
        try {
            const response = await storeAPI.getMasterCatalog();
            if (response.success) setItems(response.data || []);
        } catch (error) { console.error('Error:', error); }
    }, []);

    useEffect(() => { fetchRequests(); fetchItems(); }, [fetchRequests, fetchItems]);

    const handleCreateRequest = async () => {
        if (requestItems.length === 0) { toast.error('Add at least one item'); return; }
        try {
            await storeAPI.createStockRequest({
                items: requestItems,
                request_type: 'ROUTINE',
                priority: 'NORMAL',
                reason: requestReason
            });
            toast.success('Request created');
            setIsNewRequestModalOpen(false);
            setRequestItems([]);
            setRequestReason('');
            fetchRequests();
        } catch (error) { toast.error('Failed to create request'); }
    };

    const addItem = (sku: string) => {
        if (!sku) return;
        if (requestItems.find(i => i.item_sku === sku)) return;
        setRequestItems([...requestItems, { item_sku: sku, requested_quantity: 1 }]);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return 'warning';
            case 'REVIEWED': return 'blue';
            case 'APPROVED': return 'success';
            case 'PARTIALLY_APPROVED': return 'success';
            case 'REJECTED': return 'error';
            case 'DELIVERED': return 'success';
            case 'RECEIVED': return 'blue';
            default: return 'light';
        }
    };

    const handleFlagAnomaly = async (request: StockRequest) => {
        try {
            toast.loading("Flagging anomaly...");
            await auditAPI.createException({
                audit_session_id: 'MANUAL_REQUEST_' + new Date().getTime(),
                exception_type: 'REQUEST_ANOMALY',
                severity: 'medium',
                description: `Potential anomaly in stock request ${request.request_number}. Items: ${request.items?.length || 0}`,
                amount: request.items?.length || 0,
                reference_type: 'stock_request',
                reference_id: request.id,
            });
            toast.dismiss();
            toast.success("Anomaly flagged for review");
        } catch (error) {
            console.error(error);
            toast.dismiss();
            toast.error("Failed to flag anomaly");
        }
    };

    const handleVerify = async (request: StockRequest) => {
        try {
            toast.loading("Verifying request...");
            await auditAPI.verifyAnomaly({
                id: request.id,
                type: 'stock_request',
                notes: 'Verified by auditor'
            });
            toast.dismiss();
            toast.success("Request verified successfully");
            fetchRequests(); // Refresh data
            setIsDetailModalOpen(false);
        } catch (error) {
            console.error(error);
            toast.dismiss();
            toast.error("Failed to verify request");
        }
    };

    return (
        <ProtectedRoute allowedRoles={[
            UserRole.BRANCH_STOREKEEPER,
            UserRole.BRANCH_MANAGER,
            UserRole.SUPER_ADMIN,
            UserRole.GENERAL_MANAGER,
            UserRole.BARTENDER,
            UserRole.RESTAURANT,
            UserRole.AUDITOR
        ]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                {user?.role === UserRole.AUDITOR ? 'Stock Request Oversight' : 'Stock Requests'}
                            </h1>
                            <p className="text-gray-500">
                                {user?.role === UserRole.AUDITOR ? 'Review and audit branch stock requisitions' : 'Request items from central store'}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton variant="secondary" onClick={fetchRequests} leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}>Refresh</IOSButton>
                            {user?.role === UserRole.AUDITOR && (
                                <IOSButton variant="secondary" onClick={handleExport} leftIcon={<FileDown />}>Export Ledger</IOSButton>
                            )}
                            {user?.role !== UserRole.AUDITOR && (
                                <IOSButton onClick={() => setIsNewRequestModalOpen(true)} leftIcon={<Plus />}>New Request</IOSButton>
                            )}
                        </div>
                    </div>

                    {user?.role === UserRole.AUDITOR && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <IOSCard className="p-4 bg-white">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600">
                                        <ClipboardList className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Total Requisitions</p>
                                        <p className="text-xl font-black text-stone-900">{requests.length}</p>
                                    </div>
                                </div>
                            </IOSCard>
                            <IOSCard className="p-4 bg-white">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                                        <Clock className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest text-amber-600">Pending Approval</p>
                                        <p className="text-xl font-black text-amber-600">{stats.pending}</p>
                                    </div>
                                </div>
                            </IOSCard>
                            <IOSCard className="p-4 bg-white">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
                                        <AlertTriangle className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest text-rose-600">With Rejections</p>
                                        <p className="text-xl font-black text-rose-600">{stats.hasRejections}</p>
                                    </div>
                                </div>
                            </IOSCard>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
                    ) : requests.length === 0 ? (
                        <IOSCard className="p-12 text-center"><ClipboardList className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No requests yet</p></IOSCard>
                    ) : (
                        <div className="grid gap-3">
                            {requests.map((req) => (
                                <IOSCard
                                    key={req.id}
                                    className="p-4 cursor-pointer hover:border-blue-400 transition-colors"
                                    onClick={() => {
                                        setSelectedRequest(req);
                                        setIsDetailModalOpen(true);
                                    }}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-ios-lg bg-amber-100 flex items-center justify-center"><ClipboardList className="h-6 w-6 text-amber-600" /></div>
                                            <div>
                                                <p className="font-bold">{req.request_number}</p>
                                                <p className="text-xs text-gray-400 flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(req.created_at).toLocaleDateString()}</p>
                                                <p className="text-sm text-gray-500">{req.items?.length || 0} items</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <IOSBadge variant="light" color={getStatusColor(req.status) as any}>{req.status}</IOSBadge>
                                            <div className="hidden md:block">
                                                {req.items?.some(i => i.status === 'REJECTED') && <span className="text-xs text-red-500 font-medium bg-red-50 px-2 py-1 rounded">Has Rejections</span>}
                                            </div>
                                        </div>
                                    </div>
                                </IOSCard>
                            ))}
                        </div>
                    )}
                </div>

                <Dialog open={isNewRequestModalOpen} onOpenChange={setIsNewRequestModalOpen}>
                    <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-stone-200">
                        <DialogHeader className="p-6 pb-2 border-b border-stone-50 bg-white">
                            <DialogTitle>New Stock Requisition</DialogTitle>
                            <p className="text-xs text-stone-500">Requesting items from Central Store for your branch</p>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Search & Suggestions */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Find Item</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                        <input
                                            type="text"
                                            placeholder="Search catalog..."
                                            className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-200"
                                            onChange={(e) => {
                                                const term = e.target.value.toLowerCase();
                                                const filtered = items.filter(i =>
                                                    (i.item?.item_name || i.item_name || '').toLowerCase().includes(term) ||
                                                    (i.item_sku || i.sku || '').toLowerCase().includes(term)
                                                );
                                            }}
                                        />
                                    </div>
                                    <select
                                        onChange={(e) => addItem(e.target.value)}
                                        className="w-full p-2 border border-stone-200 rounded-lg text-sm bg-white"
                                        value=""
                                    >
                                        <option value="">Select an item to add...</option>
                                        {items.map((item) => (
                                            <option key={item.sku} value={item.sku}>
                                                {item.item_name} (Central: {item.quantity || 0})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Quick Actions</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        <button
                                            onClick={() => {
                                                const lowStock = items.filter(i => (i.quantity || 0) <= (i.reorder_level || 10));
                                                lowStock.forEach(i => addItem(i.item_sku || i.sku));
                                            }}
                                            className="w-full text-left px-4 py-2 bg-amber-50 border border-amber-100 rounded-lg text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                                        >
                                            Add all low stock items
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Added Items List */}
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Requested Items ({requestItems.length})</label>
                                <div className="space-y-2">
                                    {requestItems.length === 0 ? (
                                        <div className="py-8 text-center bg-stone-50 rounded-xl border border-dashed border-stone-200">
                                            <p className="text-xs text-stone-400">No items added yet</p>
                                        </div>
                                    ) : (
                                        requestItems.map((item, idx) => {
                                            const stockInfo = items.find(i => (i.item_sku || i.sku) === item.item_sku);
                                            return (
                                                <div key={idx} className="flex items-start gap-3 p-3 bg-white border border-stone-200 rounded-xl hover:border-stone-300 transition-colors">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-stone-800 truncate">
                                                            {stockInfo?.item_name || item.item_sku}
                                                        </p>
                                                        <div className="flex items-center gap-3 mt-0.5">
                                                            <span className="text-[10px] text-stone-400">Central Stock: <b className="text-stone-600 font-mono">{stockInfo?.quantity || 0}</b></span>
                                                            <span className="text-[10px] text-stone-400">Unit: <b className="text-stone-600 font-mono">{stockInfo?.unit_of_measure || '--'}</b></span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex flex-col items-end">
                                                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-tighter">Qty</label>
                                                            <Input
                                                                type="number"
                                                                className="w-20 h-9 text-right font-mono font-bold"
                                                                value={item.requested_quantity}
                                                                onChange={(e) => {
                                                                    const newItems = [...requestItems];
                                                                    newItems[idx].requested_quantity = parseInt(e.target.value) || 0;
                                                                    setRequestItems(newItems);
                                                                }}
                                                                min="1"
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={() => setRequestItems(requestItems.filter((_, i) => i !== idx))}
                                                            className="p-2 text-stone-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors mt-4"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Reason for Request</label>
                                <Input
                                    value={requestReason}
                                    onChange={(e) => setRequestReason(e.target.value)}
                                    placeholder="e.g. Weekly replenishment, event preparation..."
                                    className="bg-stone-50 border-stone-200"
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-stone-50 border-t border-stone-100 flex gap-3">
                            <IOSButton variant="secondary" onClick={() => setIsNewRequestModalOpen(false)} className="flex-1">Cancel</IOSButton>
                            <IOSButton onClick={handleCreateRequest} className="flex-1 px-8">Submit Requisition</IOSButton>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Detail Modal */}
                <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
                    <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-stone-200">
                        <DialogHeader className="p-6 pb-2 border-b border-stone-50 bg-white">
                            <DialogTitle>Request Details</DialogTitle>
                            <p className="text-xs text-stone-500">{selectedRequest?.request_number}</p>
                        </DialogHeader>

                        {selectedRequest && (
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-stone-50 p-4 rounded-xl border border-stone-100">
                                    <div>
                                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Status</label>
                                        <div className="font-medium text-sm mt-1">
                                            <IOSBadge variant="light" color={getStatusColor(selectedRequest.status) as any}>{selectedRequest.status}</IOSBadge>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Date</label>
                                        <p className="font-medium text-sm mt-1">{new Date(selectedRequest.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Priority</label>
                                        <p className="font-medium text-sm mt-1 capitalize">{selectedRequest.priority?.toLowerCase()}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Type</label>
                                        <p className="font-medium text-sm mt-1 capitalize">{selectedRequest.request_type?.toLowerCase()}</p>
                                    </div>
                                </div>

                                {/* Items List */}
                                <div>
                                    <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2 block">Items</label>
                                    <div className="border border-stone-100 rounded-xl overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-stone-50 text-stone-500 font-medium border-b border-stone-100">
                                                <tr>
                                                    <th className="px-4 py-3">Item</th>
                                                    <th className="px-4 py-3 text-right">Requested</th>
                                                    <th className="px-4 py-3 text-right">Approved</th>
                                                    <th className="px-4 py-3 text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-stone-100">
                                                {selectedRequest.items?.map((item: any) => (
                                                    <tr key={item.id} className="hover:bg-stone-50/50">
                                                        <td className="px-4 py-3">
                                                            <p className="font-medium text-stone-800">{item.item_name || item.item_sku}</p>
                                                            {item.rejection_reason && (
                                                                <p className="text-xs text-rose-500 mt-1">Reason: {item.rejection_reason}</p>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono">{item.requested_quantity}</td>
                                                        <td className="px-4 py-3 text-right font-mono">
                                                            {['APPROVED', 'PARTIALLY_APPROVED', 'DELIVERED', 'RECEIVED'].includes(item.status) ? (
                                                                <span className="text-emerald-600 font-bold">{item.approved_quantity}</span>
                                                            ) : (
                                                                <span className="text-stone-300">-</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${item.status === 'APPROVED' || item.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-600' :
                                                                item.status === 'RECEIVED' ? 'bg-blue-50 text-blue-600' :
                                                                    item.status === 'REJECTED' ? 'bg-rose-50 text-rose-600' :
                                                                        'bg-amber-50 text-amber-600'
                                                                }`}>
                                                                {item.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {(selectedRequest as any).review_notes && (
                                    <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl">
                                        <label className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1 block">Review Notes</label>
                                        <p className="text-sm text-blue-900">{(selectedRequest as any).review_notes}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="p-6 bg-stone-50 border-t border-stone-100">
                            {selectedRequest && (
                                <>
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Audit Status</p>
                                        {(selectedRequest as any).audited_at ? (
                                            <div className="flex items-center gap-1 text-emerald-600">
                                                <Check className="h-3 w-3" />
                                                <span className="text-[10px] font-bold uppercase tracking-widest">Verified</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1 text-amber-600">
                                                <Clock className="h-3 w-3" />
                                                <span className="text-[10px] font-bold uppercase tracking-widest">Unverified</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <IOSButton variant="secondary" onClick={() => setIsDetailModalOpen(false)} className="w-full">Close</IOSButton>
                                        {user?.role === UserRole.AUDITOR && !(selectedRequest as any).audited_at && (
                                            <IOSButton variant="secondary" onClick={() => handleVerify(selectedRequest!)} leftIcon={<Check />} className="w-full">
                                                Verify
                                            </IOSButton>
                                        )}
                                    </div>

                                    {user?.role === UserRole.AUDITOR && !(selectedRequest as any).audited_at && (
                                        <IOSButton variant="destructive" onClick={() => handleFlagAnomaly(selectedRequest)} leftIcon={<AlertTriangle />} className="w-full">
                                            Flag Anomaly
                                        </IOSButton>
                                    )}

                                    {user?.role === UserRole.AUDITOR && (selectedRequest as any).audited_at && (
                                        <div className="pt-2 italic text-[10px] text-stone-500">
                                            Verified on {new Date((selectedRequest as any).audited_at).toLocaleDateString()} {new Date((selectedRequest as any).audited_at).toLocaleTimeString()}.
                                        </div>
                                    )}
                                </>
                            )}
                            {!selectedRequest && (
                                <IOSButton variant="secondary" onClick={() => setIsDetailModalOpen(false)} className="w-full">Close</IOSButton>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </DashboardLayout>
        </ProtectedRoute >
    );
}
