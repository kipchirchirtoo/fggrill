'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { maintenanceAPI } from '@/lib/api';
import { Wrench, RefreshCw, Clock, CheckCircle, AlertTriangle, Settings } from 'lucide-react';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

export default function AdminMaintenancePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ pending: 0, inProgress: 0, completed: 0, urgent: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await maintenanceAPI.getRequests();
      const requests = response.data || [];
      setStats({
        pending: requests.filter((r: any) => r.status === 'pending').length,
        inProgress: requests.filter((r: any) => r.status === 'in_progress').length,
        completed: requests.filter((r: any) => r.status === 'completed').length,
        urgent: requests.filter((r: any) => r.priority === 'urgent').length,
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
            <div><h1 className="text-2xl font-bold text-gray-900">Maintenance</h1><p className="text-gray-500">Repair and maintenance</p></div>
            <IOSButton variant="secondary" onClick={fetchData} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4"><Clock className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Pending</p><p className="text-xl font-bold text-yellow-600">{stats.pending}</p></IOSCard>
            <IOSCard className="p-4"><Wrench className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">In Progress</p><p className="text-xl font-bold text-[#007AFF]">{stats.inProgress}</p></IOSCard>
            <IOSCard className="p-4"><CheckCircle className="h-6 w-6 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Completed</p><p className="text-xl font-bold text-[#34C759]">{stats.completed}</p></IOSCard>
            <IOSCard className="p-4"><AlertTriangle className="h-6 w-6 text-[#FF3B30] mb-2" /><p className="text-sm text-gray-500">Urgent</p><p className="text-xl font-bold text-[#FF3B30]">{stats.urgent}</p></IOSCard>
          </div>

          <IOSCard className="p-6">
            <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Quick Access</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Link href="/dashboard/maintenance/orders"><IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer text-center bg-blue-50"><Wrench className="h-8 w-8 mx-auto mb-2 text-[#007AFF]" /><p className="font-medium">Work Orders</p></IOSCard></Link>
              <Link href="/dashboard/maintenance/assets"><IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer text-center bg-green-50"><Settings className="h-8 w-8 mx-auto mb-2 text-[#34C759]" /><p className="font-medium">Assets</p></IOSCard></Link>
              <Link href="/dashboard/maintenance/schedule"><IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer text-center bg-purple-50"><Clock className="h-8 w-8 mx-auto mb-2 text-purple-600" /><p className="font-medium">Schedule</p></IOSCard></Link>
            </div>
          </IOSCard>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
