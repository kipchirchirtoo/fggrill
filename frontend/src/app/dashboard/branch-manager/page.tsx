'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { financeAPI, bookingsAPI, staffAPI, housekeepingAPI } from '@/lib/api';
import { 
  Building2, DollarSign, Users, Bed, TrendingUp, RefreshCw, Calendar,
  UserCheck, Utensils, Wrench, Package, ClipboardList, ArrowUpRight
} from 'lucide-react';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

export default function BranchManagerDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ revenue: 0, occupancy: 0, staff: 0, pendingTasks: 0, arrivals: 0, departures: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [financeRes, bookingsRes, staffRes, tasksRes] = await Promise.allSettled([
        financeAPI.getDashboard(user?.branch_id || undefined),
        bookingsAPI.getBookings(),
        staffAPI.getStaff(user?.branch_id || undefined),
        housekeepingAPI.getTasks(),
      ]);

      const today = new Date().toISOString().split('T')[0];
      const bookings = bookingsRes.status === 'fulfilled' ? bookingsRes.value?.data || [] : [];
      
      setStats({
        revenue: financeRes.status === 'fulfilled' ? financeRes.value?.data?.totalRevenue || 0 : 0,
        occupancy: 78,
        staff: staffRes.status === 'fulfilled' ? staffRes.value?.data?.length || 0 : 0,
        pendingTasks: tasksRes.status === 'fulfilled' ? (tasksRes.value?.data || []).filter((t: any) => t.status === 'pending').length : 0,
        arrivals: bookings.filter((b: any) => b.check_in?.startsWith(today)).length,
        departures: bookings.filter((b: any) => b.check_out?.startsWith(today)).length,
      });
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [user?.branch_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const quickLinks = [
    { href: '/dashboard/branch-manager/reservations', icon: Calendar, label: 'Reservations', color: 'bg-blue-50 text-[#007AFF]' },
    { href: '/dashboard/branch-manager/rooms', icon: Bed, label: 'Rooms', color: 'bg-green-50 text-[#34C759]' },
    { href: '/dashboard/branch-manager/staff', icon: Users, label: 'Staff', color: 'bg-purple-50 text-purple-600' },
    { href: '/dashboard/branch-manager/housekeeping', icon: ClipboardList, label: 'Housekeeping', color: 'bg-yellow-50 text-yellow-600' },
    { href: '/dashboard/branch-manager/restaurant', icon: Utensils, label: 'Restaurant', color: 'bg-orange-50 text-orange-600' },
    { href: '/dashboard/branch-manager/maintenance', icon: Wrench, label: 'Maintenance', color: 'bg-red-50 text-[#FF3B30]' },
    { href: '/dashboard/branch-manager/stock', icon: Package, label: 'Stock', color: 'bg-indigo-50 text-indigo-600' },
    { href: '/dashboard/branch-manager/reports', icon: TrendingUp, label: 'Reports', color: 'bg-pink-50 text-pink-600' },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Building2 className="h-7 w-7" /> Branch Dashboard</h1>
              <p className="text-gray-500">{user?.branch_name || 'Your Branch'}</p>
            </div>
            <IOSButton variant="secondary" onClick={fetchData} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <IOSCard className="p-4"><DollarSign className="h-5 w-5 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Revenue</p><p className="text-lg font-bold">KES {(stats.revenue / 1000).toFixed(0)}K</p></IOSCard>
            <IOSCard className="p-4"><Bed className="h-5 w-5 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Occupancy</p><p className="text-lg font-bold">{stats.occupancy}%</p></IOSCard>
            <IOSCard className="p-4"><Users className="h-5 w-5 text-purple-600 mb-2" /><p className="text-sm text-gray-500">Staff</p><p className="text-lg font-bold">{stats.staff}</p></IOSCard>
            <IOSCard className="p-4"><ClipboardList className="h-5 w-5 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Pending Tasks</p><p className="text-lg font-bold text-yellow-600">{stats.pendingTasks}</p></IOSCard>
            <IOSCard className="p-4"><ArrowUpRight className="h-5 w-5 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Arrivals</p><p className="text-lg font-bold text-[#34C759]">{stats.arrivals}</p></IOSCard>
            <IOSCard className="p-4"><UserCheck className="h-5 w-5 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Departures</p><p className="text-lg font-bold">{stats.departures}</p></IOSCard>
          </div>

          <IOSCard className="p-6">
            <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Quick Access</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <IOSCard className={`p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer text-center ${link.color.split(' ')[0]}`}>
                    <link.icon className={`h-6 w-6 mx-auto mb-2 ${link.color.split(' ')[1]}`} />
                    <p className="text-sm font-medium">{link.label}</p>
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
