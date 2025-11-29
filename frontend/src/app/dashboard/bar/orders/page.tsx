'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Wine, Clock, CheckCircle, RefreshCw, Eye, Printer, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { barAPI } from '@/lib/api';

const statusConfig: Record<string, { label: string; color: string; icon: any; next?: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock, next: 'preparing' },
  preparing: { label: 'Preparing', color: 'bg-blue-100 text-blue-800', icon: Wine, next: 'ready' },
  ready: { label: 'Ready', color: 'bg-green-100 text-green-800', icon: CheckCircle, next: 'completed' },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-800', icon: CheckCircle },
};

export default function BarOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  useEffect(() => {
    barAPI.getOrders().then(res => {
      const list = res.orders || res.data || [];
      setOrders(Array.isArray(list) ? list : []);
    }).catch(() => setOrders([]));
  }, []);

  const filteredOrders = orders.filter(order => {
    const matchesFilter = filter === 'all' || order.status === filter;
    const matchesSearch = order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.tab_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const updateStatus = async (orderId: string, newStatus: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    toast.success(`Order updated to ${statusConfig[newStatus]?.label}`);
  };

  const getTimeSince = (date: string) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    return mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
  };

  const stats = {
    pending: orders.filter(o => o.status === 'pending').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready: orders.filter(o => o.status === 'ready').length,
    completed: orders.filter(o => o.status === 'completed').length,
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BARTENDER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Wine className="h-8 w-8 text-purple-600" />
                Bar Orders
              </h1>
              <p className="text-gray-600 mt-1">Track and manage bar orders</p>
            </div>
            <button onClick={() => window.location.reload()} className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats).map(([status, count]) => {
              const config = statusConfig[status];
              const Icon = config.icon;
              return (
                <div key={status} onClick={() => setFilter(status)} className={`p-4 rounded-xl border cursor-pointer transition-all ${filter === status ? 'ring-2 ring-purple-500' : ''} ${config.color}`}>
                  <div className="flex items-center justify-between">
                    <Icon className="h-6 w-6" />
                    <span className="text-3xl font-bold">{count}</span>
                  </div>
                  <div className="text-sm mt-2">{config.label}</div>
                </div>
              );
            })}
          </div>

          {/* Search & Filter */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input type="text" placeholder="Search orders..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg" />
            </div>
            <div className="flex gap-2">
              {['all', 'pending', 'preparing', 'ready', 'completed'].map(s => (
                <button key={s} onClick={() => setFilter(s)} className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === s ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                  {s === 'all' ? 'All' : statusConfig[s]?.label}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map(order => {
              const config = statusConfig[order.status];
              const Icon = config.icon;
              return (
                <div key={order.id} className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-bold">{order.order_number}</div>
                      <div className="text-sm text-gray-500">
                        {order.type === 'bar' && (order.seat_number ? `Seat ${order.seat_number}` : 'Bar Counter')}
                        {order.type === 'tab' && `Tab: ${order.tab_name}`}
                        {order.type === 'room-service' && `Room ${order.room_number}`}
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${config.color}`}>
                      <Icon className="h-3 w-3" /> {config.label}
                    </span>
                  </div>

                  <div className="border-t border-b py-3 my-3 space-y-1">
                    {order.items.slice(0, 3).map((item: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{item.quantity}x {item.name}</span>
                        <span className="text-gray-500">KES {(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                    {order.items.length > 3 && <div className="text-xs text-gray-400">+{order.items.length - 3} more</div>}
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-bold text-purple-600">KES {order.total.toLocaleString()}</div>
                      <div className="text-xs text-gray-400">{getTimeSince(order.created_at)}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setSelectedOrder(order)} className="p-2 hover:bg-gray-100 rounded-lg"><Eye className="h-4 w-4" /></button>
                      {config.next && (
                        <button onClick={() => updateStatus(order.id, config.next!)} className="px-3 py-1 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
                          {config.next === 'preparing' ? 'Start' : config.next === 'ready' ? 'Ready' : 'Complete'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-12 text-gray-500"><Wine className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No orders found</p></div>
          )}
        </div>

        {/* Order Detail Modal */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedOrder(null)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between mb-4">
                <h2 className="text-xl font-bold">{selectedOrder.order_number}</h2>
                <button onClick={() => setSelectedOrder(null)}><X className="h-5 w-5" /></button>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Status</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig[selectedOrder.status].color}`}>
                    {statusConfig[selectedOrder.status].label}
                  </span>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Items</div>
                  <div className="border rounded-lg divide-y">
                    {selectedOrder.items.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between p-3">
                        <span>{item.quantity}x {item.name}</span>
                        <span className="font-medium">KES {(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="text-lg font-bold">Total</span>
                  <span className="text-xl font-bold text-purple-600">KES {selectedOrder.total.toLocaleString()}</span>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => window.print()} className="flex-1 py-2 border rounded-lg flex items-center justify-center gap-2"><Printer className="h-4 w-4" /> Print</button>
                  {statusConfig[selectedOrder.status].next && (
                    <button onClick={() => { updateStatus(selectedOrder.id, statusConfig[selectedOrder.status].next!); setSelectedOrder(null); }} className="flex-1 py-2 bg-purple-600 text-white rounded-lg">
                      Mark {statusConfig[selectedOrder.status].next === 'preparing' ? 'Preparing' : statusConfig[selectedOrder.status].next === 'ready' ? 'Ready' : 'Complete'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
