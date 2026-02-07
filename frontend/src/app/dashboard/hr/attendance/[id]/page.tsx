'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { staffAPI } from '@/lib/api';
import { toast } from 'sonner';
import {
    Calendar,
    Clock,
    ArrowLeft,
    Briefcase,
    Clock3,
    AlertCircle,
    CheckCircle2,
    CalendarDays,
    Info,
    ChevronLeft,
    ChevronRight,
    RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function StaffAttendanceDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const [staff, setStaff] = useState<any>(null);
    const [attendance, setAttendance] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const fetchData = useCallback(async () => {
        if (!id) return;
        setIsLoading(true);
        try {
            const [staffRes, attendanceRes, summaryRes, leaveRes] = await Promise.all([
                staffAPI.getStaffMember(id as string),
                staffAPI.getAttendance({ staff_id: id as string, limit: 1000 }),
                staffAPI.getAttendanceSummary(id as string),
                staffAPI.getLeaveRequests({ staff_id: id as string })
            ]);

            if (staffRes.success) setStaff(staffRes.data);
            if (attendanceRes.success) setAttendance(attendanceRes.data || []);
            if (summaryRes.success) setSummary(summaryRes.data);
            if (leaveRes.success) setLeaveRequests(leaveRes.data || []);
        } catch (error) {
            console.error('Error fetching staff attendance data:', error);
            toast.error('Failed to load attendance records');
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Heatmap Logic
    const heatmapData = useMemo(() => {
        const daysInYear = 365;
        const startOfYear = new Date(selectedYear, 0, 1);
        const data: { [key: string]: 'present' | 'absent' | 'overtime' | 'late' | 'excused' } = {};

        console.log('[Heatmap] Processing attendance records:', attendance.length);

        attendance.forEach(record => {
            const dateStr = record.attendance_date.split('T')[0];
            const hasOT = (Number(record.hours_ot_weekday || 0) + Number(record.hours_ot_rest || 0)) > 0;
            const isLate = record.status === 'late';

            if (hasOT) data[dateStr] = 'overtime';
            else if (isLate) data[dateStr] = 'late';
            else data[dateStr] = 'present';
        });

        console.log('[Heatmap] Processed attendance data:', Object.keys(data).length, 'days with attendance');

        const calendar: any[] = [];
        for (let i = 0; i < 371; i++) {
            const d = new Date(startOfYear);
            d.setDate(d.getDate() + i);
            if (d.getFullYear() !== selectedYear) continue;

            const dateStr = d.toISOString().split('T')[0];
            calendar.push({
                date: d,
                status: data[dateStr] || 'absent'
            });
        }

        console.log('[Heatmap] Generated calendar:', calendar.length, 'days');
        console.log('[Heatmap] Sample days:', calendar.slice(0, 5).map(d => ({ date: d.date.toISOString().split('T')[0], status: d.status })));

        return calendar;
    }, [attendance, selectedYear]);

    const stats = useMemo(() => {
        const presentDays = attendance.length;
        const totalHours = attendance.reduce((acc, curr) => acc + (curr.hours_normal || 0), 0);
        const totalOT = attendance.reduce((acc, curr) => acc + (curr.hours_ot_weekday || 0) + (curr.hours_ot_rest || 0) + (curr.hours_ot_holiday || 0), 0);
        const leaveDaysTaken = leaveRequests.filter(r => r.status === 'approved').reduce((acc, curr) => acc + (curr.duration_days || 0), 0);
        const pendingLeaves = leaveRequests.filter(r => r.status === 'pending').length;

        return {
            presentDays,
            totalHours: totalHours.toFixed(1),
            totalOT: totalOT.toFixed(1),
            leaveDaysTaken,
            pendingLeaves
        };
    }, [attendance, leaveRequests]);

    if (isLoading && !staff) {
        return (
            <ProtectedRoute allowedRoles={[UserRole.HR_MANAGER, UserRole.SUPER_ADMIN]}>
                <DashboardLayout>
                    <div className="flex items-center justify-center h-[60vh]">
                        <RefreshCw className="h-8 w-8 animate-spin text-stone-200" />
                    </div>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return (
        <ProtectedRoute allowedRoles={[UserRole.HR_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-8 animate-ios-fade-in pb-20">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                        <div>
                            <button
                                onClick={() => router.back()}
                                className="flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-900 mb-3 transition-colors"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                <span>Back</span>
                            </button>
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-stone-900 text-white flex items-center justify-center text-xl font-bold shadow-lg">
                                    {staff?.user?.first_name?.[0]}{staff?.user?.last_name?.[0]}
                                </div>
                                <div>
                                    <h1 className="text-[28px] font-bold text-stone-900 tracking-tight font-sf-pro-display">
                                        {staff?.user?.first_name} {staff?.user?.last_name}
                                    </h1>
                                    <p className="text-stone-500 font-medium">
                                        {staff?.role} • {staff?.department || 'General Department'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="bg-white border border-stone-200 rounded-xl p-1 flex shadow-sm">
                                <button
                                    onClick={() => setSelectedYear(prev => prev - 1)}
                                    className="p-2 hover:bg-stone-50 rounded-lg text-stone-400 hover:text-stone-900 transition-colors"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <div className="px-4 py-2 text-sm font-bold text-stone-900">{selectedYear}</div>
                                <button
                                    onClick={() => setSelectedYear(prev => prev + 1)}
                                    className="p-2 hover:bg-stone-50 rounded-lg text-stone-400 hover:text-stone-900 transition-colors"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm border-l-4 border-l-emerald-500">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Days Attended</p>
                                    <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.presentDays}</p>
                                </div>
                                <CalendarDays className="h-4 w-4 text-emerald-300" />
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm border-l-4 border-l-blue-500">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Normal Hours</p>
                                    <p className="text-2xl font-bold text-blue-600 mt-1">{stats.totalHours}h</p>
                                </div>
                                <Clock3 className="h-4 w-4 text-blue-300" />
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm border-l-4 border-l-sky-500">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">OT Hours</p>
                                    <p className="text-2xl font-bold text-sky-600 mt-1">{stats.totalOT}h</p>
                                </div>
                                <Clock className="h-4 w-4 text-sky-300" />
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm border-l-4 border-l-indigo-500">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Leave Taken</p>
                                    <p className="text-2xl font-bold text-indigo-600 mt-1">{stats.leaveDaysTaken}d</p>
                                </div>
                                <Briefcase className="h-4 w-4 text-indigo-300" />
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm border-l-4 border-l-amber-500">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Pending Leave</p>
                                    <p className="text-2xl font-bold text-amber-600 mt-1">{stats.pendingLeaves}</p>
                                </div>
                                <AlertCircle className="h-4 w-4 text-amber-300" />
                            </div>
                        </div>
                    </div>

                    {/* Heatmap UI */}
                    <div className="bg-white p-8 rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-lg font-bold text-stone-900 group flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-stone-400" />
                                Yearly Attendance Heatmap
                            </h3>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                    <span>Less</span>
                                    <div className="flex gap-1">
                                        <div className="w-3 h-3 rounded-sm bg-stone-50 border border-stone-100"></div>
                                        <div className="w-3 h-3 rounded-sm bg-emerald-100"></div>
                                        <div className="w-3 h-3 rounded-sm bg-emerald-300"></div>
                                        <div className="w-3 h-3 rounded-sm bg-emerald-500"></div>
                                        <div className="w-3 h-3 rounded-sm bg-sky-500"></div>
                                    </div>
                                    <span>More</span>
                                </div>
                            </div>
                        </div>

                        <div className="relative overflow-x-auto pb-4 scrollbar-hide">
                            <div className="flex gap-1 min-w-max">
                                {/* Week Days Labels */}
                                <div className="flex flex-col gap-1 pr-2 pt-6 text-[9px] font-bold text-stone-300 uppercase">
                                    <div className="h-3 leading-none">Mon</div>
                                    <div className="h-3"></div>
                                    <div className="h-3 leading-none">Wed</div>
                                    <div className="h-3"></div>
                                    <div className="h-3 leading-none">Fri</div>
                                    <div className="h-3"></div>
                                    <div className="h-3 leading-none">Sun</div>
                                </div>

                                {/* Heatmap Grid */}
                                <div className="flex-1">
                                    {/* Month Labels */}
                                    <div className="flex mb-2 text-[10px] font-bold text-stone-400 uppercase tracking-tighter">
                                        {months.map((m, idx) => (
                                            <div key={idx} className="flex-1 min-w-[3.5rem]">{m}</div>
                                        ))}
                                    </div>

                                    <div className="grid grid-flow-col grid-rows-7 gap-1 auto-cols-[12px]">
                                        {heatmapData.map((day, idx) => {
                                            let color = 'bg-stone-50 border-stone-100';
                                            if (day.status === 'present') color = 'bg-emerald-300 border-emerald-400/20';
                                            if (day.status === 'overtime') color = 'bg-sky-500 border-sky-600/20 shadow-sm';
                                            if (day.status === 'late') color = 'bg-amber-400 border-amber-500/20';

                                            return (
                                                <div
                                                    key={idx}
                                                    className={`w-3 h-3 rounded-sm border transition-all hover:scale-125 cursor-help ${color}`}
                                                    title={`${day.date.toDateString()}: ${day.status.toUpperCase()}`}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-stone-50 flex flex-wrap gap-6">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-sm bg-emerald-300 shadow-sm"></div>
                                <span className="text-[11px] font-bold text-stone-500 uppercase">Standard Presence</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-sm bg-sky-500 shadow-sm"></div>
                                <span className="text-[11px] font-bold text-stone-500 uppercase">Overtime (OT)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-sm bg-amber-400 shadow-sm"></div>
                                <span className="text-[11px] font-bold text-stone-500 uppercase">Lateness Detected</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-sm bg-stone-50 border border-stone-100 shadow-sm"></div>
                                <span className="text-[11px] font-bold text-stone-500 uppercase">Off-duty / Absent</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Attendance Timeline */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-stone-900">Recent Registry Logs</h3>
                                <button className="text-[12px] font-bold text-[#007AFF] uppercase hover:underline">View Full Audit</button>
                            </div>

                            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-stone-50 border-b border-stone-100">
                                                <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Date</th>
                                                <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Hours</th>
                                                <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-center">In/Out</th>
                                                <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-right">Audit</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-50">
                                            {attendance.slice(0, 10).map((record) => (
                                                <tr key={record.id} className="hover:bg-stone-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <p className="text-sm font-bold text-stone-900">{new Date(record.attendance_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mt-0.5">{record.status}</p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-stone-700">{record.hours_normal?.toFixed(1) || '0.0'}h</span>
                                                            {(record.hours_ot_weekday + record.hours_ot_rest) > 0 && (
                                                                <span className="text-[10px] font-bold text-sky-600">+{((record.hours_ot_weekday || 0) + (record.hours_ot_rest || 0)).toFixed(1)}h OT</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="inline-flex flex-col items-center">
                                                            <div className="text-[12px] font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded uppercase tracking-tighter shadow-sm border border-stone-200">
                                                                {record.clock_in ? new Date(record.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                            </div>
                                                            <div className="h-2 w-px bg-stone-200"></div>
                                                            <div className="text-[12px] font-bold text-stone-400 bg-stone-50 px-2 py-0.5 rounded uppercase tracking-tighter border border-stone-100">
                                                                {record.clock_out ? new Date(record.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'ON-DUTY'}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        {record.is_approved ? (
                                                            <CheckCircle2 className="h-5 w-5 text-emerald-400 ml-auto" />
                                                        ) : (
                                                            <div className="w-5 h-5 rounded-full border-2 border-stone-100 ml-auto"></div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {attendance.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-12 text-center text-stone-400 text-sm italic font-medium">
                                                        No attendance records found in registry for current year
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Leave & Exceptions */}
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-stone-900">Leave Requests</h3>
                            <div className="space-y-3">
                                {leaveRequests.length === 0 ? (
                                    <div className="p-10 bg-white border border-stone-100 border-dashed rounded-2xl text-center">
                                        <p className="text-stone-400 text-xs font-medium">No leave requests found</p>
                                    </div>
                                ) : (
                                    leaveRequests.slice(0, 5).map((req) => (
                                        <div key={req.id} className="p-4 bg-white border border-stone-100 rounded-2xl shadow-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <p className="text-[12px] font-bold text-stone-900 uppercase tracking-tighter">{req.leave_type || 'Annual Leave'}</p>
                                                <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                                                    req.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                                                    }`}>
                                                    {req.status}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 text-stone-400 text-[11px] font-medium">
                                                <Calendar className="h-3 w-3" />
                                                <span>{new Date(req.start_date).toLocaleDateString()} — {new Date(req.end_date).toLocaleDateString()}</span>
                                            </div>
                                            <p className="mt-2 text-[11px] text-stone-500 line-clamp-2 leading-relaxed italic">
                                                "{req.reason || 'No reason provided'}"
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="bg-stone-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Info className="h-4 w-4 text-blue-400" />
                                        <h4 className="font-bold text-sm uppercase tracking-widest text-stone-400">Payroll Insight</h4>
                                    </div>
                                    <p className="text-2xl font-bold mb-1">
                                        {(Number(stats.totalHours) + Number(stats.totalOT) * 1.5).toFixed(1)} <span className="text-sm font-normal text-stone-500">Credited Units</span>
                                    </p>
                                    <p className="text-[10px] text-stone-500 font-medium leading-relaxed uppercase tracking-tighter">
                                        Calculated based on confirmed registry logs and holiday multipliers for the current selection.
                                    </p>
                                </div>
                                <div className="absolute -right-4 -bottom-4 opacity-10">
                                    <Clock className="w-24 h-24" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
