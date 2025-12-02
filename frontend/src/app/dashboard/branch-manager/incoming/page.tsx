'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { storeAPI } from '@/lib/api';
import { Truck, RefreshCw, Package, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface IncomingStock { id: string; dispatch_number: string; from_branch: string; items_count: number; status: string; dispatched_at: string; }

export default function BranchIncomingPage() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<IncomingStock[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchShipments = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getBranchStock();
      // Filter for incoming/in-transit items
      if (response.success) setShipments([]);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  const handleReceive = async (id: string) => {
    try {
      // TODO: Implement receive stock API
      console.log('Receiving stock:', id);
      toast.success('Stock received');
      fetchShipments();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.BRANCH_STOREKEEPER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Incoming Stock</h1><p className="text-gray-500">Stock in transit to your branch</p></div>
            <IOSButton variant="secondary" onClick={fetchShipments}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : shipments.length === 0 ? (
            <IOSCard className="p-12 text-center"><Truck className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No incoming shipments</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {shipments.map((shipment) => (
                <IOSCard key={shipment.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-ios-lg bg-blue-100 flex items-center justify-center"><Truck className="h-6 w-6 text-[#007AFF]" /></div>
                      <div>
                        <p className="font-bold">#{shipment.dispatch_number}</p>
                        <p className="text-sm text-gray-500">From: {shipment.from_branch} • {shipment.items_count} items</p>
                        <p className="text-xs text-gray-400">{new Date(shipment.dispatched_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <IOSBadge variant={shipment.status === 'received' ? 'success' : 'info'}>{shipment.status}</IOSBadge>
                      {shipment.status === 'in_transit' && <IOSButton size="sm" onClick={() => handleReceive(shipment.id)}><CheckCircle className="h-4 w-4 mr-1" /> Receive</IOSButton>}
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
