'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { restaurantAPI } from '@/lib/api';
import { 
  ChefHat, Clock, RefreshCw, Check, Bell, UtensilsCrossed,
  Timer, AlertTriangle, Play
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  notes?: string;
  status: 'pending' | 'preparing' | 'ready';
}

interface KitchenOrder {
  id: string;
  order_number: string;
  table_number?: string;
  order_type: string;
  status: string;
  items: OrderItem[];
  created_at: string;
  elapsed_minutes?: number;
}

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-300' },
  preparing: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
  ready: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300' },
};

export default function KitchenDisplayPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewFilter, setViewFilter] = useState<'all' | 'pending' | 'preparing'>('all');

  const fetchOrders = useCallback(async () => {
    try {
      const response = await restaurantAPI.getKitchenOrders();
      if (response.success) {
        const ordersWithTime = (response.data || []).map((order: KitchenOrder) => ({
          ...order,
          elapsed_minutes: Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000),
        }));
        setOrders(ordersWithTime);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const filteredOrders = orders.filter((order) => {
    if (viewFilter === 'all') return ['pending', 'preparing'].includes(order.status);
    return order.status === viewFilter;
  });

  const handleStartOrder = async (orderId: string) => {
    try {
      await restaurantAPI.updateOrderStatus(orderId, 'preparing');
      toast.success('Order started');
      fetchOrders();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update order');
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    try {
      await restaurantAPI.updateOrderStatus(orderId, 'ready');
      toast.success('Order ready!');
      // Play notification sound
      const audio = new Audio('/notification.mp3');
      audio.play().catch(() => {});
      fetchOrders();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update order');
    }
  };

  const handleItemReady = async (orderId: string, itemId: string) => {
    try {
      await restaurantAPI.markItemReady(orderId, itemId);
      fetchOrders();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update item');
    }
  };

  const stats = {
    pending: orders.filter(o => o.status === 'pending').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    avgWait: orders.length > 0 
      ? Math.round(orders.reduce((sum, o) => sum + (o.elapsed_minutes || 0), 0) / orders.length)
      : 0,
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.RESTAURANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ChefHat className="h-7 w-7" />
                Kitchen Display
              </h1>
              <p className="text-gray-500">Real-time order management</p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchOrders} leftIcon={<RefreshCw />}>Refresh
              </IOSButton>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4 bg-yellow-50 border-yellow-200">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div>
                  <p className="text-sm text-yellow-700">Pending</p>
                  <p className="text-3xl font-bold text-yellow-700">{stats.pending}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-center gap-3">
                <ChefHat className="h-8 w-8 text-[#007AFF]" />
                <div>
                  <p className="text-sm text-blue-700">Preparing</p>
                  <p className="text-3xl font-bold text-blue-700">{stats.preparing}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4 bg-gray-50">
              <div className="flex items-center gap-3">
                <Timer className="h-8 w-8 text-gray-600" />
                <div>
                  <p className="text-sm text-gray-600">Avg Wait</p>
                  <p className="text-3xl font-bold text-gray-700">{stats.avgWait} min</p>
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2">
            {(['all', 'pending', 'preparing'] as const).map((filter) => (
              <IOSButton
                key={filter}
                variant={viewFilter === filter ? 'primary' : 'secondary'}
                onClick={() => setViewFilter(filter)}
              >
                {filter === 'all' ? 'All Active' : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </IOSButton>
            ))}
          </div>

          {/* Orders Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <UtensilsCrossed className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <p className="text-xl text-gray-500">No active orders</p>
              <p className="text-gray-400">New orders will appear here</p>
            </IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredOrders.map((order) => {
                const colors = statusColors[order.status] || statusColors.pending;
                const isUrgent = (order.elapsed_minutes || 0) > 15;

                return (
                  <IOSCard
                    key={order.id}
                    className={`p-4 border-2 ${colors.border} ${colors.bg} ${isUrgent ? 'animate-pulse' : ''}`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-lg">#{order.order_number}</p>
                        <p className="text-sm text-gray-600">
                          {order.table_number ? `Table ${order.table_number}` : order.order_type}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`flex items-center gap-1 ${isUrgent ? 'text-[#FF3B30]' : 'text-gray-600'}`}>
                          {isUrgent && <AlertTriangle className="h-4 w-4" />}
                          <Timer className="h-4 w-4" />
                          <span className="font-bold">{order.elapsed_minutes}m</span>
                        </div>
                        <IOSBadge className={`${colors.bg} ${colors.text}`}>
                          {order.status}
                        </IOSBadge>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="space-y-2 mb-4">
                      {(order.items || []).map((item, i) => (
                        <div
                          key={i}
                          className={`p-2 rounded flex items-center justify-between ${
                            item.status === 'ready' ? 'bg-green-100 line-through opacity-60' : 'bg-[#FFFFFF]'
                          }`}
                        >
                          <div>
                            <span className="font-medium">{item.quantity}x</span> {item.name}
                            {item.notes && (
                              <p className="text-xs text-orange-600">Note: {item.notes}</p>
                            )}
                          </div>
                          {item.status !== 'ready' && (
                            <IOSButton
                              size="sm"
                              variant="ghost"
                              onClick={() => handleItemReady(order.id, item.id)}
                            >
                              <Check className="h-4 w-4" />
                            </IOSButton>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {order.status === 'pending' && (
                        <IOSButton
                          className="flex-1"
                          onClick={() => handleStartOrder(order.id)}
                          leftIcon={<Play />}
                        >
                          Start
                        </IOSButton>
                      )}
                      {order.status === 'preparing' && (
                        <IOSButton
                          className="flex-1 bg-[#34C759] hover:bg-green-700"
                          onClick={() => handleCompleteOrder(order.id)}
                          leftIcon={<Bell />}
                        >
                          Ready
                        </IOSButton>
                      )}
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
