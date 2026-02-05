'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { staffAPI, systemAPI } from '@/lib/api';
import { toast } from 'sonner';
import {
    Users,
    RefreshCw,
    Search,
    ChevronRight,
    Building2,
    ArrowLeft,
    CalendarCheck
} from 'lucide-react';
import Link from 'next/link';

interface Staff {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    department?: string;
    status: 'active' | 'inactive';
}

export default function StaffAttendanceLookupPage() {
    const { user } = useAuth();
    const [staff, setStaff] = useState<Staff[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [departments, setDepartments] = useState<any[]>([]);
    const [departmentFilter, setDepartmentFilter] = useState('');

    const fetchStaffData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [staffRes, departmentsRes] = await Promise.all([
                staffAPI.getStaff(),
                systemAPI.getDepartments()
            ]);

            if (staffRes.success) setStaff(staffRes.data || []);
            if (departmentsRes.success) setDepartments(departmentsRes.data || []);
        } catch (error) {
            console.error('Error fetching staff data:', error);
            toast.error('Failed to load personnel');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStaffData();
    }, [fetchStaffData]);

    const filteredStaff = staff.filter((s) => {
        const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
        const matchesSearch =
            fullName.includes(searchQuery.toLowerCase()) ||
            s.role?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesDepartment = departmentFilter ? s.department === departmentFilter : true;
        const isActive = s.status === 'active';

        return matchesSearch && matchesDepartment && isActive;
    });

    return (
        <ProtectedRoute allowedRoles={[UserRole.HR_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-8 animate-ios-fade-in">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                        <div>
                            <Link
                                href="/dashboard/hr"
                                className="flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-900 mb-3 transition-colors"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                <span>Back to HR Dashboard</span>
                            </Link>
                            <h1 className="text-[28px] font-bold text-stone-900 tracking-tight font-sf-pro-display">Staff Attendance</h1>
                            <p className="text-stone-500 font-medium">Select a team member to view their detailed attendance audit</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={fetchStaffData}
                                disabled={isLoading}
                                className="w-11 h-11 rounded-xl bg-white border border-stone-200 text-stone-500 hover:bg-stone-50 transition-all flex items-center justify-center shadow-sm active:scale-95"
                                title="Sync Personnel"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-stone-50 p-2 rounded-2xl border border-stone-100">
                        <div className="relative w-full lg:w-[450px]">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                            <input
                                placeholder="Search by name or role..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-white border border-stone-200 rounded-xl text-[14px] text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-400 transition-all placeholder:text-stone-400"
                            />
                        </div>

                        <div className="flex items-center gap-3 w-full lg:w-auto">
                            <select
                                value={departmentFilter}
                                onChange={(e) => setDepartmentFilter(e.target.value)}
                                className="flex-1 lg:flex-none px-4 py-3 bg-white border border-stone-200 rounded-xl text-[14px] text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-900/5 appearance-none min-w-[200px]"
                            >
                                <option value="">All Departments</option>
                                {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                            </select>
                            <div className="hidden sm:block px-5 py-3 bg-stone-900 text-white rounded-xl text-[13px] font-bold shadow-sm">
                                {filteredStaff.length} Active Staff
                            </div>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="h-24 bg-stone-50 rounded-2xl animate-pulse border border-stone-100" />
                            ))}
                        </div>
                    ) : filteredStaff.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-stone-100 border-dashed p-20 text-center">
                            <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-stone-100">
                                <Users className="h-8 w-8 text-stone-200" />
                            </div>
                            <h3 className="text-lg font-bold text-stone-900">No personnel matches</h3>
                            <p className="text-stone-500 mt-1">Try adjusting your filters or search query.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredStaff.map((member) => (
                                <Link
                                    key={member.id}
                                    href={`/dashboard/hr/attendance/${member.id}`}
                                    className="group p-5 bg-white border border-stone-100 rounded-2xl shadow-sm hover:shadow-md hover:border-stone-200 transition-all active:scale-[0.98]"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-stone-50 border border-stone-100 flex items-center justify-center text-stone-600 font-bold group-hover:bg-stone-100 transition-colors">
                                                {member.first_name?.[0]}{member.last_name?.[0]}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-stone-900 group-hover:text-stone-900">{member.first_name} {member.last_name}</h3>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <Building2 className="h-3 w-3 text-stone-300" />
                                                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-tighter">{member.department || 'General'} • {member.role}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center group-hover:bg-stone-900 group-hover:text-white transition-all">
                                            <ChevronRight className="h-4 w-4" />
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-stone-50 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-stone-400 text-[11px] font-bold">
                                            <CalendarCheck className="h-3.5 w-3.5" />
                                            <span>VIEW ATTENDANCE HISTORY</span>
                                        </div>
                                        <div className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded uppercase tracking-tighter">
                                            {member.status}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}

                    <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100 flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                            <Users className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <h4 className="font-bold text-amber-900">Attendance Monitoring</h4>
                            <p className="text-sm text-amber-700 mt-1 leading-relaxed">
                                Detailed records include clock-in/out stamps, calculated hours (Normal, OT, Night), and compliance verification.
                                Click on any personnel card above to access their full yearly heatmap and summary statistics.
                            </p>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
