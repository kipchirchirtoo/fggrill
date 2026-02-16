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
        <ProtectedRoute allowedRoles={[UserRole.HR_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <DashboardLayout>
                <div className="space-y-8 animate-ios-fade-in">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                        <div>
                            <h1 className="text-[28px] font-bold text-stone-900 tracking-tight font-sf-pro-display">Leave Applications</h1>
                            <p className="text-stone-500 font-medium">Review and process personnel leave requests</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={fetchRequests}
                                disabled={isLoading}
                                className="px-4 py-2 rounded-full border border-stone-200 bg-white text-stone-600 text-sm font-bold hover:bg-stone-50 transition-all flex items-center gap-2 active:scale-95 shadow-sm"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span>Sync Requests</span>
                            </button>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-5 rounded-2xl bg-white border border-stone-100 border-l-4 border-l-amber-500 shadow-sm transition-all hover:border-stone-200">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Awaiting Review</p>
                                    <p className="text-2xl font-bold mt-1 text-amber-600">{stats.pending}</p>
                                </div>
                                <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
                                    <Clock className="h-4 w-4" />
                                </div>
                            </div>
                        </div>

                        <div className="p-5 rounded-2xl bg-white border border-stone-100 border-l-4 border-l-emerald-500 shadow-sm transition-all hover:border-stone-200">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Approved Cycle</p>
                                    <p className="text-2xl font-bold mt-1 text-emerald-600">{stats.approved}</p>
                                </div>
                                <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                                    <Check className="h-4 w-4" />
                                </div>
                            </div>
                        </div>

                        <div className="p-5 rounded-2xl bg-white border border-stone-100 border-l-4 border-l-rose-500 shadow-sm transition-all hover:border-stone-200">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Audit Redacted</p>
                                    <p className="text-2xl font-bold mt-1 text-rose-600">{stats.rejected}</p>
                                </div>
                                <div className="w-9 h-9 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
                                    <X className="h-4 w-4" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Status Filter */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 bg-stone-50 rounded-2xl border border-stone-100">
                        <div className="flex items-center p-1 bg-white rounded-xl border border-stone-200 shadow-sm w-full sm:w-auto">
                            {['all', 'pending', 'approved', 'rejected'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`flex-1 sm:flex-none px-5 py-2 text-[13px] font-bold rounded-lg transition-all ${statusFilter === status
                                        ? 'bg-stone-900 text-white shadow-md'
                                        : 'text-stone-500 hover:text-stone-900 hover:bg-stone-50'
                                        }`}
                                >
                                    {status.charAt(0).toUpperCase() + status.slice(1)}
                                </button>
                            ))}
                        </div>
                        <div className="relative w-full sm:w-64">
                            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                            <input
                                placeholder="Universal find..."
                                className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-xl text-[13px] text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-400 transition-all placeholder:text-stone-400 shadow-sm"
                            />
                        </div>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {requests.map((request) => {
                                const status = statusConfig[request.status];
                                return (
                                    <div key={request.id} className="bg-white rounded-2xl border border-stone-100 shadow-sm flex flex-col group hover:border-stone-200 transition-all p-5">
                                        <div className="flex items-start justify-between mb-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600 font-bold text-xs">
                                                    {request.employee_name.split(' ').map(n => n[0]).join('')}
                                                </div>
                                                <div>
                                                    <h3 className="text-[14px] font-bold text-stone-900 leading-none">{request.employee_name}</h3>
                                                    <p className="text-[11px] text-stone-400 font-bold mt-1.5 uppercase tracking-tighter">
                                                        {request.leave_type} — {request.days} Working Days
                                                    </p>
                                                </div>
                                            </div>
                                            <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border ${status.bg} ${status.color} border-current/10`}>
                                                {status.label}
                                            </div>
                                        </div>

                                        <div className="bg-stone-50/50 rounded-xl p-4 mb-5 flex-1 border border-stone-100">
                                            <div className="grid grid-cols-2 gap-6 mb-4">
                                                <div>
                                                    <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">Commencement</p>
                                                    <p className="text-[13px] font-bold text-stone-700">{new Date(request.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">Resumption</p>
                                                    <p className="text-[13px] font-bold text-stone-700">{new Date(request.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                                </div>
                                            </div>
                                            {request.reason && (
                                                <div className="pt-3 border-t border-stone-100">
                                                    <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">Statement of Purpose</p>
                                                    <p className="text-[12px] text-stone-600 leading-relaxed font-medium italic">"{request.reason}"</p>
                                                </div>
                                            )}
                                        </div>

                                        {request.status === 'pending' && (
                                            <div className="flex gap-3 mt-auto pt-4 border-t border-stone-50">
                                                <button
                                                    onClick={() => handleApprove(request.id)}
                                                    className="flex-1 h-10 rounded-xl bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-sm flex items-center justify-center gap-2"
                                                >
                                                    <Check className="h-4 w-4" />
                                                    <span>Approve Cycle</span>
                                                </button>
                                                <button
                                                    onClick={() => handleReject(request.id)}
                                                    className="flex-1 h-10 rounded-xl bg-white border border-stone-200 text-rose-600 text-[13px] font-bold hover:bg-rose-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                                                >
                                                    <X className="h-4 w-4" />
                                                    <span>Redact Approval</span>
                                                </button>
                                            </div>
                                        )}

                                        {request.branch_name && (
                                            <div className="mt-3 flex items-center gap-1.5 text-stone-300">
                                                <Building2 className="h-3 w-3" />
                                                <span className="text-[10px] font-bold uppercase tracking-tight">{request.branch_name}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
