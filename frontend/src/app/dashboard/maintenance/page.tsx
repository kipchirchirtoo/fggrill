'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { maintenanceAPI } from '@/lib/api';
import { Wrench, RefreshCw, Plus, Clock, CheckCircle, AlertTriangle, Calendar, ClipboardList, Settings } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface WorkOrder { id: string; title: string; location: string; priority: string; status: string; created_at: string; }

export default function MaintenanceDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [stats, setStats] = useState({ pending: 0, inProgress: 0, completed: 0, urgent: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await maintenanceAPI.getRequests();
      if (response.success) {
        const data = response.data || [];
        setOrders(data.slice(0, 10));
        setStats({
          pending: data.filter((o: WorkOrder) => o.status === 'pending').length,
          inProgress: data.filter((o: WorkOrder) => o.status === 'in_progress').length,
          completed: data.filter((o: WorkOrder) => o.status === 'completed').length,
          urgent: data.filter((o: WorkOrder) => o.priority === 'urgent').length,
        });
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await maintenanceAPI.updateRequest(id, { status });
      toast.success('Status updated');
      fetchData();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const priorityColors: Record<string, string> = { urgent: 'bg-[#FF3B30]', high: 'bg-orange-500', normal: 'bg-[#007AFF]', low: 'bg-[#8E8E93]' };
  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pending', color: 'text-yellow-700', bg: 'bg-yellow-100' },
    in_progress: { label: 'In Progress', color: 'text-blue-700', bg: 'bg-blue-100' },
    completed: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-100' },
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.MAINTENANCE, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Wrench className="h-7 w-7" /> Maintenance</h1><p className="text-gray-500">Manage work orders and assets</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchData} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <Link href="/dashboard/maintenance/orders"><IOSButton leftIcon={<Plus />}>New Order</IOSButton></Link>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4"><Clock className="h-8 w-8 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Pending</p><p className="text-2xl font-bold text-yellow-600">{stats.pending}</p></IOSCard>
            <IOSCard className="p-4"><Wrench className="h-8 w-8 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">In Progress</p><p className="text-2xl font-bold text-[#007AFF]">{stats.inProgress}</p></IOSCard>
            <IOSCard className="p-4"><CheckCircle className="h-8 w-8 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Completed</p><p className="text-2xl font-bold text-[#34C759]">{stats.completed}</p></IOSCard>
            <IOSCard className="p-4"><AlertTriangle className="h-8 w-8 text-[#FF3B30] mb-2" /><p className="text-sm text-gray-500">Urgent</p><p className="text-2xl font-bold text-[#FF3B30]">{stats.urgent}</p></IOSCard>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <IOSCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold font-sf-pro-display">Recent Work Orders</h2>
                <Link href="/dashboard/maintenance/orders"><IOSButton variant="ghost" size="sm">View All</IOSButton></Link>
              </div>
              {isLoading ? (
                <div className="flex justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8 text-gray-500"><Wrench className="h-12 w-12 mx-auto mb-2 text-gray-300" /><p>No work orders</p></div>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {orders.map((order) => {
                    const status = statusConfig[order.status] || statusConfig.pending;
                    return (
                      <div key={order.id} className="p-3 border rounded-ios-lg flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${priorityColors[order.priority] || priorityColors.normal}`} />
                          <div><p className="font-medium">{order.title}</p><p className="text-sm text-gray-500">{order.location}</p></div>
                        </div>
                        <div className="flex items-center gap-2">
                          <IOSBadge className={`${status.bg} ${status.color}`}>{status.label}</IOSBadge>
                          {order.status === 'pending' && <IOSButton size="sm" onClick={() => handleUpdateStatus(order.id, 'in_progress')}>Start</IOSButton>}
                          {order.status === 'in_progress' && <IOSButton size="sm" onClick={() => handleUpdateStatus(order.id, 'completed')}>Done</IOSButton>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </IOSCard>

            <IOSCard className="p-6">
              <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/dashboard/maintenance/orders"><IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer bg-blue-50"><ClipboardList className="h-8 w-8 text-[#007AFF] mb-2" /><p className="font-medium">Work Orders</p></IOSCard></Link>
                <Link href="/dashboard/maintenance/assets"><IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer bg-green-50"><Settings className="h-8 w-8 text-[#34C759] mb-2" /><p className="font-medium">Assets</p></IOSCard></Link>
                <Link href="/dashboard/maintenance/schedule"><IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer bg-purple-50"><Calendar className="h-8 w-8 text-purple-600 mb-2" /><p className="font-medium">Schedule</p></IOSCard></Link>
              </div>
            </IOSCard>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
