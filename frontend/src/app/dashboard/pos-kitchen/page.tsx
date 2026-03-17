'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { restaurantAPI } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { UnifiedPOS } from '@/components/pos/UnifiedPOS';
import {
  UtensilsCrossed, ShoppingCart, DollarSign, Clock, TrendingUp,
  RefreshCw, ArrowRight, Building2, FileText, X, ChefHat, Wine,
  Play, Bell, Timer
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  order_number: string;
  table_number?: string;
  order_type: 'dine_in' | 'takeaway' | 'room_service' | 'bar';
  status: string;
  total: number;
  items_count: number;
  created_at: string;
  elapsed_minutes?: number;
  items?: OrderItem[];
}

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category_id: string;
  category_name?: string;
  image_url?: string;
  is_available: boolean;
  preparation_time?: number;
  branch_id?: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
}

interface CartItem extends MenuItem {
  quantity: number;
  notes?: string;
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
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  avgOrderValue: number;
}

const orderStatusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-stone-100', text: 'text-stone-700' },
  preparing: { bg: 'bg-stone-200', text: 'text-stone-800' },
  ready: { bg: 'bg-stone-100', text: 'text-stone-700' },
  served: { bg: 'bg-stone-50', text: 'text-stone-600' },
  completed: { bg: 'bg-stone-100', text: 'text-stone-700' },
  cancelled: { bg: 'bg-stone-200', text: 'text-stone-600' },
};

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: 'bg-stone-50', text: 'text-stone-700', border: 'border-stone-300' },
  preparing: { bg: 'bg-stone-100', text: 'text-stone-800', border: 'border-stone-400' },
  ready: { bg: 'bg-stone-50', text: 'text-stone-700', border: 'border-stone-300' },
};

