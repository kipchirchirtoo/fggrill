'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UtensilsCrossed, RefreshCw, DollarSign, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { restaurantAPI } from '@/lib/api';

export default function BranchManagerRestaurantPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchOrders(); }, [user]);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const res = await restaurantAPI.getOrders(user?.branch_id);
      setOrders(res.orders || res || []);
    } catch (error) { console.error('Error:', error); } 
    finally { setIsLoading(false); }
  };

  const todayRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Restaurant Overview</h1>
              <p className="text-gray-600">Monitor restaurant operations</p>
            </div>
            <Button onClick={fetchOrders} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 bg-emerald-50">
              <DollarSign className="h-6 w-6 text-emerald-600 mb-2" />
              <p className="text-2xl font-bold">KES {todayRevenue.toLocaleString()}</p>
              <p className="text-sm text-emerald-700">Today's Revenue</p>
            </Card>
            <Card className="p-4 bg-blue-50">
              <ShoppingCart className="h-6 w-6 text-blue-600 mb-2" />
              <p className="text-2xl font-bold">{orders.length}</p>
              <p className="text-sm text-blue-700">Orders Today</p>
            </Card>
          </div>

          <Card>
            <div className="p-4 border-b font-semibold">Recent Orders</div>
            <div className="divide-y">
              {orders.slice(0, 10).map((o: any) => (
                <div key={o.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{o.order_number || `#${o.id}`}</p>
                    <p className="text-sm text-gray-500">Table {o.table_number || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">KES {(o.total || 0).toLocaleString()}</p>
                    <Badge className={o.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>{o.status}</Badge>
                  </div>
                </div>
              ))}
              {orders.length === 0 && <div className="p-8 text-center text-gray-500">{isLoading ? 'Loading...' : 'No orders'}</div>}
            </div>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
