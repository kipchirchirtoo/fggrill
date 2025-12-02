'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { financeAPI, reportsAPI, staffAPI } from '@/lib/api';
import { 
  Building2, DollarSign, Users, Bed, TrendingUp, RefreshCw,
  BarChart3, Calendar, FileText, UserCheck, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface DashboardStats {
  totalRevenue: number;
  revenueChange: number;
  occupancyRate: number;
  totalStaff: number;
  pendingLeave: number;
  branches: number;
}

export default function GMDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({ totalRevenue: 0, revenueChange: 0, occupancyRate: 0, totalStaff: 0, pendingLeave: 0, branches: 3 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [financeRes, staffRes, leaveRes] = await Promise.allSettled([
        financeAPI.getDashboard(),
        staffAPI.getStaff(),
        staffAPI.getLeaveRequests({ status: 'pending' }),
      ]);

      setStats({
        totalRevenue: financeRes.status === 'fulfilled' ? financeRes.value?.data?.totalRevenue || 0 : 0,
        revenueChange: financeRes.status === 'fulfilled' ? financeRes.value?.data?.revenueChange || 0 : 0,
        occupancyRate: 78,
        totalStaff: staffRes.status === 'fulfilled' ? staffRes.value?.data?.length || 0 : 0,
        pendingLeave: leaveRes.status === 'fulfilled' ? leaveRes.value?.data?.length || 0 : 0,
        branches: 3,
      });
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const quickLinks = [
    { href: '/dashboard/gm/branches', icon: Building2, label: 'Branches', desc: 'All locations', color: 'bg-blue-50 text-[#007AFF]' },
    { href: '/dashboard/gm/finance', icon: DollarSign, label: 'Finance', desc: 'Overview', color: 'bg-green-50 text-[#34C759]' },
    { href: '/dashboard/gm/staff', icon: Users, label: 'Staff', desc: 'All employees', color: 'bg-purple-50 text-purple-600' },
    { href: '/dashboard/gm/reports', icon: BarChart3, label: 'Reports', desc: 'Analytics', color: 'bg-orange-50 text-orange-600' },
    { href: '/dashboard/gm/leave-requests', icon: Calendar, label: 'Leave', desc: 'Requests', color: 'bg-yellow-50 text-yellow-600' },
    { href: '/dashboard/gm/compare', icon: TrendingUp, label: 'Compare', desc: 'Branches', color: 'bg-indigo-50 text-indigo-600' },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">General Manager Dashboard</h1><p className="text-gray-500">Overview of all operations</p></div>
            <IOSButton variant="secondary" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="h-5 w-5 text-[#34C759]" />
                {stats.revenueChange >= 0 ? <ArrowUpRight className="h-4 w-4 text-[#34C759]" /> : <ArrowDownRight className="h-4 w-4 text-[#FF3B30]" />}
              </div>
              <p className="text-sm text-gray-500">Revenue</p>
              <p className="text-lg font-bold">KES {(stats.totalRevenue / 1000000).toFixed(1)}M</p>
            </IOSCard>
            <IOSCard className="p-4">
              <Bed className="h-5 w-5 text-[#007AFF] mb-2" />
              <p className="text-sm text-gray-500">Occupancy</p>
              <p className="text-lg font-bold">{stats.occupancyRate}%</p>
            </IOSCard>
            <IOSCard className="p-4">
              <Building2 className="h-5 w-5 text-purple-600 mb-2" />
              <p className="text-sm text-gray-500">Branches</p>
              <p className="text-lg font-bold">{stats.branches}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <Users className="h-5 w-5 text-indigo-600 mb-2" />
              <p className="text-sm text-gray-500">Staff</p>
              <p className="text-lg font-bold">{stats.totalStaff}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <Calendar className="h-5 w-5 text-yellow-600 mb-2" />
              <p className="text-sm text-gray-500">Leave Requests</p>
              <p className="text-lg font-bold text-yellow-600">{stats.pendingLeave}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <TrendingUp className="h-5 w-5 text-[#34C759] mb-2" />
              <p className="text-sm text-gray-500">Growth</p>
              <p className="text-lg font-bold text-[#34C759]">+{stats.revenueChange}%</p>
            </IOSCard>
          </div>

          <IOSCard className="p-6">
            <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Quick Access</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <IOSCard className={`p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer ${link.color.split(' ')[0]}`}>
                    <link.icon className={`h-8 w-8 mb-2 ${link.color.split(' ')[1]}`} />
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
