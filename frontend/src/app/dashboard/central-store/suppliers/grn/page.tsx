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
import { PackageSearch, Plus, Search, RefreshCw, Eye, CheckCircle2, AlertTriangle, ClipboardCheck, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface GRNItem {
    id?: string;
    item_id: string;
    item_name?: string;
    quantity_ordered: number;
    quantity_received: number;
    condition_status: 'good' | 'damaged' | 'short' | 'expired' | 'rejected';
    notes?: string;
}

interface GRN {
    id: string;
    grn_number: string;
    po_number?: string;
    po_id?: string;
    supplier_name?: string;
    delivery_date: string;
    status: 'draft' | 'pending_review' | 'approved' | 'cancelled';
    received_by_name?: string;
    total_items?: number;
    items?: GRNItem[];
}

export default function GRNPage() {
    const { user } = useAuth();
    const [grns, setGrns] = useState<GRN[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewGRN, setViewGRN] = useState<GRN | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);

    const fetchGRNs = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await procurementAPI.getGRNs();
            if (response.success) {
                // Transform the data to flatten supplier and PO info
                const transformedData = (response.data || []).map((grn: any) => ({
                    ...grn,
                    supplier_name: grn.supplier?.name || 'N/A',
                    po_number: grn.purchase_order?.po_number || grn.po_number || null,
                    delivery_date: grn.grn_date || grn.delivery_date
                }));
                setGrns(transformedData);
            }
        } catch (error) { console.error('Error fetching GRNs:', error); }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchGRNs(); }, [fetchGRNs]);

    const handleApprove = async (id: string) => {
        if (!confirm('Approve this GRN? This will update inventory and create GRNI entries.')) return;
        try {
            await procurementAPI.approveGRN(id);
            toast.success('GRN Approved & Inventory Updated');
            fetchGRNs();
            setIsViewOpen(false);
        } catch (error: any) { toast.error(error.message || 'Failed to approve'); }
    };

    const filteredGRNs = grns.filter(grn =>
        grn.grn_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (grn.po_number && grn.po_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
        grn.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return 'success';
            case 'pending_review': return 'warning';
            case 'draft': return 'secondary';
            case 'cancelled': return 'danger';
            default: return 'secondary';
        }
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Goods Received (GRN)</h1>
                            <p className="text-gray-500">Record and verify incoming shipments</p>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton variant="secondary" onClick={fetchGRNs} leftIcon={<RefreshCw size={16} />}>Refresh</IOSButton>
                            {(user?.role === UserRole.CENTRAL_STOREKEEPER || user?.role === UserRole.SUPER_ADMIN) && (
                                <IOSButton onClick={() => toast.info('Redirecting to GRN Recording...')} leftIcon={<Plus size={16} />}>Record Receipt</IOSButton>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 py-2 border-b border-stone-100">
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers'}>Suppliers</IOSButton>
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers/purchase-orders'}>POs</IOSButton>
                        <IOSButton variant="secondary" className="bg-stone-50 border-none h-8 text-xs px-3" onClick={() => window.location.href = '/dashboard/central-store/suppliers/grn'}>GRN</IOSButton>
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers/invoices'}>Invoices</IOSButton>
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers/payments'}>Payments</IOSButton>
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers/reports'}>Reports</IOSButton>
                    </div>

                    <IOSCard className="p-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search by GRN #, PO # or Supplier..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-9 text-sm"
                            />
                        </div>
                    </IOSCard>

                    {isLoading ? (
                        <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-stone-300" /></div>
                    ) : filteredGRNs.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-ios-xl border border-stone-100 italic text-stone-400">No goods receipts found</div>
                    ) : (
                        <div className="overflow-x-auto rounded-ios-xl border border-stone-100">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-stone-50 text-stone-500 font-medium">
                                    <tr>
                                        <th className="px-4 py-3">GRN Number</th>
                                        <th className="px-4 py-3">PO Reference</th>
                                        <th className="px-4 py-3">Supplier</th>
                                        <th className="px-4 py-3">Delivery Date</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50 bg-white">
                                    {filteredGRNs.map(grn => (
                                        <tr key={grn.id} className="hover:bg-stone-50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs font-bold text-stone-700">{grn.grn_number}</td>
                                            <td className="px-4 py-3 font-mono text-[10px] text-stone-400">{grn.po_number || 'Direct Receipt'}</td>
                                            <td className="px-4 py-3">{grn.supplier_name || 'N/A'}</td>
                                            <td className="px-4 py-3 text-stone-500">
                                                {grn.delivery_date ? new Date(grn.delivery_date).toLocaleDateString() : 'Invalid Date'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <IOSBadge variant="light" color={getStatusColor(grn.status)} className="capitalize text-[10px] py-0 px-2 min-w-[80px] text-center border-none">
                                                    {grn.status.replace('_', ' ')}
                                                </IOSBadge>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const res = await procurementAPI.getGRN(grn.id);
                                                            if (res.success) {
                                                                setViewGRN(res.data);
                                                                setIsViewOpen(true);
                                                            }
                                                        } catch (e) { toast.error('Failed to load details'); }
                                                    }}
                                                    className="p-1 text-stone-400 hover:text-[#007AFF]"
                                                >
                                                    <Eye size={16} />
                                                </button>
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
                                    <DialogTitle className="text-xl">GRN Details: {viewGRN?.grn_number}</DialogTitle>
                                    <DialogDescription>Received from {viewGRN?.supplier_name}</DialogDescription>
                                </div>
                                {viewGRN && (
                                    <IOSBadge variant="light" color={getStatusColor(viewGRN.status)} className="capitalize">
                                        {viewGRN.status.replace('_', ' ')}
                                    </IOSBadge>
                                )}
                            </div>
                        </DialogHeader>

                        {viewGRN && (
                            <div className="space-y-6 mt-4">
                                <div className="grid grid-cols-3 gap-4 text-xs bg-stone-50 p-3 rounded-ios-lg">
                                    <div>
                                        <p className="text-stone-400 pb-1">Delivery Logistics</p>
                                        <div className="flex items-center gap-2">
                                            <Truck size={14} className="text-stone-500" /> 
                                            <span className="font-medium">
                                                {viewGRN.delivery_date ? new Date(viewGRN.delivery_date).toLocaleDateString() : 'Invalid Date'}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-stone-400 pb-1">PO Reference</p>
                                        <div className="flex items-center gap-2"><ClipboardCheck size={14} className="text-stone-500" /> <span className="font-medium">{viewGRN.po_number || 'Manual'}</span></div>
                                    </div>
                                    <div>
                                        <p className="text-stone-400 pb-1">Received By</p>
                                        <p className="font-medium">{viewGRN.received_by_name || 'Storekeeper'}</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-xs font-bold uppercase text-stone-400">Received Items & Inspection</p>
                                    <div className="overflow-hidden rounded-lg border border-stone-100">
                                        <table className="w-full text-xs">
                                            <thead className="bg-stone-50 text-stone-500">
                                                <tr>
                                                    <th className="px-3 py-2 text-left">Item Name</th>
                                                    <th className="px-3 py-2 text-right">Ordered</th>
                                                    <th className="px-3 py-2 text-right">Received</th>
                                                    <th className="px-3 py-2 text-center">Condition</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {viewGRN.items?.map((item, idx) => (
                                                    <tr key={idx} className="border-t border-stone-50">
                                                        <td className="px-3 py-2 font-medium">{item.item_name}</td>
                                                        <td className="px-3 py-2 text-right text-stone-400 font-mono">{item.quantity_ordered}</td>
                                                        <td className="px-3 py-2 text-right font-bold text-stone-700 font-mono">{item.quantity_received}</td>
                                                        <td className="px-3 py-2 text-center">
                                                            <IOSBadge variant="light" color={item.condition_status === 'good' ? 'success' : 'danger'} className="text-[9px] py-0 px-1 border-none">
                                                                {item.condition_status}
                                                            </IOSBadge>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-4 border-t border-stone-100">
                                    <IOSButton variant="secondary" onClick={() => setIsViewOpen(false)} className="h-9 px-4 text-xs font-medium">Close</IOSButton>
                                    {viewGRN.status === 'pending_review' && (user?.role === UserRole.AUDITOR || user?.role === UserRole.SUPER_ADMIN) && (
                                        <IOSButton onClick={() => handleApprove(viewGRN.id)} className="h-9 px-4 text-xs flex-1 font-medium" leftIcon={<PackageSearch size={14} />}>Approve & Update Stock</IOSButton>
                                    )}
                                    {viewGRN.status === 'approved' && (
                                        <div className="flex-1 flex justify-end">
                                            <IOSBadge variant="light" color="success" className="h-8 flex items-center px-3 border-none gap-2"><CheckCircle2 size={14} /> Inventory Updated</IOSBadge>
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
