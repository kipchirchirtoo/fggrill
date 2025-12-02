'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { restaurantAPI } from '@/lib/api';
import { Utensils, RefreshCw, ShoppingCart, DollarSign, Clock, ChefHat } from 'lucide-react';
import Link from 'next/link';

export default function BranchRestaurantPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, revenue: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [ordersRes, salesRes] = await Promise.all([
        restaurantAPI.getOrders(),
        restaurantAPI.getDailySales(),
      ]);
      if (ordersRes.success) {
        const data = ordersRes.data || [];
        setOrders(data.slice(0, 10));
        setStats({
          total: data.length,
          pending: data.filter((o: any) => ['pending', 'preparing'].includes(o.status)).length,
          revenue: salesRes.data?.total || data.reduce((sum: number, o: any) => sum + (o.total || 0), 0),
        });
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Restaurant</h1><p className="text-gray-500">Food & beverage operations</p></div>
            <IOSButton variant="secondary" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4"><ShoppingCart className="h-6 w-6 text-blue-600 mb-2" /><p className="text-sm text-gray-500">Orders Today</p><p className="text-xl font-bold">{stats.total}</p></IOSCard>
            <IOSCard className="p-4"><Clock className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Pending</p><p className="text-xl font-bold text-yellow-600">{stats.pending}</p></IOSCard>
            <IOSCard className="p-4"><DollarSign className="h-6 w-6 text-green-600 mb-2" /><p className="text-sm text-gray-500">Revenue</p><p className="text-xl font-bold text-green-600">KES {stats.revenue.toLocaleString()}</p></IOSCard>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <IOSCard className="p-6">
              <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/dashboard/restaurant/pos"><IOSCard className="p-4 hover:shadow-lg transition cursor-pointer bg-blue-50 text-center"><ShoppingCart className="h-6 w-6 mx-auto text-blue-600 mb-2" /><p className="text-sm font-medium">POS</p></IOSCard></Link>
                <Link href="/dashboard/restaurant/kitchen"><IOSCard className="p-4 hover:shadow-lg transition cursor-pointer bg-orange-50 text-center"><ChefHat className="h-6 w-6 mx-auto text-orange-600 mb-2" /><p className="text-sm font-medium">Kitchen</p></IOSCard></Link>
                <Link href="/dashboard/restaurant/orders"><IOSCard className="p-4 hover:shadow-lg transition cursor-pointer bg-green-50 text-center"><Clock className="h-6 w-6 mx-auto text-green-600 mb-2" /><p className="text-sm font-medium">Orders</p></IOSCard></Link>
                <Link href="/dashboard/restaurant/menu"><IOSCard className="p-4 hover:shadow-lg transition cursor-pointer bg-purple-50 text-center"><Utensils className="h-6 w-6 mx-auto text-purple-600 mb-2" /><p className="text-sm font-medium">Menu</p></IOSCard></Link>
              </div>
            </IOSCard>

            <IOSCard className="p-6">
              <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Recent Orders</h2>
              {isLoading ? (
                <div className="flex justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
              ) : orders.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No orders today</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {orders.map((order) => (
                    <div key={order.id} className="flex justify-between p-2 bg-gray-50 rounded">
                      <span>#{order.order_number}</span>
                      <span className="font-medium">KES {order.total?.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </IOSCard>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
