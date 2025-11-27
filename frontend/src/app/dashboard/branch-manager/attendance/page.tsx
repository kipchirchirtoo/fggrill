'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { staffAPI } from '@/lib/api';

export default function BranchManagerAttendancePage() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchAttendance(); }, [user]);

  const fetchAttendance = async () => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await staffAPI.getAttendance({ branch_id: user?.branch_id, date: today });
      setAttendance(res.attendance || res || []);
    } catch (error) { console.error('Error:', error); } 
    finally { setIsLoading(false); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Staff Attendance</h1>
              <p className="text-gray-600">Today's attendance record</p>
            </div>
            <Button onClick={fetchAttendance} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4 bg-green-50">
              <CheckCircle className="h-6 w-6 text-green-600 mb-2" />
              <p className="text-2xl font-bold">{attendance.filter(a => a.status === 'present').length}</p>
              <p className="text-sm text-green-700">Present</p>
            </Card>
            <Card className="p-4 bg-red-50">
              <XCircle className="h-6 w-6 text-red-600 mb-2" />
              <p className="text-2xl font-bold">{attendance.filter(a => a.status === 'absent').length}</p>
              <p className="text-sm text-red-700">Absent</p>
            </Card>
            <Card className="p-4 bg-amber-50">
              <Clock className="h-6 w-6 text-amber-600 mb-2" />
              <p className="text-2xl font-bold">{attendance.filter(a => a.status === 'late').length}</p>
              <p className="text-sm text-amber-700">Late</p>
            </Card>
          </div>

          <Card>
            <div className="divide-y">
              {attendance.map((a: any) => (
                <div key={a.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">{a.staff_name}</p>
                      <p className="text-sm text-gray-500">{a.check_in_time || '-'}</p>
                    </div>
                  </div>
                  <Badge className={a.status === 'present' ? 'bg-green-100 text-green-800' : a.status === 'absent' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}>{a.status}</Badge>
                </div>
              ))}
              {attendance.length === 0 && <div className="p-8 text-center text-gray-500">{isLoading ? 'Loading...' : 'No attendance records'}</div>}
            </div>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
