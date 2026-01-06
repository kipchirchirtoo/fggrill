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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[22px] sm:text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Bar Orders</h1>
              <p className="text-stone-500 text-sm mt-0.5">View and manage orders</p>
            </div>
            <button
              onClick={fetchOrders}
              disabled={isLoading}
              className="btn-secondary h-[40px] px-4 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <IOSCard className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <Input placeholder="Search orders..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-[44px]" />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {['all', 'pending', 'preparing', 'ready', 'completed'].map((status) => (
                  <IOSButton
                    key={status}
                    variant={statusFilter === status ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                    className="whitespace-nowrap h-[36px]"
                  >
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
                  <IOSCard key={order.id} className="p-4 hover:border-stone-200 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                          <Wine className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-stone-900">#{order.order_number}</p>
                            <IOSBadge className={`${statusInfo.bgColor} ${statusInfo.color} text-[10px] h-5 sm:hidden`}>
                              {statusInfo.label}
                            </IOSBadge>
                          </div>
                          <p className="text-sm text-stone-500 truncate">
                            {order.seat_number ? `Seat ${order.seat_number}` : order.guest_name || 'Counter'} • {order.items?.length || 0} items
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-4 border-t sm:border-0 pt-3 sm:pt-0">
                        <div className="text-left sm:text-right">
                          <p className="font-bold text-stone-900">KES {order.total?.toLocaleString()}</p>
                          <div className="flex items-center gap-1.5 text-xs text-stone-400 mt-0.5">
                            <Clock className="h-3 w-3" />
                            <span>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                        <IOSBadge className={`${statusInfo.bgColor} ${statusInfo.color} hidden sm:flex`}>
                          {statusInfo.label}
                        </IOSBadge>
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
