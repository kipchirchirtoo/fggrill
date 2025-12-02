'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { staffAPI } from '@/lib/api';
import { Calendar, RefreshCw, Check, X, Clock, User, Building2 } from 'lucide-react';
import { toast } from 'sonner';

interface LeaveRequest { id: string; employee_name: string; employee_id: string; branch_name?: string; leave_type: string; start_date: string; end_date: string; days: number; reason?: string; status: 'pending' | 'approved' | 'rejected'; }

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  approved: { label: 'Approved', color: 'text-green-700', bg: 'bg-green-100' },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-100' },
};

export default function GMLeaveRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await staffAPI.getLeaveRequests({ status: statusFilter !== 'all' ? statusFilter : undefined });
      if (response.success) setRequests(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApprove = async (id: string) => {
    try {
      await staffAPI.approveLeaveRequest(id);
      toast.success('Leave approved');
      fetchRequests();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const handleReject = async (id: string) => {
    try {
      await staffAPI.rejectLeaveRequest(id);
      toast.success('Leave rejected');
      fetchRequests();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const stats = { pending: requests.filter(r => r.status === 'pending').length, approved: requests.filter(r => r.status === 'approved').length, rejected: requests.filter(r => r.status === 'rejected').length };

  return (
    <ProtectedRoute allowedRoles={[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Leave Requests</h1><p className="text-gray-500">Manage staff leave requests</p></div>
            <IOSButton variant="secondary" onClick={fetchRequests}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4"><Clock className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Pending</p><p className="text-xl font-bold text-yellow-600">{stats.pending}</p></IOSCard>
            <IOSCard className="p-4"><Check className="h-6 w-6 text-green-600 mb-2" /><p className="text-sm text-gray-500">Approved</p><p className="text-xl font-bold text-green-600">{stats.approved}</p></IOSCard>
            <IOSCard className="p-4"><X className="h-6 w-6 text-red-600 mb-2" /><p className="text-sm text-gray-500">Rejected</p><p className="text-xl font-bold text-red-600">{stats.rejected}</p></IOSCard>
          </div>

          <div className="flex gap-2">
            {['all', 'pending', 'approved', 'rejected'].map((status) => (
              <IOSButton key={status} variant={statusFilter === status ? 'primary' : 'secondary'} size="sm" onClick={() => setStatusFilter(status)}>
                {status === 'all' ? 'All' : statusConfig[status]?.label || status}
              </IOSButton>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : requests.length === 0 ? (
            <IOSCard className="p-12 text-center"><Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No requests found</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => {
                const status = statusConfig[request.status];
                return (
                  <IOSCard key={request.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center"><User className="h-6 w-6 text-blue-600" /></div>
                        <div>
                          <p className="font-bold">{request.employee_name}</p>
                          <p className="text-sm text-gray-500">{request.leave_type} • {request.days} days</p>
                          <p className="text-xs text-gray-400">{new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}</p>
                          {request.branch_name && <p className="text-xs text-gray-400 flex items-center gap-1"><Building2 className="h-3 w-3" /> {request.branch_name}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <IOSBadge className={`${status.bg} ${status.color}`}>{status.label}</IOSBadge>
                        {request.status === 'pending' && (
                          <div className="flex gap-2">
                            <IOSButton size="sm" onClick={() => handleApprove(request.id)}><Check className="h-4 w-4" /></IOSButton>
                            <IOSButton size="sm" variant="destructive" onClick={() => handleReject(request.id)}><X className="h-4 w-4" /></IOSButton>
                          </div>
                        )}
                      </div>
                    </div>
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
