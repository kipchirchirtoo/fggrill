'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { branchOperationsAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Search, RefreshCw, CheckCircle, Clock, FileText,
  CalendarCheck, User, Calendar as CalendarIcon, XCircle, AlertCircle,
  ChevronLeft, ChevronRight, PieChart, UserPlus, PlusCircle
} from 'lucide-react';
import { format, addDays, startOfMonth, endOfMonth, isSameDay, isSameMonth, addMonths, subMonths, parseISO } from 'date-fns';

// Attendance interfaces
interface StaffMember {
  id: string;
  name: string;
  position: string;
  department: string;
  avatar?: string;
}

interface AttendanceRecord {
  id: string;
  staff_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'leave' | 'half_day';
  check_in?: string;
  check_out?: string;
  notes?: string;
}

export default function BranchStaffAttendancePage() {
  return (
    <ProtectedRoute allowedRoles={[
      UserRole.BRANCH_OPERATIONS_MANAGER,
      UserRole.BRANCH_MANAGER,
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.AUDITOR
    ]}>
      <BranchAwareDashboardLayout>
        <BranchStaffAttendanceContent />
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

function BranchStaffAttendanceContent() {
  const { user } = useAuth();
  const { activeBranch, activeBranchId } = useBranch();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Date controls
  const today = new Date();
  const [currentDate, setCurrentDate] = useState<Date>(today);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredStaff, setFilteredStaff] = useState<StaffMember[]>([]);

  // Attendance dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [attendanceDate, setAttendanceDate] = useState<string>(format(today, 'yyyy-MM-dd'));
  const [attendanceStatus, setAttendanceStatus] = useState<'present' | 'absent' | 'late' | 'leave' | 'half_day'>('present');
  const [checkInTime, setCheckInTime] = useState<string>('');
  const [checkOutTime, setCheckOutTime] = useState<string>('');
  const [attendanceNotes, setAttendanceNotes] = useState<string>('');

  // Summary stats
  const [summary, setSummary] = useState({
    present: 0,
    absent: 0,
    late: 0,
    leave: 0,
    half_day: 0
  });

  const resetAttendanceForm = () => {
    setSelectedStaff('');
    setAttendanceDate(format(today, 'yyyy-MM-dd'));
    setAttendanceStatus('present');
    setCheckInTime('');
    setCheckOutTime('');
    setAttendanceNotes('');
  };

  useEffect(() => {
    if (activeBranchId) {
      fetchAttendanceData();
    }
  }, [activeBranchId, currentDate]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = staff.filter(member =>
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.department.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredStaff(filtered);
    } else {
      setFilteredStaff(staff);
    }
  }, [searchTerm, staff]);

  const fetchAttendanceData = async () => {
    setIsLoading(true);
    try {
      // Get staff members
      const staffResponse = await branchOperationsAPI.getStaff(activeBranchId || undefined);
      if (staffResponse.success && Array.isArray(staffResponse.data)) {
        setStaff(staffResponse.data);
        setFilteredStaff(staffResponse.data);
      } else {
        // No staff data available
        setStaff([]);
        setFilteredStaff([]);
      }

      // Get attendance records for the current month
      const startDate = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentDate), 'yyyy-MM-dd');

      const attendanceResponse = await branchOperationsAPI.getAttendanceRecords({
        startDate,
        endDate
      }, activeBranchId || undefined);

      if (attendanceResponse.success && Array.isArray(attendanceResponse.data)) {
        setAttendanceRecords(attendanceResponse.data);
      } else {
        // No attendance data available
        setAttendanceRecords([]);
      }

      // Calculate summary stats for today
      calculateSummaryStats();

    } catch (error) {
      console.error('Error fetching attendance data:', error);
      toast.error('Failed to load attendance data');
      // Show empty state on error
      setStaff([]);
      setFilteredStaff([]);
      setAttendanceRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSummaryStats = () => {
    // Calculate from actual attendance records for the selected day
    const todayStr = format(currentDate, 'yyyy-MM-dd');
    const todayRecords = attendanceRecords.filter(r => r.date === todayStr);
    setSummary({
      present: todayRecords.filter(r => r.status === 'present').length,
      absent: todayRecords.filter(r => r.status === 'absent').length,
      late: todayRecords.filter(r => r.status === 'late').length,
      leave: todayRecords.filter(r => r.status === 'leave').length,
      half_day: todayRecords.filter(r => r.status === 'half_day').length
    });
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(today);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800 border-green-200';
      case 'absent': return 'bg-red-100 text-red-800 border-red-200';
      case 'late': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'leave': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'half_day': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleSaveAttendance = async () => {
    if (!selectedStaff || !attendanceDate) {
      toast.error('Please fill in required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      const newRecord: AttendanceRecord = {
        id: `new-${Date.now()}`,
        staff_id: selectedStaff,
        date: attendanceDate,
        status: attendanceStatus,
        check_in: checkInTime,
        check_out: checkOutTime,
        notes: attendanceNotes
      };

      setAttendanceRecords([...attendanceRecords, newRecord]);
      toast.success('Attendance recorded successfully');
      setDialogOpen(false);
      resetAttendanceForm();
    } catch (error) {
      toast.error('Failed to save attendance');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BranchPageWrapper
      title="Staff Attendance"
      subtitle="Track daily attendance and timekeeping"
      actions={
        <div className="flex gap-2">
          <IOSButton variant="secondary" size="sm" onClick={fetchAttendanceData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </IOSButton>
          <IOSButton variant="primary" size="sm" onClick={() => {
            resetAttendanceForm();
            setDialogOpen(true);
          }}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Record Attendance
          </IOSButton>
        </div>
      }
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <IOSCard className="p-4 bg-green-50 border-green-100">
          <div className="text-sm text-green-600 font-medium mb-1">Present</div>
          <div className="text-2xl font-bold text-green-700">{summary.present}</div>
        </IOSCard>
        <IOSCard className="p-4 bg-red-50 border-red-100">
          <div className="text-sm text-red-600 font-medium mb-1">Absent</div>
          <div className="text-2xl font-bold text-red-700">{summary.absent}</div>
        </IOSCard>
        <IOSCard className="p-4 bg-yellow-50 border-yellow-100">
          <div className="text-sm text-yellow-600 font-medium mb-1">Late</div>
          <div className="text-2xl font-bold text-yellow-700">{summary.late}</div>
        </IOSCard>
        <IOSCard className="p-4 bg-blue-50 border-blue-100">
          <div className="text-sm text-blue-600 font-medium mb-1">On Leave</div>
          <div className="text-2xl font-bold text-blue-700">{summary.leave}</div>
        </IOSCard>
        <IOSCard className="p-4 bg-orange-50 border-orange-100">
          <div className="text-sm text-orange-600 font-medium mb-1">Half Day</div>
          <div className="text-2xl font-bold text-orange-700">{summary.half_day}</div>
        </IOSCard>
      </div>

      <IOSCard className="p-4 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={handlePrevMonth}
                className="p-2 hover:bg-white rounded-md transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-4 font-medium min-w-[150px] text-center">
                {format(currentDate, 'MMMM yyyy')}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-2 hover:bg-white rounded-md transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <IOSButton variant="secondary" size="sm" onClick={handleToday}>
              Today
            </IOSButton>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
            <Input
              placeholder="Search staff..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-3 text-left font-medium text-gray-600">Staff Member</th>
                <th className="p-3 text-left font-medium text-gray-600">Department</th>
                <th className="p-3 text-center font-medium text-gray-600">Status</th>
                <th className="p-3 text-center font-medium text-gray-600">Check In</th>
                <th className="p-3 text-center font-medium text-gray-600">Check Out</th>
                <th className="p-3 text-left font-medium text-gray-600">Notes</th>
                <th className="p-3 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map(member => {
                // Find attendance for today (or selected date context)
                // For simplicity in this view, we're showing "today's" status or latest record
                const record = attendanceRecords.find(r =>
                  r.staff_id === member.id &&
                  (r.date === format(today, 'yyyy-MM-dd') || r.date === format(currentDate, 'yyyy-MM-dd'))
                );

                return (
                  <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
                          {member.avatar ? (
                            <img src={member.avatar} alt={member.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{member.name}</div>
                          <div className="text-xs text-gray-500">{member.position}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-gray-600">{member.department}</td>
                    <td className="p-3 text-center">
                      {record ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(record.status)}`}>
                          {record.status.replace('_', ' ').toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center text-sm font-mono">{record?.check_in || '-'}</td>
                    <td className="p-3 text-center text-sm font-mono">{record?.check_out || '-'}</td>
                    <td className="p-3 text-sm text-gray-500 truncate max-w-[150px]">{record?.notes || '-'}</td>
                    <td className="p-3 text-right">
                      <IOSButton
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedStaff(member.id);
                          if (record) {
                            setAttendanceStatus(record.status);
                            setCheckInTime(record.check_in || '');
                            setCheckOutTime(record.check_out || '');
                            setAttendanceNotes(record.notes || '');
                            setAttendanceDate(record.date);
                          } else {
                            resetAttendanceForm();
                            setSelectedStaff(member.id);
                          }
                          setDialogOpen(true);
                        }}
                      >
                        Edit
                      </IOSButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </IOSCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Attendance</DialogTitle>
            <DialogDescription>
              Update attendance record for staff member
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Staff Member</Label>
              <select
                className="w-full p-2 border rounded-md"
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
              >
                <option value="">Select Staff...</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.name} - {s.position}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="w-full p-2 border rounded-md"
                  value={attendanceStatus}
                  onChange={(e) => setAttendanceStatus(e.target.value as any)}
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="leave">On Leave</option>
                  <option value="half_day">Half Day</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Check In</Label>
                <Input
                  type="time"
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Check Out</Label>
                <Input
                  type="time"
                  value={checkOutTime}
                  onChange={(e) => setCheckOutTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={attendanceNotes}
                onChange={(e) => setAttendanceNotes(e.target.value)}
                placeholder="Optional notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <IOSButton variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </IOSButton>
            <IOSButton
              variant="primary"
              onClick={handleSaveAttendance}
              disabled={isSubmitting || !selectedStaff}
            >
              {isSubmitting ? 'Saving...' : 'Save Record'}
            </IOSButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BranchPageWrapper>
  );
}
