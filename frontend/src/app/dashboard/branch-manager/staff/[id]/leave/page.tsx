'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { staffAPI } from '@/lib/api/staff';
import { ArrowLeft, Calendar, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function StaffLeavePage() {
  const params = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const staffId = params.id as string;

  useEffect(() => {
    fetchLeaveRequests();
  }, [staffId]);

  const fetchLeaveRequests = async () => {
    setIsLoading(true);
    try {
      const response = await staffAPI.getLeaveRequests({ staff_id: staffId });
      if (response.success && response.data) {
        setLeaveRequests(response.data);
      }
    } catch (error: any) {
      console.error('Error fetching leave requests:', error);
      toast.error(error.message || 'Failed to load leave requests');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'bg-emerald-100 text-emerald-700';
      case 'rejected':
        return 'bg-rose-100 text-rose-700';
      case 'pending':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-stone-100 text-stone-700';
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Link href={`/dashboard/branch-manager/staff/${staffId}`} className="text-stone-400 hover:text-stone-900 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-[12px] font-bold text-stone-400 uppercase tracking-widest">
              Staff / Leave Requests
            </span>
          </div>

          <div className="flex items-center justify-between">
            <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Leave Requests</h1>
            <button onClick={fetchLeaveRequests} disabled={isLoading} className="btn-secondary">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="card-elevated p-0 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-6 w-6 animate-spin text-stone-300" />
              </div>
            ) : leaveRequests.length === 0 ? (
              <div className="text-center py-20 px-6">
                <Calendar className="h-12 w-12 text-stone-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-stone-900">No Leave Requests</h3>
                <p className="text-sm text-stone-500 mt-1">This staff member has no leave requests.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="table-header-cell">Leave Type</th>
                      <th className="table-header-cell">Start Date</th>
                      <th className="table-header-cell">End Date</th>
                      <th className="table-header-cell">Days</th>
                      <th className="table-header-cell">Status</th>
                      <th className="table-header-cell">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {leaveRequests.map((request: any) => (
                      <tr key={request.id} className="table-row">
                        <td className="table-cell">
                          <span className="text-[13px] font-medium text-stone-800 capitalize">
                            {request.leave_type?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="table-cell">
                          {new Date(request.start_date).toLocaleDateString()}
                        </td>
                        <td className="table-cell">
                          {new Date(request.end_date).toLocaleDateString()}
                        </td>
                        <td className="table-cell">
                          <span className="text-[13px] font-medium text-stone-800">
                            {request.days_requested || 0}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${getStatusColor(request.status)}`}>
                            {request.status}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span className="text-[12px] text-stone-600">
                            {request.reason || 'N/A'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
