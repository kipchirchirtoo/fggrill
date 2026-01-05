'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { staffAPI, payrollAPI } from '@/lib/api';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { Users, Calendar, FileText, CreditCard, RefreshCw, DollarSign } from 'lucide-react';

export default function AdminHRPayrollPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalStaff: 0, totalPayroll: 0, pendingLeave: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [staffRes, payrollRes, leaveRes] = await Promise.allSettled([
        staffAPI.getStaff(),
        payrollAPI.getSummary(),
        staffAPI.getLeaveRequests({ status: 'pending' }),
      ]);
      setStats({
        totalStaff: staffRes.status === 'fulfilled' ? staffRes.value?.data?.length || 0 : 0,
        totalPayroll: payrollRes.status === 'fulfilled' ? payrollRes.value?.data?.totalAmount || 0 : 0,
        pendingLeave: leaveRes.status === 'fulfilled' ? leaveRes.value?.data?.length || 0 : 0,
      });
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const quickLinks = [
    { href: '/dashboard/admin/staff', icon: Users, label: 'Staff', desc: 'Manage employees', color: 'bg-blue-50 text-[#007AFF]' },
    { href: '/dashboard/admin/staff/attendance', icon: Calendar, label: 'Attendance', desc: 'Daily records', color: 'bg-green-50 text-[#34C759]' },
    { href: '/dashboard/gm/leave-requests', icon: FileText, label: 'Leave', desc: 'Leave requests', color: 'bg-yellow-50 text-yellow-600' },
    { href: '/dashboard/branch-accounting', icon: CreditCard, label: 'Payroll', desc: 'Process payments', color: 'bg-purple-50 text-purple-600' },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">HR & Payroll</h1><p className="text-gray-500">Human resources management</p></div>
            <IOSButton variant="secondary" onClick={fetchData} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4"><Users className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Total Staff</p><p className="text-xl font-bold">{stats.totalStaff}</p></IOSCard>
            <IOSCard className="p-4"><DollarSign className="h-6 w-6 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Monthly Payroll</p><p className="text-xl font-bold">KES {stats.totalPayroll.toLocaleString()}</p></IOSCard>
            <IOSCard className="p-4"><FileText className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Pending Leave</p><p className="text-xl font-bold text-yellow-600">{stats.pendingLeave}</p></IOSCard>
          </div>

          <IOSCard className="p-6">
            <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Quick Access</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <IOSCard className={`p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer text-center ${link.color.split(' ')[0]}`}>
                    <link.icon className={`h-8 w-8 mx-auto mb-2 ${link.color.split(' ')[1]}`} />
                    <p className="font-medium">{link.label}</p>
                    <p className="text-sm text-gray-500">{link.desc}</p>
                  </IOSCard>
                </Link>
              ))}
            </div>
          </IOSCard>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
