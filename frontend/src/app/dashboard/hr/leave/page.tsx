'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSBadge } from '@/components/ui/ios-badge';
import { staffAPI } from '@/lib/api';
import { Calendar, RefreshCw, Check, X, Clock, User, Building2, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface LeaveRequest {
    id: string;
    employee_name: string;
    employee_id: string;
    branch_name?: string;
    leave_type: string;
    start_date: string;
    end_date: string;
    days: number;
    reason?: string;
    status: 'pending' | 'approved' | 'rejected';
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-100' },
    approved: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-100' },
    rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-100' },
};

export default function HRLeaveRequestsPage() {
    const { user } = useAuth();
    const [requests, setRequests] = useState<LeaveRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('pending');

    const fetchRequests = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await staffAPI.getLeaveRequests({
                status: statusFilter !== 'all' ? statusFilter : undefined
            });
            if (response.success) setRequests(response.data || []);
        } catch (error) {
            console.error('Error fetching leave requests:', error);
            toast.error('Failed to load leave requests');
        } finally {
            setIsLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const handleApprove = async (id: string) => {
        try {
            await staffAPI.approveLeaveRequest(id);
            toast.success('Leave request approved');
            fetchRequests();
        } catch (error: any) {
            toast.error(error.message || 'Approval failed');
        }
    };

    const handleReject = async (id: string) => {
        const reason = prompt('Please enter a reason for rejection:');
        if (reason === null) return;

        try {
            await staffAPI.rejectLeaveRequest(id, reason);
            toast.success('Leave request rejected');
            fetchRequests();
        } catch (error: any) {
            toast.error(error.message || 'Rejection failed');
        }
    };

    const stats = {
        pending: requests.filter(r => r.status === 'pending').length,
        approved: requests.filter(r => r.status === 'approved').length,
        rejected: requests.filter(r => r.status === 'rejected').length
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.HR_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Leave Management</h1>
                            <p className="text-stone-500 mt-0.5">Review and process staff leave applications</p>
                        </div>
                        <IOSButton variant="secondary" onClick={fetchRequests} leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}>
                            Refresh
                        </IOSButton>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <IOSCard className="p-4 border-l-4 border-l-amber-500">
                            <Clock className="h-5 w-5 text-amber-600 mb-2" />
                            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Pending</p>
                            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                        </IOSCard>
                        <IOSCard className="p-4 border-l-4 border-l-emerald-500">
                            <Check className="h-5 w-5 text-emerald-600 mb-2" />
                            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Approved</p>
                            <p className="text-2xl font-bold text-emerald-600">{stats.approved}</p>
                        </IOSCard>
                        <IOSCard className="p-4 border-l-4 border-l-red-500">
                            <X className="h-5 w-5 text-red-600 mb-2" />
                            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Rejected</p>
                            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                        </IOSCard>
                    </div>

                    <div className="flex items-center gap-2 p-1.5 bg-stone-100 w-fit rounded-ios-xl">
                        {['all', 'pending', 'approved', 'rejected'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-4 py-1.5 text-[13px] font-semibold rounded-ios-lg transition-all ${statusFilter === status
                                        ? 'bg-white text-stone-900 shadow-sm'
                                        : 'text-stone-500 hover:text-stone-700'
                                    }`}
                            >
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                            </button>
                        ))}
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <RefreshCw className="h-8 w-8 animate-spin text-stone-300" />
                        </div>
                    ) : requests.length === 0 ? (
                        <IOSCard className="p-20 text-center">
                            <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-stone-100">
                                <Calendar className="h-8 w-8 text-stone-300" />
                            </div>
                            <h3 className="text-lg font-medium text-stone-900">No requests found</h3>
                            <p className="text-stone-500 mt-1">Status: {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}</p>
                        </IOSCard>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {requests.map((request) => {
                                const status = statusConfig[request.status];
                                return (
                                    <IOSCard key={request.id} className="p-5 flex flex-col h-full hover:shadow-md transition-shadow">
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center border border-stone-200">
                                                    <User className="h-6 w-6 text-stone-400" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-stone-900">{request.employee_name}</h3>
                                                    <p className="text-xs text-stone-500 font-medium">{request.leave_type} • {request.days} Days</p>
                                                </div>
                                            </div>
                                            <IOSBadge className={`${status.bg} ${status.color} border-none`}>{status.label}</IOSBadge>
                                        </div>

                                        <div className="bg-stone-50 rounded-ios-xl p-4 mb-4 flex-1">
                                            <div className="grid grid-cols-2 gap-4 mb-3">
                                                <div>
                                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">From</p>
                                                    <p className="text-[13px] font-semibold text-stone-700">{new Date(request.start_date).toLocaleDateString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">To</p>
                                                    <p className="text-[13px] font-semibold text-stone-700">{new Date(request.end_date).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            {request.reason && (
                                                <div>
                                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Reason</p>
                                                    <p className="text-[13px] text-stone-600 leading-relaxed italic">"{request.reason}"</p>
                                                </div>
                                            )}
                                            {request.branch_name && (
                                                <div className="mt-3 flex items-center gap-1.5 text-stone-400">
                                                    <Building2 className="h-3.5 w-3.5" />
                                                    <span className="text-[11px] font-medium">{request.branch_name}</span>
                                                </div>
                                            )}
                                        </div>

                                        {request.status === 'pending' && (
                                            <div className="flex gap-2 pt-2 border-t border-stone-100">
                                                <IOSButton
                                                    className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700"
                                                    onClick={() => handleApprove(request.id)}
                                                    leftIcon={<Check />}
                                                >
                                                    Approve
                                                </IOSButton>
                                                <IOSButton
                                                    variant="secondary"
                                                    className="flex-1 h-10 text-red-600 hover:bg-red-50"
                                                    onClick={() => handleReject(request.id)}
                                                    leftIcon={<X />}
                                                >
                                                    Reject
                                                </IOSButton>
                                            </div>
                                        )}
                                    </IOSCard>
                                );
                            })}
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
