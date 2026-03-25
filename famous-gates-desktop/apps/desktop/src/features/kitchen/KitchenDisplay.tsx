'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useBranch } from '../../hooks/useBranch';
import { restaurantAPI } from '../../services/api/api';
import {
  ChefHat, RefreshCw, Timer, Bell, Play,
  Building2, Clock, CheckCircle2, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../utils/cn';
import { motion, AnimatePresence } from 'framer-motion';

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

export function KitchenDisplay() {
  const { session } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const [kitchenOrders, setKitchenOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    pendingOrders: 0,
    preparingOrders: 0,
    avgWaitTime: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Compute the effective branch ID
  const effectiveBranchId = activeBranchId || session?.branch_id || undefined;

  const fetchOrders = useCallback(async (branchId?: string | number) => {
    try {
      const result = await restaurantAPI.getKitchenOrders(Number(branchId) || undefined) as any;
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

  useEffect(() => {
    fetchOrders(effectiveBranchId);
    setIsLoading(false);

    // Fast polling for orders (every 10 seconds for desktop)
    const orderInterval = setInterval(() => {
      fetchOrders(effectiveBranchId);
    }, 10000);

    return () => clearInterval(orderInterval);
  }, [effectiveBranchId, fetchOrders]);

  const handleStartOrder = async (orderId: string) => {
    try {
      const res = await restaurantAPI.updateOrderStatus(orderId, 'preparing') as any;
      if (res.success) {
        toast.success('Order started');
        fetchOrders(effectiveBranchId);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update order');
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    try {
      const res = await restaurantAPI.updateOrderStatus(orderId, 'ready') as any;
      if (res.success) {
        toast.success('Order ready!');
        fetchOrders(effectiveBranchId);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update order');
    }
  };

  return (
    <div className="h-full bg-stone-50 flex flex-col w-full text-stone-900 overflow-hidden p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Kitchen Display</h1>
          <p className="text-stone-500 text-sm">Active Orders - {activeBranch?.name || 'Loading...'}</p>
        </div>
        <button
          onClick={() => fetchOrders(effectiveBranchId)}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 bg-white border border-stone-200 h-10 px-4 rounded-xl font-bold hover:bg-stone-50 transition-all shadow-sm"
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Pending</p>
            <p className="text-2xl font-black text-stone-900">{stats.pendingOrders}</p>
          </div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center">
            <ChefHat className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Cooking</p>
            <p className="text-2xl font-black text-stone-900">{stats.preparingOrders}</p>
          </div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-green-50 flex items-center justify-center">
            <Timer className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Avg Wait</p>
            <p className="text-2xl font-black text-stone-900">{stats.avgWaitTime}m</p>
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {kitchenOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-stone-300">
            <ChefHat className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-bold">No active kitchen orders</p>
            <p className="text-sm opacity-60">Incoming orders will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {kitchenOrders.map((order) => {
              const isUrgent = (order.elapsed_minutes || 0) > 20;
              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={order.id}
                  className={cn(
                    "bg-white border border-stone-200 rounded-2xl overflow-hidden flex flex-col shadow-sm transition-all",
                    isUrgent && "ring-2 ring-red-500 ring-offset-2",
                    order.status === 'preparing' && "border-blue-200 bg-blue-50/10"
                  )}
                >
                  {/* Order Card Header */}
                  <div className={cn(
                    "p-4 border-b flex items-start justify-between",
                    order.status === 'preparing' ? "bg-blue-50/50 border-blue-100" : "bg-stone-50 border-stone-100"
                  )}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-lg text-stone-900">#{order.order_number}</span>
                        {isUrgent && <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />}
                      </div>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                        {order.table_number ? `Table ${order.table_number}` : order.order_type}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "flex items-center gap-1 text-xs font-bold",
                        isUrgent ? "text-red-600" : "text-stone-500"
                      )}>
                        <Clock className="w-3 h-3" />
                        <span>{order.elapsed_minutes}m</span>
                      </div>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="flex-1 p-4 space-y-2">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="flex gap-3 items-start">
                        <span className="bg-stone-100 text-stone-900 font-bold text-xs px-2 py-0.5 rounded shrink-0">
                          {item.quantity}x
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-stone-800 leading-tight">{item.name}</p>
                          {item.notes && (
                            <p className="text-[10px] text-amber-600 font-bold italic mt-0.5">{item.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Button */}
                  <div className="p-4 pt-0">
                    {(order.status === 'pending' || order.status === 'confirmed') ? (
                      <button
                        onClick={() => handleStartOrder(order.id)}
                        className="w-full h-11 bg-stone-900 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-black transition-all active:scale-95"
                      >
                        <Play className="w-4 h-4" />
                        START COOKING
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCompleteOrder(order.id)}
                        className="w-full h-11 bg-green-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition-all active:scale-95 shadow-lg shadow-green-100"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        MARK AS READY
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
