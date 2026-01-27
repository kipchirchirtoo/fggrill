'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { staffAPI, payrollAPI } from '@/lib/api';
import {
    Users,
    Calendar,
    FileText,
    CreditCard,
    RefreshCw,
    DollarSign,
    UserPlus,
    Clock,
    ChevronRight,
    TrendingUp,
    AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

export default function HRDashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState({
        totalStaff: 0,
        totalPayroll: 0,
        pendingLeave: 0,
        presentToday: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            const [staffRes, payrollRes, leaveRes, attendanceRes] = await Promise.allSettled([
                staffAPI.getStaff(),
                payrollAPI.getSummary(),
                staffAPI.getLeaveRequests({ status: 'pending' }),
                staffAPI.getAttendance({ date: today })
            ]);

            setStats({
                totalStaff: staffRes.status === 'fulfilled' ? staffRes.value?.data?.length || 0 : 0,
                totalPayroll: payrollRes.status === 'fulfilled' ? payrollRes.value?.data?.totalGrossPay || 0 : 0,
                pendingLeave: leaveRes.status === 'fulfilled' ? leaveRes.value?.data?.length || 0 : 0,
                presentToday: attendanceRes.status === 'fulfilled' ? attendanceRes.value?.data?.length || 0 : 0,
            });
        } catch (error) {
            console.error('Error fetching HR stats:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const quickLinks = [
        {
            href: '/dashboard/hr/employees',
            icon: Users,
            label: 'Employees',
            desc: 'Directory & Profiles',
            color: 'text-blue-600',
            bgColor: 'bg-blue-50'
        },
        {
            href: '/dashboard/hr/attendance',
            icon: Clock,
            label: 'Attendance',
            desc: 'Check-in Logs',
            color: 'text-green-600',
            bgColor: 'bg-green-50'
        },
        {
            href: '/dashboard/hr/leave',
            icon: FileText,
            label: 'Leave',
            desc: 'Requests & History',
            color: 'text-amber-600',
            bgColor: 'bg-amber-50'
        },
        {
            href: '/dashboard/hr/salaries',
            icon: CreditCard,
            label: 'Salaries',
            desc: 'Employee Pay Rates',
            color: 'text-purple-600',
            bgColor: 'bg-purple-50'
        },
        {
            href: '/dashboard/hr/payroll',
            icon: DollarSign,
            label: 'Payroll',
            desc: 'Process Payments',
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-50'
        },
        {
            href: '/dashboard/hr/employees/add',
            icon: UserPlus,
            label: 'New Hire',
            desc: 'Onboard Staff',
            color: 'text-stone-600',
            bgColor: 'bg-stone-50'
        },
    ];

    return (
        <ProtectedRoute allowedRoles={[UserRole.HR_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">HR Dashboard</h1>
                            <p className="text-stone-500 mt-0.5">Manage employees, payroll, and attendance</p>
                        </div>
                        <IOSButton
                            variant="secondary"
                            onClick={fetchData}
                            disabled={isLoading}
                            leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}
                        >
                            Refresh Data
                        </IOSButton>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="stat-card">
                            <div className="stat-icon bg-blue-50 text-blue-600">
                                <Users className="h-5 w-5" />
                            </div>
                            <p className="stat-value">{stats.totalStaff}</p>
                            <p className="stat-label mt-1">Total Employees</p>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon bg-emerald-50 text-emerald-600">
                                <DollarSign className="h-5 w-5" />
                            </div>
                            <p className="stat-value">KES {stats.totalPayroll.toLocaleString()}</p>
                            <p className="stat-label mt-1">Monthly Gross Pay</p>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon bg-amber-50 text-amber-600">
                                <FileText className="h-5 w-5" />
                            </div>
                            <p className="stat-value text-amber-600">{stats.pendingLeave}</p>
                            <p className="stat-label mt-1">Pending Leave</p>
                        </div>

                        <div className="stat-card">
                            <div className="stat-icon bg-green-50 text-green-600">
                                <Calendar className="h-5 w-5" />
                            </div>
                            <p className="stat-value">{stats.presentToday}</p>
                            <p className="stat-label mt-1">Present Today</p>
                        </div>
                    </div>

                    {/* Quick Access */}
                    <div className="card-elevated p-6">
                        <div className="section-header">
                            <div>
                                <h2 className="section-title">Management Modules</h2>
                                <p className="section-subtitle">Quick access to HR functionalities</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {quickLinks.map((link) => (
                                <Link key={link.href} href={link.href}>
                                    <div className="action-card group h-full">
                                        <div className={`action-card-icon ${link.bgColor} ${link.color} group-hover:bg-opacity-80 transition-all`}>
                                            <link.icon className="h-6 w-6" />
                                        </div>
                                        <p className="action-card-label font-semibold text-[14px]">{link.label}</p>
                                        <p className="text-[11px] text-stone-400 mt-0.5">{link.desc}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Bottom Grid */}
                    <div className="grid lg:grid-cols-2 gap-5">
                        {/* Recent Leave Requests */}
                        <div className="card-elevated p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-[15px] font-semibold text-stone-900">Pending Leave Requests</h3>
                                <Link href="/dashboard/hr/leave" className="text-[12px] text-amber-600 font-medium hover:underline">View All</Link>
                            </div>
                            <div className="space-y-3">
                                {stats.pendingLeave === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-stone-400">
                                        <CheckCircle className="h-8 w-8 mb-2 opacity-20" />
                                        <p className="text-sm">No pending requests</p>
                                    </div>
                                ) : (
                                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-100 flex items-start gap-3">
                                        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[13px] font-medium text-amber-900">Review Required</p>
                                            <p className="text-[12px] text-amber-700 mt-0.5">
                                                There are {stats.pendingLeave} leave requests waiting for your approval.
                                            </p>
                                            <Link href="/dashboard/hr/leave">
                                                <button className="mt-3 text-[12px] bg-amber-600 text-white px-3 py-1.5 rounded-md font-medium hover:bg-amber-700 transition-colors">
                                                    Review Requests
                                                </button>
                                            </Link>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Payroll Processing Status */}
                        <div className="card-elevated p-5">
                            <h3 className="text-[15px] font-semibold text-stone-900 mb-4">Payroll Status</h3>
                            <div className="space-y-4">
                                <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[13px] font-medium text-stone-600">Current Period</span>
                                        <span className="text-[13px] font-bold text-stone-900">
                                            {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-emerald-500 h-full w-[15%] transition-all" />
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-[11px] text-stone-500">Processing Status</span>
                                        <span className="text-[11px] font-medium text-stone-700">Initial Stage</span>
                                    </div>
                                </div>

                                <Link href="/dashboard/hr/payroll" className="block">
                                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-stone-50 transition-all group border border-transparent hover:border-stone-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                                                <TrendingUp className="h-4 w-4 text-emerald-600" />
                                            </div>
                                            <div>
                                                <p className="text-[13px] font-semibold text-stone-800">Process Payroll</p>
                                                <p className="text-[11px] text-stone-500">Calculate & Pay Salaries</p>
                                            </div>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-400" />
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}

// Helper component for Lucide icon
function CheckCircle(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
    );
}
