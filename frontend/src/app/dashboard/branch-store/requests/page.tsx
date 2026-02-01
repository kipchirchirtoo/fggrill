'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { storeAPI } from '@/lib/api';
import { ClipboardList, RefreshCw, Plus, Package, Search, AlertCircle, Clock } from 'lucide-react';
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
}

export default function BranchRequestsPage() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<StockRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
    const [items, setItems] = useState<any[]>([]);
    const [requestItems, setRequestItems] = useState<{ item_sku: string; requested_quantity: number }[]>([]);
    const [requestReason, setRequestReason] = useState('');

    const fetchRequests = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await storeAPI.getBranchRequests();
            if (response.success) setRequests(response.data || []);
        } catch (error) { console.error('Error:', error); }
        finally { setIsLoading(false); }
    }, []);

    const fetchItems = useCallback(async () => {
        try {
            const response = await storeAPI.getBranchStock();
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
            case 'APPROVED': return 'success';
            case 'REJECTED': return 'danger';
            case 'DISPATCHED': return 'info';
            default: return 'neutral';
        }
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div><h1 className="text-2xl font-bold text-gray-900">Stock Requests</h1><p className="text-gray-500">Request items from central store</p></div>
                        <div className="flex gap-2">
                            <IOSButton variant="secondary" onClick={fetchRequests} leftIcon={<RefreshCw />}>Refresh</IOSButton>
                            <IOSButton onClick={() => setIsNewRequestModalOpen(true)} leftIcon={<Plus />}>New Request</IOSButton>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
                    ) : requests.length === 0 ? (
                        <IOSCard className="p-12 text-center"><ClipboardList className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No requests yet</p></IOSCard>
                    ) : (
                        <div className="grid gap-3">
                            {requests.map((req) => (
                                <IOSCard key={req.id} className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-ios-lg bg-amber-100 flex items-center justify-center"><ClipboardList className="h-6 w-6 text-amber-600" /></div>
                                            <div>
                                                <p className="font-bold">{req.request_number}</p>
                                                <p className="text-xs text-gray-400 flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(req.created_at).toLocaleDateString()}</p>
                                                <p className="text-sm text-gray-500">{req.items?.length || 0} items</p>
                                            </div>
                                        </div>
                                        <IOSBadge variant="light" color={getStatusColor(req.status) as any}>{req.status}</IOSBadge>
                                    </div>
                                </IOSCard>
                            ))}
                        </div>
                    )}
                </div>

                <Dialog open={isNewRequestModalOpen} onOpenChange={setIsNewRequestModalOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>New Stock Requisition</DialogTitle>
                            <p className="text-xs text-stone-500">Requesting items from Central Store for your branch</p>
                        </DialogHeader>
                        <div className="space-y-6 mt-4">
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
                                                // We can use this to filter the dropdown or show a results list
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
                                            <option key={item.item_sku || item.sku} value={item.item_sku || item.sku}>
                                                {item.item?.item_name || item.item_name || item.item_sku} (Stock: {item.quantity || 0})
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
                                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                                    {requestItems.length === 0 ? (
                                        <div className="py-8 text-center bg-stone-50 rounded-xl border border-dashed border-stone-200">
                                            <p className="text-xs text-stone-400">No items added yet</p>
                                        </div>
                                    ) : (
                                        requestItems.map((item, idx) => {
                                            const stockInfo = items.find(i => (i.item_sku || i.sku) === item.item_sku);
                                            return (
                                                <div key={item.item_sku} className="flex items-center gap-4 p-3 bg-white border border-stone-100 rounded-xl shadow-sm group">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-stone-800 truncate">
                                                            {stockInfo?.item?.item_name || stockInfo?.item_name || item.item_sku}
                                                        </p>
                                                        <div className="flex items-center gap-3 mt-0.5">
                                                            <span className="text-[10px] text-stone-400">Current: <b className="text-stone-600 font-mono">{stockInfo?.quantity || 0}</b></span>
                                                            <span className="text-[10px] text-stone-400">Par: <b className="text-stone-600 font-mono">{stockInfo?.max_stock_level || stockInfo?.reorder_level || '--'}</b></span>
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

                            <div className="flex gap-3 pt-2">
                                <IOSButton variant="secondary" onClick={() => setIsNewRequestModalOpen(false)} className="flex-1">Cancel</IOSButton>
                                <IOSButton onClick={handleCreateRequest} className="flex-1 px-8">Submit Requisition</IOSButton>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
