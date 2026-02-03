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
                    <div className="page-header flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-stone-900 flex items-center justify-center text-white shadow-lg">
                                <Activity className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="page-title text-stone-900">Kitchen Requisitions</h1>
                                <p className="page-subtitle">Monitoring inventory movement and replenishment requests</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-2 bg-stone-100/50 border border-stone-200 rounded-xl px-3 py-1.5 shadow-sm h-10">
                                <Search className="h-3.5 w-3.5 text-stone-400" />
                                <input
                                    type="text"
                                    placeholder="Search requisitions..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="text-[12px] font-semibold text-stone-700 bg-transparent outline-none w-40"
                                />
                            </div>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-stone-100/50 border border-stone-200 rounded-xl px-3 py-1.5 text-[12px] font-semibold text-stone-700 shadow-sm outline-none h-10"
                            >
                                <option value="all">All Status</option>
                                <option value="PENDING">Pending</option>
                                <option value="APPROVED">Approved</option>
                                <option value="FULFILLED">Fulfilled</option>
                                <option value="REJECTED">Rejected</option>
                            </select>
                            <BranchSelector />
                            <button onClick={fetchRequisitions} className="btn-primary">
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="stat-card bg-stone-900 border-none shadow-xl shadow-stone-900/10">
                            <div className="stat-icon bg-white/10 text-white border-none">
                                <ClipboardList className="h-5 w-5" />
                            </div>
                            <p className="stat-value text-white">{requisitions.length}</p>
                            <p className="stat-label text-stone-400">Total Requests</p>
                        </div>
                        <div className="stat-card">
                            <div className={`stat-icon ${requisitions.filter(r => r.status === 'PENDING').length > 0 ? 'bg-amber-50 text-amber-500' : 'bg-stone-50 text-stone-400'}`}>
                                <Clock className="h-5 w-5" />
                            </div>
                            <p className={`stat-value ${requisitions.filter(r => r.status === 'PENDING').length > 0 ? 'text-amber-600' : 'text-stone-900'}`}>{requisitions.filter(r => r.status === 'PENDING').length}</p>
                            <p className="stat-label">Pending Review</p>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon bg-stone-50 text-stone-500">
                                <ShieldCheck className="h-5 w-5" />
                            </div>
                            <p className="stat-value">{new Set(requisitions.map(r => r.branch_id)).size}</p>
                            <p className="stat-label">Active Branches</p>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="table-container shadow-sm border border-stone-100">
                        <div className="section-header p-5 border-b border-stone-100">
                            <div>
                                <h2 className="section-title">Requisition Registry</h2>
                                <p className="section-subtitle">Real-time monitoring of replenishment requests across branches</p>
                            </div>
                        </div>
                        <div className="table-responsive">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="table-header">
                                        <th className="table-header-cell">Reference</th>
                                        <th className="table-header-cell">Branch Unit</th>
                                        <th className="table-header-cell">Date</th>
                                        <th className="table-header-cell">Items</th>
                                        <th className="table-header-cell">Priority</th>
                                        <th className="table-header-cell text-center">Status</th>
                                        <th className="table-header-cell"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center gap-2 opacity-50">
                                                    <RefreshCw className="h-6 w-6 animate-spin text-stone-300" />
                                                    <span className="text-[11px] font-black uppercase tracking-widest text-stone-400">Syncing requisitions...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredRequisitions.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-32 text-center text-stone-300">
                                                <div className="flex flex-col items-center gap-4">
                                                    <ClipboardList className="h-12 w-12 opacity-10" />
                                                    <span className="text-[11px] font-black uppercase tracking-widest">No requisition records</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRequisitions.map((req) => (
                                            <tr key={req.id} className="table-row group">
                                                <td className="table-cell">
                                                    <span className="font-mono font-bold text-stone-900 tracking-tight">{req.requisition_number}</span>
                                                </td>
                                                <td className="table-cell">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-stone-900">{req.branch?.name || `Branch #${req.branch_id}`}</span>
                                                        <span className="text-[10px] text-stone-400 font-semibold uppercase tracking-tighter">By {req.requested_by_name}</span>
                                                    </div>
                                                </td>
                                                <td className="table-cell font-semibold text-stone-600">
                                                    {format(new Date(req.request_date), 'MMM dd, yyyy')}
                                                </td>
                                                <td className="table-cell">
                                                    <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest bg-stone-100 px-2 py-1 rounded-lg">
                                                        {req.items.length} Items
                                                    </span>
                                                </td>
                                                <td className="table-cell">
                                                    <span className={`text-[10px] font-black uppercase tracking-tight ${req.priority === 'URGENT' ? 'text-rose-600 shadow-sm shadow-rose-100' :
                                                        req.priority === 'HIGH' ? 'text-amber-600' : 'text-stone-400'
                                                        }`}>
                                                        {req.priority}
                                                    </span>
                                                </td>
                                                <td className="table-cell text-center">
                                                    <span className={
                                                        req.status === 'FULFILLED' ? 'badge-success' :
                                                            req.status === 'APPROVED' ? 'badge-info' :
                                                                req.status === 'PENDING' ? 'badge-warning' :
                                                                    'badge-danger'
                                                    }>
                                                        {req.status}
                                                    </span>
                                                </td>
                                                <td className="table-cell text-right">
                                                    <button
                                                        onClick={() => handleViewDetails(req)}
                                                        className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors text-stone-400"
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
                                <div className="flex items-center gap-4 mb-2">
                                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0 border border-white/5">
                                        <ClipboardList className="h-6 w-6" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-500">Inventory Call</span>
                                        <DialogTitle className="text-2xl font-black tracking-tight">{selectedRequisition?.requisition_number}</DialogTitle>
                                    </div>
                                </div>
                                <DialogDescription className="text-stone-400 font-semibold mt-1">
                                    {selectedRequisition?.branch?.name} • Issued By {selectedRequisition?.requested_by_name}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="absolute top-8 right-8">
                                {selectedRequisition && getStatusBadge(selectedRequisition.status)}
                            </div>
                        </div>

                        <div className="p-8">
                            <div className="grid grid-cols-2 gap-8 mb-8">
                                <div className="space-y-4">
                                    <p className="caption uppercase tracking-[0.2em]">Request Authority</p>
                                    <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                                        <p className="text-[13px] font-bold text-stone-700 leading-relaxed italic">
                                            "{selectedRequisition?.reason || 'Standard operational replenishment request.'}"
                                        </p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="caption uppercase tracking-widest">Urgency</p>
                                        <div className={`text-[11px] font-black uppercase ${selectedRequisition?.priority === 'URGENT' ? 'text-rose-600' : 'text-stone-900'}`}>
                                            {selectedRequisition?.priority}
                                        </div>
                                    </div>
                                    <div className="space-y-1 text-right">
                                        <p className="caption uppercase tracking-widest">Fulfillment</p>
                                        <div className="text-[11px] font-black text-stone-900">
                                            {selectedRequisition?.needed_by_date ? format(new Date(selectedRequisition.needed_by_date), 'MMM dd') : '--'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="table-container shadow-sm border border-stone-100 overflow-hidden">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="table-header">
                                            <th className="table-header-cell">Item Descriptor</th>
                                            <th className="table-header-cell text-center">Unit</th>
                                            <th className="table-header-cell text-right">Requested</th>
                                            <th className="table-header-cell text-right">Fullfilled</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-50">
                                        {selectedRequisition?.items.map((item) => (
                                            <tr key={item.id} className="table-row">
                                                <td className="table-cell font-bold text-stone-800">{item.item_name}</td>
                                                <td className="table-cell text-center">
                                                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{item.unit}</span>
                                                </td>
                                                <td className="table-cell text-right font-bold text-stone-900">{item.quantity_requested}</td>
                                                <td className="table-cell text-right">
                                                    <span className={`font-black ${item.quantity_fulfilled && item.quantity_fulfilled >= item.quantity_requested ? 'text-emerald-600' : 'text-stone-300'}`}>
                                                        {item.quantity_fulfilled || 0}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-stone-100">
                                <button
                                    onClick={() => setIsDetailsOpen(false)}
                                    className="btn-secondary"
                                >
                                    Dismiss
                                </button>
                                {selectedRequisition?.status === 'PENDING' && (
                                    <button
                                        onClick={() => {
                                            toast.info("Auditor sign-off logic in development");
                                        }}
                                        className="btn-primary"
                                    >
                                        Authorize Movement
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
