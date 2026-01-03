'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { barAPI } from '@/lib/api';
import { useBranch } from '@/lib/branch-context';
import { ShoppingCart, RefreshCw, Search, Eye, Clock, Wine } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Order {
  id: string;
  order_number?: string;
  seat_number?: string;
  room_number?: string;
  guest_name?: string;
  order_type: string;
  status: string;
  total: number;
  subtotal: number;
  items?: any[];
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  preparing: { label: 'Preparing', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  ready: { label: 'Ready', color: 'text-green-700', bgColor: 'bg-green-100' },
  served: { label: 'Served', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  completed: { label: 'Completed', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  cancelled: { label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-100' },
};

export default function BarOrdersPage() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await barAPI.getOrders(activeBranchId || undefined, statusFilter !== 'all' ? statusFilter : undefined);
      if (response.success) setOrders(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [statusFilter, activeBranchId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const filteredOrders = orders.filter((order) =>
    order.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.seat_number?.includes(searchQuery) ||
    order.guest_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUpdateStatus = async (orderId: string, status: string) => {
    try {
      await barAPI.updateOrderStatus(orderId, status);
      toast.success(`Order ${status}`);
      fetchOrders();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BARTENDER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Bar Orders</h1><p className="text-gray-500">View and manage orders</p></div>
            <IOSButton variant="secondary" onClick={fetchOrders} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <Input placeholder="Search orders..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {['all', 'pending', 'preparing', 'ready', 'completed'].map((status) => (
                  <IOSButton key={status} variant={statusFilter === status ? 'primary' : 'secondary'} size="sm" onClick={() => setStatusFilter(status)}>
                    {status === 'all' ? 'All' : statusConfig[status]?.label || status}
                  </IOSButton>
                ))}
              </div>
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredOrders.length === 0 ? (
            <IOSCard className="p-12 text-center"><Wine className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No orders found</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const statusInfo = statusConfig[order.status] || statusConfig.pending;
                return (
                  <IOSCard key={order.id} className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-ios-lg bg-purple-100 flex items-center justify-center"><Wine className="h-6 w-6 text-purple-600" /></div>
                        <div>
                          <p className="font-bold">#{order.order_number}</p>
                          <p className="text-sm text-gray-500">{order.seat_number ? `Seat ${order.seat_number}` : order.guest_name || 'Bar'} • {order.items?.length || 0} items</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold">KES {order.total?.toLocaleString()}</p>
                          <p className="text-sm text-gray-500">{new Date(order.created_at).toLocaleTimeString()}</p>
                        </div>
                        <IOSBadge className={`${statusInfo.bgColor} ${statusInfo.color}`}>{statusInfo.label}</IOSBadge>
                        {/* Status buttons removed as per request - drinks are already made */}
                      </div>
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
