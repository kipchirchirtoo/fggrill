'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { staffAPI } from '@/lib/api';
import { Calendar, RefreshCw, Clock, CheckCircle, XCircle, User } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface AttendanceRecord { id: string; staff_name: string; date: string; check_in?: string; check_out?: string; status: string; }

export default function AdminAttendancePage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await staffAPI.getAttendance({ date: selectedDate });
      if (response.success) setRecords(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [selectedDate]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const stats = { present: records.filter(r => r.status === 'present').length, absent: records.filter(r => r.status === 'absent').length, late: records.filter(r => r.status === 'late').length };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Staff Attendance</h1><p className="text-gray-500">Daily attendance records</p></div>
            <div className="flex gap-2">
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-3 py-2 border rounded-ios-lg" />
              <IOSButton variant="secondary" onClick={fetchRecords}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4"><CheckCircle className="h-6 w-6 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Present</p><p className="text-xl font-bold text-[#34C759]">{stats.present}</p></IOSCard>
            <IOSCard className="p-4"><XCircle className="h-6 w-6 text-[#FF3B30] mb-2" /><p className="text-sm text-gray-500">Absent</p><p className="text-xl font-bold text-[#FF3B30]">{stats.absent}</p></IOSCard>
            <IOSCard className="p-4"><Clock className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Late</p><p className="text-xl font-bold text-yellow-600">{stats.late}</p></IOSCard>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : records.length === 0 ? (
            <IOSCard className="p-12 text-center"><Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No attendance records</p></IOSCard>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50"><tr><th className="text-left p-3">Staff</th><th className="text-left p-3">Check In</th><th className="text-left p-3">Check Out</th><th className="text-center p-3">Status</th></tr></thead>
                <tbody className="divide-y">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="p-3 flex items-center gap-2"><User className="h-4 w-4 text-gray-400" /> {record.staff_name}</td>
                      <td className="p-3">{record.check_in || '-'}</td>
                      <td className="p-3">{record.check_out || '-'}</td>
                      <td className="p-3 text-center"><IOSBadge variant={record.status === 'present' ? 'success' : record.status === 'absent' ? 'error' : 'warning'}>{record.status}</IOSBadge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
