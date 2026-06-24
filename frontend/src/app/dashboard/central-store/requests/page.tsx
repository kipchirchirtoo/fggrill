'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { storeAPI } from '@/lib/api';
import { ClipboardList, RefreshCw, Package, Clock, Building2, ChevronRight, CheckCircle2, AlertTriangle, Truck, Filter, X, Download } from 'lucide-react';
import { toast } from 'sonner';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { exportRequestsHistoryPDF } from '@/lib/dispatch-pdf';

interface RequestItem {
    id: string;
    item_sku: string;
    item_name: string;
    requested_quantity: number;
    approved_quantity: number;
    unit: string;
}

interface StockRequest {
    id: string;
    request_number: string;
    requesting_branch_id: number;
    branch_name: string;
    status: string;
    priority: string;
    created_at: string;
    review_notes?: string;
    items: RequestItem[];
}

export default function CentralRequestsPage() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<StockRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);
    const [reviewNotes, setReviewNotes] = useState('');
    const [approvedQuantities, setApprovedQuantities] = useState<Record<string, number>>({});
    const [isProcessing, setIsProcessing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const router = useRouter();

    const fetchRequests = useCallback(async () => {
        setIsLoading(true);
        try {
            // If status is 'all', we want active/unfulfilled requests
            const activeStatuses = ['PENDING', 'PENDING_BRANCH_ACCOUNTANT_APPROVAL', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'DISPATCHED'];
            const historyStatuses = ['DELIVERED', 'REJECTED', 'CANCELLED'];

            const isHistory = statusFilter === 'HISTORY';
            const filterToUse = (statusFilter === 'all' || isHistory) ? undefined : statusFilter;

            const response = await storeAPI.getBranchRequests(filterToUse);

            if (response.success) {
                let data = response.data || [];

                // If 'all' is selected, filter out fulfilled/past stuff
                if (statusFilter === 'all') {
                    data = data.filter((r: any) => activeStatuses.includes(r.status));
                }

                // If 'HISTORY' is selected, show only completed stuff
                if (isHistory) {
                    data = data.filter((r: any) => historyStatuses.includes(r.status));
                }

                // Ensure sorting is newest first
                data.sort((a: any, b: any) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );

                setRequests(data);
            }
        } catch (error) {
            console.error('Error:', error);
            toast.error('Failed to fetch requests');
        } finally {
            setIsLoading(false);
        }
    }, [statusFilter]);

    const handleExportHistory = async () => {
        if (requests.length === 0) { toast.error('No history records to export'); return; }
        setIsExporting(true);
        try {
            await exportRequestsHistoryPDF(requests);
            toast.success('History report downloaded successfully');
        } catch (e: any) {
            toast.error('Failed to generate PDF');
            console.error(e);
        } finally {
            setIsExporting(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const handleAction = async (action: 'APPROVE' | 'REJECT') => {
        if (!selectedRequest) return;
        setIsProcessing(true);
        try {
            const approvedItems = action === 'APPROVE'
                ? Object.entries(approvedQuantities).map(([id, qty]) => ({ id, approved_quantity: qty }))
                : [];

            const res = await storeAPI.reviewStockRequest(selectedRequest.id, {
                action,
                review_notes: reviewNotes,
                approved_items: approvedItems
            });
            if (res.success) {
                toast.success(`Request ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully`);
                setReviewNotes('');
                setSelectedRequest(null);
                fetchRequests();

                if (action === 'APPROVE') {
                    toast.info('Redirecting to Packing Station...');
                    setTimeout(() => {
                        router.push('/dashboard/central-store/packing');
                    }, 1500);
                }
            } else {
                toast.error(res.message || "Action failed");
            }
        } catch (error) {
            console.error('Error processing request:', error);
            toast.error("Failed to process request");
        } finally {
            setIsProcessing(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING':
            case 'PENDING_BRANCH_ACCOUNTANT_APPROVAL': return 'warning';
            case 'UNDER_REVIEW': return 'info';
            case 'APPROVED': return 'success';
            case 'PARTIALLY_APPROVED': return 'success';
            case 'REJECTED': return 'danger';
            case 'DISPATCHED': return 'info';
            case 'DELIVERED': return 'neutral';
            default: return 'neutral';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'PENDING':
            case 'PENDING_BRANCH_ACCOUNTANT_APPROVAL': return <Clock className="h-4 w-4" />;
            case 'APPROVED': return <CheckCircle2 className="h-4 w-4" />;
            case 'DISPATCHED': return <Truck className="h-4 w-4" />;
            case 'REJECTED': return <AlertTriangle className="h-4 w-4" />;
            default: return <ClipboardList className="h-4 w-4" />;
        }
    };

    return (
        <ProtectedRoute allowedRoles={[
            UserRole.CENTRAL_STOREKEEPER,
            UserRole.CENTRAL_OPERATIONS_MANAGER,
            UserRole.SUPER_ADMIN,
            UserRole.GENERAL_MANAGER,
            UserRole.BRANCH_ACCOUNTANT,
            UserRole.AUDITOR
        ]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Branch Requisitions</h1>
                            <p className="text-stone-500 mt-0.5">Monitor and track stock requests from all branches</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="flex p-1 bg-stone-100 rounded-lg overflow-x-auto max-w-[calc(100vw-40px)] no-scrollbar">
                                {['all', 'PENDING', 'PENDING_BRANCH_ACCOUNTANT_APPROVAL', 'APPROVED', 'DISPATCHED', 'HISTORY'].map((filter) => (
                                    <button
                                        key={filter}
                                        onClick={() => setStatusFilter(filter)}
                                        className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${statusFilter === filter
                                            ? 'bg-white text-stone-900 shadow-sm'
                                            : 'text-stone-400 hover:text-stone-600'
                                            }`}
                                    >
                                        {filter === 'PENDING_BRANCH_ACCOUNTANT_APPROVAL' ? 'Pending Accountant' : filter}
                                    </button>
                                ))}
                            </div>
                            {statusFilter === 'HISTORY' && (
                                <button
                                    onClick={handleExportHistory}
                                    disabled={isExporting || requests.length === 0}
                                    className="h-10 px-4 flex items-center gap-2 bg-stone-900 text-white text-[11px] font-bold rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isExporting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                    {isExporting ? 'Exporting...' : `Export PDF (${requests.length})`}
                                </button>
                            )}
                            <button onClick={fetchRequests} disabled={isLoading} className="btn-secondary h-10 px-3">
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <IOSCard className="p-4 bg-amber-50/50 border-amber-100">
                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Pending Review</p>
                            <p className="text-2xl font-bold text-amber-700 mt-1">
                                {requests.filter(r => r.status === 'PENDING').length}
                            </p>
                        </IOSCard>
                        <IOSCard className="p-4 bg-emerald-50/50 border-emerald-100">
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Approved</p>
                            <p className="text-2xl font-bold text-emerald-700 mt-1">
                                {requests.filter(r => r.status === 'APPROVED').length}
                            </p>
                        </IOSCard>
                        <IOSCard className="p-4 bg-blue-50/50 border-blue-100">
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">In Transit</p>
                            <p className="text-2xl font-bold text-blue-700 mt-1">
                                {requests.filter(r => r.status === 'DISPATCHED').length}
                            </p>
                        </IOSCard>
                        <IOSCard className="p-4 bg-stone-50 border-stone-100">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Total Monitored</p>
                            <p className="text-2xl font-bold text-stone-900 mt-1">{requests.length}</p>
                        </IOSCard>
                    </div>

                    {/* Request List */}
                    {isLoading ? (
                        <div className="py-20 text-center text-stone-300">Synchronizing requisitions...</div>
                    ) : requests.length === 0 ? (
                        <div className="bg-white border border-stone-100 p-24 text-center flex flex-col items-center rounded-lg">
                            <ClipboardList className="h-12 w-12 text-stone-100 mb-4" />
                            <h3 className="text-lg font-medium text-stone-400">No requests found</h3>
                            <p className="text-stone-300 text-sm">There are no requisitions matching your filter.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {requests.map((req) => (
                                <IOSCard
                                    key={req.id}
                                    className="p-0 overflow-hidden group hover:border-stone-300 transition-all cursor-pointer"
                                    onClick={() => {
                                        setSelectedRequest(req);
                                        // Initialize approved quantities with requested amounts
                                        const initialQuantities: Record<string, number> = {};
                                        req.items.forEach(item => {
                                            initialQuantities[item.id] = item.requested_quantity;
                                        });
                                        setApprovedQuantities(initialQuantities);
                                    }}
                                >
                                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-ios-lg bg-stone-100 flex items-center justify-center group-hover:bg-stone-200 transition-colors">
                                                <Building2 className="h-6 w-6 text-stone-500" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-stone-900">{req.request_number}</p>
                                                    <IOSBadge variant="light" color={getStatusColor(req.status) as any} className="text-[10px]">
                                                        <span className="flex items-center gap-1">
                                                            {getStatusIcon(req.status)}
                                                            {req.status}
                                                        </span>
                                                    </IOSBadge>
                                                </div>
                                                <p className="text-[13px] font-medium text-stone-600 mt-0.5 uppercase tracking-tight">{req.branch_name}</p>
                                                <p className="text-[11px] text-stone-400 mt-1 flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {new Date(req.created_at).toLocaleDateString()} at {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-none pt-4 md:pt-0">
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none mb-1">Line Items</p>
                                                <p className="text-xl font-bold text-stone-900">{req.items?.length || 0}</p>
                                            </div>
                                            <div className="text-right hidden sm:block">
                                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none mb-1">Priority</p>
                                                <p className={`text-[12px] font-bold ${req.priority === 'URGENT' ? 'text-rose-600' : 'text-stone-600'}`}>
                                                    {req.priority}
                                                </p>
                                            </div>
                                            <ChevronRight className="h-5 w-5 text-stone-300 group-hover:text-stone-900 group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </div>

                                    {/* Mini quick-view for items */}
                                    <div className="px-4 py-3 bg-stone-50/50 border-t border-stone-50 flex flex-wrap gap-2">
                                        {req.items?.slice(0, 3).map((item, i) => (
                                            <span key={i} className="text-[10px] bg-white border border-stone-100 px-2 py-0.5 rounded text-stone-500 font-medium">
                                                {item.item_name} ({item.requested_quantity})
                                            </span>
                                        ))}
                                        {req.items?.length > 3 && (
                                            <span className="text-[10px] text-stone-400 italic">
                                                + {req.items.length - 3} more...
                                            </span>
                                        )}
                                    </div>
                                </IOSCard>
                            ))}
                        </div>
                    )}
                </div>

                {/* Detail Modal */}
                {selectedRequest && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                        <IOSCard className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="bg-stone-50/80 px-6 py-4 border-b border-stone-100 flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-stone-900">Requisition Details</h2>
                                    <p className="text-xs text-stone-500">{selectedRequest.request_number} • {selectedRequest.branch_name}</p>
                                </div>
                                <button onClick={() => setSelectedRequest(null)} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
                                    <X className="h-5 w-5 text-stone-500" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Submission Date</p>
                                        <p className="text-sm font-semibold text-stone-900">
                                            {new Date(selectedRequest.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Current Status</p>
                                        <IOSBadge color={getStatusColor(selectedRequest.status) as any} variant="light">
                                            {selectedRequest.status}
                                        </IOSBadge>
                                    </div>
                                </div>

                                {selectedRequest.review_notes && (
                                    <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 italic">
                                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Auditor's Notes</p>
                                        <p className="text-sm text-amber-800">"{selectedRequest.review_notes}"</p>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Requested Items</p>
                                    <div className="overflow-hidden border border-stone-100 rounded-2xl">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-stone-50 border-b border-stone-100">
                                                <tr>
                                                    <th className="px-4 py-3 font-bold text-stone-500 text-[11px] uppercase">Item Description</th>
                                                    <th className="px-4 py-3 font-bold text-stone-500 text-[11px] uppercase text-right">Requested</th>
                                                    <th className="px-4 py-3 font-bold text-stone-500 text-[11px] uppercase text-right">Approved</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-stone-50">
                                                {selectedRequest.items.map((item, i) => (
                                                    <tr key={i} className="hover:bg-stone-50/50 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <p className="font-bold text-stone-800">{item.item_name}</p>
                                                            <p className="text-[10px] text-stone-400 font-mono">{item.item_sku}</p>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono font-bold text-stone-600">
                                                            {item.requested_quantity} {item.unit}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                                                            {(selectedRequest.status === 'PENDING' || selectedRequest.status === 'PENDING_BRANCH_ACCOUNTANT_APPROVAL') && user?.role !== UserRole.CENTRAL_STOREKEEPER ? (
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max={item.requested_quantity}
                                                                    className="w-20 px-2 py-1 text-right bg-emerald-50 border border-emerald-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                                    value={approvedQuantities[item.id] ?? item.requested_quantity}
                                                                    onChange={(e) => {
                                                                        const val = Math.max(0, Math.min(item.requested_quantity, parseInt(e.target.value) || 0));
                                                                        setApprovedQuantities(prev => ({ ...prev, [item.id]: val }));
                                                                    }}
                                                                />
                                                            ) : (
                                                                <span>{item.approved_quantity || '--'}</span>
                                                            )}
                                                            <span className="ml-1 text-xs font-normal text-stone-400">{item.unit}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {(selectedRequest.status === 'PENDING' || selectedRequest.status === 'PENDING_BRANCH_ACCOUNTANT_APPROVAL') && user?.role !== UserRole.CENTRAL_STOREKEEPER && (
                                    <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-2">Review Notes (Optional)</label>
                                        <textarea
                                            value={reviewNotes}
                                            onChange={(e) => setReviewNotes(e.target.value)}
                                            placeholder="Add notes for the branch..."
                                            className="w-full p-3 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-200 resize-none h-20"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="bg-stone-50/80 px-6 py-4 border-t border-stone-100 flex justify-end gap-3 font-medium">
                                {(selectedRequest.status === 'PENDING' || selectedRequest.status === 'PENDING_BRANCH_ACCOUNTANT_APPROVAL') && (
                                    user?.role === UserRole.CENTRAL_STOREKEEPER ? (
                                        <div className="flex items-center gap-2 text-amber-600 text-[13px] bg-amber-50 px-4 py-2 rounded-xl border border-amber-100">
                                            <Clock className="h-4 w-4" />
                                            <span>Awaiting Branch Accountant Approval</span>
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                disabled={isProcessing}
                                                onClick={() => handleAction('REJECT')}
                                                className="btn-secondary text-rose-600 hover:bg-rose-50 hover:border-rose-200 px-6"
                                            >
                                                Reject
                                            </button>
                                            <button
                                                disabled={isProcessing}
                                                onClick={() => handleAction('APPROVE')}
                                                className="btn-primary bg-stone-900 hover:bg-stone-800 px-6 flex items-center gap-2"
                                            >
                                                {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                                Approve Request
                                            </button>
                                        </>
                                    )
                                )}
                                {['APPROVED', 'PARTIALLY_APPROVED'].includes(selectedRequest.status) && (
                                    <button
                                        className="btn-primary bg-emerald-600 hover:bg-emerald-700 px-6"
                                        onClick={() => {
                                            toast.info("Opening Packing Station...");
                                            // Link to packing
                                            window.location.href = '/dashboard/central-store/packing';
                                        }}
                                    >
                                        Proceed to Packing
                                    </button>
                                )}
                                <button onClick={() => setSelectedRequest(null)} className="btn-secondary px-6">Close</button>
                            </div>
                        </IOSCard>
                    </div>
                )}
            </DashboardLayout>
        </ProtectedRoute>
    );
}
