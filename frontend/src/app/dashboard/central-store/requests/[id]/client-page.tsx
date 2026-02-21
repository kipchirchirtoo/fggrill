'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { storeAPI } from '@/lib/api';
import { ArrowLeft, RefreshCw, Package, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface StockRequest {
    id: string;
    request_number: string;
    request_type: string;
    priority: string;
    status: string;
    created_at: string;
    items: any[];
    review_notes?: string;
    reason?: string;
    requesting_branch?: any;
}

export default function CentralStoreRequestDetailClient() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [request, setRequest] = useState<StockRequest | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [reviewNotes, setReviewNotes] = useState('');
    const [itemApprovals, setItemApprovals] = useState<{ [key: string]: number }>({});

    const requestId = params.id as string;

    useEffect(() => {
        if (requestId) {
            fetchRequestDetails();
        }
    }, [requestId]);

    const fetchRequestDetails = async () => {
        setIsLoading(true);
        try {
            const response = await storeAPI.getStockRequests();
            if (response.success && response.data) {
                const foundRequest = response.data.find((r: StockRequest) => r.id === requestId);
                if (foundRequest) {
                    setRequest(foundRequest);
                    // Initialize item approvals with requested quantities
                    const approvals: { [key: string]: number } = {};
                    foundRequest.items?.forEach((item: any) => {
                        approvals[item.id] = item.requested_quantity;
                    });
                    setItemApprovals(approvals);
                } else {
                    toast.error('Request not found');
                    router.push('/dashboard/central-store/requests');
                }
            }
        } catch (error) {
            console.error('Error fetching request:', error);
            toast.error('Failed to load request details');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!request) return;
        try {
            await storeAPI.approveStockRequest(request.id, {
                item_approvals: Object.entries(itemApprovals).map(([itemId, quantity]) => ({
                    id: itemId,
                    approved_quantity: quantity
                }))
            });
            toast.success('Request approved successfully');
            setIsApproveModalOpen(false);
            fetchRequestDetails();
        } catch (error) {
            toast.error('Failed to approve request');
        }
    };

    const handleReject = async () => {
        if (!request) return;
        if (!reviewNotes.trim()) {
            toast.error('Please provide a reason for rejection');
            return;
        }
        try {
            await storeAPI.rejectStockRequest(request.id, { review_notes: reviewNotes });
            toast.success('Request rejected');
            setIsRejectModalOpen(false);
            fetchRequestDetails();
        } catch (error) {
            toast.error('Failed to reject request');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return 'warning';
            case 'APPROVED': return 'success';
            case 'REJECTED': return 'danger';
            case 'DISPATCHED': return 'info';
            case 'DELIVERED': return 'success';
            case 'RECEIVED': return 'success';
            default: return 'neutral';
        }
    };

    const canApproveOrReject = request?.status === 'PENDING' && [
        UserRole.CENTRAL_STOREKEEPER,
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER,
        UserRole.AUDITOR
    ].includes(user?.role as UserRole);

    return (
        <ProtectedRoute allowedRoles={[
            UserRole.CENTRAL_STOREKEEPER,
            UserRole.SUPER_ADMIN,
            UserRole.GENERAL_MANAGER,
            UserRole.AUDITOR
        ]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <IOSButton
                                variant="secondary"
                                onClick={() => router.push('/dashboard/central-store/requests')}
                                leftIcon={<ArrowLeft />}
                            >
                                Back
                            </IOSButton>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Request Details</h1>
                                <p className="text-gray-500">{request?.request_number || 'Loading...'}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton variant="secondary" onClick={fetchRequestDetails} leftIcon={<RefreshCw />}>
                                Refresh
                            </IOSButton>
                            {canApproveOrReject && (
                                <>
                                    <IOSButton
                                        variant="secondary"
                                        onClick={() => setIsRejectModalOpen(true)}
                                        leftIcon={<XCircle />}
                                        className="text-red-600 hover:bg-red-50"
                                    >
                                        Reject
                                    </IOSButton>
                                    <IOSButton
                                        onClick={() => setIsApproveModalOpen(true)}
                                        leftIcon={<CheckCircle />}
                                    >
                                        Approve
                                    </IOSButton>
                                </>
                            )}
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : !request ? (
                        <IOSCard className="p-12 text-center">
                            <AlertCircle className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                            <p className="text-gray-500">Request not found</p>
                        </IOSCard>
                    ) : (
                        <div className="space-y-6">
                            {/* Request Summary */}
                            <IOSCard className="p-6">
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Status</label>
                                        <div className="mt-2">
                                            <IOSBadge variant="light" color={getStatusColor(request.status) as any}>
                                                {request.status}
                                            </IOSBadge>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Branch</label>
                                        <p className="font-medium text-sm mt-2">{request.requesting_branch?.name || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Date Created</label>
                                        <p className="font-medium text-sm mt-2 flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-gray-400" />
                                            {new Date(request.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Priority</label>
                                        <p className="font-medium text-sm mt-2 capitalize">{request.priority?.toLowerCase()}</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Type</label>
                                        <p className="font-medium text-sm mt-2 capitalize">{request.request_type?.toLowerCase()}</p>
                                    </div>
                                </div>

                                {request.reason && (
                                    <div className="mt-6 pt-6 border-t border-gray-100">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Reason</label>
                                        <p className="text-sm text-gray-700 mt-2">{request.reason}</p>
                                    </div>
                                )}

                                {request.review_notes && (
                                    <div className="mt-6 pt-6 border-t border-gray-100">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Review Notes</label>
                                        <p className="text-sm text-gray-700 mt-2">{request.review_notes}</p>
                                    </div>
                                )}
                            </IOSCard>

                            {/* Items List */}
                            <IOSCard className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <Package className="h-5 w-5" />
                                        Requested Items ({request.items?.length || 0})
                                    </h2>
                                </div>

                                <div className="border border-gray-100 rounded-xl overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                            <tr>
                                                <th className="px-4 py-3">Item</th>
                                                <th className="px-4 py-3 text-right">Requested</th>
                                                <th className="px-4 py-3 text-right">Approved</th>
                                                <th className="px-4 py-3 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {request.items?.map((item: any) => (
                                                <tr key={item.id} className="hover:bg-gray-50/50">
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-gray-800">{item.item_name || item.item_sku}</p>
                                                        {item.rejection_reason && (
                                                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                                                <AlertCircle className="h-3 w-3" />
                                                                {item.rejection_reason}
                                                            </p>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono">{item.requested_quantity}</td>
                                                    <td className="px-4 py-3 text-right font-mono">
                                                        {['APPROVED', 'PARTIALLY_APPROVED', 'DELIVERED', 'RECEIVED'].includes(item.status) ? (
                                                            <span className="text-emerald-600 font-bold">{item.approved_quantity}</span>
                                                        ) : (
                                                            <span className="text-gray-300">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold uppercase ${item.status === 'APPROVED' || item.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-600' :
                                                                item.status === 'RECEIVED' ? 'bg-blue-50 text-blue-600' :
                                                                    item.status === 'REJECTED' ? 'bg-red-50 text-red-600' :
                                                                        'bg-amber-50 text-amber-600'
                                                            }`}>
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </IOSCard>
                        </div>
                    )}
                </div>

                {/* Approve Modal */}
                <Dialog open={isApproveModalOpen} onOpenChange={setIsApproveModalOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Approve Request</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">Review and adjust approved quantities for each item:</p>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {request?.items?.map((item: any) => (
                                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex-1">
                                            <p className="font-medium text-sm">{item.item_name || item.item_sku}</p>
                                            <p className="text-xs text-gray-500">Requested: {item.requested_quantity}</p>
                                        </div>
                                        <div className="w-24">
                                            <Input
                                                type="number"
                                                value={itemApprovals[item.id] || 0}
                                                onChange={(e) => setItemApprovals({
                                                    ...itemApprovals,
                                                    [item.id]: parseInt(e.target.value) || 0
                                                })}
                                                min="0"
                                                max={item.requested_quantity}
                                                className="text-right"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700">Review Notes (Optional)</label>
                                <Input
                                    value={reviewNotes}
                                    onChange={(e) => setReviewNotes(e.target.value)}
                                    placeholder="Add any notes about this approval..."
                                    className="mt-1"
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <IOSButton variant="secondary" onClick={() => setIsApproveModalOpen(false)}>
                                    Cancel
                                </IOSButton>
                                <IOSButton onClick={handleApprove}>
                                    Approve Request
                                </IOSButton>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Reject Modal */}
                <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Reject Request</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">Please provide a reason for rejecting this request:</p>
                            <Input
                                value={reviewNotes}
                                onChange={(e) => setReviewNotes(e.target.value)}
                                placeholder="Reason for rejection..."
                                required
                            />
                            <div className="flex gap-2 justify-end">
                                <IOSButton variant="secondary" onClick={() => setIsRejectModalOpen(false)}>
                                    Cancel
                                </IOSButton>
                                <IOSButton
                                    onClick={handleReject}
                                    className="bg-red-600 hover:bg-red-700"
                                >
                                    Reject Request
                                </IOSButton>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
