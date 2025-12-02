'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { financeAPI, staffAPI, systemAPI } from '@/lib/api';
import { 
  Shield, DollarSign, Users, Building2, Bed, Settings, RefreshCw,
  UserCog, Package, FileText, Wrench, Utensils, ClipboardList
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ revenue: 0, staff: 0, branches: 0, rooms: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [financeRes, staffRes, branchesRes] = await Promise.all([
        financeAPI.getDashboard(),
        staffAPI.getStaff(),
        systemAPI.getBranches(),
      ]);
      setStats({
        revenue: financeRes.data?.totalRevenue || 0,
        staff: staffRes.data?.length || 0,
        branches: branchesRes.data?.length || 0,
        rooms: 150,
      });
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const quickLinks = [
    { href: '/dashboard/admin/users', icon: UserCog, label: 'Users', color: 'bg-blue-50 text-blue-600' },
    { href: '/dashboard/admin/staff', icon: Users, label: 'Staff', color: 'bg-purple-50 text-purple-600' },
    { href: '/dashboard/admin/finance', icon: DollarSign, label: 'Finance', color: 'bg-green-50 text-green-600' },
    { href: '/dashboard/admin/rooms', icon: Bed, label: 'Rooms', color: 'bg-yellow-50 text-yellow-600' },
    { href: '/dashboard/admin/storekeeping', icon: Package, label: 'Store', color: 'bg-orange-50 text-orange-600' },
    { href: '/dashboard/admin/restaurant', icon: Utensils, label: 'Restaurant', color: 'bg-red-50 text-red-600' },
    { href: '/dashboard/admin/housekeeping', icon: ClipboardList, label: 'Housekeeping', color: 'bg-teal-50 text-teal-600' },
    { href: '/dashboard/admin/maintenance', icon: Wrench, label: 'Maintenance', color: 'bg-gray-50 text-gray-600' },
    { href: '/dashboard/admin/reports', icon: FileText, label: 'Reports', color: 'bg-indigo-50 text-indigo-600' },
    { href: '/dashboard/admin/settings', icon: Settings, label: 'Settings', color: 'bg-pink-50 text-pink-600' },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Shield className="h-7 w-7" /> Admin Dashboard</h1><p className="text-gray-500">System administration</p></div>
            <IOSButton variant="secondary" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4"><DollarSign className="h-6 w-6 text-green-600 mb-2" /><p className="text-sm text-gray-500">Total Revenue</p><p className="text-xl font-bold">KES {(stats.revenue / 1000000).toFixed(1)}M</p></IOSCard>
            <IOSCard className="p-4"><Users className="h-6 w-6 text-blue-600 mb-2" /><p className="text-sm text-gray-500">Total Staff</p><p className="text-xl font-bold">{stats.staff}</p></IOSCard>
            <IOSCard className="p-4"><Building2 className="h-6 w-6 text-purple-600 mb-2" /><p className="text-sm text-gray-500">Branches</p><p className="text-xl font-bold">{stats.branches}</p></IOSCard>
            <IOSCard className="p-4"><Bed className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Total Rooms</p><p className="text-xl font-bold">{stats.rooms}</p></IOSCard>
          </div>

          <IOSCard className="p-6">
            <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Administration</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <IOSCard className={`p-4 hover:shadow-lg transition cursor-pointer text-center ${link.color.split(' ')[0]}`}>
                    <link.icon className={`h-8 w-8 mx-auto mb-2 ${link.color.split(' ')[1]}`} />
                    <p className="font-medium">{link.label}</p>
                  </IOSCard>
                </Link>
              ))}
            </div>
          </IOSCard>

          <div className="grid md:grid-cols-2 gap-6">
            <IOSCard className="p-6">
              <h2 className="text-lg font-semibold font-sf-pro-display mb-4">System</h2>
              <div className="space-y-2">
                <Link href="/dashboard/admin/system/branches"><IOSButton variant="secondary" className="w-full justify-start"><Building2 className="h-4 w-4 mr-2" /> Branches</IOSButton></Link>
                <Link href="/dashboard/admin/system/departments"><IOSButton variant="secondary" className="w-full justify-start"><Users className="h-4 w-4 mr-2" /> Departments</IOSButton></Link>
                <Link href="/dashboard/admin/audit"><IOSButton variant="secondary" className="w-full justify-start"><ClipboardList className="h-4 w-4 mr-2" /> Audit Logs</IOSButton></Link>
              </div>
            </IOSCard>
            <IOSCard className="p-6">
              <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Quick Stats</h2>
              <div className="space-y-3">
                <div className="flex justify-between p-3 bg-gray-50 rounded-ios-lg"><span>Active Users</span><span className="font-bold">{stats.staff}</span></div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-ios-lg"><span>Branches</span><span className="font-bold">{stats.branches}</span></div>
                <div className="flex justify-between p-3 bg-gray-50 rounded-ios-lg"><span>System Status</span><span className="font-bold text-green-600">Online</span></div>
              </div>
            </IOSCard>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
