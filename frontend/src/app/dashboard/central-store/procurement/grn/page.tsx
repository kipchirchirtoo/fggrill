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
import { PackageSearch, Plus, Search, RefreshCw, Eye, CheckCircle2, AlertTriangle, ClipboardCheck, Truck, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface GRNItem {
    id?: string;
    item_id: string;
    item: { name: string; item_code: string; unit: string };
    quantity_ordered: number;
    quantity_received: number;
    quantity_accepted: number;
    quantity_rejected: number;
    unit_price: number;
    total_value: number;
}

interface GRN {
    id: string;
    grn_number: string;
    po_id?: string;
    purchase_order?: { po_number: string };
    supplier: { name: string; supplier_code: string };
    grn_date: string;
    status: 'draft' | 'pending_review' | 'completed' | 'rejected' | 'approved';
    total_items: number;
    total_quantity: number;
    total_value: number;
    received_by_user?: { first_name: string; last_name: string };
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
            if (response.success) setGrns(response.data || []);
        } catch (error) { console.error('Error fetching GRNs:', error); }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchGRNs(); }, [fetchGRNs]);

    const handleApprove = async (id: string) => {
        if (!confirm('Approve this GRN? This will update inventory levels.')) return;
        try {
            const res = await procurementAPI.approveGRN(id);
            if (res.success) {
                toast.success('GRN Approved & Inventory Updated');
                fetchGRNs();
                setIsViewOpen(false);
            } else {
                toast.error(res.message || 'Failed to approve');
            }
        } catch (error: any) { toast.error(error.message || 'Failed to approve'); }
    };

    const filteredGRNs = grns.filter(grn =>
        grn.grn_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (grn.purchase_order?.po_number && grn.purchase_order.po_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
        grn.supplier?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed':
            case 'approved': return 'success';
            case 'pending_review': return 'warning';
            case 'draft': return 'secondary';
            case 'rejected': return 'danger';
            default: return 'secondary';
        }
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-[#1C1C1E] tracking-tight">Goods Received (GRN)</h1>
                            <p className="text-[#8E8E93] text-sm">Record and verify incoming shipments</p>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton variant="secondary" onClick={fetchGRNs} leftIcon={<RefreshCw size={16} />}>Refresh</IOSButton>
                            {(user?.role === UserRole.CENTRAL_STOREKEEPER || user?.role === UserRole.SUPER_ADMIN) && (
                                <IOSButton onClick={() => window.location.href = '/dashboard/central-store/receiving'} leftIcon={<Plus size={16} />}>Record Receipt</IOSButton>
                            )}
                        </div>
                    </div>

                    <IOSCard className="p-4 border-none shadow-sm bg-white/80 backdrop-blur-md">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8E8E93]" />
                            <Input
                                placeholder="Search by GRN #, PO # or Supplier..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-10 bg-[#F2F2F7] border-none rounded-ios-lg focus-visible:ring-1 focus-visible:ring-amber-500"
                            />
                        </div>
                    </IOSCard>

                    {isLoading ? (
                        <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-amber-500" /></div>
                    ) : filteredGRNs.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-ios-xl border border-stone-100 italic text-stone-400">No goods receipts found</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredGRNs.map(grn => (
                                <IOSCard key={grn.id} className="p-4 hover:shadow-md transition-all cursor-pointer border-none bg-white" onClick={async () => {
                                    try {
                                        const res = await procurementAPI.getGRN(grn.id);
                                        if (res.success) {
                                            setViewGRN(res.data);
                                            setIsViewOpen(true);
                                        }
                                    } catch (e) { toast.error('Failed to load details'); }
                                }}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <p className="font-mono text-xs font-bold text-amber-600">{grn.grn_number}</p>
                                            <p className="font-semibold text-stone-800 line-clamp-1">{grn.supplier?.name}</p>
                                        </div>
                                        <IOSBadge variant="light" color={getStatusColor(grn.status)} className="capitalize text-[10px]">
                                            {grn.status.replace('_', ' ')}
                                        </IOSBadge>
                                    </div>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between text-stone-500">
                                            <span className="flex items-center gap-1"><Truck size={12} /> PO:</span>
                                            <span className="font-mono text-[10px]">{grn.purchase_order?.po_number || 'Direct Receipt'}</span>
                                        </div>
                                        <div className="flex justify-between text-stone-500">
                                            <span className="flex items-center gap-1"><Calendar size={12} /> Date:</span>
                                            <span>{new Date(grn.grn_date).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex justify-between font-bold text-stone-900 border-t border-stone-50 pt-2">
                                            <span>Total Value:</span>
                                            <span>KES {grn.total_value.toLocaleString()}</span>
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
                                    <DialogTitle className="text-xl font-bold tracking-tight">GRN Details: {viewGRN?.grn_number}</DialogTitle>
                                    <DialogDescription className="text-stone-500">Received from {viewGRN?.supplier?.name}</DialogDescription>
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
                                <div className="grid grid-cols-3 gap-4 text-[10px] bg-[#F2F2F7] p-4 rounded-ios-xl">
                                    <div className="space-y-1">
                                        <p className="text-stone-400 font-bold uppercase tracking-widest">Delivery Details</p>
                                        <div className="flex items-center gap-2"><Truck size={14} className="text-amber-500" /> <span className="font-bold text-stone-800">{new Date(viewGRN.grn_date).toLocaleDateString()}</span></div>
                                    </div>
                                    <div className="space-y-1 border-l border-stone-200 pl-4">
                                        <p className="text-stone-400 font-bold uppercase tracking-widest">PO Reference</p>
                                        <div className="flex items-center gap-2 font-mono text-stone-800 font-bold">{viewGRN.purchase_order?.po_number || 'Direct receipt'}</div>
                                    </div>
                                    <div className="space-y-1 border-l border-stone-200 pl-4">
                                        <p className="text-stone-400 font-bold uppercase tracking-widest">Received By</p>
                                        <p className="font-bold text-stone-800">{viewGRN.received_by_user ? `${viewGRN.received_by_user.first_name} ${viewGRN.received_by_user.last_name}` : 'N/A'}</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Received Items & Inspection</p>
                                    <div className="overflow-hidden rounded-xl border border-stone-100">
                                        <table className="w-full text-xs">
                                            <thead className="bg-stone-50 text-stone-500 uppercase text-[9px] tracking-widest font-bold">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">Item Name</th>
                                                    <th className="px-3 py-3 text-right">Ordered</th>
                                                    <th className="px-3 py-3 text-right">Received</th>
                                                    <th className="px-3 py-3 text-right">Accepted</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-stone-50">
                                                {viewGRN.items?.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-stone-50/50">
                                                        <td className="px-4 py-3">
                                                            <div className="font-medium text-stone-800">{item.item?.name}</div>
                                                            <div className="text-[10px] text-stone-400 font-mono">{item.item?.item_code}</div>
                                                        </td>
                                                        <td className="px-3 py-3 text-right text-stone-400 font-mono">{item.quantity_ordered}</td>
                                                        <td className="px-3 py-3 text-right font-bold text-stone-700 font-mono">{item.quantity_received}</td>
                                                        <td className="px-3 py-3 text-right">
                                                            <IOSBadge variant="light" color={item.quantity_accepted === item.quantity_received ? 'success' : 'warning'} className="font-mono text-[10px] py-1">
                                                                {item.quantity_accepted}
                                                            </IOSBadge>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <IOSButton variant="secondary" onClick={() => setIsViewOpen(false)} className="flex-1 h-11 rounded-ios-lg">Close</IOSButton>
                                    {(viewGRN.status === 'draft' || viewGRN.status === 'pending_review') && (user?.role === UserRole.AUDITOR || user?.role === UserRole.SUPER_ADMIN) && (
                                        <IOSButton onClick={() => handleApprove(viewGRN.id)} className="flex-[2] h-11 rounded-ios-lg shadow-amber-200 shadow-lg" leftIcon={<PackageSearch size={18} />}>Approve & Update Stock</IOSButton>
                                    )}
                                    {(viewGRN.status === 'completed' || viewGRN.status === 'approved') && (
                                        <div className="flex-[2] flex items-center justify-center gap-2 bg-green-50 text-green-600 rounded-ios-lg font-bold text-sm">
                                            <CheckCircle2 size={18} /> Inventory Updated
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
