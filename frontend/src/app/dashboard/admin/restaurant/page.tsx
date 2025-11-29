'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { motion } from 'framer-motion';
import {
  UtensilsCrossed,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Clock,
  Users,
  Star,
  Coffee,
  Plus,
  Edit2,
  Trash2,
  MoreHorizontal,
  Search,
  Filter,
  ChevronDown,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { MenuItemModal, OrderModal } from '@/components/modals/RestaurantModals';
import { restaurantAPI } from '@/lib/api';

export default function AdminRestaurantPage() {
  const { user } = useAuth();
  const [showMenuItemModal, setShowMenuItemModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [stats, setStats] = useState({
    todayOrders: 0,
    todayRevenue: 0,
    averageOrderValue: 0,
    tableOccupancy: 0,
    topDish: '-',
    customerRating: 0
  });

  const [topItems, setTopItems] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [ordersRes, menuRes] = await Promise.all([
        restaurantAPI.getOrders().catch(() => ({ orders: [] })),
        restaurantAPI.getMenuItems().catch(() => ({ items: [] }))
      ]);

      const orders = ordersRes.orders || ordersRes || [];
      const menuItems = menuRes.items || menuRes || [];

      if (Array.isArray(orders)) {
        const todayRevenue = orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);
        
        setStats({
          todayOrders: orders.length,
          todayRevenue,
          averageOrderValue: orders.length > 0 ? Math.round(todayRevenue / orders.length) : 0,
          tableOccupancy: 0,
          topDish: '-',
          customerRating: 0
        });

        setRecentOrders(orders.slice(0, 10).map((o: any) => ({
          id: o.id || o.order_number || '-',
          table: o.table_number || o.room || '-',
          amount: o.total || 0,
          items: o.items?.length || 0,
          status: o.status || 'pending',
          time: o.created_at ? new Date(o.created_at).toLocaleTimeString() : '-'
        })));
      }
    } catch (error) {
      console.error('Error fetching restaurant data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Restaurant Management</h1>
            <p className="text-gray-600 mt-1">Monitor restaurant operations and performance</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <ShoppingCart className="h-8 w-8 text-blue-600 mb-2" />
              <p className="text-2xl font-bold">{stats.todayOrders}</p>
              <p className="text-sm text-gray-600">Today's Orders</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <DollarSign className="h-8 w-8 text-green-600 mb-2" />
              <p className="text-xl font-bold text-green-900">KES {(stats.todayRevenue / 1000).toFixed(0)}K</p>
              <p className="text-sm text-green-700">Today's Revenue</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <TrendingUp className="h-8 w-8 text-purple-600 mb-2" />
              <p className="text-xl font-bold">KES {stats.averageOrderValue}</p>
              <p className="text-sm text-gray-600">Avg Order Value</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <Users className="h-8 w-8 text-indigo-600 mb-2" />
              <p className="text-2xl font-bold">{stats.tableOccupancy}%</p>
              <p className="text-sm text-gray-600">Table Occupancy</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <Coffee className="h-8 w-8 text-orange-600 mb-2" />
              <p className="text-lg font-bold">{stats.topDish}</p>
              <p className="text-sm text-gray-600">Top Dish</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <Star className="h-8 w-8 text-yellow-600 mb-2" />
              <p className="text-2xl font-bold text-yellow-900">{stats.customerRating}</p>
              <p className="text-sm text-yellow-700">Customer Rating</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Selling Items */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Selling Items</h2>
              <div className="space-y-3">
                {topItems.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-600">{item.orders} orders</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">KES {item.revenue.toLocaleString()}</p>
                      <span className={`text-xs ${
                        item.trend === 'up' ? 'text-green-600' :
                        item.trend === 'down' ? 'text-red-600' :
                        'text-gray-600'
                      }`}>
                        {item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : '→'} {item.trend}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Orders */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h2>
              <div className="space-y-3">
                {recentOrders.map(order => (
                  <div key={order.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium text-gray-900">{order.id}</span>
                        <span className="ml-2 text-sm text-gray-600">
                          {order.table.includes('Room') ? order.table : `Table ${order.table}`}
                        </span>
                      </div>
                      <span className="font-bold">KES {order.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{order.items} items • {order.time}</span>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        order.status === 'served' ? 'bg-green-100 text-green-800' :
                        order.status === 'ready' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'preparing' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-xl p-6 text-white">
            <h2 className="text-lg font-semibold mb-4">Restaurant Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => setShowMenuItemModal(true)}
                className="bg-white/20 backdrop-blur-sm rounded-lg p-4 hover:bg-white/30 transition-colors"
              >
                <UtensilsCrossed className="h-6 w-6 mb-2 mx-auto" />
                <span className="text-sm">Menu Management</span>
              </button>
              <button
                onClick={() => setShowOrderModal(true)}
                className="bg-white/20 backdrop-blur-sm rounded-lg p-4 hover:bg-white/30 transition-colors"
              >
                <ShoppingCart className="h-6 w-6 mb-2 mx-auto" />
                <span className="text-sm">New Order</span>
              </button>
              <button
                onClick={() => setShowReservationModal(true)}
                className="bg-white/20 backdrop-blur-sm rounded-lg p-4 hover:bg-white/30 transition-colors"
              >
                <Clock className="h-6 w-6 mb-2 mx-auto" />
                <span className="text-sm">Table Reservations</span>
              </button>
              <button
                onClick={() => toast.info('Opening daily report...')}
                className="bg-white/20 backdrop-blur-sm rounded-lg p-4 hover:bg-white/30 transition-colors"
              >
                <DollarSign className="h-6 w-6 mb-2 mx-auto" />
                <span className="text-sm">Daily Report</span>
              </button>
            </div>
          </div>

          {/* Restaurant Modals */}
          <MenuItemModal
            isOpen={showMenuItemModal}
            onClose={() => setShowMenuItemModal(false)}
            mode="create"
          />
          <OrderModal
            isOpen={showOrderModal}
            onClose={() => setShowOrderModal(false)}
          />
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
