'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { storeAPI } from '@/lib/api';
import { Truck, RefreshCw, Package, Calendar, Building2 } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Transfer { id: string; dispatch_number: string; from_branch: string; to_branch: string; status: string; items_count: number; dispatched_at: string; }

export default function AdminTransfersPage() {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTransfers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getDispatchHistory();
      if (response.success) setTransfers(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchTransfers(); }, [fetchTransfers]);

  const statusConfig: Record<string, { color: string; bg: string }> = {
    pending: { color: 'text-yellow-700', bg: 'bg-yellow-100' },
    in_transit: { color: 'text-blue-700', bg: 'bg-blue-100' },
    delivered: { color: 'text-green-700', bg: 'bg-green-100' },
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Stock Transfers</h1><p className="text-gray-500">Inter-branch transfers</p></div>
            <IOSButton variant="secondary" onClick={fetchTransfers} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : transfers.length === 0 ? (
            <IOSCard className="p-12 text-center"><Truck className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No transfers</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {transfers.map((transfer) => {
                const status = statusConfig[transfer.status] || statusConfig.pending;
                return (
                  <IOSCard key={transfer.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-ios-lg bg-purple-100 flex items-center justify-center"><Truck className="h-6 w-6 text-purple-600" /></div>
                        <div>
                          <p className="font-bold">#{transfer.dispatch_number}</p>
                          <p className="text-sm text-gray-500 flex items-center gap-1"><Building2 className="h-3 w-3" /> {transfer.from_branch} → {transfer.to_branch}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1"><Package className="h-3 w-3" /> {transfer.items_count} items <Calendar className="h-3 w-3 ml-2" /> {new Date(transfer.dispatched_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <IOSBadge className={`${status.bg} ${status.color}`}>{transfer.status?.replace('_', ' ')}</IOSBadge>
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
