'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/minimal/card";
import { IOSBadge } from '@/components/ui/ios-badge';
import { staffAPI } from '@/lib/api';
import {
  RefreshCw, Calendar, Users, Timer,
  Search, Download, ChevronRight, CheckCircle2, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IOSButton } from '@/components/ui/ios-button';
import { FileText, Phone, Mail, Clock, User } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  staff_id: string;
  attendance_date: string;
  clock_in?: string;
  clock_out?: string;
  status: 'present' | 'absent' | 'late' | 'leave';
  notes?: string;
  staff?: {
    first_name: string;
    last_name: string;
    id_number?: string;
    department?: string;
  };
}

export default function BranchAttendancePage() {
  const { user } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');

  const currentBranchId = activeBranchId || user?.branch_id;

  const fetchData = useCallback(async () => {
    if (!currentBranchId) return;
    setIsLoading(true);
    try {
      const attendanceRes = await staffAPI.getAttendance({ branch_id: currentBranchId, date: selectedDate });

      if (attendanceRes.success) {
        const records = attendanceRes.data || [];
        setAttendance(records);

        // Compute stats from the data directly
        const totalHours = records.reduce((sum: number, r: any) => {
          if (r.clock_in && r.clock_out) {
            const diff = (new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()) / 3600000;
            return sum + diff;
          }
          return sum;
        }, 0);

        setAnalytics({
          total_staff: records.length,
          present: records.filter((r: any) => r.status === 'present').length,
          late: records.filter((r: any) => r.status === 'late').length,
          total_hours: totalHours.toFixed(1),
        });
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setIsLoading(false);
    }
  }, [currentBranchId, selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredAttendance = attendance.filter(a => {
    const name = `${a.staff?.first_name || ''} ${a.staff?.last_name || ''}`.toLowerCase();
    const id = (a.staff?.id_number || '').toLowerCase();
    return name.includes(searchQuery.toLowerCase()) || id.includes(searchQuery.toLowerCase());
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'success';
      case 'late': return 'warning';
      case 'absent': return 'danger';
      case 'leave': return 'secondary';
      default: return 'info';
    }
  };

  const handleExport = () => {
    if (filteredAttendance.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Date', 'Employee ID', 'Name', 'Clock In', 'Clock Out', 'Status', 'Notes'];
    const csvData = filteredAttendance.map(a => [
      a.attendance_date,
      a.staff?.id_number || '',
      `${a.staff?.first_name || ''} ${a.staff?.last_name || ''}`.trim(),
      a.clock_in ? format(new Date(a.clock_in), 'HH:mm:ss') : '',
      a.clock_out ? format(new Date(a.clock_out), 'HH:mm:ss') : '',
      a.status,
      a.notes || ''
    ]);

    const csvContent = [headers, ...csvData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_${selectedDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Attendance report exported');
  };

  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);

  const handleExportPDF = async () => {
    if (!currentBranchId) return;

    try {
      toast.loading('Generating PDF report...');

      // Use the attendance data we already have instead of fetching again
      const reportData = {
        total_staff: attendance.length,
        present_count: attendance.filter(a => a.status === 'present').length,
        late_count: attendance.filter(a => a.status === 'late').length,
        absent_count: 0,
        leave_count: attendance.filter(a => a.status === 'leave').length,
        total_hours: attendance.reduce((sum, a) => {
          if (a.clock_in && a.clock_out) {
            const diff = (new Date(a.clock_out).getTime() - new Date(a.clock_in).getTime()) / 3600000;
            return sum + diff;
          }
          return sum;
        }, 0),
        records: attendance.map(a => ({
          date: a.attendance_date,
          name: `${a.staff?.first_name || ''} ${a.staff?.last_name || ''}`.trim() || 'Unknown',
          employee_id: a.staff?.id_number || '',
          clock_in: a.clock_in,
          clock_out: a.clock_out,
          status: a.status,
          notes: a.notes || ''
        }))
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL}/api/reports/generate/branded-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType: 'employee_attendance',
          filters: {
            branch_id: currentBranchId,
            start_date: selectedDate,
            end_date: selectedDate,
            branch_name: activeBranch?.name || 'Branch'
          },
          data: reportData,
          useRealData: false
        }),
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Attendance_Report_${selectedDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.dismiss();
      toast.success('PDF report downloaded');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.dismiss();
      toast.error('Failed to export PDF');
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="max-w-7xl mx-auto space-y-8 pb-10">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Attendance Log</h1>
              <p className="text-sm text-stone-500 mt-1">Daily staff records for {activeBranch?.name}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-10 pl-9 pr-4 bg-white border border-stone-200 rounded-lg text-sm focus:ring-1 focus:ring-stone-400 outline-none transition-all"
                />
              </div>
              <button
                onClick={fetchData}
                className="h-10 w-10 flex items-center justify-center border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                title="Refresh data"
              >
                <RefreshCw className={`h-4 w-4 text-stone-600 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleExport}
                className="h-10 px-4 bg-white border border-stone-200 text-stone-700 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                CSV
              </button>
              <button
                onClick={handleExportPDF}
                className="h-10 px-4 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 transition-colors flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                PDF Report
              </button>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Total Staff', value: analytics?.total_staff || 0, icon: Users },
              { label: 'Present', value: analytics?.present || 0, icon: CheckCircle2 },
              { label: 'Late', value: analytics?.late || 0, icon: AlertCircle },
              { label: 'Total Hours', value: `${analytics?.total_hours || 0}h`, icon: Timer },
            ].map((stat, i) => (
              <div key={i} className="bg-white border border-stone-100 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2.5 mb-2">
                  <stat.icon className="h-4 w-4 text-stone-400" />
                  <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">{stat.label}</span>
                </div>
                <div className="text-2xl font-bold text-stone-900">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Main Content Area */}
          <Card className="border-stone-100 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-stone-50 bg-white py-5 px-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="text-lg font-medium text-stone-900">Records</CardTitle>
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <input
                    type="text"
                    placeholder="Search by name or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-10 pl-9 pr-3 text-sm bg-stone-50/50 border border-stone-200 rounded-lg focus:ring-1 focus:ring-stone-400 outline-none transition-all"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50/50 border-b border-stone-100">
                      <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Staff Member</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Employee ID</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Clock In</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Clock Out</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-16 text-center text-stone-400">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-3 opacity-20" />
                          <span className="text-sm">Loading records...</span>
                        </td>
                      </tr>
                    ) : filteredAttendance.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-16 text-center text-stone-400">
                          <span className="text-sm">No attendance records found for this date.</span>
                        </td>
                      </tr>
                    ) : (
                      filteredAttendance.map((record) => (
                        <tr key={record.id} className="hover:bg-stone-50/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 font-semibold text-xs">
                                {record.staff?.first_name?.[0]}{record.staff?.last_name?.[0]}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-stone-900">
                                  {record.staff?.first_name} {record.staff?.last_name}
                                </div>
                                <div className="text-[11px] text-stone-400">{record.staff?.department || '-'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-stone-600 font-mono">{record.staff?.id_number || '-'}</td>
                          <td className="px-6 py-4 text-sm text-stone-600">
                            {record.clock_in ? format(new Date(record.clock_in), 'HH:mm:ss') : '--:--'}
                          </td>
                          <td className="px-6 py-4 text-sm text-stone-600">
                            {record.clock_out ? format(new Date(record.clock_out), 'HH:mm:ss') : (
                              <span className="text-stone-400 italic">Active</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <IOSBadge color={getStatusColor(record.status)} variant="light" size="sm">
                              {record.status.toUpperCase()}
                            </IOSBadge>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setSelectedRecord(record)}
                              className="p-1.5 text-stone-300 hover:text-stone-600 transition-colors"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Details Modal */}
          <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
            <DialogContent className="max-w-2xl overflow-y-auto max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl font-sf-pro-display">
                  <FileText className="h-5 w-5 text-stone-600" />
                  Attendance Details
                </DialogTitle>
              </DialogHeader>

              {selectedRecord && (
                <div className="space-y-6 py-4">
                  <div className="flex items-center gap-5 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                    <div className="w-16 h-16 rounded-full bg-stone-200 flex items-center justify-center text-stone-700 font-bold text-xl shadow-sm">
                      {selectedRecord.staff?.first_name?.[0]}{selectedRecord.staff?.last_name?.[0]}
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-stone-900 tracking-tight">
                        {selectedRecord.staff?.first_name} {selectedRecord.staff?.last_name}
                      </h4>
                      <p className="text-sm text-stone-500 font-medium">{selectedRecord.staff?.department || '-'}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest bg-stone-100 px-2 py-0.5 rounded">ID: {selectedRecord.staff?.id_number || '-'}</span>
                        <IOSBadge color={getStatusColor(selectedRecord.status)} variant="light" size="sm">
                          {selectedRecord.status.toUpperCase()}
                        </IOSBadge>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white border border-stone-200 rounded-xl shadow-sm">
                      <div className="flex items-center gap-2 text-stone-400 mb-2">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Clock In</span>
                      </div>
                      <div className="text-lg font-semibold text-stone-900 leading-none">
                        {selectedRecord.clock_in ? format(new Date(selectedRecord.clock_in), 'HH:mm:ss') : '--:--'}
                      </div>
                      <p className="text-[10px] text-stone-400 mt-2 font-medium">{selectedDate}</p>
                    </div>
                    <div className="p-4 bg-white border border-stone-200 rounded-xl shadow-sm">
                      <div className="flex items-center gap-2 text-stone-400 mb-2">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Clock Out</span>
                      </div>
                      <div className="text-lg font-semibold text-stone-900 leading-none">
                        {selectedRecord.clock_out ? format(new Date(selectedRecord.clock_out), 'HH:mm:ss') : 'Active'}
                      </div>
                      <p className="text-[10px] text-stone-400 mt-2 font-medium">{selectedDate}</p>
                    </div>
                  </div>

                  {selectedRecord.notes && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider px-1">Supervisor Notes</label>
                      <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl text-stone-700 text-sm leading-relaxed">
                        {selectedRecord.notes}
                      </div>
                    </div>
                  )}

                  <div className="pt-6 border-t border-stone-100">
                    <IOSButton
                      className="w-full h-12 text-base font-semibold"
                      onClick={() => setSelectedRecord(null)}
                    >
                      Close Report
                    </IOSButton>
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
