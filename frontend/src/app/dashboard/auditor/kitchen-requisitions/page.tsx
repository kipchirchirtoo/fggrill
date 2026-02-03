'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import {
    Search, Filter, RefreshCw, Package, Eye,
    ArrowRight, ClipboardList, Clock, CheckCircle2,
    XCircle, AlertCircle, Trash2, FileText,
    Activity, ShieldCheck, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchSelector, useBranch } from '@/lib/branch-context';
import { UserRole } from '@/lib/auth-context';
import { toast } from 'sonner';

interface RequisitionItem {
    id: string;
    item_name: string;
    unit: string;
    quantity_requested: number;
    quantity_fulfilled?: number;
    approved_quantity?: number;
}

interface Requisition {
    id: string;
    requisition_number: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED' | 'PARTIALLY_FULFILLED';
    requested_by_name: string;
    request_date: string;
    needed_by_date?: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    reason?: string;
    items: RequisitionItem[];
    branch?: { name: string };
    branch_id: number;
}

export default function AuditorKitchenRequisitionsPage() {
    const { activeBranchId } = useBranch();
    const [requisitions, setRequisitions] = useState<Requisition[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    const fetchRequisitions = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.store.getKitchenRequisitions({
                branch_id: activeBranchId === 0 ? undefined : (activeBranchId ?? undefined),
                status: statusFilter !== 'all' ? statusFilter : undefined
            });
            if (res.success && Array.isArray(res.data)) {
                setRequisitions(res.data);
            } else {
                setRequisitions([]);
            }
        } catch (error) {
            console.error('Failed to fetch requisitions:', error);
            toast.error('Failed to load requisitions');
        } finally {
            setLoading(false);
        }
    }, [activeBranchId, statusFilter]);

    useEffect(() => {
        fetchRequisitions();
    }, [fetchRequisitions]);

    const handleViewDetails = (req: Requisition) => {
        setSelectedRequisition(req);
        setIsDetailsOpen(true);
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            PENDING: 'bg-amber-50 text-amber-600 border-amber-100',
            APPROVED: 'bg-blue-50 text-blue-600 border-blue-100',
            REJECTED: 'bg-rose-50 text-rose-600 border-rose-100',
            FULFILLED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
            PARTIALLY_FULFILLED: 'bg-teal-50 text-teal-600 border-teal-100'
        };
        const style = styles[status] || 'bg-stone-50 text-stone-600 border-stone-100';
        return (
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-wider ${style}`}>
                {status.replace('_', ' ')}
            </span>
        );
    };

    const filteredRequisitions = requisitions.filter(req =>
        (req.requisition_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.branch?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-8 pb-10">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Activity className="h-4 w-4 text-stone-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Stock Requisitions</span>
                            </div>
                            <h1 className="text-2xl font-black text-stone-900 tracking-tight leading-none">Kitchen Requisitions</h1>
                            <p className="text-stone-500 text-sm mt-2 font-medium">Monitoring inventory movement and replenishment requests</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-xl px-4 py-2 shadow-sm">
                                <Search className="h-4 w-4 text-stone-400" />
                                <input
                                    type="text"
                                    placeholder="Search requisitions..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="text-sm font-bold text-stone-700 outline-none w-40"
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm font-bold text-stone-700 shadow-sm outline-none"
                            >
                                <option value="all">All Status</option>
                                <option value="PENDING">Pending</option>
                                <option value="APPROVED">Approved</option>
                                <option value="FULFILLED">Fulfilled</option>
                                <option value="REJECTED">Rejected</option>
                            </select>
                            <BranchSelector />
                            <button onClick={fetchRequisitions} className="p-2.5 bg-stone-900 rounded-xl hover:bg-stone-800 transition-colors shadow-sm">
                                <RefreshCw className={`h-4 w-4 text-white ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="card-elevated p-6 bg-stone-900 text-white shadow-xl shadow-stone-200/50 flex flex-col justify-between min-h-[140px]">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Total Requests</p>
                                <h3 className="text-2xl font-black italic">{requisitions.length} <span className="text-xs font-bold text-stone-400">entries</span></h3>
                            </div>
                            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest text-opacity-50">Branch Aggregates</span>
                                <ShieldCheck className="h-4 w-4 text-stone-400" />
                            </div>
                        </div>
                        <div className="card-elevated p-6 bg-white border border-stone-100 flex flex-col justify-between min-h-[140px]">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Pending Review</p>
                                <h3 className={`text-2xl font-black ${requisitions.filter(r => r.status === 'PENDING').length > 0 ? 'text-amber-500' : 'text-stone-300'}`}>
                                    {requisitions.filter(r => r.status === 'PENDING').length}
                                </h3>
                            </div>
                            <p className="text-[11px] text-stone-400 font-medium">Awaiting auditor or store approval</p>
                        </div>
                        <div className="card-elevated p-6 bg-white border border-stone-100 flex flex-col justify-between min-h-[140px]">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Active Branches</p>
                                <h3 className="text-2xl font-black text-stone-900">
                                    {new Set(requisitions.map(r => r.branch_id)).size}
                                </h3>
                            </div>
                            <p className="text-[11px] text-stone-400 font-medium leading-tight">Requesting units across the organization</p>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="card-elevated p-0 bg-white shadow-xl shadow-stone-200/50 overflow-hidden border border-stone-100/50">
                        <div className="p-6 border-b border-stone-50 bg-stone-50/20 flex items-center justify-between">
                            <h3 className="text-[16px] font-black text-stone-900 flex items-center gap-2">
                                <Package className="h-4 w-4 text-stone-400" />
                                Requisition Registry
                            </h3>
                            <div className="flex items-center gap-1.5 bg-stone-100 rounded-lg px-3 py-1">
                                <Clock className="h-3 w-3 text-stone-400" />
                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Real-time Feed</span>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-stone-50/50 text-[10px] font-black uppercase tracking-widest text-stone-400 border-b border-stone-100">
                                    <tr>
                                        <th className="px-6 py-4">Requisition ID</th>
                                        <th className="px-6 py-4">Branch Unit</th>
                                        <th className="px-6 py-4">Request Date</th>
                                        <th className="px-6 py-4">Items Count</th>
                                        <th className="px-6 py-4">Priority</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-20 text-center">
                                                <RefreshCw className="h-8 w-8 animate-spin text-stone-200 mx-auto" />
                                            </td>
                                        </tr>
                                    ) : filteredRequisitions.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-32 text-center text-stone-300">
                                                <div className="flex flex-col items-center gap-4">
                                                    <ClipboardList className="h-12 w-12 opacity-10" />
                                                    <span className="text-sm italic">No requisition records found</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRequisitions.map((req) => (
                                            <tr key={req.id} className="hover:bg-stone-50/30 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <span className="text-[13px] font-black text-stone-900 font-mono tracking-tighter">{req.requisition_number}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[13px] font-bold text-stone-900">{req.branch?.name || `Branch #${req.branch_id}`}</span>
                                                        <span className="text-[10px] text-stone-400 font-medium uppercase tracking-tighter">By {req.requested_by_name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-[12px] font-bold text-stone-600">{format(new Date(req.request_date), 'MMM dd, yyyy')}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-[12px] font-black text-stone-400 uppercase tracking-widest bg-stone-50 px-2 py-1 rounded">
                                                        {req.items.length} SKUs
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[10px] font-black uppercase tracking-tight ${req.priority === 'URGENT' ? 'text-rose-600 animate-pulse' :
                                                            req.priority === 'HIGH' ? 'text-amber-600' : 'text-stone-400'
                                                        }`}>
                                                        {req.priority}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {getStatusBadge(req.status)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => handleViewDetails(req)}
                                                        className="p-2 text-stone-300 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-all"
                                                    >
                                                        <ChevronRight className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                    <DialogContent className="max-w-3xl bg-white rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
                        <div className="bg-stone-900 p-8 text-white relative">
                            <DialogHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-white/10 rounded-xl">
                                        <ClipboardList className="h-5 w-5 text-stone-300" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-500">Inventory Request</span>
                                        <DialogTitle className="text-2xl font-black tracking-tight">{selectedRequisition?.requisition_number}</DialogTitle>
                                    </div>
                                </div>
                                <DialogDescription className="text-stone-400 font-medium mt-1">
                                    Unit: {selectedRequisition?.branch?.name} • Issued By: {selectedRequisition?.requested_by_name}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="absolute top-8 right-8">
                                {selectedRequisition && getStatusBadge(selectedRequisition.status)}
                            </div>
                        </div>

                        <div className="p-8">
                            <div className="grid grid-cols-2 gap-8 mb-8">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Reason for Request</p>
                                    <p className="text-sm font-bold text-stone-700 leading-relaxed bg-stone-50 p-4 rounded-2xl border border-stone-100">
                                        {selectedRequisition?.reason || 'No specific reason provided for this stock call.'}
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Priority Level</p>
                                        <span className="text-xs font-black text-stone-900 bg-stone-100 px-3 py-1.5 rounded-lg uppercase tracking-widest border border-stone-200/50">
                                            {selectedRequisition?.priority}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Needed By</p>
                                        <span className="text-xs font-bold text-stone-600 flex items-center gap-2">
                                            <Clock className="h-3 w-3" />
                                            {selectedRequisition?.needed_by_date ? format(new Date(selectedRequisition.needed_by_date), 'MMM dd, yyyy') : 'No specific deadline'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="card-elevated p-0 border border-stone-100 bg-stone-50/30 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-stone-50 text-[10px] font-black uppercase tracking-widest text-stone-400 border-b border-stone-100">
                                        <tr>
                                            <th className="px-6 py-4">Product Descriptor</th>
                                            <th className="px-6 py-4 text-center">Unit</th>
                                            <th className="px-6 py-4 text-right">Requested</th>
                                            <th className="px-6 py-4 text-right">Fullfilled</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100 bg-white">
                                        {selectedRequisition?.items.map((item) => (
                                            <tr key={item.id} className="hover:bg-stone-50/50 transition-colors">
                                                <td className="px-6 py-4 font-black text-stone-800 tracking-tight">{item.item_name}</td>
                                                <td className="px-6 py-4 text-center text-[10px] font-black text-stone-400 uppercase tracking-widest">{item.unit}</td>
                                                <td className="px-6 py-4 text-right font-bold text-stone-900">{item.quantity_requested}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`font-black ${item.quantity_fulfilled && item.quantity_fulfilled >= item.quantity_requested ? 'text-emerald-600' : 'text-stone-300'}`}>
                                                        {item.quantity_fulfilled || 0}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-8 flex justify-end gap-3">
                                <button
                                    onClick={() => setIsDetailsOpen(false)}
                                    className="px-6 py-2.5 bg-stone-100 text-stone-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-200 transition-colors"
                                >
                                    Close View
                                </button>
                                {selectedRequisition?.status === 'PENDING' && (
                                    <button
                                        onClick={() => {
                                            toast.info("Audit approval function pending integration");
                                        }}
                                        className="px-6 py-2.5 bg-stone-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-800 transition-all flex items-center gap-2"
                                    >
                                        Auditor Sign-off <ArrowRight className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
