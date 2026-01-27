'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSBadge } from '@/components/ui/ios-badge';
import { staffAPI } from '@/lib/api';
import {
    Calendar,
    RefreshCw,
    Clock,
    CheckCircle,
    XCircle,
    User,
    Search,
    ChevronLeft,
    ChevronRight,
    Filter,
    Info
} from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface AttendanceRecord {
    id: string;
    staff_id: string;
    staff_name: string;
    attendance_date: string;
    clock_in: string;
    clock_out?: string;
    in_method: string;
    out_method?: string;
    status: 'present' | 'absent' | 'late' | 'excused';
    hours_normal: number;
    hours_ot_weekday: number;
    hours_ot_rest: number;
    hours_ot_holiday: number;
    hours_night: number;
    is_approved: boolean;
    rejection_reason?: string;
    department?: string;
    issues?: string[];
}

export default function HRAttendancePage() {
    const { user } = useAuth();
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [searchQuery, setSearchQuery] = useState('');

    const [showOnlyOnDuty, setShowOnlyOnDuty] = useState(false);

    const fetchRecords = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await staffAPI.getAttendanceReports({
                startDate: selectedDate,
                endDate: selectedDate
            });
            if (response.success) {
                setRecords(response.data || []);
                setSummary(response.summary);
            }
        } catch (error) {
            console.error('Error fetching attendance reports:', error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    const handleApprove = async (id: string, approved: boolean) => {
        try {
            const response = await staffAPI.approveAttendance(id, {
                approved,
                rejection_reason: approved ? undefined : 'Unverified'
            });
            if (response.success) {
                toast.success(approved ? 'Attendance approved' : 'Attendance rejected');
                fetchRecords();
            }
        } catch (error) {
            toast.error('Failed to update attendance status');
        }
    };

    const handleExport = () => {
        if (records.length === 0) return;

        const headers = ['Staff Name', 'Department', 'Clock In', 'Clock Out', 'Normal Hours', 'OT Hours', 'Night Hours', 'Status'];
        const rows = records.map(r => [
            `${r.staff?.user?.first_name} ${r.staff?.user?.last_name}`,
            r.staff?.user?.department || '',
            r.clock_in,
            r.clock_out || '',
            r.hours_normal || 0,
            (Number(r.hours_ot_weekday || 0) + Number(r.hours_ot_rest || 0) + Number(r.hours_ot_holiday || 0)).toFixed(1),
            r.hours_night || 0,
            r.is_approved ? 'Approved' : 'Pending'
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `attendance_report_${selectedDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredRecords = records.filter(r => {
        const staffName = (r.staff?.user?.first_name + ' ' + r.staff?.user?.last_name).toLowerCase();
        const nameMatch = staffName.includes(searchQuery.toLowerCase());
        const deptMatch = r.staff?.user?.department?.toLowerCase().includes(searchQuery.toLowerCase());
        const dutyMatch = !showOnlyOnDuty || !r.clock_out;
        return (nameMatch || deptMatch) && dutyMatch;
    });

    const stats = {
        present: records.length,
        totalOT: (summary?.totalOTWeekday || 0) + (summary?.totalOTRest || 0) + (summary?.totalOTHoliday || 0),
        pendingApproval: records.filter(r => !r.is_approved).length,
        onDuty: records.filter(r => !r.clock_out).length
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.HR_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Attendance & Compliance</h1>
                            <p className="text-stone-500 mt-0.5">Kenyan Labour Law hour tracking and verification</p>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton variant="secondary" onClick={handleExport} leftIcon={<Filter className="h-4 w-4" />}>
                                Export CSV
                            </IOSButton>
                            <div className="flex gap-2 mx-2">
                                <IOSButton variant="primary" onClick={() => window.open('/dashboard/hr/terminal', '_blank')} leftIcon={<Clock className="h-4 w-4" />}>
                                    Open Terminal
                                </IOSButton>
                            </div>
                            <div className="flex items-center bg-stone-100 rounded-ios-lg p-1">
                                <button
                                    onClick={() => {
                                        const d = new Date(selectedDate);
                                        d.setDate(d.getDate() - 1);
                                        setSelectedDate(d.toISOString().split('T')[0]);
                                    }}
                                    className="p-2 hover:bg-white rounded-ios-md transition-colors"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="bg-transparent border-none text-[13px] font-bold text-stone-700 focus:ring-0 w-32 px-1 text-center"
                                />
                                <button
                                    onClick={() => {
                                        const d = new Date(selectedDate);
                                        d.setDate(d.getDate() + 1);
                                        setSelectedDate(d.toISOString().split('T')[0]);
                                    }}
                                    className="p-2 hover:bg-white rounded-ios-md transition-colors"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                            <IOSButton variant="secondary" onClick={fetchRecords} leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}>
                                Refresh
                            </IOSButton>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <IOSCard
                            className={`p-4 border-l-4 cursor-pointer transition-all ${showOnlyOnDuty ? 'border-l-blue-600 ring-2 ring-blue-600/10' : 'border-l-[#34C759]'}`}
                            onClick={() => setShowOnlyOnDuty(!showOnlyOnDuty)}
                        >
                            <User className={`h-5 w-5 mb-2 ${showOnlyOnDuty ? 'text-blue-600' : 'text-[#34C759]'}`} />
                            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">{showOnlyOnDuty ? "Showing On-Duty" : "Active Today"}</p>
                            <p className={`text-2xl font-bold ${showOnlyOnDuty ? 'text-blue-600' : 'text-[#34C759]'}`}>{showOnlyOnDuty ? stats.onDuty : stats.present}</p>
                        </IOSCard>
                        <IOSCard className="p-4 border-l-4 border-l-blue-500">
                            <Clock className="h-5 w-5 text-blue-500 mb-2" />
                            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">OT Hours</p>
                            <p className="text-2xl font-bold text-blue-500">{stats.totalOT.toFixed(1)}h</p>
                        </IOSCard>
                        <IOSCard className="p-4 border-l-4 border-l-amber-500">
                            <Info className="h-5 w-5 text-amber-500 mb-2" />
                            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Pending Appr.</p>
                            <p className="text-2xl font-bold text-amber-500">{stats.pendingApproval}</p>
                        </IOSCard>
                        <IOSCard className="p-4 border-l-4 border-l-purple-500">
                            <Clock className="h-5 w-5 text-purple-500 mb-2" />
                            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Night Hours</p>
                            <p className="text-2xl font-bold text-purple-500">{(summary?.totalNight || 0).toFixed(1)}h</p>
                        </IOSCard>
                    </div>

                    <IOSCard className="p-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                            <Input
                                placeholder="Search by staff name or department..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-11 bg-stone-50 border-stone-100"
                            />
                        </div>
                    </IOSCard>

                    <IOSCard className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-stone-50/50">
                                        <th className="px-5 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Staff member</th>
                                        <th className="px-5 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Method</th>
                                        <th className="px-5 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Normal</th>
                                        <th className="px-5 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Overtime</th>
                                        <th className="px-5 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Compliance</th>
                                        <th className="px-5 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={6} className="px-5 py-20 text-center">
                                                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-stone-200 mb-2" />
                                                <p className="text-stone-400 text-sm font-medium">Crunching labour data...</p>
                                            </td>
                                        </tr>
                                    ) : filteredRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-5 py-20 text-center">
                                                <p className="text-stone-500 mt-1 font-medium">No records for this period</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRecords.map((record: any) => {
                                            const totalOT = Number(record.hours_ot_weekday || 0) +
                                                Number(record.hours_ot_rest || 0) +
                                                Number(record.hours_ot_holiday || 0);
                                            const staffName = record.staff?.user?.first_name + ' ' + record.staff?.user?.last_name;

                                            return (
                                                <tr key={record.id} className="hover:bg-stone-50/50 transition-colors group">
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 font-bold text-[10px] border border-stone-200 uppercase">
                                                                {staffName.split(' ').map((n: string) => n[0]).join('')}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-stone-900 leading-none">{staffName}</p>
                                                                <p className="text-[11px] text-stone-500 font-medium mt-1 uppercase tracking-tight">
                                                                    {new Date(record.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    {record.clock_out ? ` - ${new Date(record.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' (On-Duty)'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <div className="flex flex-col gap-1">
                                                            <IOSBadge variant="secondary" className="w-fit text-[10px] opacity-70">
                                                                IN: {record.in_method}
                                                            </IOSBadge>
                                                            {record.out_method && (
                                                                <IOSBadge variant="secondary" className="w-fit text-[10px] opacity-70">
                                                                    OUT: {record.out_method}
                                                                </IOSBadge>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-sm font-bold text-stone-700">
                                                        {record.hours_normal?.toFixed(1) || '0.0'}h
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <p className="text-sm font-bold text-blue-600 leading-none">{totalOT.toFixed(1)}h</p>
                                                        {record.hours_night > 0 && (
                                                            <p className="text-[10px] text-purple-600 font-bold mt-1">NIGHT: {record.hours_night.toFixed(1)}h</p>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        {record.issues && record.issues.length > 0 ? (
                                                            <div className="space-y-1">
                                                                {record.issues.map((msg: string, i: number) => (
                                                                    <div key={i} className="flex items-center gap-1.5 text-[10px] font-bold text-rose-500 uppercase">
                                                                        <Info className="h-3 w-3" />
                                                                        {msg}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <IOSBadge variant="success">Compliant</IOSBadge>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 text-right">
                                                        {!record.is_approved ? (
                                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => handleApprove(record.id, true)}
                                                                    className="p-2 bg-emerald-100 text-emerald-700 rounded-ios-lg hover:bg-emerald-200 transition-colors"
                                                                >
                                                                    <CheckCircle className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleApprove(record.id, false)}
                                                                    className="p-2 bg-rose-100 text-rose-700 rounded-ios-lg hover:bg-rose-200 transition-colors"
                                                                >
                                                                    <XCircle className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <IOSBadge variant="secondary" className="opacity-40">Verified</IOSBadge>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </IOSCard>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
