'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { storeAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function BranchStoreIncomingPage() {
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchDispatches(); }, []);

  const fetchDispatches = async () => {
    setIsLoading(true);
    try {
      const res = await storeAPI.getIncomingDispatches();
      setDispatches(res.dispatches || res || []);
    } catch (error) { console.error('Error:', error); } 
    finally { setIsLoading(false); }
  };

  const handleConfirm = async (id: string) => {
    try {
      await storeAPI.confirmDelivery(id, {});
      toast.success('Delivery confirmed');
      fetchDispatches();
    } catch (error) {
      toast.error('Failed to confirm');
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Incoming Deliveries</h1>
              <p className="text-gray-600">Confirm stock deliveries</p>
            </div>
            <Button onClick={fetchDispatches} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          <div className="grid gap-4">
            {dispatches.map((d: any) => (
              <Card key={d.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Truck className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="font-medium">{d.dispatch_number || `DN-${d.id}`}</p>
                      <p className="text-sm text-gray-500">{d.items_count || 0} items</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={d.status === 'delivered' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>{d.status}</Badge>
                    {d.status === 'in_transit' && (
                      <Button size="sm" onClick={() => handleConfirm(d.id)}>
                        <CheckCircle className="h-4 w-4 mr-1" /> Confirm
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            {dispatches.length === 0 && <Card className="p-8 text-center text-gray-500">{isLoading ? 'Loading...' : 'No incoming deliveries'}</Card>}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
