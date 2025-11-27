'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { staffAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function GMLeaveRequestsPage() {
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  const fetchLeaveRequests = async () => {
    setIsLoading(true);
    try {
      const res = await staffAPI.getLeaveRequests({ status: 'pending' });
      setLeaveRequests(res.leaves || res || []);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await staffAPI.approveLeaveRequest(id);
      toast.success('Leave request approved');
      fetchLeaveRequests();
    } catch (error) {
      toast.error('Failed to approve');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await staffAPI.rejectLeaveRequest(id);
      toast.success('Leave request rejected');
      fetchLeaveRequests();
    } catch (error) {
      toast.error('Failed to reject');
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Leave Requests</h1>
              <p className="text-gray-600">Review and approve staff leave requests</p>
            </div>
            <Button onClick={fetchLeaveRequests} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <Card>
            <div className="divide-y">
              {leaveRequests.map((req: any) => (
                <div key={req.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <Calendar className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium">{req.staff_name || 'Staff Member'}</p>
                      <p className="text-sm text-gray-500">
                        {req.leave_type} - {req.start_date} to {req.end_date}
                      </p>
                      <p className="text-sm text-gray-400">{req.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={
                      req.status === 'approved' ? 'bg-green-100 text-green-800' :
                      req.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-amber-100 text-amber-800'
                    }>
                      {req.status}
                    </Badge>
                    {req.status === 'pending' && (
                      <>
                        <Button size="sm" onClick={() => handleApprove(req.id)} className="bg-green-600 hover:bg-green-700">
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleReject(req.id)} className="text-red-600 border-red-200">
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {leaveRequests.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  {isLoading ? 'Loading...' : 'No pending leave requests'}
                </div>
              )}
            </div>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
