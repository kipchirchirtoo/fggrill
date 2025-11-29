'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Calendar, Clock, Users, Plus, RefreshCw, ArrowLeft, ChevronLeft, ChevronRight,
  User, CheckCircle, XCircle, AlertTriangle, Repeat, Coffee, Moon, Sun
} from 'lucide-react';
import { housekeepingAPI } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

interface ShiftDefinition {
  id: string;
  name: string;
  shift_type: 'morning' | 'afternoon' | 'evening' | 'night' | 'split';
  start_time: string;
  end_time: string;
  break_duration_minutes: number;
}

interface StaffSchedule {
  id: string;
  staff_id: string;
  shift_id: string;
  schedule_date: string;
  status: 'scheduled' | 'checked_in' | 'checked_out' | 'absent' | 'leave';
  check_in_time?: string;
  check_out_time?: string;
  assigned_floors: number[];
  staff?: {
    staff_code: string;
    user: { first_name: string; last_name: string };
  };
  shift?: ShiftDefinition;
}

interface LeaveRequest {
  id: string;
  staff_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  staff?: {
    staff_code: string;
    user: { first_name: string; last_name: string };
  };
}

interface TodayRoster {
  date: string;
  total: number;
  checkedIn: number;
  roster: StaffSchedule[];
  byShift: Record<string, StaffSchedule[]>;
}

interface StaffMember {
  id: string;
  staff_code: string;
  designation: string;
  assigned_floors: number[];
  user: { first_name: string; last_name: string };
}

const SHIFT_ICONS: Record<string, any> = {
  morning: Sun,
  afternoon: Coffee,
  evening: Moon,
  night: Moon,
  split: Repeat
};

const SHIFT_COLORS: Record<string, string> = {
  morning: 'bg-amber-100 text-amber-800 border-amber-200',
  afternoon: 'bg-blue-100 text-blue-800 border-blue-200',
  evening: 'bg-purple-100 text-purple-800 border-purple-200',
  night: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  split: 'bg-gray-100 text-gray-800 border-gray-200'
};

