'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { storeAPI } from '@/lib/api';
import { Truck, RefreshCw, Plus, Clock, CheckCircle, Building2, Package } from 'lucide-react';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Dispatch { id: string; dispatch_number: string; to_branch: string; status: string; items_count: number; dispatched_at: string; }

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  in_transit: { label: 'In Transit', color: 'text-blue-700', bg: 'bg-blue-100' },
  delivered: { label: 'Delivered', color: 'text-green-700', bg: 'bg-green-100' },
};

export default function CentralDispatchPage() {
  const { user } = useAuth();
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchDispatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getDispatchHistory();
      if (response.success) {
        const data = response.data || [];
        setDispatches(statusFilter === 'all' ? data : data.filter((d: Dispatch) => d.status === statusFilter));
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchDispatches(); }, [fetchDispatches]);

  const stats = { pending: dispatches.filter(d => d.status === 'pending').length, inTransit: dispatches.filter(d => d.status === 'in_transit').length, delivered: dispatches.filter(d => d.status === 'delivered').length };

  return (
    <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Dispatch</h1><p className="text-gray-500">Send stock to branches</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchDispatches}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
              <Link href="/dashboard/central-store/dispatch/new"><IOSButton><Plus className="h-4 w-4 mr-2" /> New Dispatch</IOSButton></Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4"><Clock className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Pending</p><p className="text-xl font-bold text-yellow-600">{stats.pending}</p></IOSCard>
            <IOSCard className="p-4"><Truck className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">In Transit</p><p className="text-xl font-bold text-[#007AFF]">{stats.inTransit}</p></IOSCard>
            <IOSCard className="p-4"><CheckCircle className="h-6 w-6 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Delivered</p><p className="text-xl font-bold text-[#34C759]">{stats.delivered}</p></IOSCard>
          </div>

          <div className="flex gap-2">
            {['all', 'pending', 'in_transit', 'delivered'].map((status) => (
              <IOSButton key={status} variant={statusFilter === status ? 'primary' : 'secondary'} size="sm" onClick={() => setStatusFilter(status)}>
                {status === 'all' ? 'All' : statusConfig[status]?.label || status}
              </IOSButton>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : dispatches.length === 0 ? (
            <IOSCard className="p-12 text-center"><Truck className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No dispatches</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {dispatches.map((dispatch) => {
                const status = statusConfig[dispatch.status] || statusConfig.pending;
                return (
                  <IOSCard key={dispatch.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-ios-lg bg-blue-100 flex items-center justify-center"><Truck className="h-6 w-6 text-[#007AFF]" /></div>
                        <div>
                          <p className="font-bold">#{dispatch.dispatch_number}</p>
                          <p className="text-sm text-gray-500 flex items-center gap-1"><Building2 className="h-3 w-3" /> {dispatch.to_branch} <Package className="h-3 w-3 ml-2" /> {dispatch.items_count} items</p>
                          <p className="text-xs text-gray-400">{new Date(dispatch.dispatched_at).toLocaleString()}</p>
                        </div>
                      </div>
                      <IOSBadge className={`${status.bg} ${status.color}`}>{status.label}</IOSBadge>
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
