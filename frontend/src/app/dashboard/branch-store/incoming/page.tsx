'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { storeAPI } from '@/lib/api';
import { Truck, RefreshCw, CheckCircle, Package, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface IncomingDispatch { id: string; dispatch_number: string; from_branch: string; items_count: number; status: string; dispatched_at: string; }

export default function BranchIncomingPage() {
  const { user } = useAuth();
  const [dispatches, setDispatches] = useState<IncomingDispatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDispatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getIncomingDispatches();
      if (response.success) setDispatches(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchDispatches(); }, [fetchDispatches]);

  const handleConfirmDelivery = async (id: string) => {
    try {
      await storeAPI.confirmDelivery(id, { received_items: [], delivery_notes: 'Received in full' });
      toast.success('Delivery confirmed');
      fetchDispatches();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Incoming Stock</h1><p className="text-gray-500">Receive dispatches from central</p></div>
            <IOSButton variant="secondary" onClick={fetchDispatches} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : dispatches.length === 0 ? (
            <IOSCard className="p-12 text-center"><Truck className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No incoming dispatches</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {dispatches.map((dispatch) => (
                <IOSCard key={dispatch.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-ios-lg bg-green-100 flex items-center justify-center"><Truck className="h-6 w-6 text-[#34C759]" /></div>
                      <div>
                        <p className="font-bold">#{dispatch.dispatch_number}</p>
                        <p className="text-sm text-gray-500">From: {dispatch.from_branch} • {dispatch.items_count} items</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1" suppressHydrationWarning><Calendar className="h-3 w-3" /> {new Date(dispatch.dispatched_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <IOSBadge variant={dispatch.status === 'delivered' ? 'success' : 'info'}>{dispatch.status}</IOSBadge>
                      {dispatch.status === 'in_transit' && (
                        <IOSButton size="sm" onClick={() => handleConfirmDelivery(dispatch.id)} leftIcon={<CheckCircle />}> Receive</IOSButton>
                      )}
                    </div>
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
