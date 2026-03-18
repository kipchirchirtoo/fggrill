'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { BranchSelector } from '@/components/dashboard/BranchSelector';
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
    AlertCircle,
    Building2
} from 'lucide-react';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

export default function HRDashboard() {
    const { user } = useAuth();
    const { activeBranchId, activeBranch, userBranches } = useBranch();
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
            
            // Build params with branch filter if a specific branch is selected
            const branchParam = activeBranchId ? { branch_id: activeBranchId } : {};
            
            const [staffRes, payrollRes, leaveRes, attendanceRes] = await Promise.allSettled([
                staffAPI.getStaff(branchParam),
                payrollAPI.getSummary(branchParam),
                staffAPI.getLeaveRequests({ status: 'pending', ...branchParam }),
                staffAPI.getAttendance({ date: today, ...branchParam })
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
    }, [activeBranchId]);

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
            href: '/dashboard/hr/adjustments',
            icon: RefreshCw,
            label: 'Adjustments',
            desc: 'Deductions & Additions',
            color: 'text-orange-600',
            bgColor: 'bg-orange-50'
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
        <ProtectedRoute allowedRoles={[UserRole.HR_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
            <DashboardLayout>
                <div className="space-y-8 animate-ios-fade-in">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-[28px] font-bold text-stone-900 tracking-tight font-sf-pro-display">HR Command</h1>
                            <p className="text-stone-500">Personnel management and payroll oversight</p>
                            {activeBranch && (
                                <div className="flex items-center gap-2 mt-2 text-sm text-stone-600">
                                    <Building2 className="h-4 w-4" />
                                    <span className="font-medium">{activeBranch.name}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            {userBranches.length > 1 && (
                                <BranchSelector 
                                    showLabel={false}
                                    className="min-w-[200px]"
                                />
                            )}
                            <button
                                onClick={fetchData}
                                disabled={isLoading}
                                className="px-4 py-2 rounded-full bg-white border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-all flex items-center gap-2 shadow-sm active:scale-95"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span>Refresh</span>
                            </button>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="stat-card border-l-4 border-l-stone-900">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="stat-label uppercase tracking-widest text-[10px]">Total Workforce</p>
                                    <p className="stat-value text-2xl">{stats.totalStaff}</p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-stone-50 flex items-center justify-center">
                                    <Users className="h-4 w-4 text-stone-400" />
                                </div>
                            </div>
                        </div>

                        <div className="stat-card border-l-4 border-l-emerald-500">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="stat-label uppercase tracking-widest text-[10px]">Monthly Payroll</p>
                                    <p className="stat-value text-2xl">KES {stats.totalPayroll.toLocaleString()}</p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                                    <DollarSign className="h-4 w-4 text-emerald-400" />
                                </div>
                            </div>
                        </div>

                        <div className="stat-card border-l-4 border-l-amber-500">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="stat-label uppercase tracking-widest text-[10px]">Pending Leave</p>
                                    <p className="stat-value text-2xl text-amber-600">{stats.pendingLeave}</p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
                                    <FileText className="h-4 w-4 text-amber-400" />
                                </div>
                            </div>
                        </div>

                        <div className="stat-card border-l-4 border-l-green-500">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="stat-label uppercase tracking-widest text-[10px]">Active Today</p>
                                    <p className="stat-value text-2xl">{stats.presentToday}</p>
                                    000                                </div>
                                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                                    <Calendar className="h-4 w-4 text-green-400" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Management Modules */}
                    <div className="card-elevated p-6">
                        <h3 className="text-[15px] font-bold text-stone-900 mb-6 flex items-center gap-2">
                            <Users className="h-4 w-4 text-stone-400" />
                            HR Control Modules
                        </h3>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {quickLinks.map((link) => (
                                <Link key={link.href} href={link.href}>
                                    <div className="flex items-center gap-4 p-4 rounded-xl border border-stone-50 hover:bg-stone-50 hover:border-stone-200 transition-all group cursor-pointer h-full">
                                        <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center group-hover:bg-white border border-transparent group-hover:border-stone-200 transition-all">
                                            <link.icon className="h-5 w-5 text-stone-600" />
                                        </div>
                                        <div>
                                            <p className="text-[14px] font-bold text-stone-900">{link.label}</p>
                                            <p className="text-[12px] text-stone-500">{link.desc}</p>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-stone-300 ml-auto group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Bottom Grid */}
                    <div className="grid lg:grid-cols-2 gap-6">
                        {/* Leave Requests */}
                        <div className="card-elevated p-6 border-l-4 border-l-amber-300">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-[15px] font-bold text-stone-900 flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-stone-400" />
                                    Pending Review
                                </h3>
                                <Link href="/dashboard/hr/leave" className="text-[12px] text-amber-600 font-bold hover:underline">View Repository</Link>
                            </div>

                            {stats.pendingLeave === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-stone-400">
                                    <CheckCircle className="h-8 w-8 mb-2 opacity-20" />
                                    <p className="text-sm font-medium">Clearance achieved</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                                        <p className="text-[13px] font-bold text-stone-900 mb-1">Attention Required</p>
                                        <p className="text-[12px] text-stone-500 leading-relaxed">
                                            There are currently {stats.pendingLeave} leave application(s) awaiting administrative decision.
                                        </p>
                                    </div>
                                    <Link href="/dashboard/hr/leave" className="block text-center py-2.5 bg-stone-900 text-white rounded-lg text-[13px] font-bold active:scale-95 transition-all">
                                        Open Review Interface
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Payroll Status */}
                        <div className="card-elevated p-6 border-l-4 border-l-emerald-300">
                            <h3 className="text-[15px] font-bold text-stone-900 mb-6 flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-stone-400" />
                                Payroll Cycle Status
                            </h3>
                            <div className="space-y-4">
                                <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[13px] font-bold text-stone-600 uppercase tracking-tighter">Current Period</span>
                                        <span className="text-[13px] font-bold text-stone-900">
                                            {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                                        </span>
                                    </div>
                                    <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-emerald-500 h-full w-[15%] transition-all" />
                                    </div>
                                    <div className="flex items-center justify-between mt-3">
                                        <span className="text-[11px] font-medium text-stone-500">Operation Status</span>
                                        <span className="text-[11px] font-bold text-emerald-600">Active Cycle</span>
                                    </div>
                                </div>

                                <Link href="/dashboard/hr/payroll" className="flex items-center justify-between p-4 rounded-xl border border-stone-50 hover:bg-stone-50 hover:border-stone-200 transition-all group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-[14px] font-bold text-stone-900">Initiate Payroll</p>
                                            <p className="text-[12px] text-stone-500">Execute salary disbursement</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-stone-300 group-hover:translate-x-1 transition-transform" />
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
