'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { staffAPI } from '@/lib/api/staff';
import { ArrowLeft, Calendar, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function StaffAttendancePage() {
  const params = useParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const staffId = params.id as string;

  useEffect(() => {
    fetchAttendance();
  }, [staffId]);

  const fetchAttendance = async () => {
    setIsLoading(true);
    try {
      const response = await staffAPI.getAttendance({ staff_id: staffId });
      
      if (response.success && response.data && response.data.length > 0) {
        setAttendance(response.data);
        
        // Calculate summary from attendance data
        const records = response.data;
        const presentDays = records.filter((r: any) => r.status === 'present').length;
        const absentDays = records.filter((r: any) => r.status === 'absent').length;
        const lateDays = records.filter((r: any) => r.status === 'late' || r.is_late).length;
        const totalDays = records.length;
        const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
        
        const calculatedSummary = {
          present_days: presentDays,
          absent_days: absentDays,
          late_days: lateDays,
          attendance_rate: attendanceRate,
          total_days: totalDays
        };
        
        setSummary(calculatedSummary);
      } else {
        setSummary({
          present_days: 0,
          absent_days: 0,
          late_days: 0,
          attendance_rate: 0,
          total_days: 0
        });
      }
    } catch (error: any) {
      console.error('Error fetching attendance:', error);
      toast.error(error.message || 'Failed to load attendance data');
      setSummary({
        present_days: 0,
        absent_days: 0,
        late_days: 0,
        attendance_rate: 0,
        total_days: 0
      });
    } finally {
      setIsLoading(false);
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
              Staff / Attendance Records
            </span>
          </div>

          <div className="flex items-center justify-between">
            <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Attendance Records</h1>
            <button onClick={fetchAttendance} disabled={isLoading} className="btn-secondary">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="stat-card">
                <div className="stat-icon bg-emerald-50 text-emerald-600">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <p className="stat-value text-emerald-600">{summary.present_days || 0}</p>
                <p className="stat-label">Present Days</p>
              </div>
              <div className="stat-card">
                <div className="stat-icon bg-rose-50 text-rose-600">
                  <XCircle className="h-5 w-5" />
                </div>
                <p className="stat-value text-rose-600">{summary.absent_days || 0}</p>
                <p className="stat-label">Absent Days</p>
              </div>
              <div className="stat-card">
                <div className="stat-icon bg-amber-50 text-amber-600">
                  <Clock className="h-5 w-5" />
                </div>
                <p className="stat-value text-amber-600">{summary.late_days || 0}</p>
                <p className="stat-label">Late Days</p>
              </div>
              <div className="stat-card">
                <div className="stat-icon bg-blue-50 text-blue-600">
                  <Calendar className="h-5 w-5" />
                </div>
                <p className="stat-value text-blue-600">{summary.attendance_rate || 0}%</p>
                <p className="stat-label">Attendance Rate</p>
              </div>
            </div>
          )}

          <div className="card-elevated p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-6 w-6 animate-spin text-stone-300" />
              </div>
            ) : attendance.length === 0 ? (
              <div className="text-center py-20">
                <Calendar className="h-12 w-12 text-stone-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-stone-900">No Attendance Records</h3>
                <p className="text-sm text-stone-500 mt-1">No attendance data available for this staff member.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="table-header-cell">Date</th>
                      <th className="table-header-cell">Clock In</th>
                      <th className="table-header-cell">Clock Out</th>
                      <th className="table-header-cell">Status</th>
                      <th className="table-header-cell">Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {attendance.map((record: any) => {
                      // Handle different possible date field names
                      const dateValue = record.attendance_date || record.date || record.created_at;
                      const formattedDate = dateValue ? new Date(dateValue).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      }) : 'N/A';
                      
                      // Format time fields - handle all possible column name variations
                      // Database uses: clock_in, clock_out (confirmed from backend)
                      // Some APIs might return: clock_in_time, clock_out_time, check_in, check_out
                      const clockInRaw = record.clock_in || record.clock_in_time || record.check_in_time || record.check_in || record.clockIn;
                      const clockOutRaw = record.clock_out || record.clock_out_time || record.check_out_time || record.check_out || record.clockOut;
                      
                      // Format times to show only HH:MM
                      const formatTime = (time: string | null) => {
                        if (!time) return 'N/A';
                        try {
                          // If it's a full timestamp, extract time
                          if (time.includes('T') || time.includes(' ')) {
                            const date = new Date(time);
                            if (isNaN(date.getTime())) return 'N/A';
                            return date.toLocaleTimeString('en-US', { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              hour12: true 
                            });
                          }
                          // If it's already just time (HH:MM:SS or HH:MM), format it
                          const timeParts = time.split(':');
                          if (timeParts.length >= 2) {
                            const hours = parseInt(timeParts[0]);
                            const minutes = timeParts[1];
                            const ampm = hours >= 12 ? 'PM' : 'AM';
                            const displayHours = hours % 12 || 12;
                            return `${displayHours}:${minutes} ${ampm}`;
                          }
                          return time;
                        } catch {
                          return time;
                        }
                      };
                      
                      // Calculate hours worked
                      const calculateHours = () => {
                        if (!clockInRaw || !clockOutRaw) return 0;
                        try {
                          let clockInDate: Date;
                          let clockOutDate: Date;
                          
                          // Parse clock in
                          if (clockInRaw.includes('T') || clockInRaw.includes(' ')) {
                            clockInDate = new Date(clockInRaw);
                          } else {
                            // Time only, use today's date
                            clockInDate = new Date(`${dateValue}T${clockInRaw}`);
                          }
                          
                          // Parse clock out
                          if (clockOutRaw.includes('T') || clockOutRaw.includes(' ')) {
                            clockOutDate = new Date(clockOutRaw);
                          } else {
                            // Time only, use today's date
                            clockOutDate = new Date(`${dateValue}T${clockOutRaw}`);
                          }
                          
                          if (isNaN(clockInDate.getTime()) || isNaN(clockOutDate.getTime())) {
                            return 0;
                          }
                          
                          const diffMs = clockOutDate.getTime() - clockInDate.getTime();
                          const diffHours = diffMs / (1000 * 60 * 60);
                          
                          // Return 0 if negative (data issue) or if unreasonably large
                          if (diffHours < 0 || diffHours > 24) return 0;
                          
                          return Math.round(diffHours * 10) / 10; // Round to 1 decimal
                        } catch {
                          return 0;
                        }
                      };
                      
                      const hoursWorked = record.hours_worked || record.total_hours || calculateHours();
                      
                      return (
                        <tr key={record.id} className="table-row">
                          <td className="table-cell">{formattedDate}</td>
                          <td className="table-cell">{formatTime(clockInRaw)}</td>
                          <td className="table-cell">{formatTime(clockOutRaw)}</td>
                          <td className="table-cell">
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                              record.status === 'present' ? 'bg-emerald-100 text-emerald-700' :
                              record.status === 'absent' ? 'bg-rose-100 text-rose-700' :
                              record.status === 'late' ? 'bg-amber-100 text-amber-700' :
                              'bg-stone-100 text-stone-700'
                            }`}>
                              {record.status || 'present'}
                            </span>
                          </td>
                          <td className="table-cell font-medium">{hoursWorked}h</td>
                        </tr>
                      );
                    })}
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
