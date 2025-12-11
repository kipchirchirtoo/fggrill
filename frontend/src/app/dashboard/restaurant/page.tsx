'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { restaurantAPI } from '@/lib/api';
import { 
  UtensilsCrossed, ShoppingCart, DollarSign, Clock, Users, ChefHat,
  RefreshCw, TrendingUp, Coffee, Soup, Plus, ArrowRight, Building2
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Order {
  id: string;
  order_number: string;
  table_number?: string;
  order_type: 'dine_in' | 'takeaway' | 'room_service';
  status: string;
  total: number;
  items_count: number;
  created_at: string;
}

interface DashboardStats {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  avgOrderValue: number;
}

const orderStatusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  preparing: { bg: 'bg-blue-100', text: 'text-blue-700' },
  ready: { bg: 'bg-green-100', text: 'text-green-700' },
  served: { bg: 'bg-gray-100', text: 'text-gray-700' },
  completed: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  cancelled: { bg: 'bg-red-100', text: 'text-red-700' },
};

export default function RestaurantDashboard() {
  const { user } = useAuth();
  const { activeBranchId, userBranches, setActiveBranch } = useBranch();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    todayOrders: 0,
    todayRevenue: 0,
    pendingOrders: 0,
    avgOrderValue: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [ordersResult, salesResult] = await Promise.allSettled([
        restaurantAPI.getOrders(activeBranchId || undefined),
        restaurantAPI.getDailySales(activeBranchId || undefined),
      ]);

      const ordersRes = ordersResult.status === 'fulfilled' ? ordersResult.value : { success: false, data: [] };
      const salesRes = salesResult.status === 'fulfilled' ? salesResult.value : { success: false, data: { total: 0 } };

      const allOrders = ordersRes.success ? (ordersRes.data || []) : [];
      setOrders(allOrders.slice(0, 10));
      
      const pending = allOrders.filter((o: Order) => ['pending', 'preparing'].includes(o.status)).length;
      const todayTotal = allOrders.reduce((sum: number, o: Order) => sum + (o.total || 0), 0);
      
      setStats({
        todayOrders: allOrders.length,
        todayRevenue: salesRes.success ? salesRes.data?.total || todayTotal : todayTotal,
        pendingOrders: pending,
        avgOrderValue: allOrders.length > 0 ? Math.round(todayTotal / allOrders.length) : 0,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleUpdateStatus = async (orderId: string, status: string) => {
    try {
      await restaurantAPI.updateOrderStatus(orderId, status);
      toast.success(`Order updated to ${status}`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update order');
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.RESTAURANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-stone-900">Restaurant Dashboard</h1>
              <p className="text-stone-500">Manage orders and kitchen operations</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Branch Selector */}
              {userBranches.length > 1 && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-stone-400" />
                  <select
                    value={activeBranchId || ''}
                    onChange={(e) => setActiveBranch(Number(e.target.value))}
                    className="px-3 py-2 text-sm bg-stone-100 rounded-lg border-0 focus:ring-2 focus:ring-amber-500"
                  >
                    {userBranches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <IOSButton variant="secondary" onClick={fetchData} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <Link href="/dashboard/restaurant/pos">
                <IOSButton leftIcon={<Plus />}>New Order</IOSButton>
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-ios-lg">
                  <ShoppingCart className="h-5 w-5 text-[#007AFF]" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Today's Orders</p>
                  <p className="text-xl font-bold">{stats.todayOrders}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-ios-lg">
                  <DollarSign className="h-5 w-5 text-[#34C759]" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Revenue</p>
                  <p className="text-xl font-bold">KES {stats.todayRevenue.toLocaleString()}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-ios-lg">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-xl font-bold text-yellow-600">{stats.pendingOrders}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-ios-lg">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Avg Order</p>
                  <p className="text-xl font-bold">KES {stats.avgOrderValue.toLocaleString()}</p>
                </div>
              </div>
            </IOSCard>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Recent Orders */}
            <IOSCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold font-sf-pro-display">Recent Orders</h2>
                <Link href="/dashboard/restaurant/orders">
                  <IOSButton variant="ghost" size="sm">
                    View All <ArrowRight className="h-4 w-4 ml-1" />
                  </IOSButton>
                </Link>
              </div>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <UtensilsCrossed className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No orders yet today</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {orders.map((order) => {
                    const statusColor = orderStatusColors[order.status] || orderStatusColors.pending;
                    return (
                      <div key={order.id} className="p-3 border rounded-ios-lg flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">#{order.order_number}</p>
                            {order.table_number && (
                              <span className="text-sm text-gray-500">Table {order.table_number}</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            {order.items_count} items • KES {order.total?.toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <IOSBadge className={`${statusColor.bg} ${statusColor.text}`}>
                            {order.status}
                          </IOSBadge>
                          {order.status === 'pending' && (
                            <IOSButton size="sm" onClick={() => handleUpdateStatus(order.id, 'preparing')}>
                              Start
                            </IOSButton>
                          )}
                          {order.status === 'preparing' && (
                            <IOSButton size="sm" onClick={() => handleUpdateStatus(order.id, 'ready')}>
                              Ready
                            </IOSButton>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </IOSCard>

            {/* Quick Actions */}
            <div className="space-y-6">
              <IOSCard className="p-6">
                <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/dashboard/restaurant/pos">
                    <IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer bg-blue-50">
                      <ShoppingCart className="h-8 w-8 text-[#007AFF] mb-2" />
                      <p className="font-medium">POS</p>
                      <p className="text-sm text-gray-500">Take orders</p>
                    </IOSCard>
                  </Link>
                  <Link href="/dashboard/restaurant/kitchen">
                    <IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer bg-orange-50">
                      <ChefHat className="h-8 w-8 text-orange-600 mb-2" />
                      <p className="font-medium">Kitchen</p>
                      <p className="text-sm text-gray-500">Kitchen display</p>
                    </IOSCard>
                  </Link>
                  <Link href="/dashboard/restaurant/menu">
                    <IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer bg-green-50">
                      <Soup className="h-8 w-8 text-[#34C759] mb-2" />
                      <p className="font-medium">Menu</p>
                      <p className="text-sm text-gray-500">Manage items</p>
                    </IOSCard>
                  </Link>
                  <Link href="/dashboard/restaurant/orders">
                    <IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer bg-purple-50">
                      <Clock className="h-8 w-8 text-purple-600 mb-2" />
                      <p className="font-medium">Orders</p>
                      <p className="text-sm text-gray-500">Order history</p>
                    </IOSCard>
                  </Link>
                </div>
              </IOSCard>

              {/* Kitchen Status */}
              <IOSCard className="p-6">
                <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Kitchen Status</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-ios-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-yellow-600" />
                      <span>Pending Orders</span>
                    </div>
                    <span className="font-bold text-yellow-600">
                      {orders.filter(o => o.status === 'pending').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-ios-lg">
                    <div className="flex items-center gap-2">
                      <ChefHat className="h-5 w-5 text-[#007AFF]" />
                      <span>Preparing</span>
                    </div>
                    <span className="font-bold text-[#007AFF]">
                      {orders.filter(o => o.status === 'preparing').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-ios-lg">
                    <div className="flex items-center gap-2">
                      <UtensilsCrossed className="h-5 w-5 text-[#34C759]" />
                      <span>Ready to Serve</span>
                    </div>
                    <span className="font-bold text-[#34C759]">
                      {orders.filter(o => o.status === 'ready').length}
                    </span>
                  </div>
                </div>
              </IOSCard>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
