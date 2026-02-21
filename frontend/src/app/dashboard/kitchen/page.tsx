'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { restaurantAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import {
  ChefHat, RefreshCw, Timer, Bell, Play,
  Building2, Clock, ArrowRight, Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Order {
  id: string;
  order_number: string;
  table_number?: string;
  order_type: 'dine_in' | 'takeaway' | 'room_service';
  status: string;
  total: number;
  items_count: number;
  created_at: string;
  elapsed_minutes?: number;
  items?: OrderItem[];
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit_price?: number;
  notes?: string;
  status: 'pending' | 'preparing' | 'ready';
}

interface DashboardStats {
  pendingOrders: number;
  preparingOrders: number;
  avgWaitTime: number;
}

export default function KitchenDashboard() {
  const { user } = useAuth();
  const { activeBranchId, userBranches, setActiveBranch } = useBranch();
  const router = useRouter();
  const [kitchenOrders, setKitchenOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    pendingOrders: 0,
    preparingOrders: 0,
    avgWaitTime: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Compute the effective branch ID
  const effectiveBranchId = activeBranchId || user?.branch_id || undefined;

  const fetchOrders = useCallback(async (branchId?: number) => {
    try {
      const result = await restaurantAPI.getKitchenOrders(branchId);
      if (result.success && result.data) {
        const ordersWithTime = result.data.map((order: Order) => ({
          ...order,
          elapsed_minutes: Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000),
        }));
        setKitchenOrders(ordersWithTime);

        // Update stats derived from orders
        const pending = ordersWithTime.filter((o: Order) => o.status === 'pending' || o.status === 'confirmed').length;
        const preparing = ordersWithTime.filter((o: Order) => o.status === 'preparing').length;
        const avgWait = ordersWithTime.length > 0
          ? Math.round(ordersWithTime.reduce((sum: number, o: Order) => sum + (o.elapsed_minutes || 0), 0) / ordersWithTime.length)
          : 0;

        setStats({
          pendingOrders: pending,
          preparingOrders: preparing,
          avgWaitTime: avgWait
        });
      }
    } catch (error) {
      console.error('Error fetching kitchen orders:', error);
    }
  }, []);

  // Re-fetch when branch changes and setup real-time subscription
  useEffect(() => {
    fetchOrders(effectiveBranchId);
    setIsLoading(false);

    // Fast polling for orders (every 5 seconds)
    const orderInterval = setInterval(() => {
      fetchOrders(effectiveBranchId);
    }, 5000);

    // Real-time subscription - only for restaurant orders, not bar
    const channel = supabase
      .channel('kitchen-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_orders',
          filter: effectiveBranchId 
            ? `branch_id=eq.${effectiveBranchId},department=eq.restaurant` 
            : 'department=eq.restaurant',
        },
        (payload) => {
          fetchOrders(effectiveBranchId);
        }
      )
      .subscribe();

    return () => {
      clearInterval(orderInterval);
      supabase.removeChannel(channel);
    };
  }, [effectiveBranchId, fetchOrders]);

  const handleStartOrder = async (orderId: string) => {
    // Optimistic update
    setKitchenOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, status: 'preparing' } : o
    ));
    setStats(prev => ({
      ...prev,
      pendingOrders: Math.max(0, prev.pendingOrders - 1),
      preparingOrders: prev.preparingOrders + 1
    }));

    try {
      await restaurantAPI.updateOrderStatus(orderId, 'preparing');
      toast.success('Order started');
      fetchOrders(effectiveBranchId);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update order');
      // Revert on error - fetch fresh data
      fetchOrders(effectiveBranchId);
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    // Optimistic update
    setKitchenOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, status: 'ready' } : o
    ));
    setStats(prev => ({
      ...prev,
      preparingOrders: Math.max(0, prev.preparingOrders - 1)
    }));

    try {
      await restaurantAPI.updateOrderStatus(orderId, 'ready');
      toast.success('Order ready!');
      const audio = new Audio('/notification.mp3');
      audio.play().catch(() => { });
      fetchOrders(effectiveBranchId);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update order');
      // Revert on error - fetch fresh data
      fetchOrders(effectiveBranchId);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.KITCHEN, UserRole.POS_KITCHEN, UserRole.KITCHEN_OPERATIONS, UserRole.RESTAURANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[22px] sm:text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Kitchen Display</h1>
              <p className="text-stone-500 text-sm mt-0.5">Manage incoming orders</p>
            </div>
            <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-3">
              {userBranches.length > 1 && (
                <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 flex-1 xs:flex-none">
                  <Building2 className="h-4 w-4 text-stone-400" />
                  <select
                    value={activeBranchId || ''}
                    onChange={(e) => setActiveBranch(Number(e.target.value))}
                    className="bg-transparent text-[13px] font-semibold text-stone-700 focus:outline-none w-full"
                  >
                    {userBranches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <button
                onClick={() => fetchOrders(effectiveBranchId)}
                disabled={isLoading}
                className="btn-secondary h-[40px] px-4 flex items-center justify-center gap-2 flex-1 xs:flex-none"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-stone-200 rounded-xl p-3 sm:p-4 shadow-sm flex items-center gap-3 sm:gap-4">
              <div className="h-10 w-10 rounded-xl bg-stone-50 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-stone-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">Pending</p>
                <p className="text-lg sm:text-xl font-bold text-stone-900 truncate">{stats.pendingOrders}</p>
              </div>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl p-3 sm:p-4 shadow-sm flex items-center gap-3 sm:gap-4">
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <ChefHat className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">Preparing</p>
                <p className="text-lg sm:text-xl font-bold text-stone-900 truncate">{stats.preparingOrders}</p>
              </div>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl p-3 sm:p-4 shadow-sm flex items-center gap-3 sm:gap-4">
              <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <Timer className="h-5 w-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">Avg Wait</p>
                <p className="text-lg sm:text-xl font-bold text-stone-900 truncate">{stats.avgWaitTime}m</p>
              </div>
            </div>
          </div>

          {/* Kitchen Orders Grid */}
          {kitchenOrders.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-lg p-8 text-center">
              <ChefHat className="h-12 w-12 mx-auto mb-2 text-stone-300" />
              <p className="text-stone-500 mb-1">No active orders</p>
              <p className="text-sm text-stone-400">New orders will appear here</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {kitchenOrders.map((order) => {
                const isUrgent = (order.elapsed_minutes || 0) > 15;
                const statusStyle = (order.status === 'pending' || order.status === 'confirmed') ? 'border-yellow-200 bg-yellow-50/50' :
                  order.status === 'preparing' ? 'border-blue-200 bg-blue-50/50' :
                    order.status === 'ready' ? 'border-green-200 bg-green-50/50' :
                      'border-stone-200 bg-white';

                return (
                  <div
                    key={order.id}
                    className={`border rounded-2xl p-4 shadow-sm transition-all ${statusStyle} ${isUrgent ? 'ring-2 ring-red-500 ring-offset-2' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-stone-900">#{order.order_number}</p>
                          {isUrgent && (
                            <span className="flex h-2 w-2 rounded-full bg-red-600 animate-ping" />
                          )}
                        </div>
                        <p className="text-xs font-bold text-stone-400 mt-0.5 uppercase tracking-wide">
                          {order.table_number ? `Table ${order.table_number}` : order.order_type}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`flex items-center gap-1.5 text-xs font-bold ${isUrgent ? 'text-red-600' : 'text-stone-500'}`}>
                          <Clock className="h-3.5 w-3.5" />
                          <span>{order.elapsed_minutes}m</span>
                        </div>
                        <div className="mt-1.5">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${(order.status === 'pending' || order.status === 'confirmed') ? 'bg-yellow-200 text-yellow-800' :
                            order.status === 'preparing' ? 'bg-blue-200 text-blue-800' :
                              order.status === 'ready' ? 'bg-green-200 text-green-800' :
                                'bg-stone-200 text-stone-800'
                            }`}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 border-t border-stone-100 pt-3">
                      {(order.items || []).map((item, i) => (
                        <div
                          key={i}
                          className={`p-2.5 rounded-xl text-[13px] ${item.status === 'ready' ? 'bg-stone-100 line-through opacity-60' : 'bg-white border border-stone-100'}`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="font-bold text-stone-900 shrink-0">{item.quantity}x</span>
                            <span className="text-stone-700 font-medium leading-tight">{item.name}</span>
                          </div>
                          {item.notes && (
                            <p className="text-[11px] text-amber-600 font-bold mt-1 ml-6">Note: {item.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 mt-4">
                      {(order.status === 'pending' || order.status === 'confirmed') && (
                        <button
                          className="flex-1 h-11 bg-stone-900 text-white rounded-xl text-sm font-bold shadow-lg shadow-stone-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                          onClick={() => handleStartOrder(order.id)}
                        >
                          <Play className="h-4 w-4" fill="currentColor" />
                          <span>Start Cooking</span>
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <button
                          className="flex-1 h-11 bg-green-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-green-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                          onClick={() => handleCompleteOrder(order.id)}
                        >
                          <Bell className="h-4 w-4" />
                          <span>Ready to Serve</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