export default function SchedulingPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'roster' | 'schedule' | 'leave' | 'swaps'>('roster');
  
  // Data states
  const [todayRoster, setTodayRoster] = useState<TodayRoster | null>(null);
  const [shifts, setShifts] = useState<ShiftDefinition[]>([]);
  const [schedules, setSchedules] = useState<StaffSchedule[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  
  // Calendar navigation
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff));
  });

  // Modal states
  const [isCreateScheduleOpen, setIsCreateScheduleOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [selectedLeaveRequest, setSelectedLeaveRequest] = useState<LeaveRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [scheduleForm, setScheduleForm] = useState({
    staffId: '',
    shiftId: '',
    scheduleDate: '',
    assignedFloors: [] as number[]
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const [rosterRes, shiftsRes, schedulesRes, leaveRes, staffRes] = await Promise.all([
        housekeepingAPI.getTodayRoster().catch(() => ({ data: null })),
        housekeepingAPI.getShiftDefinitions().catch(() => ({ data: [] })),
        housekeepingAPI.getSchedules(
          currentWeekStart.toISOString().split('T')[0],
          weekEnd.toISOString().split('T')[0]
        ).catch(() => ({ data: [] })),
        housekeepingAPI.getLeaveRequests().catch(() => ({ data: [] })),
        housekeepingAPI.getStaff().catch(() => ({ data: [] }))
      ]);

      setTodayRoster(rosterRes.data);
      setShifts(shiftsRes.data || []);
      setSchedules(schedulesRes.data || []);
      setLeaveRequests(leaveRes.data || []);
      setStaff(staffRes.data || []);
    } catch (error) {
      console.error('Error fetching scheduling data:', error);
      toast.error('Failed to load scheduling data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentWeekStart]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newStart);
  };

  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const createSchedule = async () => {
    if (!scheduleForm.staffId || !scheduleForm.shiftId || !scheduleForm.scheduleDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      await housekeepingAPI.createSchedule({
        staffId: scheduleForm.staffId,
        shiftId: scheduleForm.shiftId,
        scheduleDate: scheduleForm.scheduleDate,
        assignedFloors: scheduleForm.assignedFloors
      });

      toast.success('Schedule created');
      setIsCreateScheduleOpen(false);
      setScheduleForm({ staffId: '', shiftId: '', scheduleDate: '', assignedFloors: [] });
      fetchData();
    } catch (error) {
      toast.error('Failed to create schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const reviewLeaveRequest = async (approved: boolean) => {
    if (!selectedLeaveRequest) return;
    setIsSubmitting(true);
    try {
      await housekeepingAPI.reviewLeaveRequest(selectedLeaveRequest.id, { approved });
      toast.success(`Leave request ${approved ? 'approved' : 'rejected'}`);
      setIsLeaveModalOpen(false);
      setSelectedLeaveRequest(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to process request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getScheduleForDay = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return schedules.filter(s => s.schedule_date === dateStr);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-800',
      checked_in: 'bg-emerald-100 text-emerald-800',
      checked_out: 'bg-gray-100 text-gray-800',
      absent: 'bg-red-100 text-red-800',
      leave: 'bg-purple-100 text-purple-800'
    };
    return <Badge className={styles[status] || 'bg-gray-100'}>{status.replace('_', ' ')}</Badge>;
  };

  const isManager = user?.role === UserRole.SUPER_ADMIN || 
                    user?.role === UserRole.GENERAL_MANAGER ||
                    user?.role === UserRole.BRANCH_MANAGER;

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HOUSEKEEPING]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/housekeeping">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-lg">
                <Calendar className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Staff Scheduling</h1>
                <p className="text-gray-600">Manage shifts and attendance</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={fetchData} variant="outline" size="icon">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              {isManager && (
                <Button onClick={() => setIsCreateScheduleOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Schedule
                </Button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b overflow-x-auto">
            {[
              { id: 'roster', label: "Today's Roster", icon: Users },
              { id: 'schedule', label: 'Weekly Schedule', icon: Calendar },
              { id: 'leave', label: 'Leave Requests', icon: Coffee },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-cyan-500 text-cyan-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Today's Roster Tab */}
          {activeTab === 'roster' && todayRoster && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">Scheduled</p>
                      <p className="text-3xl font-bold">{todayRoster.total}</p>
                    </div>
                    <Users className="h-8 w-8 text-blue-200" />
                  </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-emerald-500 to-green-500 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-emerald-100 text-sm">Checked In</p>
                      <p className="text-3xl font-bold">{todayRoster.checkedIn}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-emerald-200" />
                  </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-red-500 to-rose-500 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-100 text-sm">Absent</p>
                      <p className="text-3xl font-bold">{todayRoster.total - todayRoster.checkedIn}</p>
                    </div>
                    <XCircle className="h-8 w-8 text-red-200" />
                  </div>
                </Card>
              </div>

              {/* Roster by Shift */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Object.entries(todayRoster.byShift).map(([shiftName, members]) => {
                  const ShiftIcon = SHIFT_ICONS[members[0]?.shift?.shift_type || 'morning'] || Sun;
                  return (
                    <Card key={shiftName} className="p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2 rounded-lg ${SHIFT_COLORS[members[0]?.shift?.shift_type || 'morning']}`}>
                          <ShiftIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{shiftName}</h3>
                          <p className="text-sm text-gray-500">
                            {members[0]?.shift?.start_time} - {members[0]?.shift?.end_time}
                          </p>
                        </div>
                        <Badge className="ml-auto">{members.length} staff</Badge>
                      </div>

                      <div className="space-y-3">
                        {members.map(member => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                                <User className="h-5 w-5 text-gray-500" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {member.staff?.user.first_name} {member.staff?.user.last_name}
                                </p>
                                <p className="text-sm text-gray-500">{member.staff?.staff_code}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              {getStatusBadge(member.status)}
                              {member.check_in_time && (
                                <p className="text-xs text-gray-500 mt-1">
                                  In: {new Date(member.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Weekly Schedule Tab */}
          {activeTab === 'schedule' && (
            <Card className="p-5">
              {/* Week Navigation */}
              <div className="flex items-center justify-between mb-6">
                <Button variant="outline" size="icon" onClick={() => navigateWeek('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="font-semibold text-gray-900">
                  {currentWeekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - 
                  {' '}{new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
                <Button variant="outline" size="icon" onClick={() => navigateWeek('next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Calendar Grid */}
              <div className="overflow-x-auto">
                <div className="grid grid-cols-7 gap-2 min-w-[800px]">
                  {getWeekDays().map((date, idx) => {
                    const isToday = date.toDateString() === new Date().toDateString();
                    const daySchedules = getScheduleForDay(date);

                    return (
                      <div
                        key={idx}
                        className={`border rounded-lg p-3 min-h-[200px] ${
                          isToday ? 'bg-cyan-50 border-cyan-200' : 'bg-white'
                        }`}
                      >
                        <div className="text-center mb-3">
                          <p className="text-sm text-gray-500">
                            {date.toLocaleDateString('en-US', { weekday: 'short' })}
                          </p>
                          <p className={`text-lg font-semibold ${isToday ? 'text-cyan-600' : 'text-gray-900'}`}>
                            {date.getDate()}
                          </p>
                        </div>

                        <div className="space-y-2">
                          {daySchedules.slice(0, 4).map(schedule => (
                            <div
                              key={schedule.id}
                              className={`p-2 rounded text-xs ${
                                SHIFT_COLORS[schedule.shift?.shift_type || 'morning']
                              }`}
                            >
                              <p className="font-medium truncate">
                                {schedule.staff?.user.first_name}
                              </p>
                              <p className="opacity-75">{schedule.shift?.name}</p>
                            </div>
                          ))}
                          {daySchedules.length > 4 && (
                            <p className="text-xs text-gray-500 text-center">
                              +{daySchedules.length - 4} more
                            </p>
                          )}
                          {daySchedules.length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-4">
                              No schedules
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}

          {/* Leave Requests Tab */}
          {activeTab === 'leave' && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Leave Requests</h3>
                <div className="flex gap-2">
                  <Badge className="bg-amber-100 text-amber-800">
                    {leaveRequests.filter(r => r.status === 'pending').length} Pending
                  </Badge>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Staff</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">From</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">To</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Reason</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Status</th>
                      {isManager && <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {leaveRequests.map(request => (
                      <tr key={request.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">
                              {request.staff?.user.first_name} {request.staff?.user.last_name}
                            </p>
                            <p className="text-sm text-gray-500">{request.staff?.staff_code}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 capitalize">{request.leave_type}</td>
                        <td className="py-3 px-4">{new Date(request.start_date).toLocaleDateString()}</td>
                        <td className="py-3 px-4">{new Date(request.end_date).toLocaleDateString()}</td>
                        <td className="py-3 px-4 max-w-xs truncate">{request.reason || '-'}</td>
                        <td className="py-3 px-4">
                          <Badge className={
                            request.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                            request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-amber-100 text-amber-800'
                          }>
                            {request.status}
                          </Badge>
                        </td>
                        {isManager && (
                          <td className="py-3 px-4">
                            {request.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedLeaveRequest(request);
                                  setIsLeaveModalOpen(true);
                                }}
                              >
                                Review
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {leaveRequests.length === 0 && (
                  <div className="text-center py-12">
                    <Coffee className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No leave requests</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Create Schedule Modal */}
          <Dialog open={isCreateScheduleOpen} onOpenChange={setIsCreateScheduleOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Schedule</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Staff Member</label>
                  <select
                    value={scheduleForm.staffId}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, staffId: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="">Select staff...</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.user.first_name} {s.user.last_name} ({s.staff_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shift</label>
                  <select
                    value={scheduleForm.shiftId}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, shiftId: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="">Select shift...</option>
                    {shifts.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.start_time} - {s.end_time})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <Input
                    type="date"
                    value={scheduleForm.scheduleDate}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, scheduleDate: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Floors</label>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(floor => (
                      <button
                        key={floor}
                        type="button"
                        onClick={() => {
                          setScheduleForm(prev => ({
                            ...prev,
                            assignedFloors: prev.assignedFloors.includes(floor)
                              ? prev.assignedFloors.filter(f => f !== floor)
                              : [...prev.assignedFloors, floor]
                          }));
                        }}
                        className={`px-3 py-1 rounded border ${
                          scheduleForm.assignedFloors.includes(floor)
                            ? 'bg-cyan-100 border-cyan-300 text-cyan-700'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        Floor {floor}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsCreateScheduleOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createSchedule} disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create Schedule'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Leave Review Modal */}
          <Dialog open={isLeaveModalOpen} onOpenChange={setIsLeaveModalOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Review Leave Request</DialogTitle>
              </DialogHeader>

              {selectedLeaveRequest && (
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Staff</p>
                      <p className="font-medium">
                        {selectedLeaveRequest.staff?.user.first_name} {selectedLeaveRequest.staff?.user.last_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Type</p>
                      <p className="font-medium capitalize">{selectedLeaveRequest.leave_type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">From</p>
                      <p className="font-medium">{new Date(selectedLeaveRequest.start_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">To</p>
                      <p className="font-medium">{new Date(selectedLeaveRequest.end_date).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {selectedLeaveRequest.reason && (
                    <div>
                      <p className="text-sm text-gray-500">Reason</p>
                      <p className="font-medium">{selectedLeaveRequest.reason}</p>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button
                      variant="destructive"
                      onClick={() => reviewLeaveRequest(false)}
                      disabled={isSubmitting}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => reviewLeaveRequest(true)}
                      disabled={isSubmitting}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
