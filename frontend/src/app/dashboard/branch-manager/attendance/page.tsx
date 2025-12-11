'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { staffAPI } from '@/lib/api';
import { UserCheck, RefreshCw, Clock, User, CheckCircle, XCircle } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Attendance { id: string; employee_name: string; check_in?: string; check_out?: string; status: 'present' | 'absent' | 'late'; }

export default function BranchAttendancePage() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAttendance = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await staffAPI.getAttendance();
      if (response.success) setAttendance(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const stats = { present: attendance.filter(a => a.status === 'present').length, absent: attendance.filter(a => a.status === 'absent').length, late: attendance.filter(a => a.status === 'late').length };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Attendance</h1><p className="text-gray-500">Today's staff attendance</p></div>
            <IOSButton variant="secondary" onClick={fetchAttendance} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4 border-l-4 border-green-500"><CheckCircle className="h-6 w-6 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Present</p><p className="text-xl font-bold text-[#34C759]">{stats.present}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-red-500"><XCircle className="h-6 w-6 text-[#FF3B30] mb-2" /><p className="text-sm text-gray-500">Absent</p><p className="text-xl font-bold text-[#FF3B30]">{stats.absent}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-yellow-500"><Clock className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Late</p><p className="text-xl font-bold text-yellow-600">{stats.late}</p></IOSCard>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : attendance.length === 0 ? (
            <IOSCard className="p-12 text-center"><UserCheck className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No attendance records</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {attendance.map((record) => (
                <IOSCard key={record.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"><User className="h-5 w-5 text-[#007AFF]" /></div>
                      <div>
                        <p className="font-bold">{record.employee_name}</p>
                        <p className="text-sm text-gray-500">
                          {record.check_in && `In: ${record.check_in}`}
                          {record.check_out && ` • Out: ${record.check_out}`}
                        </p>
                      </div>
                    </div>
                    <IOSBadge variant={record.status === 'present' ? 'success' : record.status === 'absent' ? 'error' : 'warning'}>{record.status}</IOSBadge>
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
