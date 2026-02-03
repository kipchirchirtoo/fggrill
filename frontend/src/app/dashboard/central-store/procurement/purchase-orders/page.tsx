'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { procurementAPI } from '@/lib/api';
import { FileText, Plus, Search, RefreshCw, Eye, CheckCircle2, XCircle, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface POItem {
    id?: string;
    item_id: string;
    item_name?: string;
    quantity_ordered: number;
    quantity_received: number;
    unit_price: number;
    total_price: number;
}

interface PurchaseOrder {
    id: string;
    po_number: string;
    supplier_id: string;
    supplier: { name: string };
    status: 'draft' | 'pending_approval' | 'approved' | 'closed' | 'cancelled';
    total_amount: number;
    po_date: string;
    expected_delivery_date?: string;
    created_at: string;
    items?: POItem[];
}

export default function PurchaseOrdersPage() {
    const { user } = useAuth();
    const [pos, setPos] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewPO, setViewPO] = useState<PurchaseOrder | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);

    const fetchPOs = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await procurementAPI.getPurchaseOrders();
            if (response.success) setPos(response.data || []);
        } catch (error) { console.error('Error fetching POs:', error); }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchPOs(); }, [fetchPOs]);

    const handleApprove = async (id: string) => {
        if (!confirm('Approve this Purchase Order?')) return;
        try {
            const res = await procurementAPI.approvePurchaseOrder(id);
            if (res.success) {
                toast.success('PO Approved');
                fetchPOs();
                setIsViewOpen(false);
            } else {
                toast.error(res.message || 'Failed to approve');
            }
        } catch (error: any) { toast.error(error.message || 'Failed to approve'); }
    };

    const handleCancel = async (id: string) => {
        if (!confirm('Cancel this Purchase Order?')) return;
        try {
            const res = await procurementAPI.cancelPurchaseOrder(id);
            if (res.success) {
                toast.success('PO Cancelled');
                fetchPOs();
                setIsViewOpen(false);
            } else {
                toast.error(res.message || 'Failed to cancel');
            }
        } catch (error: any) { toast.error(error.message || 'Failed to cancel'); }
    };

    const filteredPOs = pos.filter(po =>
        po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.supplier?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return 'success';
            case 'pending_approval': return 'warning';
            case 'draft': return 'secondary';
            case 'closed': return 'info';
            case 'cancelled': return 'danger';
            default: return 'secondary';
        }
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.AUDITOR, UserRole.PROCUREMENT]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-[#1C1C1E] tracking-tight">Purchase Orders</h1>
                            <p className="text-[#8E8E93] text-sm">Manage procurement requests and approvals</p>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton variant="secondary" onClick={fetchPOs} leftIcon={<RefreshCw size={16} />}>Refresh</IOSButton>
                            {(user?.role === UserRole.PROCUREMENT || user?.role === UserRole.SUPER_ADMIN) && (
                                <IOSButton onClick={() => window.location.href = '/dashboard/central-store/procurement/purchase-orders/new'} leftIcon={<Plus size={16} />}>New PO</IOSButton>
                            )}
                        </div>
                    </div>

                    <IOSCard className="p-4 border-none shadow-sm bg-white/80 backdrop-blur-md">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8E8E93]" />
                            <Input
                                placeholder="Search POs by number or supplier..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-10 bg-[#F2F2F7] border-none rounded-ios-lg focus-visible:ring-1 focus-visible:ring-amber-500"
                            />
                        </div>
                    </IOSCard>

                    {isLoading ? (
                        <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-amber-500" /></div>
                    ) : filteredPOs.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-ios-xl border border-stone-100 italic text-stone-400">No purchase orders found</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredPOs.map(po => (
                                <IOSCard key={po.id} className="p-4 hover:shadow-md transition-all cursor-pointer border-none bg-white" onClick={async () => {
                                    try {
                                        const res = await procurementAPI.getPurchaseOrder(po.id);
                                        if (res.success) {
                                            setViewPO(res.data);
                                            setIsViewOpen(true);
                                        }
                                    } catch (e) { toast.error('Failed to load details'); }
                                }}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <p className="font-mono text-xs font-bold text-amber-600">{po.po_number}</p>
                                            <p className="font-semibold text-stone-800 line-clamp-1">{po.supplier?.name}</p>
                                        </div>
                                        <IOSBadge variant="light" color={getStatusColor(po.status)} className="capitalize text-[10px]">
                                            {po.status.replace('_', ' ')}
                                        </IOSBadge>
                                    </div>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between text-stone-500">
                                            <span>Date:</span>
                                            <span>{new Date(po.po_date).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex justify-between font-bold text-stone-900 border-t border-stone-50 pt-2">
                                            <span>Total:</span>
                                            <span>KES {po.total_amount.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </IOSCard>
                            ))}
                        </div>
                    )}
                </div>

                <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border-none rounded-ios-2xl">
                        <DialogHeader>
                            <div className="flex items-center justify-between pr-8">
                                <div>
                                    <DialogTitle className="text-xl font-bold tracking-tight">PO: {viewPO?.po_number}</DialogTitle>
                                    <DialogDescription className="text-stone-500">Details for {viewPO?.supplier?.name}</DialogDescription>
                                </div>
                                {viewPO && (
                                    <IOSBadge variant="light" color={getStatusColor(viewPO.status)} className="capitalize">
                                        {viewPO.status.replace('_', ' ')}
                                    </IOSBadge>
                                )}
                            </div>
                        </DialogHeader>

                        {viewPO && (
                            <div className="space-y-6 mt-4">
                                <div className="grid grid-cols-2 gap-8 text-sm border-b border-stone-100 pb-4">
                                    <div className="space-y-1">
                                        <p className="text-stone-400 font-medium uppercase text-[10px] tracking-wider">Supplier Info</p>
                                        <p className="font-bold text-stone-800">{viewPO.supplier?.name}</p>
                                        <p className="text-stone-500 italic">Expected: {viewPO.expected_delivery_date ? new Date(viewPO.expected_delivery_date).toLocaleDateString() : 'N/A'}</p>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <p className="text-stone-400 font-medium uppercase text-[10px] tracking-wider">Total Amount</p>
                                        <p className="text-2xl font-black text-amber-600">KES {viewPO.total_amount.toLocaleString()}</p>
                                        <p className="text-stone-500 text-xs">Tax included (16% VAT)</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Order Items</p>
                                    <div className="overflow-hidden rounded-xl border border-stone-100">
                                        <table className="w-full text-xs">
                                            <thead className="bg-stone-50 text-stone-500 uppercase text-[9px] tracking-widest font-bold">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">Item Name</th>
                                                    <th className="px-3 py-3 text-right">Qty</th>
                                                    <th className="px-3 py-3 text-right">Unit Price</th>
                                                    <th className="px-4 py-3 text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-stone-50">
                                                {viewPO.items?.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-stone-50/50">
                                                        <td className="px-4 py-3 font-medium text-stone-800">
                                                            {(item as any).item?.name || item.item_name}
                                                        </td>
                                                        <td className="px-3 py-3 text-right font-mono font-bold">{item.quantity_ordered}</td>
                                                        <td className="px-3 py-3 text-right text-stone-500">{item.unit_price.toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-right font-bold text-stone-900">{item.total_price.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <IOSButton variant="secondary" onClick={() => setIsViewOpen(false)} className="flex-1 h-11 rounded-ios-lg">Close</IOSButton>
                                    {viewPO.status === 'draft' && (user?.role === UserRole.PROCUREMENT || user?.role === UserRole.SUPER_ADMIN) && (
                                        <IOSButton onClick={() => handleApprove(viewPO.id)} className="flex-[2] h-11 rounded-ios-lg shadow-amber-200 shadow-lg" leftIcon={<CheckCircle2 size={18} />}>Approve & Send</IOSButton>
                                    )}
                                    {viewPO.status === 'approved' && (user?.role === UserRole.CENTRAL_STOREKEEPER || user?.role === UserRole.SUPER_ADMIN) && (
                                        <IOSButton className="flex-[2] h-11 rounded-ios-lg shadow-green-200 shadow-lg" color="success" leftIcon={<Plus size={18} />} onClick={() => window.location.href = `/dashboard/central-store/procurement/grn/new?po_id=${viewPO.id}`}>Receive Goods</IOSButton>
                                    )}
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
