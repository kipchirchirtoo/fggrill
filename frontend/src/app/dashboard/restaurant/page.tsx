'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { motion } from 'framer-motion';
import {
  UtensilsCrossed,
  ShoppingCart,
  Clock,
  CheckCircle,
  DollarSign,
  Package,
  AlertCircle,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { restaurantAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function RestaurantDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    ordersToday: 0,
    pendingOrders: 0,
    completedOrders: 0,
    todayRevenue: 0,
    averageOrderValue: 0
  });
  const [activeOrders, setActiveOrders] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const ordersRes = await restaurantAPI.getOrders().catch(() => ({ orders: [] }));
      const orders = ordersRes.orders || ordersRes || [];

      if (Array.isArray(orders)) {
        const pendingOrders = orders.filter((o: any) => o.status === 'pending' || o.status === 'preparing').length;
        const completedOrders = orders.filter((o: any) => o.status === 'completed').length;
        const todayRevenue = orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);

        setStats({
          ordersToday: orders.length,
          pendingOrders,
          completedOrders,
          todayRevenue,
          averageOrderValue: orders.length > 0 ? Math.round(todayRevenue / orders.length) : 0
        });

        setActiveOrders(orders.filter((o: any) => o.status !== 'completed').slice(0, 10).map((o: any) => ({
          id: o.id,
          table: o.table_number || o.room_number || '-',
          items: o.items?.length || 0,
          total: o.total || 0,
          status: o.status || 'pending',
          time: o.created_at ? new Date(o.created_at).toLocaleTimeString() : '-'
        })));
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <ProtectedRoute allowedRoles={[UserRole.RESTAURANT]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Restaurant Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Welcome, {user?.firstName}! Manage orders and menu items.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <div className="flex items-center justify-between">
                <ShoppingCart className="h-8 w-8 text-blue-600" />
                <span className="text-2xl font-bold">{stats.ordersToday}</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">Orders Today</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <Clock className="h-8 w-8 text-yellow-600" />
                <span className="text-2xl font-bold">{stats.pendingOrders}</span>
              </div>
              <p className="text-sm text-yellow-700 mt-2">Pending</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <span className="text-2xl font-bold">{stats.completedOrders}</span>
              </div>
              <p className="text-sm text-green-700 mt-2">Completed</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <div className="flex items-center justify-between">
                <DollarSign className="h-8 w-8 text-green-600" />
                <span className="text-xl font-bold">KES {stats.todayRevenue.toLocaleString()}</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">Today's Revenue</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <div className="flex items-center justify-between">
                <TrendingUp className="h-8 w-8 text-purple-600" />
                <span className="text-xl font-bold">KES {stats.averageOrderValue}</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">Avg Order Value</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Orders</h2>
              <div className="space-y-3">
                {activeOrders.map(order => (
                  <div key={order.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium text-gray-900">
                          {order.table.includes('Room') ? order.table : `Table ${order.table}`}
                        </span>
                        <span className="ml-2 text-sm text-gray-600">({order.items} items)</span>
                      </div>
                      <span className="font-bold text-gray-900">KES {order.total}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        order.status === 'ready' ? 'bg-green-100 text-green-800' :
                        order.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.status}
                      </span>
                      <span className="text-sm text-gray-500">{order.time}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button className="flex-1 px-3 py-1 bg-indigo-50 text-indigo-600 rounded text-sm hover:bg-indigo-100">
                        View Details
                      </button>
                      {order.status === 'ready' && (
                        <button className="flex-1 px-3 py-1 bg-green-50 text-green-600 rounded text-sm hover:bg-green-100">
                          Mark Delivered
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-4">
                <button className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                  <ShoppingCart className="h-6 w-6 text-green-600 mb-2 mx-auto" />
                  <span className="text-sm text-gray-700">New Order</span>
                </button>
                <button className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                  <UtensilsCrossed className="h-6 w-6 text-blue-600 mb-2 mx-auto" />
                  <span className="text-sm text-gray-700">Menu Items</span>
                </button>
                <button className="p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                  <Package className="h-6 w-6 text-purple-600 mb-2 mx-auto" />
                  <span className="text-sm text-gray-700">Inventory</span>
                </button>
                <button className="p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors">
                  <DollarSign className="h-6 w-6 text-yellow-600 mb-2 mx-auto" />
                  <span className="text-sm text-gray-700">Daily Report</span>
                </button>
              </div>

              <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-orange-600 mr-2" />
                  <span className="text-sm font-medium text-orange-800">Low Stock Alert</span>
                </div>
                <p className="text-sm text-orange-700 mt-1">Coffee beans and milk running low</p>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
