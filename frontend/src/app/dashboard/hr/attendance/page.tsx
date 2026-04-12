'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSBadge } from '@/components/ui/ios-badge';
import { staffAPI, systemAPI } from '@/lib/api';
import Link from 'next/link';
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
    Info,
    ArrowLeft
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
    issues?: string[];
    staff?: {
        first_name: string;
        last_name: string;
        department?: string;
    }
}

export default function HRAttendancePage() {
    const { user } = useAuth();
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [searchQuery, setSearchQuery] = useState('');
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('all');

    const [showOnlyOnDuty, setShowOnlyOnDuty] = useState(false);

    const fetchRecords = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await staffAPI.getAttendanceReports({
                startDate: selectedDate,
                endDate: selectedDate,
                branchId: selectedBranch === 'all' ? undefined : selectedBranch
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
    }, [selectedDate, selectedBranch]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    // Fetch branches on mount
    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const response = await systemAPI.getBranches();
                if (response.success && response.data) {
                    setBranches(response.data);
                }
            } catch (error) {
                console.error('Error fetching branches:', error);
            }
        };
        fetchBranches();
    }, []);

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
            `${r.staff?.first_name || ''} ${r.staff?.last_name || ''}`.trim() || 'Unknown',
            r.staff?.department || '',
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
        const staffName = `${r.staff?.first_name || ''} ${r.staff?.last_name || ''}`.trim().toLowerCase();
        const nameMatch = staffName.includes(searchQuery.toLowerCase());
        const deptMatch = r.staff?.department?.toLowerCase().includes(searchQuery.toLowerCase());
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
        <ProtectedRoute allowedRoles={[UserRole.HR_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <DashboardLayout>
                <div className="space-y-8 animate-ios-fade-in">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                        <div>
                            <h1 className="text-[28px] font-bold text-stone-900 tracking-tight font-sf-pro-display">Personnel Logs</h1>
                            <p className="text-stone-500 font-medium">Compliance verification and labor hour audit</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                onClick={handleExport}
                                className="px-4 py-2 rounded-full border border-stone-200 bg-white text-stone-600 text-sm font-bold hover:bg-stone-50 transition-all flex items-center gap-2 active:scale-95 shadow-sm"
                            >
                                <Filter className="h-4 w-4" />
                                <span>Export Audit</span>
                            </button>
                            <button
                                onClick={() => window.open('/dashboard/hr/terminal', '_blank')}
                                className="px-4 py-2 rounded-full bg-stone-900 text-white text-sm font-bold hover:bg-stone-800 transition-all flex items-center gap-2 active:scale-95 shadow-md"
                            >
                                <Clock className="h-4 w-4" />
                                <span>Registry Terminal</span>
                            </button>
                        </div>
                    </div>

                    {/* Controls & Sync */}
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-stone-50 p-2 rounded-2xl border border-stone-100">
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                            {/* Date Picker */}
                            <div className="flex items-center bg-white rounded-xl border border-stone-200 p-1 shadow-sm w-full sm:w-auto">
                                <button
                                    onClick={() => {
                                        const d = new Date(selectedDate);
                                        d.setDate(d.getDate() - 1);
                                        setSelectedDate(d.toISOString().split('T')[0]);
                                    }}
                                    className="p-2 hover:bg-stone-50 rounded-lg text-stone-400 hover:text-stone-900 transition-colors"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="bg-transparent border-none text-[13px] font-bold text-stone-900 focus:ring-0 w-36 px-2 text-center"
                                />
                                <button
                                    onClick={() => {
                                        const d = new Date(selectedDate);
                                        d.setDate(d.getDate() + 1);
                                        setSelectedDate(d.toISOString().split('T')[0]);
                                    }}
                                    className="p-2 hover:bg-stone-50 rounded-lg text-stone-400 hover:text-stone-900 transition-colors"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Branch Filter */}
                            <div className="flex items-center bg-white rounded-xl border border-stone-200 p-1 shadow-sm w-full sm:w-auto">
                                <select
                                    value={selectedBranch}
                                    onChange={(e) => setSelectedBranch(e.target.value)}
                                    className="bg-transparent border-none text-[13px] font-bold text-stone-900 focus:ring-0 px-3 py-2 cursor-pointer w-full sm:w-auto"
                                >
                                    <option value="all">All Branches</option>
                                    {branches.map((branch) => (
                                        <option key={branch.id} value={branch.id}>
                                            {branch.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 w-full lg:w-auto">
                            <div className="relative flex-1 lg:flex-none">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                                <input
                                    placeholder="Filter by name or department..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full lg:w-[280px] pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-xl text-[13px] text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-400 transition-all placeholder:text-stone-400"
                                />
                            </div>
                            <button
                                onClick={fetchRecords}
                                disabled={isLoading}
                                className="w-11 h-11 rounded-xl bg-white border border-stone-200 text-stone-500 hover:bg-stone-50 transition-all flex items-center justify-center shadow-sm active:scale-95"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Insights Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div
                            className={`p-5 rounded-2xl bg-white border cursor-pointer transition-all shadow-sm group ${showOnlyOnDuty ? 'border-l-4 border-l-blue-600 ring-4 ring-blue-50/50 text-blue-600' : 'border-l-4 border-l-emerald-500 border-stone-100 hover:border-stone-200'}`}
                            onClick={() => setShowOnlyOnDuty(!showOnlyOnDuty)}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{showOnlyOnDuty ? "Active Now" : "Total Registry"}</p>
                                    <p className="text-2xl font-bold mt-1">{showOnlyOnDuty ? stats.onDuty : stats.present}</p>
                                </div>
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${showOnlyOnDuty ? 'bg-blue-50' : 'bg-emerald-50'}`}>
                                    <User className={`h-4 w-4 ${showOnlyOnDuty ? 'text-blue-400' : 'text-emerald-400'}`} />
                                </div>
                            </div>
                        </div>

                        <div className="p-5 rounded-2xl bg-white border border-stone-100 border-l-4 border-l-sky-500 shadow-sm">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">OT Hours</p>
                                    <p className="text-2xl font-bold text-sky-600 mt-1">{stats.totalOT.toFixed(1)}h</p>
                                </div>
                                <div className="w-9 h-9 rounded-full bg-sky-50 flex items-center justify-center">
                                    <Clock className="h-4 w-4 text-sky-400" />
                                </div>
                            </div>
                        </div>

                        <div className="p-5 rounded-2xl bg-white border border-stone-100 border-l-4 border-l-amber-500 shadow-sm">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Pending Appr.</p>
                                    <p className="text-2xl font-bold text-amber-600 mt-1">{stats.pendingApproval}</p>
                                </div>
                                <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center">
                                    <Info className="h-4 w-4 text-amber-400" />
                                </div>
                            </div>
                        </div>

                        <div className="p-5 rounded-2xl bg-white border border-stone-100 border-l-4 border-l-indigo-500 shadow-sm">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Night Shifts</p>
                                    <p className="text-2xl font-bold text-indigo-600 mt-1">{(summary?.totalNight || 0).toFixed(1)}h</p>
                                </div>
                                <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center">
                                    <Clock className="h-4 w-4 text-indigo-400" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-stone-50/50 border-b border-stone-100">
                                        <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Personnel</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Method</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-center">Hours</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-center">Overtime</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Audit Status</th>
                                        <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-right">Verification</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-20 text-center">
                                                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-stone-200 mb-2" />
                                                <p className="text-stone-400 text-[13px] font-medium">Synchronizing logs...</p>
                                            </td>
                                        </tr>
                                    ) : filteredRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-20 text-center text-stone-400 font-medium italic">
                                                No activity logs found for this period
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredRecords.map((record: any) => {
                                            const totalOT = Number(record.hours_ot_weekday || 0) +
                                                Number(record.hours_ot_rest || 0) +
                                                Number(record.hours_ot_holiday || 0);
                                            const staffName = `${record.staff?.first_name || ''} ${record.staff?.last_name || ''}`.trim() || 'Unknown Staff';

                                            return (
                                                <tr key={record.id} className="hover:bg-stone-50/50 transition-colors group">
                                                    <td className="px-6 py-5">
                                                        <Link
                                                            href={`/dashboard/hr/attendance/${record.staff_id}`}
                                                            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                                                        >
                                                            <div className="w-9 h-9 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600 font-bold text-[10px] uppercase">
                                                                {staffName.split(' ').map((n: string) => n[0]).join('')}
                                                            </div>
                                                            <div>
                                                                <p className="text-[14px] font-bold text-stone-900 leading-none group-hover:text-[#007AFF] transition-colors">{staffName}</p>
                                                                <p className="text-[11px] text-stone-400 font-bold mt-1.5 uppercase tracking-tighter">
                                                                    {new Date(record.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    {record.clock_out ? ` — ${new Date(record.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ' (On-Duty)'}
                                                                </p>
                                                            </div>
                                                        </Link>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex flex-col gap-1.5">
                                                            <div className="inline-flex items-center px-2 py-0.5 rounded bg-stone-100 text-[9px] font-bold text-stone-500 uppercase tracking-widest w-fit">
                                                                IN: {record.in_method}
                                                            </div>
                                                            {record.out_method && (
                                                                <div className="inline-flex items-center px-2 py-0.5 rounded bg-stone-100 text-[9px] font-bold text-stone-500 uppercase tracking-widest w-fit">
                                                                    OUT: {record.out_method}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <span className="text-[14px] font-bold text-stone-700">{record.hours_normal?.toFixed(1) || '0.0'}h</span>
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        <p className="text-[14px] font-bold text-sky-600 leading-none">{totalOT.toFixed(1)}h</p>
                                                        {record.hours_night > 0 && (
                                                            <p className="text-[10px] text-indigo-600 font-bold mt-1 uppercase tracking-tighter">Night: {record.hours_night.toFixed(1)}h</p>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        {record.issues && record.issues.length > 0 ? (
                                                            <div className="space-y-1.5">
                                                                {record.issues.map((msg: string, i: number) => (
                                                                    <div key={i} className="flex items-center gap-1.5 text-[10px] font-bold text-rose-500 uppercase tracking-tight">
                                                                        <Info className="h-3 w-3" />
                                                                        {msg}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold uppercase tracking-widest border border-emerald-100">
                                                                Compliant
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-5 text-right">
                                                        {!record.is_approved ? (
                                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => handleApprove(record.id, true)}
                                                                    className="w-8 h-8 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm border border-emerald-100"
                                                                    title="Verify Entry"
                                                                >
                                                                    <CheckCircle className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleApprove(record.id, false)}
                                                                    className="w-8 h-8 flex items-center justify-center bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all shadow-sm border border-rose-100"
                                                                    title="Invalidate Entry"
                                                                >
                                                                    <XCircle className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-stone-50 text-stone-400 text-[9px] font-bold uppercase tracking-widest border border-stone-200 select-none">
                                                                Verified
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
