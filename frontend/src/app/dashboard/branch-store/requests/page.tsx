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
                    <DialogContent className="max-w-md">
                        <DialogHeader><DialogTitle>New Stock Request</DialogTitle></DialogHeader>
                        <div className="space-y-4 mt-4">
                            <div><label className="text-sm font-medium">Add Item</label>
                                <select onChange={(e) => addItem(e.target.value)} className="w-full p-2 border rounded-ios-lg mt-1" value="">
                                    <option value="">Select item...</option>
                                    {items.map((item) => <option key={item.sku} value={item.sku}>{item.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                {requestItems.map((item, idx) => (
                                    <div key={item.item_sku} className="flex items-center justify-between p-2 bg-stone-50 rounded-lg">
                                        <span className="text-sm font-medium truncate flex-1">{items.find(i => i.sku === item.item_sku)?.name || item.item_sku}</span>
                                        <Input type="number" className="w-20 ml-2" value={item.requested_quantity} onChange={(e) => {
                                            const newItems = [...requestItems];
                                            newItems[idx].requested_quantity = parseInt(e.target.value) || 0;
                                            setRequestItems(newItems);
                                        }} />
                                        <button onClick={() => setRequestItems(requestItems.filter((_, i) => i !== idx))} className="ml-2 text-red-500">×</button>
                                    </div>
                                ))}
                            </div>

                            <div><label className="text-sm font-medium">Reason</label><Input value={requestReason} onChange={(e) => setRequestReason(e.target.value)} placeholder="Why is this needed?" /></div>

                            <div className="flex gap-3 pt-4">
                                <IOSButton variant="secondary" onClick={() => setIsNewRequestModalOpen(false)} className="flex-1">Cancel</IOSButton>
                                <IOSButton onClick={handleCreateRequest} className="flex-1">Submit Request</IOSButton>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
