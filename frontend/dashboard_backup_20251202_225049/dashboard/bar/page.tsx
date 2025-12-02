'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { restaurantAPI } from '@/lib/api';
import { 
  Wine, ShoppingCart, DollarSign, Clock, Users, GlassWater,
  RefreshCw, TrendingUp, Plus, ArrowRight, CreditCard
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface Order {
  id: string;
  order_number: string;
  table_number?: string;
  status: string;
  total: number;
  items_count: number;
  created_at: string;
}

export default function BarDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState({ todayOrders: 0, todayRevenue: 0, openTabs: 0, avgOrder: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const ordersRes = await restaurantAPI.getOrders();
      if (ordersRes.success) {
        const allOrders = ordersRes.data || [];
        setOrders(allOrders.slice(0, 8));
        const total = allOrders.reduce((sum: number, o: Order) => sum + (o.total || 0), 0);
        setStats({
          todayOrders: allOrders.length,
          todayRevenue: total,
          openTabs: allOrders.filter((o: Order) => o.status === 'pending').length,
          avgOrder: allOrders.length > 0 ? Math.round(total / allOrders.length) : 0,
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <ProtectedRoute allowedRoles={[UserRole.BARTENDER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Wine className="h-7 w-7" /> Bar Dashboard
              </h1>
              <p className="text-gray-500">Manage bar orders and tabs</p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-2" /> Refresh
              </IOSButton>
              <Link href="/dashboard/bar/pos">
                <IOSButton><Plus className="h-4 w-4 mr-2" /> New Order</IOSButton>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-ios-lg"><ShoppingCart className="h-5 w-5 text-blue-600" /></div>
                <div><p className="text-sm text-gray-500">Orders</p><p className="text-xl font-bold">{stats.todayOrders}</p></div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-ios-lg"><DollarSign className="h-5 w-5 text-green-600" /></div>
                <div><p className="text-sm text-gray-500">Revenue</p><p className="text-xl font-bold">KES {stats.todayRevenue.toLocaleString()}</p></div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-ios-lg"><CreditCard className="h-5 w-5 text-yellow-600" /></div>
                <div><p className="text-sm text-gray-500">Open Tabs</p><p className="text-xl font-bold text-yellow-600">{stats.openTabs}</p></div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-ios-lg"><TrendingUp className="h-5 w-5 text-purple-600" /></div>
                <div><p className="text-sm text-gray-500">Avg Order</p><p className="text-xl font-bold">KES {stats.avgOrder.toLocaleString()}</p></div>
              </div>
            </IOSCard>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <IOSCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold font-sf-pro-display">Recent Orders</h2>
                <Link href="/dashboard/bar/orders"><IOSButton variant="ghost" size="sm">View All</IOSButton></Link>
              </div>
              {isLoading ? (
                <div className="flex justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8 text-gray-500"><Wine className="h-12 w-12 mx-auto mb-2 text-gray-300" /><p>No orders yet</p></div>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {orders.map((order) => (
                    <div key={order.id} className="p-3 border rounded-ios-lg flex items-center justify-between">
                      <div>
                        <p className="font-medium">#{order.order_number}</p>
                        <p className="text-sm text-gray-500">{order.items_count} items • KES {order.total?.toLocaleString()}</p>
                      </div>
                      <IOSBadge variant={order.status === 'completed' ? 'success' : 'warning'}>{order.status}</IOSBadge>
                    </div>
                  ))}
                </div>
              )}
            </IOSCard>

            <IOSCard className="p-6">
              <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/dashboard/bar/pos">
                  <IOSCard className="p-4 hover:shadow-lg transition cursor-pointer bg-blue-50">
                    <ShoppingCart className="h-8 w-8 text-blue-600 mb-2" /><p className="font-medium">POS</p><p className="text-sm text-gray-500">Take orders</p>
                  </IOSCard>
                </Link>
                <Link href="/dashboard/bar/tabs">
                  <IOSCard className="p-4 hover:shadow-lg transition cursor-pointer bg-yellow-50">
                    <CreditCard className="h-8 w-8 text-yellow-600 mb-2" /><p className="font-medium">Tabs</p><p className="text-sm text-gray-500">Open tabs</p>
                  </IOSCard>
                </Link>
                <Link href="/dashboard/bar/menu">
                  <IOSCard className="p-4 hover:shadow-lg transition cursor-pointer bg-green-50">
                    <GlassWater className="h-8 w-8 text-green-600 mb-2" /><p className="font-medium">Menu</p><p className="text-sm text-gray-500">Drinks menu</p>
                  </IOSCard>
                </Link>
                <Link href="/dashboard/bar/inventory">
                  <IOSCard className="p-4 hover:shadow-lg transition cursor-pointer bg-purple-50">
                    <Wine className="h-8 w-8 text-purple-600 mb-2" /><p className="font-medium">Stock</p><p className="text-sm text-gray-500">Inventory</p>
                  </IOSCard>
                </Link>
              </div>
            </IOSCard>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
