'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { restaurantAPI } from '@/lib/api';
import { 
  ShoppingCart, RefreshCw, Search, Filter, Eye, Clock, DollarSign,
  UtensilsCrossed, User, MapPin, Phone, Printer, Check, X
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
}

interface Order {
  id: string;
  order_number: string;
  table_number?: string;
  order_type: 'dine_in' | 'takeaway' | 'room_service';
  status: string;
  total: number;
  subtotal: number;
  tax: number;
  items: OrderItem[];
  customer_name?: string;
  customer_phone?: string;
  room_number?: string;
  payment_status: string;
  payment_method?: string;
  created_at: string;
  completed_at?: string;
  notes?: string;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  preparing: { label: 'Preparing', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  ready: { label: 'Ready', color: 'text-green-700', bgColor: 'bg-green-100' },
  served: { label: 'Served', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  completed: { label: 'Completed', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  cancelled: { label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-100' },
};

export default function RestaurantOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await restaurantAPI.getOrders(undefined, statusFilter !== 'all' ? statusFilter : undefined);
      if (response.success) {
        setOrders(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = 
      order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.table_number?.includes(searchQuery);
    return matchesSearch;
  });

  const handleUpdateStatus = async (orderId: string, status: string) => {
    try {
      await restaurantAPI.updateOrderStatus(orderId, status);
      toast.success(`Order updated to ${status}`);
      fetchOrders();
      setDetailsModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update order');
    }
  };

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    completed: orders.filter(o => o.status === 'completed').length,
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.RESTAURANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
              <p className="text-gray-500">View and manage restaurant orders</p>
            </div>
            <IOSButton variant="secondary" onClick={fetchOrders}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </IOSButton>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Total Orders</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </IOSCard>
            <IOSCard className="p-4 border-l-4 border-yellow-500">
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </IOSCard>
            <IOSCard className="p-4 border-l-4 border-[#007AFF]">
              <p className="text-sm text-gray-500">Preparing</p>
              <p className="text-2xl font-bold text-[#007AFF]">{stats.preparing}</p>
            </IOSCard>
            <IOSCard className="p-4 border-l-4 border-green-500">
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-2xl font-bold text-[#34C759]">{stats.completed}</p>
            </IOSCard>
          </div>

          {/* Filters */}
          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {['all', 'pending', 'preparing', 'ready', 'completed'].map((status) => (
                  <IOSButton
                    key={status}
                    variant={statusFilter === status ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                  >
                    {status === 'all' ? 'All' : statusConfig[status]?.label || status}
                  </IOSButton>
                ))}
              </div>
            </div>
          </IOSCard>

          {/* Orders List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredOrders.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <ShoppingCart className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No orders found</p>
            </IOSCard>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const statusInfo = statusConfig[order.status] || statusConfig.pending;

                return (
                  <IOSCard key={order.id} className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-ios-lg bg-blue-100 flex items-center justify-center">
                          <UtensilsCrossed className="h-6 w-6 text-[#007AFF]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold">#{order.order_number}</p>
                            <IOSBadge className={`${statusInfo.bgColor} ${statusInfo.color}`}>
                              {statusInfo.label}
                            </IOSBadge>
                          </div>
                          <p className="text-sm text-gray-500">
                            {order.order_type === 'dine_in' && order.table_number && `Table ${order.table_number}`}
                            {order.order_type === 'room_service' && order.room_number && `Room ${order.room_number}`}
                            {order.order_type === 'takeaway' && 'Takeaway'}
                            {' • '}{(order.items?.length || 0)} items
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold">KES {order.total?.toLocaleString()}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(order.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                        <IOSButton
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelectedOrder(order);
                            setDetailsModalOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </IOSButton>
                      </div>
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>

        {/* Order Details Modal */}
        <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Order #{selectedOrder?.order_number}</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4 mt-4">
                <div className="flex justify-between items-center">
                  <IOSBadge className={`${statusConfig[selectedOrder.status]?.bgColor} ${statusConfig[selectedOrder.status]?.color}`}>
                    {statusConfig[selectedOrder.status]?.label}
                  </IOSBadge>
                  <p className="text-sm text-gray-500">
                    {new Date(selectedOrder.created_at).toLocaleString()}
                  </p>
                </div>

                {/* Order Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-ios-lg">
                    <p className="text-xs text-gray-500">Type</p>
                    <p className="font-medium capitalize">{selectedOrder.order_type?.replace('_', ' ')}</p>
                  </div>
                  {selectedOrder.table_number && (
                    <div className="p-3 bg-gray-50 rounded-ios-lg">
                      <p className="text-xs text-gray-500">Table</p>
                      <p className="font-medium">{selectedOrder.table_number}</p>
                    </div>
                  )}
                  {selectedOrder.customer_name && (
                    <div className="p-3 bg-gray-50 rounded-ios-lg">
                      <p className="text-xs text-gray-500">Customer</p>
                      <p className="font-medium">{selectedOrder.customer_name}</p>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div>
                  <p className="font-medium mb-2">Items</p>
                  <div className="space-y-2">
                    {(selectedOrder.items || []).map((item, i) => (
                      <div key={i} className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>{item.quantity}x {item.name}</span>
                        <span className="font-medium">KES {(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total */}
                <div className="border-t pt-3 space-y-1">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>KES {selectedOrder.subtotal?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span>KES {selectedOrder.tax?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>KES {selectedOrder.total?.toLocaleString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  {selectedOrder.status === 'pending' && (
                    <IOSButton className="flex-1" onClick={() => handleUpdateStatus(selectedOrder.id, 'preparing')}>
                      Start Preparing
                    </IOSButton>
                  )}
                  {selectedOrder.status === 'preparing' && (
                    <IOSButton className="flex-1" onClick={() => handleUpdateStatus(selectedOrder.id, 'ready')}>
                      Mark Ready
                    </IOSButton>
                  )}
                  {selectedOrder.status === 'ready' && (
                    <IOSButton className="flex-1" onClick={() => handleUpdateStatus(selectedOrder.id, 'served')}>
                      Mark Served
                    </IOSButton>
                  )}
                  <IOSButton variant="secondary">
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </IOSButton>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
