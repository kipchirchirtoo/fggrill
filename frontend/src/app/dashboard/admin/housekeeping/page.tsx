'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { housekeepingAPI } from '@/lib/api';
import { ClipboardList, Bed, Users, RefreshCw, Clock, CheckCircle, Play } from 'lucide-react';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

export default function AdminHousekeepingPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ pending: 0, inProgress: 0, completed: 0, staff: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [tasksRes, staffRes] = await Promise.all([
        housekeepingAPI.getTasks(),
        housekeepingAPI.getStaff(),
      ]);
      const tasks = tasksRes.data || [];
      setStats({
        pending: tasks.filter((t: any) => t.status === 'pending').length,
        inProgress: tasks.filter((t: any) => t.status === 'in_progress').length,
        completed: tasks.filter((t: any) => t.status === 'completed').length,
        staff: staffRes.data?.length || 0,
      });
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Housekeeping</h1><p className="text-gray-500">Cleaning operations</p></div>
            <IOSButton variant="secondary" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4"><Clock className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Pending</p><p className="text-xl font-bold text-yellow-600">{stats.pending}</p></IOSCard>
            <IOSCard className="p-4"><Play className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">In Progress</p><p className="text-xl font-bold text-[#007AFF]">{stats.inProgress}</p></IOSCard>
            <IOSCard className="p-4"><CheckCircle className="h-6 w-6 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Completed</p><p className="text-xl font-bold text-[#34C759]">{stats.completed}</p></IOSCard>
            <IOSCard className="p-4"><Users className="h-6 w-6 text-purple-600 mb-2" /><p className="text-sm text-gray-500">Staff</p><p className="text-xl font-bold">{stats.staff}</p></IOSCard>
          </div>

          <IOSCard className="p-6">
            <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Quick Access</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/dashboard/housekeeping/tasks"><IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer text-center bg-blue-50"><ClipboardList className="h-8 w-8 mx-auto mb-2 text-[#007AFF]" /><p className="font-medium">Tasks</p></IOSCard></Link>
              <Link href="/dashboard/housekeeping/rooms"><IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer text-center bg-green-50"><Bed className="h-8 w-8 mx-auto mb-2 text-[#34C759]" /><p className="font-medium">Rooms</p></IOSCard></Link>
              <Link href="/dashboard/housekeeping/staff"><IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer text-center bg-purple-50"><Users className="h-8 w-8 mx-auto mb-2 text-purple-600" /><p className="font-medium">Staff</p></IOSCard></Link>
              <Link href="/dashboard/housekeeping/reports"><IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer text-center bg-orange-50"><ClipboardList className="h-8 w-8 mx-auto mb-2 text-orange-600" /><p className="font-medium">Reports</p></IOSCard></Link>
            </div>
          </IOSCard>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
