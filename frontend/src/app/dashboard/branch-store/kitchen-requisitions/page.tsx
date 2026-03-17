'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Check, X, Search, Filter, Loader2, Package, ArrowLeft, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { UserRole } from '@/lib/auth-context';

interface RequisitionItem {
    id: string;
    item_sku: string;
    item_name: string;
    unit_of_measure: string;
    requested_quantity: number;
    approved_quantity?: number;
    issued_quantity?: number;
}

interface Requisition {
    id: string;
    requisition_number: string;
    status: string;
    priority: string;
    reason?: string;
    requested_at: string;
    items: RequisitionItem[];
    rejection_reason?: string;
}

const STATUS_STYLES: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    APPROVED: 'bg-blue-100 text-blue-700',
    FULFILLED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
};

const PRIORITY_STYLES: Record<string, string> = {
    URGENT: 'text-red-600 font-bold',
    HIGH: 'text-orange-600 font-bold',
    NORMAL: 'text-stone-600',
    LOW: 'text-stone-400',
};

export default function KitchenRequisitionsPage() {
    const [requisitions, setRequisitions] = useState<Requisition[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');

    const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);
    const [fulfillmentQtys, setFulfillmentQtys] = useState<Record<string, number>>({});
    const [isFulfillOpen, setIsFulfillOpen] = useState(false);
    const [isRejectOpen, setIsRejectOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { fetchRequisitions(); }, [statusFilter]);

    const fetchRequisitions = async () => {
        setLoading(true);
        try {
            const res = await api.store.getKitchenRequisitions({
                status: statusFilter !== 'ALL' ? statusFilter : undefined
            }) as any;
            setRequisitions(res?.data || []);
        } catch (e) {
            toast.error('Failed to load requisitions');
        } finally {
            setLoading(false);
        }
    };

    const openFulfill = (req: Requisition) => {
        setSelectedRequisition(req);
        const qtys: Record<string, number> = {};
        req.items.forEach(i => { qtys[i.id] = i.approved_quantity ?? i.requested_quantity; });
        setFulfillmentQtys(qtys);
        setIsFulfillOpen(true);
    };

    const openReject = (req: Requisition) => {
        setSelectedRequisition(req);
        setRejectionReason('');
        setIsRejectOpen(true);
    };

    const handleFulfill = async () => {
        if (!selectedRequisition) return;
        setSubmitting(true);
        try {
            const issued_quantities = selectedRequisition.items.map(item => ({
                item_id: item.id,
                issued_quantity: fulfillmentQtys[item.id] ?? 0,
            }));
            await api.store.fulfillKitchenRequisition(selectedRequisition.id, issued_quantities);
            toast.success('Requisition fulfilled');
            setIsFulfillOpen(false);
            fetchRequisitions();
        } catch (e: any) {
            toast.error(e?.message || 'Failed to fulfill');
        } finally {
            setSubmitting(false);
        }
    };

    const handleReject = async () => {
        if (!selectedRequisition || !rejectionReason.trim()) {
            toast.error('Please provide a rejection reason');
            return;
        }
        setSubmitting(true);
        try {
            await api.store.rejectKitchenRequisition(selectedRequisition.id, rejectionReason);
            toast.success('Requisition rejected');
            setIsRejectOpen(false);
            fetchRequisitions();
        } catch (e: any) {
            toast.error(e?.message || 'Failed to reject');
        } finally {
            setSubmitting(false);
        }
    };

    const filtered = requisitions.filter(r =>
        (statusFilter === 'ALL' || r.status === statusFilter) &&
        (r.requisition_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.reason || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard/branch-store">
                                <button className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-500 hover:text-stone-900">
                                    <ArrowLeft className="h-5 w-5" />
                                </button>
                            </Link>
                            <div>
                                <h1 className="page-title">Department Requisitions</h1>
                                <p className="page-subtitle">Issue stock to kitchen and other departments</p>
                            </div>
                        </div>
                        <button onClick={fetchRequisitions} disabled={loading} className="btn-secondary self-start sm:self-auto">
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            <span>Refresh</span>
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="card-elevated p-4 flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                            <input
                                placeholder="Search by requisition no. or reason..."
                                className="input-field pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto">
                            <Filter className="h-4 w-4 text-stone-400 shrink-0" />
                            {['ALL', 'PENDING', 'APPROVED', 'FULFILLED', 'REJECTED'].map(s => (
                                <button
                                    key={s}
                                    onClick={() => setStatusFilter(s)}
                                    className={`px-3 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${statusFilter === s ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                                >
                                    {s === 'ALL' ? 'All' : s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="card-elevated overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-stone-50 border-b border-stone-100">
                                    <tr>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Req No.</th>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Date</th>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Priority</th>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Reason</th>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Status</th>
                                        <th className="px-5 py-3 text-right text-[11px] font-bold text-stone-500 uppercase">Items</th>
                                        <th className="px-5 py-3 text-right text-[11px] font-bold text-stone-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {loading ? (
                                        <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-stone-500"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></td></tr>
                                    ) : filtered.length === 0 ? (
                                        <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-stone-500">No requisitions found</td></tr>
                                    ) : filtered.map(req => (
                                        <tr key={req.id} className="hover:bg-stone-50/50 transition-colors">
                                            <td className="px-5 py-3 font-mono text-[13px] font-medium text-stone-900">{req.requisition_number}</td>
                                            <td className="px-5 py-3 text-[13px] text-stone-600">{new Date(req.requested_at).toLocaleDateString()}</td>
                                            <td className="px-5 py-3">
                                                <span className={`text-[11px] uppercase ${PRIORITY_STYLES[req.priority] || 'text-stone-500'}`}>{req.priority}</span>
                                            </td>
                                            <td className="px-5 py-3 text-[13px] text-stone-600 max-w-[200px] truncate">{req.reason || '-'}</td>
                                            <td className="px-5 py-3">
                                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${STATUS_STYLES[req.status] || 'bg-stone-100 text-stone-700'}`}>{req.status}</span>
                                            </td>
                                            <td className="px-5 py-3 text-right text-[13px] text-stone-600">{req.items?.length || 0}</td>
                                            <td className="px-5 py-3 text-right">
                                                {(req.status === 'PENDING' || req.status === 'APPROVED') && (
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => openReject(req)}
                                                            className="text-[12px] font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                                                        >
                                                            Reject
                                                        </button>
                                                        <button
                                                            onClick={() => openFulfill(req)}
                                                            className="text-[12px] font-medium text-white bg-stone-900 hover:bg-stone-700 px-3 py-1 rounded"
                                                        >
                                                            Issue Stock
                                                        </button>
                                                    </div>
                                                )}
                                                {req.status === 'FULFILLED' && (
                                                    <span className="text-[12px] text-green-600 font-medium">Issued</span>
                                                )}
                                                {req.status === 'REJECTED' && (
                                                    <span className="text-[12px] text-red-500 font-medium">Rejected</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Fulfill Modal */}
                <Dialog open={isFulfillOpen} onOpenChange={setIsFulfillOpen}>
                    <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 overflow-hidden">
                        <DialogHeader className="px-6 py-5 border-b border-stone-100 bg-stone-50/50">
                            <DialogTitle className="text-[17px] font-semibold text-stone-900">
                                Issue Stock — {selectedRequisition?.requisition_number}
                            </DialogTitle>
                            <DialogDescription className="text-stone-500 text-sm">
                                {selectedRequisition?.reason && `Reason: ${selectedRequisition.reason}`}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="overflow-y-auto flex-1 px-6 py-4">
                            <table className="w-full text-sm">
                                <thead className="bg-stone-50 border-b border-stone-100">
                                    <tr>
                                        <th className="py-2 text-left text-[11px] font-bold text-stone-500 uppercase">Item</th>
                                        <th className="py-2 text-left text-[11px] font-bold text-stone-500 uppercase">SKU</th>
                                        <th className="py-2 text-right text-[11px] font-bold text-stone-500 uppercase">Requested</th>
                                        <th className="py-2 text-right text-[11px] font-bold text-stone-500 uppercase w-28">Issue Qty</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {selectedRequisition?.items.map(item => (
                                        <tr key={item.id}>
                                            <td className="py-2.5 font-medium text-stone-900">{item.item_name}</td>
                                            <td className="py-2.5 text-stone-500 font-mono text-xs">{item.item_sku}</td>
                                            <td className="py-2.5 text-right text-stone-700">{item.requested_quantity} {item.unit_of_measure}</td>
                                            <td className="py-2.5 text-right">
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    className="w-24 text-right h-8 text-sm ml-auto"
                                                    value={fulfillmentQtys[item.id] ?? item.requested_quantity}
                                                    onChange={(e) => setFulfillmentQtys({
                                                        ...fulfillmentQtys,
                                                        [item.id]: parseFloat(e.target.value) || 0
                                                    })}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <DialogFooter className="px-6 py-4 border-t border-stone-100 bg-stone-50/50 flex gap-3">
                            <button className="btn-secondary flex-1" onClick={() => setIsFulfillOpen(false)}>Cancel</button>
                            <button className="btn-primary flex-1" onClick={handleFulfill} disabled={submitting}>
                                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                Confirm Issue
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Reject Modal */}
                <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Reject Requisition</DialogTitle>
                            <DialogDescription>Provide a reason — the requester will see this.</DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <label className="text-sm font-medium mb-2 block">Reason *</label>
                            <Input
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="e.g., Out of stock, duplicate request..."
                            />
                        </div>
                        <DialogFooter className="gap-2">
                            <button className="btn-secondary" onClick={() => setIsRejectOpen(false)}>Cancel</button>
                            <button
                                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                                onClick={handleReject}
                                disabled={submitting}
                            >
                                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                Reject
                            </button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
