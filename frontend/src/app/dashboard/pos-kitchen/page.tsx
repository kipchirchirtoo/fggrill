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
  UtensilsCrossed, ShoppingCart, DollarSign, Clock, TrendingUp,
  RefreshCw, ArrowRight, Building2, FileText, X
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { POSTab } from './pos-tab';

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

  // Get active tab from URL params
  const activeTab = searchParams.get('tab') || 'overview';

  // Function to handle tab changes with URL updates
  const handleTabChange = (tabId: string) => {
    if (tabId === 'overview') {
      router.push('/dashboard/pos-kitchen');
    } else {
      router.push(`/dashboard/pos-kitchen?tab=${tabId}`);
    }
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentBranchId = activeBranchId || user?.branch_id;
      const [ordersResult, salesResult, todayOrdersResult] = await Promise.allSettled([
        restaurantAPI.getOrders(currentBranchId || undefined),
        restaurantAPI.getDailySales(currentBranchId || undefined),
        restaurantAPI.getTodayOrders(currentBranchId || undefined),
      ]);

      const ordersRes = ordersResult.status === 'fulfilled' ? ordersResult.value : { success: false, data: [] };
      const salesRes = salesResult.status === 'fulfilled' ? salesResult.value : { success: false, data: { total: 0 } };
      const todayOrdersRes = todayOrdersResult.status === 'fulfilled' ? todayOrdersResult.value : { success: false, data: [] };

      const allOrders = ordersRes.success ? (ordersRes.data || []) : [];
      const todayOrdersData = todayOrdersRes.success ? (todayOrdersRes.data || []) : [];

      setOrders(allOrders.slice(0, 10));
      setRecentOrders(todayOrdersData.slice(0, 50));

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
  }, [activeBranchId, user?.branch_id]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

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

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `bill_${order.order_number}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(`Bill for Order #${order.order_number} generated!`);
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(errorText || 'Failed to generate bill');
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

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {[
          { label: 'Orders', value: stats.todayOrders, icon: ShoppingCart, show: true },
          { label: 'Revenue', value: `KES ${stats.todayRevenue.toLocaleString()}`, icon: DollarSign, show: canSeeRevenue },
          { label: 'Pending', value: stats.pendingOrders, icon: Clock, show: true },
          { label: 'Avg Order', value: `KES ${stats.avgOrderValue.toLocaleString()}`, icon: TrendingUp, show: canSeeRevenue },
        ].filter(s => s.show).map((stat, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon">
              <stat.icon className="h-5 w-5" />
            </div>
            <p className="stat-value text-[20px]">{stat.value}</p>
            <p className="stat-label">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <IOSCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold font-sf-pro-display">Recent Orders</h2>
          <IOSButton variant="ghost" size="sm" onClick={() => handleTabChange('pos')}>
            View POS <ArrowRight className="h-4 w-4 ml-1" />
          </IOSButton>
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
                  <div className="flex-1">
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
                    <IOSButton
                      size="sm"
                      onClick={() => handleGenerateBill(order)}
                      leftIcon={<FileText />}
                    >
                      Bill
                    </IOSButton>
                    <IOSBadge className={`${statusColor.bg} ${statusColor.text}`}>
                      {order.status}
                    </IOSBadge>
                  </div>
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
            onClick={() => handleTabChange('pos')}
          >
            <p className="text-sm font-medium text-gray-900">New Order</p>
            <p className="text-xs text-gray-500 mt-1">Take new orders</p>
          </button>
          <button
            className="bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-3 text-left transition-colors"
            onClick={() => handleTabChange('recent')}
          >
            <p className="text-sm font-medium text-gray-900">View Orders</p>
            <p className="text-xs text-gray-500 mt-1">Recent orders</p>
          </button>
          <Link href="/dashboard/branch-manager/menu">
            <div className="bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-3 text-left transition-colors cursor-pointer">
              <p className="text-sm font-medium text-gray-900">Menu Management</p>
              <p className="text-xs text-gray-500 mt-1">Manager access</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );

  const renderPOS = () => <POSTab onOrderCreated={fetchData} />;

  const renderRecentOrders = () => (
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

      {/* Stats Summary - Minimal Design */}
      <div className={`grid ${canSeeRevenue ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Orders</p>
          <p className="text-xl font-semibold text-gray-900">{recentOrders.length}</p>
        </div>
        {canSeeRevenue && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Revenue</p>
            <p className="text-xl font-semibold text-gray-900">KES {recentOrders.reduce((sum, o) => sum + (o.total || 0), 0).toLocaleString()}</p>
          </div>
        )}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Ready</p>
          <p className="text-xl font-semibold text-gray-900">{recentOrders.filter(o => ['ready', 'completed', 'served'].includes(o.status)).length}</p>
        </div>
      </div>

      {/* Orders List - Minimal Design */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-base font-medium text-gray-900">Today's Orders</h2>
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
            <p className="text-sm">No orders today</p>
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
                      <span className={`px-2 py-1 text-xs rounded ${order.status === 'ready' ? 'bg-green-100 text-green-700' :
                        order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                        }`}>
                        {order.status}
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

  return (
    <ProtectedRoute allowedRoles={[UserRole.POS_KITCHEN, UserRole.RESTAURANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className={`${activeTab === 'pos' ? 'flex flex-col h-[calc(100vh-140px)]' : 'space-y-6'}`}>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-shrink-0">
            <div>
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">POS System</h1>
              <p className="text-stone-500 mt-0.5">Point of sale operations</p>
            </div>
            <div className="flex items-center gap-3">
              {userBranches.length > 1 && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-stone-400" />
                  <select
                    value={activeBranchId || ''}
                    onChange={(e) => setActiveBranch(Number(e.target.value))}
                    className="px-3 py-2 text-[13px] bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400"
                  >
                    {userBranches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <button onClick={fetchData} className="btn-secondary">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 p-1 bg-stone-100 rounded-lg w-fit flex-shrink-0">
            {[
              { id: 'overview', label: 'Overview', icon: UtensilsCrossed },
              { id: 'pos', label: 'POS', icon: ShoppingCart },
              { id: 'recent', label: 'Recent Orders', icon: Clock },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium transition-all ${activeTab === tab.id
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
          <div className={activeTab === 'pos' ? 'flex-1 min-h-0 overflow-hidden' : ''}>
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'pos' && renderPOS()}
            {activeTab === 'recent' && renderRecentOrders()}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