export default function POSKitchenDashboard() {
  const { user } = useAuth();
  const { activeBranchId, userBranches, setActiveBranch } = useBranch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isGeneratingBill, setIsGeneratingBill] = useState<string | null>(null);
  
  // Filter states for history tab
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [waiterFilter, setWaiterFilter] = useState<string>('my-orders'); // 'my-orders' or 'all-orders' or specific waiter_id
  
  const [stats, setStats] = useState<DashboardStats>({
    todayOrders: 0,
    todayRevenue: 0,
    pendingOrders: 0,
    avgOrderValue: 0,
  });

  const canSeeRevenue = [
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.ACCOUNTANT
  ].includes(user?.role as UserRole);
  const [isLoading, setIsLoading] = useState(true);

  // Active orders state (kitchen display)
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [activeOrdersLoading, setActiveOrdersLoading] = useState(false);

  const fetchActiveOrders = useCallback(async () => {
    setActiveOrdersLoading(true);
    try {
      const currentBranchId = activeBranchId || user?.branch_id;
      const result = await restaurantAPI.getKitchenOrders(currentBranchId || undefined);
      if (result.success && result.data) {
        setActiveOrders(result.data.map((o: Order) => ({
          ...o,
          elapsed_minutes: Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000),
        })));
      }
    } catch (e) {
      console.error('Failed to fetch active orders:', e);
    } finally {
      setActiveOrdersLoading(false);
    }
  }, [activeBranchId, user?.branch_id]);

  // Get active tab from URL params with fallback for legacy 'pos' tab
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam === 'pos' ? 'restaurant' : (tabParam || 'overview');

  // Function to handle tab changes with URL updates
  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabId);
    router.push(`/dashboard/pos-kitchen?${params.toString()}`);
  };

  // Effect to handle redirection of legacy 'pos' tab
  useEffect(() => {
    if (searchParams.get('tab') === 'pos') {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', 'restaurant');
      router.replace(`/dashboard/pos-kitchen?${params.toString()}`);
    }
  }, [searchParams, router]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentBranchId = activeBranchId || user?.branch_id;

      // In offline mode, we don't need user ID - just fetch all orders for the branch
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const isOfflineMode = token === 'offline-bridge-token';

      // Build filters based on current tab and filter selections
      const filters: any = {};
      
      // Default to last 7 days of orders
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      filters.from_date = sevenDaysAgo.toISOString().split('T')[0];
      filters.to_date = today.toISOString().split('T')[0];
      
      // For history tab, apply status and waiter filters
      if (activeTab === 'recent') {
        if (statusFilter !== 'all') {
          filters.status = statusFilter;
        }
        
        if (waiterFilter === 'my-orders') {
          // Show only orders created by this user (default behavior)
          // No waiter_id filter needed, will use created_by
        } else if (waiterFilter === 'all-orders') {
          // Show all orders for this branch (don't filter by user)
          // Pass empty userId to skip created_by filter
        } else if (waiterFilter && waiterFilter !== 'my-orders' && waiterFilter !== 'all-orders') {
          // Show orders for specific waiter
          filters.waiter_id = waiterFilter;
        }
      }

      const [ordersResult, salesResult] = await Promise.allSettled([
        restaurantAPI.getMyOrders(
          waiterFilter === 'all-orders' ? '' : (user?.id || 'offline-user'), 
          currentBranchId || undefined,
          filters // Always pass filters with date range
        ),
        restaurantAPI.getDailySales(currentBranchId || undefined),
      ]);

      const ordersRes = ordersResult.status === 'fulfilled' ? ordersResult.value : { success: false, data: [] };
      const salesRes = salesResult.status === 'fulfilled' ? salesResult.value : { success: false, data: { total: 0 } };

      const allOrders = ordersRes.success ? (ordersRes.data || []) : [];

      setOrders(allOrders.slice(0, 10));
      setRecentOrders(allOrders.slice(0, 50));

      const pending = allOrders.filter((o: Order) => ['pending', 'preparing', 'ready'].includes(o.status)).length;
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
  }, [activeBranchId, user?.branch_id, user?.id, activeTab, statusFilter, waiterFilter]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Poll active orders when on that tab
  useEffect(() => {
    if (activeTab !== 'active') return;
    fetchActiveOrders();
    const interval = setInterval(fetchActiveOrders, 8000);
    return () => clearInterval(interval);
  }, [activeTab, fetchActiveOrders]);

  const handleUpdateStatus = async (orderId: string, status: string) => {
    try {
      await restaurantAPI.updateOrderStatus(orderId, status);
      toast.success('Order status updated!');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update order status');
    }
  };

  const handleGenerateBill = async (order: any) => {
    setIsGeneratingBill(order.id);
    try {
      // Calculate total from items if order.total is 0
      const itemsTotal = order.items?.reduce((sum: number, item: any) =>
        sum + ((item.unit_price || 0) * item.quantity), 0) || 0;
      const totalAmount = order.total || itemsTotal;

      // Calculate VAT breakdown (16% included in prices)
      const vatRate = 0.16;
      const subtotal = Math.round(totalAmount / (1 + vatRate));
      const vatAmount = totalAmount - subtotal;

      const receiptData = {
        receipt_type: 'sale',
        receipt_number: order.order_number,
        date: new Date().toLocaleString(),
        table_number: order.table_number,
        room_number: order.room_number,
        customer_name: order.customer_name || (order.table_number ? `Table ${order.table_number}` : 'Walk-in'),
        cashier_name: user?.firstName ? `${user.firstName} ${user.lastName || ''}` : 'Staff',
        served_by: order.waiter_name || undefined,
        items: order.items?.map((item: any) => ({
          name: item.name || 'Unknown Item',
          quantity: item.quantity,
          unit_price: item.unit_price || 0,
          total: (item.unit_price || 0) * item.quantity
        })) || [],
        subtotal: subtotal,
        tax_amount: vatAmount,
        total_amount: totalAmount,
        payment_method: order.payment_method || 'Cash',
        amount_paid: totalAmount,
        change_amount: 0
      };

      const response = await restaurantAPI.generateBill(receiptData);

      if (response.success && response.data?.pdf_base64) {
        // Convert base64 to blob
        const byteCharacters = atob(response.data.pdf_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = response.data.filename || `bill_${order.order_number}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(`Bill for Order #${order.order_number} generated!`);
      } else {
        throw new Error(response.message || 'Failed to generate bill');
      }
    } catch (error: any) {
      console.error('Bill generation error:', error);
      toast.error(error.message || 'Failed to generate bill. Check if Python service is running.');
    } finally {
      setIsGeneratingBill(null);
    }
  };

  const handleStartOrder = async (orderId: string) => {
    try {
      await restaurantAPI.updateOrderStatus(orderId, 'preparing');
      toast.success('Order started');
      fetchData();
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
      audio.play().catch(() => { });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update order');
    }
  };

  const renderActiveOrders = () => {
    const pending = activeOrders.filter(o => o.status === 'pending' || o.status === 'confirmed');
    const preparing = activeOrders.filter(o => o.status === 'preparing');
    const ready = activeOrders.filter(o => o.status === 'ready');

    const handleStart = async (orderId: string) => {
      setActiveOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'preparing' } : o));
      try {
        await restaurantAPI.updateOrderStatus(orderId, 'preparing');
        toast.success('Order started');
      } catch { fetchActiveOrders(); }
    };

    const handleReady = async (orderId: string) => {
      setActiveOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'ready' } : o));
      try {
        await restaurantAPI.updateOrderStatus(orderId, 'ready');
        toast.success('Order ready!');
        new Audio('/notification.mp3').play().catch(() => {});
      } catch { fetchActiveOrders(); }
    };

    const OrderCard = ({ order }: { order: Order }) => {
      const isUrgent = (order.elapsed_minutes || 0) > 15;
      const statusStyle = (order.status === 'pending' || order.status === 'confirmed')
        ? 'border-yellow-200 bg-yellow-50/50'
        : order.status === 'preparing' ? 'border-blue-200 bg-blue-50/50'
        : 'border-green-200 bg-green-50/50';

      return (
        <div className={`border rounded-2xl p-4 shadow-sm transition-all ${statusStyle} ${isUrgent ? 'ring-2 ring-red-500 ring-offset-2' : ''}`}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-stone-900">#{order.order_number}</p>
                {isUrgent && <span className="flex h-2 w-2 rounded-full bg-red-600 animate-ping" />}
              </div>
              <p className="text-xs font-bold text-stone-400 mt-0.5 uppercase tracking-wide">
                {order.table_number ? `Table ${order.table_number}` : order.order_type}
              </p>
            </div>
            <div className="text-right">
              <div className={`flex items-center gap-1 text-xs font-bold ${isUrgent ? 'text-red-600' : 'text-stone-500'}`}>
                <Clock className="h-3 w-3" /><span>{order.elapsed_minutes}m</span>
              </div>
              <span className={`mt-1 inline-block px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                (order.status === 'pending' || order.status === 'confirmed') ? 'bg-yellow-200 text-yellow-800' :
                order.status === 'preparing' ? 'bg-blue-200 text-blue-800' : 'bg-green-200 text-green-800'
              }`}>{order.status}</span>
            </div>
          </div>
          <div className="space-y-1.5 mb-3 border-t border-stone-100 pt-2">
            {(order.items || []).map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-[13px]">
                <span className="font-bold text-stone-900 shrink-0">{item.quantity}x</span>
                <span className="text-stone-700">{item.name}</span>
              </div>
            ))}
            {(!order.items || order.items.length === 0) && (
              <p className="text-xs text-stone-400">{order.items_count} item(s)</p>
            )}
          </div>
          <div className="flex gap-2">
            {(order.status === 'pending' || order.status === 'confirmed') && (
              <button onClick={() => handleStart(order.id)}
                className="flex-1 h-10 bg-stone-900 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5">
                <Play className="h-3.5 w-3.5" fill="currentColor" /> Start
              </button>
            )}
            {order.status === 'preparing' && (
              <button onClick={() => handleReady(order.id)}
                className="flex-1 h-10 bg-green-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1.5">
                <Bell className="h-3.5 w-3.5" /> Ready
              </button>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-stone-200 rounded-xl p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-yellow-50 flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 text-yellow-600" />
            </div>
            <div><p className="text-[10px] font-bold text-stone-400 uppercase">Pending</p>
              <p className="text-lg font-bold text-stone-900">{pending.length}</p></div>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <ChefHat className="h-4 w-4 text-blue-600" />
            </div>
            <div><p className="text-[10px] font-bold text-stone-400 uppercase">Preparing</p>
              <p className="text-lg font-bold text-stone-900">{preparing.length}</p></div>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
              <Bell className="h-4 w-4 text-green-600" />
            </div>
            <div><p className="text-[10px] font-bold text-stone-400 uppercase">Ready</p>
              <p className="text-lg font-bold text-stone-900">{ready.length}</p></div>
          </div>
        </div>

        {/* Refresh */}
        <div className="flex justify-end">
          <button onClick={fetchActiveOrders} disabled={activeOrdersLoading}
            className="flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 px-3 py-1.5 border border-stone-200 rounded-lg">
            <RefreshCw className={`h-3.5 w-3.5 ${activeOrdersLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {activeOrdersLoading && activeOrders.length === 0 ? (
          <div className="flex justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-stone-400" /></div>
        ) : activeOrders.length === 0 ? (
          <div className="bg-white border border-stone-200 rounded-xl p-10 text-center">
            <ChefHat className="h-12 w-12 mx-auto mb-2 text-stone-300" />
            <p className="text-stone-500">No active orders</p>
            <p className="text-sm text-stone-400 mt-1">New orders will appear here automatically</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeOrders.map(order => <OrderCard key={order.id} order={order} />)}
          </div>
        )}
      </div>
    );
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Orders', value: stats.todayOrders, icon: ShoppingCart, show: true },
          { label: 'Revenue', value: `KES ${stats.todayRevenue.toLocaleString()}`, icon: DollarSign, show: canSeeRevenue },
          { label: 'Pending', value: stats.pendingOrders, icon: Clock, show: true },
          { label: 'Avg Order', value: `KES ${stats.avgOrderValue.toLocaleString()}`, icon: TrendingUp, show: canSeeRevenue },
        ].filter(s => s.show).map((stat, i) => (
          <div key={i} className="stat-card p-3 sm:p-4">
            <div className="stat-icon h-8 w-8 sm:h-9 sm:w-9 mb-2">
              <stat.icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <p className="stat-value text-[18px] sm:text-[20px] truncate">{stat.value}</p>
            <p className="stat-label text-[11px] sm:text-[13px]">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Orders Overview */}
      <IOSCard className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-semibold font-sf-pro-display">My Orders</h2>
          <IOSButton variant="ghost" size="sm" onClick={() => handleTabChange('recent')}>
            View All <ArrowRight className="h-4 w-4 ml-1" />
          </IOSButton>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <UtensilsCrossed className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>You haven't created any orders today</p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {orders.map((order) => {
              const statusColor = orderStatusColors[order.status] || orderStatusColors.pending;
              return (
                <div key={order.id} className="p-3 border border-stone-100 rounded-ios-lg flex items-center justify-between hover:bg-stone-50 transition-colors cursor-pointer" onClick={() => setSelectedOrder(order)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm">#{order.order_number}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${order.order_type === 'bar' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                        {order.order_type === 'bar' ? 'Bar' : 'Food'}
                      </span>
                    </div>
                    <p className="text-[12px] text-stone-500 mt-0.5 truncate">
                      {order.table_number && `Table ${order.table_number} • `}KES {order.total?.toLocaleString()}
                    </p>
                  </div>
                  <IOSBadge className={`${statusColor.bg} ${statusColor.text} text-[10px] h-5`}>
                    {order.status}
                  </IOSBadge>
                </div>
              );
            })}
          </div>
        )}
      </IOSCard>

      {/* Quick Actions - Minimal Design */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <button
            className="bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-3 text-left transition-colors"
            onClick={() => handleTabChange('restaurant')}
          >
            <p className="text-sm font-medium text-gray-900">New Restaurant Order</p>
            <p className="text-xs text-gray-500 mt-1">Take new food orders</p>
          </button>
          <button
            className="bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-3 text-left transition-colors"
            onClick={() => handleTabChange('bar')}
          >
            <p className="text-sm font-medium text-gray-900">New Bar Order</p>
            <p className="text-xs text-gray-500 mt-1">Take new drink orders</p>
          </button>
          <button
            className="bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-3 text-left transition-colors"
            onClick={() => handleTabChange('active')}
          >
            <p className="text-sm font-medium text-gray-900">Active Orders</p>
            <p className="text-xs text-gray-500 mt-1">View orders in progress</p>
          </button>
        </div>
      </div>
    </div>
  );

  const renderRecentOrders = () => {
    // Calculate filtered stats
    const pendingCount = recentOrders.filter(o => o.status === 'pending').length;
    const verifiedCount = recentOrders.filter(o => ['completed', 'served', 'ready'].includes(o.status)).length;
    const voidCount = recentOrders.filter(o => o.status === 'cancelled').length;
    
    return (
    <div className="space-y-6">
      {/* Order Details Modal - Minimal Design */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-200" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Order #{selectedOrder.order_number}</h3>
                <p className="text-sm text-gray-500">
                  {selectedOrder.table_number ? `Table ${selectedOrder.table_number}` : selectedOrder.order_type} • {new Date(selectedOrder.created_at).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Status:</span>
                <span className={`px-2 py-1 text-xs rounded ${selectedOrder.status === 'ready' ? 'bg-green-100 text-green-700' :
                  selectedOrder.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                    selectedOrder.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      selectedOrder.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                  }`}>
                  {selectedOrder.status}
                </span>
              </div>

              {/* Order Items */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Order Items</h4>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  {selectedOrder.items && selectedOrder.items.length > 0 ? (
                    selectedOrder.items.map((item: OrderItem, i: number) => (
                      <div key={i} className="flex justify-between items-center py-1">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-500">Qty: {item.quantity} × KES {item.unit_price?.toLocaleString()}</p>
                        </div>
                        <p className="text-sm font-medium text-gray-900">KES {((item.quantity || 0) * (item.unit_price || 0)).toLocaleString()}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-2 text-sm">No items found</p>
                  )}
                </div>
              </div>

              {/* Order Total */}
              <div className="border-t border-gray-200 pt-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-900">Total:</span>
                  <span className="font-medium text-gray-900">KES {(selectedOrder.total || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3">
                <button
                  onClick={() => handleGenerateBill(selectedOrder)}
                  disabled={isGeneratingBill === selectedOrder.id}
                  className="flex-1 bg-gray-900 text-white px-3 py-2 rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                >
                  {isGeneratingBill === selectedOrder.id ? 'Generating...' : 'Generate Bill'}
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-3 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Status Filter */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">Order Status</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all', label: 'All', count: recentOrders.length },
                { value: 'pending', label: 'Pending', count: pendingCount },
                { value: 'completed', label: 'Verified', count: verifiedCount },
                { value: 'cancelled', label: 'Void', count: voidCount },
              ].map((status) => (
                <button
                  key={status.value}
                  onClick={() => setStatusFilter(status.value)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                    statusFilter === status.value
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {status.label} ({status.count})
                </button>
              ))}
            </div>
          </div>

          {/* Waiter Filter */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">View Orders</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'my-orders', label: 'My Orders' },
                { value: 'all-orders', label: 'All Orders' },
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setWaiterFilter(filter.value)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                    waiterFilter === filter.value
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Summary - Minimal Design */}
      <div className={`grid ${canSeeRevenue ? 'grid-cols-4' : 'grid-cols-3'} gap-3`}>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Total Orders</p>
          <p className="text-xl font-semibold text-gray-900">{recentOrders.length}</p>
        </div>
        {canSeeRevenue && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Revenue</p>
            <p className="text-xl font-semibold text-gray-900">KES {recentOrders.reduce((sum, o) => sum + (o.total || 0), 0).toLocaleString()}</p>
          </div>
        )}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Pending</p>
          <p className="text-xl font-semibold text-yellow-600">{pendingCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Verified</p>
          <p className="text-xl font-semibold text-green-600">{verifiedCount}</p>
        </div>
      </div>

      {/* Orders List - Minimal Design */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-base font-medium text-gray-900">
            {waiterFilter === 'my-orders' ? 'My Orders' : 'All Orders'}
            {statusFilter !== 'all' && ` - ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}`}
          </h2>
          <button
            onClick={fetchData}
            className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="text-sm text-gray-500">Loading orders...</div>
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No orders found matching your filters</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedOrder(order)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">#{order.order_number}</span>
                      <span className={`px-2 py-1 text-xs rounded ${
                        order.status === 'ready' || order.status === 'completed' || order.status === 'served' ? 'bg-green-100 text-green-700' :
                        order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-700'
                        }`}>
                        {order.status === 'cancelled' ? 'VOID' : order.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {order.table_number && `Table ${order.table_number} • `}
                      {order.items_count || order.items?.length || 0} items • {new Date(order.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">KES {(order.total || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">Click to view details</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
  };

  return (
    <ProtectedRoute allowedRoles={[
      UserRole.POS_KITCHEN,
      UserRole.RESTAURANT,
      UserRole.BARTENDER,
      UserRole.BARMAN,
      UserRole.BARMAID,
      UserRole.WAITER,
      UserRole.WAITRESS,
      UserRole.HEAD_WAITER,
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.BRANCH_MANAGER
    ]}>
      <DashboardLayout
        hideHeader={['restaurant', 'bar'].includes(activeTab)}
        hideSidebar={['restaurant', 'bar'].includes(activeTab)}
      >
        <div className={cn(
          "flex flex-col h-full",
          !['restaurant', 'bar'].includes(activeTab) && "space-y-6"
        )}>
          {/* Header - Only for Overview and Activity */}
          {!['restaurant', 'bar'].includes(activeTab) && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-shrink-0">
              <div>
                <h1 className="text-[22px] sm:text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">POS System</h1>
                <p className="text-gray-500 text-sm mt-0.5">Unified Restaurant & Bar Point of Sale</p>
              </div>
            </div>
          )}

          {/* Tab Navigation - Hidden for POS modes */}
          {!['restaurant', 'bar'].includes(activeTab) && (
            <div className="flex flex-wrap items-center justify-between gap-4 p-1 flex-shrink-0">
              <div className="flex gap-1 p-1 bg-stone-100 rounded-xl overflow-x-auto no-scrollbar border border-stone-200">
                {[
                  { id: 'overview', label: 'Overview', icon: UtensilsCrossed, color: 'text-amber-600' },
                  { id: 'restaurant', label: 'Restaurant POS', icon: ChefHat, color: 'text-orange-600' },
                  { id: 'bar', label: 'Bar POS', icon: Wine, color: 'text-indigo-600' },
                  { id: 'active', label: 'Active Orders', icon: Timer, color: 'text-blue-600' },
                  { id: 'recent', label: 'Activity', icon: Clock, color: 'text-emerald-600' },
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                        isActive
                          ? "bg-white text-stone-900 shadow-sm border border-stone-100"
                          : "text-stone-500 hover:text-stone-700 hover:bg-stone-50/50"
                      )}
                    >
                      <tab.icon className={cn("h-3.5 w-3.5", isActive ? tab.color : "text-stone-400")} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                {userBranches.length > 1 && (
                  <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1">
                    <Building2 className="h-3 w-3 text-stone-400" />
                    <select
                      value={activeBranchId || ''}
                      onChange={(e) => setActiveBranch(Number(e.target.value))}
                      className="bg-transparent border-none text-[11px] font-bold focus:ring-0 p-1"
                    >
                      {userBranches.map((branch) => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  onClick={fetchData}
                  className="p-2 text-stone-400 hover:text-stone-900 transition-colors bg-stone-50 border border-stone-200 rounded-lg"
                  disabled={isLoading}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
                </button>
              </div>
            </div>
          )}

          {/* Tab Content */}
          <div className={cn(
            "flex-1 min-h-0 overflow-hidden",
            !['restaurant', 'bar'].includes(activeTab) && "overflow-y-auto custom-scrollbar pb-6 mt-2"
          )}>
            {activeTab === 'overview' && <div className="max-w-[1200px] mx-auto">{renderOverview()}</div>}
            {activeTab === 'restaurant' && <UnifiedPOS mode="restaurant" onOrderCreated={fetchData} />}
            {activeTab === 'bar' && <UnifiedPOS mode="bar" onOrderCreated={fetchData} />}
            {activeTab === 'active' && <div className="max-w-[1200px] mx-auto">{renderActiveOrders()}</div>}
            {activeTab === 'recent' && <div className="max-w-[1200px] mx-auto">{renderRecentOrders()}</div>}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
