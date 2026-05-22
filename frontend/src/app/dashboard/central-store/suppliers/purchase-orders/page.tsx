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
import { FileText, Plus, Search, RefreshCw, Eye, CheckCircle2, XCircle, ShoppingCart, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface POItem {
    id?: string;
    item_id: string;
    item_name?: string;
    quantity: number;
    unit_price: number;
    total_price: number;
}

interface PurchaseOrder {
    id: string;
    po_number: string;
    supplier_id: string;
    supplier_name?: string;
    status: 'draft' | 'pending_approval' | 'approved' | 'closed' | 'cancelled';
    total_amount: number;
    expected_delivery_date?: string;
    created_at: string;
    created_by_name?: string;
    items?: POItem[];
}

export default function PurchaseOrdersPage() {
    const { user } = useAuth();
    const [pos, setPos] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewPO, setViewPO] = useState<PurchaseOrder | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);
    
    const [poStoreTypeFilter, setPoStoreTypeFilter] = useState<'all' | 'foodstuffs' | 'bar_store'>('all');

    const fetchPOs = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = poStoreTypeFilter !== 'all' ? { store_type: poStoreTypeFilter } : {};
            const response = await procurementAPI.getPurchaseOrders(params);
            if (response.success) setPos(response.data || []);
        } catch (error) { console.error('Error fetching POs:', error); }
        finally { setIsLoading(false); }
    }, [poStoreTypeFilter]);

    useEffect(() => { fetchPOs(); }, [fetchPOs]);

    const handleApprove = async (id: string) => {
        if (!confirm('Approve this Purchase Order?')) return;
        try {
            await procurementAPI.approvePurchaseOrder(id);
            toast.success('PO Approved');
            fetchPOs();
            setIsViewOpen(false);
        } catch (error: any) { toast.error(error.message || 'Failed to approve'); }
    };

    const handleCancel = async (id: string) => {
        if (!confirm('Cancel this Purchase Order?')) return;
        try {
            await procurementAPI.cancelPurchaseOrder(id);
            toast.success('PO Cancelled');
            fetchPOs();
            setIsViewOpen(false);
        } catch (error: any) { toast.error(error.message || 'Failed to cancel'); }
    };

    const filteredPOs = pos.filter(po =>
        po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        po.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase())
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
                            <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
                            <p className="text-gray-500">Manage procurement requests and approvals</p>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton variant="secondary" onClick={fetchPOs} leftIcon={<RefreshCw size={16} />}>Refresh</IOSButton>
                            {([UserRole.PROCUREMENT, UserRole.SUPER_ADMIN, UserRole.CENTRAL_STOREKEEPER, UserRole.PURCHASING_MANAGER, UserRole.GENERAL_MANAGER].includes(user?.role as UserRole)) && (
                                <IOSButton 
                                    onClick={() => {
                                        toast.info('Select a supplier first to create a Purchase Order');
                                        window.location.href = '/dashboard/central-store/suppliers';
                                    }} 
                                    leftIcon={<Plus size={16} />}
                                >
                                    New PO
                                </IOSButton>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 py-2 border-b border-stone-100">
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers'}>Suppliers</IOSButton>
                        <IOSButton variant="secondary" className="bg-stone-50 border-none h-8 text-xs px-3" onClick={() => window.location.href = '/dashboard/central-store/suppliers/purchase-orders'}>POs</IOSButton>
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers/grn'}>GRN</IOSButton>
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers/invoices'}>Invoices</IOSButton>
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers/payments'}>Payments</IOSButton>
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers/reports'}>Reports</IOSButton>
                    </div>

                    <IOSCard className="p-4">
                        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search POs by number or supplier..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 h-9 text-sm"
                                />
                            </div>
                            <div className="bg-stone-100 p-1 rounded-lg flex self-start md:self-auto gap-1">
                                <button
                                    onClick={() => setPoStoreTypeFilter('all')}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${poStoreTypeFilter === 'all' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                                >
                                    All Stores
                                </button>
                                <button
                                    onClick={() => setPoStoreTypeFilter('foodstuffs')}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${poStoreTypeFilter === 'foodstuffs' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                                >
                                    🥦 Foodstuffs
                                </button>
                                <button
                                    onClick={() => setPoStoreTypeFilter('bar_store')}
                                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${poStoreTypeFilter === 'bar_store' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                                >
                                    🍺 Bar Store
                                </button>
                            </div>
                        </div>
                    </IOSCard>

                    {isLoading ? (
                        <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-stone-300" /></div>
                    ) : filteredPOs.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-ios-xl border border-stone-100 italic text-stone-400">No purchase orders found</div>
                    ) : (
                        <div className="overflow-x-auto rounded-ios-xl border border-stone-100">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-stone-50 text-stone-500 font-medium">
                                    <tr>
                                        <th className="px-4 py-3">PO Number</th>
                                        <th className="px-4 py-3">Supplier</th>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3 text-right">Amount</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50 bg-white">
                                    {filteredPOs.map(po => (
                                        <tr key={po.id} className="hover:bg-stone-50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs font-bold text-stone-700">{po.po_number}</td>
                                            <td className="px-4 py-3">{po.supplier_name || 'N/A'}</td>
                                            <td className="px-4 py-3 text-stone-500">{new Date(po.created_at).toLocaleDateString()}</td>
                                            <td className="px-4 py-3 text-right font-medium">KES {po.total_amount.toLocaleString()}</td>
                                            <td className="px-4 py-3">
                                                <IOSBadge variant="light" color={getStatusColor(po.status)} className="capitalize text-[10px] py-0 px-2 min-w-[80px] text-center border-none">
                                                    {po.status.replace('_', ' ')}
                                                </IOSBadge>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                const res = await procurementAPI.getPurchaseOrder(po.id);
                                                                if (res.success) {
                                                                    setViewPO(res.data);
                                                                    setIsViewOpen(true);
                                                                }
                                                            } catch (e) { toast.error('Failed to load details'); }
                                                        }}
                                                        className="p-1 text-stone-400 hover:text-[#007AFF]"
                                                        title="View Details"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    {po.status === 'approved' && (
                                                        <button
                                                            onClick={() => window.location.href = `/dashboard/central-store/receiving?po_id=${po.id}`}
                                                            className="p-1 text-stone-400 hover:text-emerald-600"
                                                            title="Receive Goods"
                                                        >
                                                            <ShoppingCart size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <div className="flex items-center justify-between pr-8">
                                <div>
                                    <DialogTitle className="text-xl">PO: {viewPO?.po_number}</DialogTitle>
                                    <DialogDescription>Details for {viewPO?.supplier_name}</DialogDescription>
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
                                        <p className="text-stone-400">Supplier Info</p>
                                        <p className="font-bold text-stone-800">{viewPO.supplier_name}</p>
                                        <p className="text-stone-500 italic">Expected: {viewPO.expected_delivery_date ? new Date(viewPO.expected_delivery_date).toLocaleDateString() : 'N/A'}</p>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <p className="text-stone-400">Total Amount</p>
                                        <p className="text-xl font-black text-[#007AFF]">KES {viewPO.total_amount.toLocaleString()}</p>
                                        <p className="text-stone-500">Created by: {viewPO.created_by_name || 'System'}</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Order Items</p>
                                    <div className="overflow-hidden rounded-lg border border-stone-100">
                                        <table className="w-full text-xs">
                                            <thead className="bg-stone-50 text-stone-500">
                                                <tr>
                                                    <th className="px-3 py-2 text-left">Item Name</th>
                                                    <th className="px-3 py-2 text-right">Qty</th>
                                                    <th className="px-3 py-2 text-right">Price</th>
                                                    <th className="px-3 py-2 text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {viewPO.items?.map((item, idx) => (
                                                    <tr key={idx} className="border-t border-stone-50">
                                                        <td className="px-3 py-2 font-medium">{item.item_name}</td>
                                                        <td className="px-3 py-2 text-right font-mono">{item.quantity}</td>
                                                        <td className="px-3 py-2 text-right">{item.unit_price.toLocaleString()}</td>
                                                        <td className="px-3 py-2 text-right font-bold">{item.total_price.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-4 border-t border-stone-100">
                                    <IOSButton variant="secondary" onClick={() => setIsViewOpen(false)} className="h-9 px-4 text-xs">Close</IOSButton>
                                    
                                    {viewPO.status === 'draft' && (
                                        <IOSButton onClick={() => handleApprove(viewPO.id)} className="h-9 px-4 text-xs flex-1" leftIcon={<CheckCircle2 size={14} />}>Submit for Approval</IOSButton>
                                    )}

                                    {viewPO.status === 'pending_approval' && (user?.role === UserRole.AUDITOR || user?.role === UserRole.SUPER_ADMIN) && (
                                        <>
                                            <IOSButton onClick={() => handleApprove(viewPO.id)} className="h-9 px-4 text-xs flex-1" leftIcon={<CheckCircle2 size={14} />}>Approve PO</IOSButton>
                                            <IOSButton variant="secondary" onClick={() => handleCancel(viewPO.id)} className="h-9 px-4 text-xs border-red-100 text-red-500 hover:bg-red-50" leftIcon={<XCircle size={14} />}>Reject</IOSButton>
                                        </>
                                    )}

                                    {viewPO.status === 'approved' && (
                                        <div className="flex gap-2 flex-1">
                                            <IOSButton 
                                                onClick={async () => {
                                                    try {
                                                        const res = await procurementAPI.sendPurchaseOrder(viewPO.id);
                                                        if (res.success) toast.success('PO sent to supplier');
                                                    } catch (e: any) { toast.error(e.message || 'Failed to send'); }
                                                }}
                                                className="h-9 px-4 text-xs flex-1 bg-[#007AFF]" 
                                                leftIcon={<Mail size={14} />}
                                            >
                                                Send to Supplier
                                            </IOSButton>
                                            <IOSButton variant="secondary" leftIcon={<ShoppingCart size={14} />} className="h-9 px-4 text-xs flex-1" onClick={() => window.location.href = `/dashboard/central-store/receiving?po_id=${viewPO.id}`}>Receive Goods</IOSButton>
                                        </div>
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
