'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { restaurantAPI, kitchenAPI } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import {
  ChefHat, RefreshCw, Timer, AlertTriangle, Bell, Play,
  Trash2, TrendingDown, Package, Building2, Clock, BookOpen, ClipboardCheck,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import { WastageTab } from './wastage-tab';

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
  totalWastage: number;
  wastageValue: number;
}

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  confirmed: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  preparing: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  ready: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
};

export default function KitchenDashboard() {
  const { user } = useAuth();
  const { activeBranchId, userBranches, setActiveBranch } = useBranch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [kitchenOrders, setKitchenOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    pendingOrders: 0,
    preparingOrders: 0,
    avgWaitTime: 0,
    totalWastage: 0,
    wastageValue: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [storeReceipts, setStoreReceipts] = useState<any[]>([]);
  const [portionTracking, setPortionTracking] = useState<any[]>([]);
  const [kitchenStats, setKitchenStats] = useState<any>(null);
  // Compute the effective branch ID
  const effectiveBranchId = activeBranchId || user?.branch_id || undefined;

  const activeTab = searchParams.get('tab') || 'kitchen';

  const handleTabChange = (tabId: string) => {
    if (tabId === 'kitchen') {
      router.push('/dashboard/kitchen');
    } else {
      router.push(`/dashboard/kitchen?tab=${tabId}`);
    }
  };

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

        setStats((prev: DashboardStats) => ({
          ...prev,
          pendingOrders: pending,
          preparingOrders: preparing,
          avgWaitTime: avgWait
        }));
      }
    } catch (error) {
      console.error('Error fetching kitchen orders:', error);
    }
  }, []);

  const fetchWastage = useCallback(async () => {
    try {
      const result = await restaurantAPI.getWastageRecords();
      if (result.success) {
        setStats((prev: DashboardStats) => ({
          ...prev,
          totalWastage: result.summary?.totalRecords || 0,
          wastageValue: result.summary?.totalCost || 0,
        }));
      }
    } catch (error) {
      console.error('Error fetching wastage:', error);
    }
  }, []);

  const fetchLedgerData = useCallback(async (branchId?: number) => {
    try {
      const [ledgerRes, receiptsRes, trackingRes, statsRes] = await Promise.all([
        kitchenAPI.getLedger({ branch_id: branchId }),
        kitchenAPI.getReceipts({ branch_id: branchId }),
        kitchenAPI.getPortionTracking({ branch_id: branchId }),
        kitchenAPI.getStats(branchId)
      ]);

      if (ledgerRes.success) setLedgerEntries(ledgerRes.data || []);
      if (receiptsRes.success) setStoreReceipts(receiptsRes.data || []);
      if (trackingRes.success) setPortionTracking(trackingRes.data || []);
      if (statsRes.success) setKitchenStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching ledger data:', error);
    }
  }, []);

  const fetchData = useCallback(async (branchId?: number) => {
    setIsLoading(true);
    await Promise.all([
      fetchOrders(branchId),
      fetchWastage(),
      fetchLedgerData(branchId)
    ]);
    setIsLoading(false);
  }, [fetchOrders, fetchWastage, fetchLedgerData]);

  // Re-fetch when branch changes and setup real-time subscription
  useEffect(() => {
    fetchData(effectiveBranchId);

    // Fast polling for orders (every 5 seconds)
    const orderInterval = setInterval(() => {
      fetchOrders(effectiveBranchId);
    }, 5000);

    // Slow polling for wastage (every 60 seconds)
    const wastageInterval = setInterval(() => {
      fetchWastage();
    }, 60000);

    // Real-time subscription
    const channel = supabase
      .channel('kitchen-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurant_orders',
          filter: effectiveBranchId ? `branch_id=eq.${effectiveBranchId}` : undefined,
        },
        (payload) => {
          fetchOrders(effectiveBranchId);
        }
      )
      .subscribe();

    return () => {
      clearInterval(orderInterval);
      clearInterval(wastageInterval);
      supabase.removeChannel(channel);
    };
  }, [effectiveBranchId, fetchData, fetchOrders, fetchWastage]);

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

  const renderKitchen = () => (
    <div className="space-y-6">
      {/* Kitchen Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card">
          <div className="stat-icon">
            <Clock className="h-5 w-5" />
          </div>
          <p className="stat-value">{stats.pendingOrders}</p>
          <p className="stat-label">Pending</p>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <ChefHat className="h-5 w-5" />
          </div>
          <p className="stat-value">{stats.preparingOrders}</p>
          <p className="stat-label">Preparing</p>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <Timer className="h-5 w-5" />
          </div>
          <p className="stat-value">{stats.avgWaitTime} min</p>
          <p className="stat-label">Avg Wait</p>
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

                <div className="space-y-2 mb-track-6 border-t border-stone-100 pt-3">
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
  );

  const handleUpdatePortions = async (id: string, actual: number, expected: number) => {
    let reason = '';
    if (actual !== expected) {
      const input = prompt(`Production discrepancy detected (Expected: ${expected}, Actual: ${actual}). Please provide a reason:`);
      if (input === null) return; // Cancelled
      if (!input.trim()) {
        toast.error('Reason is required for discrepancies');
        return;
      }
      reason = input.trim();
    }

    try {
      await kitchenAPI.updatePortionTracking(id, {
        actual_portions_produced: actual,
        variance_reason: reason
      });
      toast.success('Portions updated successfully');
      fetchLedgerData(effectiveBranchId);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update portions');
    }
  };

  const handleReceiveReceipt = async (id: string) => {
    try {
      await kitchenAPI.verifyReceipt(id, { is_verified: true });
      toast.success('Items received in kitchen');
      fetchLedgerData(effectiveBranchId);
    } catch (error: any) {
      toast.error(error.message || 'Failed to receive items');
    }
  };

  const renderLedger = () => (
    <div className="space-y-6">
      {/* Ledger Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <ClipboardCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Store Receipts</p>
          </div>
          <p className="text-2xl font-bold text-stone-900">{storeReceipts.filter(r => !r.is_verified).length}</p>
          <p className="text-[11px] text-stone-500">Pending reception from store</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <TrendingDown className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Active Portions</p>
          </div>
          <p className="text-2xl font-bold text-stone-900">{portionTracking.filter(p => !p.actual_portions_produced).length}</p>
          <p className="text-[11px] text-stone-500">Items currently being prepared</p>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Variances</p>
          </div>
          <p className="text-2xl font-bold text-stone-900">
            {portionTracking.filter(p => p.actual_portions_produced && p.actual_portions_produced !== p.expected_portions).length}
          </p>
          <p className="text-[11px] text-stone-500">Discrepancies recorded today</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Receipts */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <Package className="h-5 w-5" /> Pending Store Items
          </h2>
          <div className="space-y-3">
            {storeReceipts.filter(r => !r.is_verified).length === 0 ? (
              <div className="p-8 text-center bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200">
                <p className="text-stone-500 text-sm">No pending receipts from store</p>
              </div>
            ) : (
              storeReceipts.filter(r => !r.is_verified).map((receipt) => (
                <div key={receipt.id} className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-stone-900">{receipt.item_name}</p>
                      <p className="text-xs text-stone-500">Qty: {receipt.quantity} {receipt.unit} • From Store</p>
                    </div>
                    <button
                      onClick={() => handleReceiveReceipt(receipt.id)}
                      className="px-3 py-1.5 bg-stone-900 text-white text-[11px] font-bold rounded-lg hover:bg-black transition-colors"
                    >
                      Receive Items
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-stone-400">
                    <Clock className="w-3 h-3" />
                    <span>Sent at {new Date(receipt.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Portion Tracking */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" /> Portion Tracking
          </h2>
          <div className="space-y-3">
            {portionTracking.filter(p => !p.actual_portions_produced).length === 0 ? (
              <div className="p-8 text-center bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200">
                <p className="text-stone-500 text-sm">No active portion tracking</p>
              </div>
            ) : (
              portionTracking.filter(p => !p.actual_portions_produced).map((item) => (
                <div key={item.id} className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="font-bold text-stone-900">{item.item_name}</p>
                      <p className="text-xs text-stone-500">Expected: <span className="font-bold text-stone-900">{item.expected_portions}</span> portions</p>
                    </div>
                    <div className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                      In Production
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      placeholder="Actual portions"
                      className="flex-1 h-9 bg-stone-50 border border-stone-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-stone-900"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleUpdatePortions(item.id, Number((e.target as any).value), item.expected_portions);
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        const input = (e.currentTarget.previousSibling as HTMLInputElement);
                        handleUpdatePortions(item.id, Number(input.value), item.expected_portions);
                      }}
                      className="h-9 px-4 bg-emerald-600 text-white text-[11px] font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      Record Production
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Recently Completed (History) */}
          {portionTracking.filter(p => p.actual_portions_produced).length > 0 && (
            <div className="mt-8 pt-6 border-t border-stone-100">
              <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-4">Recent Production</h3>
              <div className="space-y-2">
                {portionTracking.filter(p => p.actual_portions_produced).slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl text-xs">
                    <div>
                      <p className="font-bold text-stone-900">{item.item_name}</p>
                      <p className="text-stone-500">Produced {item.actual_portions_produced} / {item.expected_portions}</p>
                    </div>
                    {item.variance_reason ? (
                      <div className="flex items-center gap-1.5 text-amber-600 font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Variance Logged</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                        <CheckCircle className="w-3 h-3" />
                        <span>Completed</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderWastage = () => <WastageTab onDataChange={fetchData} />;

  return (
    <ProtectedRoute allowedRoles={[UserRole.KITCHEN, UserRole.POS_KITCHEN, UserRole.RESTAURANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[22px] sm:text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Kitchen</h1>
              <p className="text-stone-500 text-sm mt-0.5">Kitchen operations and wastage recording</p>
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
                onClick={() => fetchData(effectiveBranchId)}
                disabled={isLoading}
                className="btn-secondary h-[40px] px-4 flex items-center justify-center gap-2 flex-1 xs:flex-none"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'Pending', value: stats.pendingOrders, icon: Clock, color: 'text-stone-600', bg: 'bg-stone-50' },
              { label: 'Preparing', value: stats.preparingOrders, icon: ChefHat, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Avg Wait', value: `${stats.avgWaitTime}m`, icon: Timer, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Wastage', value: stats.totalWastage, icon: Trash2, color: 'text-red-600', bg: 'bg-red-50' },
              { label: 'Loss Value', value: `KES ${stats.wastageValue.toLocaleString()}`, icon: TrendingDown, color: 'text-red-700', bg: 'bg-red-50', span: true },
            ].map((stat, i) => (
              <div key={i} className={`bg-white border border-stone-200 rounded-xl p-3 sm:p-4 shadow-sm flex items-center gap-3 sm:gap-4 ${stat.span ? 'col-span-2 md:col-span-1' : ''}`}>
                <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">{stat.label}</p>
                  <p className={`text-lg sm:text-xl font-bold text-stone-900 truncate`}>{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 p-1 bg-stone-100/50 border border-stone-200 rounded-xl w-full sm:w-fit overflow-x-auto no-scrollbar">
            {[
              { id: 'kitchen', label: 'Kitchen Display', icon: ChefHat },
              { id: 'ledger', label: 'Food Ledger', icon: BookOpen },
              { id: 'wastage', label: 'Wastage Recording', icon: Trash2 },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-[13px] font-bold transition-all whitespace-nowrap ${activeTab === tab.id
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
                  }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div>
            {activeTab === 'kitchen' && renderKitchen()}
            {activeTab === 'ledger' && renderLedger()}
            {activeTab === 'wastage' && renderWastage()}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
