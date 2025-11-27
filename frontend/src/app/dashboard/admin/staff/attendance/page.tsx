'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, Plus, User, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Attendance {
  id: string;
  staff_id: string;
  attendance_date: string;
  clock_in?: string;
  clock_out?: string;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'leave' | 'holiday';
  shift_type?: 'morning' | 'afternoon' | 'evening' | 'night';
  overtime_hours?: number;
  notes?: string;
  created_at: string;
  staff?: {
    id: string;
    user: {
      id: string;
      full_name: string;
      email: string;
    };
  };
}

export default function AttendancePage() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [formData, setFormData] = useState({
    staff_id: '',
    attendance_date: new Date().toISOString().split('T')[0],
    clock_in: '',
    clock_out: '',
    status: 'present',
    shift_type: 'morning',
    overtime_hours: 0,
    notes: ''
  });

  useEffect(() => {
    fetchAttendance();
  }, [dateFilter, statusFilter]);

  const fetchAttendance = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      
      if (dateFilter) {
        params.append('startDate', dateFilter);
        params.append('endDate', dateFilter);
      }
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const url = `${API_URL}/api/staff/attendance${params.toString() ? '?' + params.toString() : ''}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAttendance(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      toast.error('Failed to load attendance');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecordAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/staff/attendance`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success('Attendance recorded successfully');
        setIsModalOpen(false);
        setFormData({
          staff_id: '',
          attendance_date: new Date().toISOString().split('T')[0],
          clock_in: '',
          clock_out: '',
          status: 'present',
          shift_type: 'morning',
          overtime_hours: 0,
          notes: ''
        });
        fetchAttendance();
      } else {
        toast.error('Failed to record attendance');
      }
    } catch (error) {
      toast.error('Error recording attendance');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'absent': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'late': return <AlertCircle className="w-5 h-5 text-amber-600" />;
      case 'leave': return <Calendar className="w-5 h-5 text-blue-600" />;
      default: return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-500';
      case 'absent': return 'bg-red-500';
      case 'late': return 'bg-amber-500';
      case 'half_day': return 'bg-orange-500';
      case 'leave': return 'bg-blue-500';
      case 'holiday': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return 'N/A';
    return new Date(timeString).toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const stats = {
    total: attendance.length,
    present: attendance.filter(a => a.status === 'present').length,
    absent: attendance.filter(a => a.status === 'absent').length,
    late: attendance.filter(a => a.status === 'late').length
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Staff Attendance</h1>
            <p className="text-gray-600 mt-1">Track and manage daily attendance</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Record Attendance
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card className="p-4">
            <div className="text-sm text-gray-600">Total Records</div>
            <div className="text-2xl font-bold mt-1">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Present</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{stats.present}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Absent</div>
            <div className="text-2xl font-bold text-red-600 mt-1">{stats.absent}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Late</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{stats.late}</div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dateFilter">Date</Label>
              <Input
                id="dateFilter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="statusFilter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="statusFilter">
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="leave">Leave</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Attendance List */}
        {isLoading ? (
          <div className="text-center py-12">
            <p>Loading attendance...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {attendance.map((record) => (
              <Card key={record.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {getStatusIcon(record.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold">
                          {record.staff?.user?.full_name || 'Unknown Staff'}
                        </h3>
                        <Badge className={getStatusColor(record.status)}>
                          {record.status}
                        </Badge>
                        {record.shift_type && (
                          <Badge variant="outline">{record.shift_type}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-6 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(record.attendance_date).toLocaleDateString()}</span>
                        </div>
                        {record.clock_in && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>In: {formatTime(record.clock_in)}</span>
                          </div>
                        )}
                        {record.clock_out && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>Out: {formatTime(record.clock_out)}</span>
                          </div>
                        )}
                        {record.overtime_hours && record.overtime_hours > 0 && (
                          <div className="text-orange-600 font-medium">
                            OT: {record.overtime_hours}h
                          </div>
                        )}
                      </div>
                      {record.notes && (
                        <p className="text-sm text-gray-500 mt-1">{record.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && attendance.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No attendance records found for this date</p>
          </div>
        )}

        {/* Record Attendance Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Record Attendance</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleRecordAttendance} className="space-y-4">
              <div>
                <Label htmlFor="staff_id">Staff ID *</Label>
                <Input
                  id="staff_id"
                  required
                  value={formData.staff_id}
                  onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                  placeholder="Enter staff UUID"
                />
              </div>
              <div>
                <Label htmlFor="attendance_date">Date *</Label>
                <Input
                  id="attendance_date"
                  type="date"
                  required
                  value={formData.attendance_date}
                  onChange={(e) => setFormData({ ...formData, attendance_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="half_day">Half Day</SelectItem>
                    <SelectItem value="leave">Leave</SelectItem>
                    <SelectItem value="holiday">Holiday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="shift_type">Shift Type</Label>
                <Select
                  value={formData.shift_type}
                  onValueChange={(value: any) => setFormData({ ...formData, shift_type: value })}
                >
                  <SelectTrigger id="shift_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                    <SelectItem value="evening">Evening</SelectItem>
                    <SelectItem value="night">Night</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clock_in">Clock In</Label>
                  <Input
                    id="clock_in"
                    type="time"
                    value={formData.clock_in}
                    onChange={(e) => setFormData({ ...formData, clock_in: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="clock_out">Clock Out</Label>
                  <Input
                    id="clock_out"
                    type="time"
                    value={formData.clock_out}
                    onChange={(e) => setFormData({ ...formData, clock_out: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="overtime_hours">Overtime Hours</Label>
                <Input
                  id="overtime_hours"
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.overtime_hours}
                  onChange={(e) => setFormData({ ...formData, overtime_hours: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Record Attendance</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
