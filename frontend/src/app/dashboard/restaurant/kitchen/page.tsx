'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ChefHat, Clock, CheckCircle, Bell, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import { restaurantAPI } from '@/lib/api';

const mockOrders = [
  { id: '1', order_number: 'ORD-001', type: 'dine-in', table_number: '5', status: 'pending', items: [{ id: '1', name: 'Beef Burger', quantity: 2, ready: false }, { id: '2', name: 'Fresh Juice', quantity: 2, ready: false }], created_at: new Date(Date.now() - 300000).toISOString() },
  { id: '2', order_number: 'ORD-002', type: 'room-service', room_number: '204', status: 'preparing', items: [{ id: '3', name: 'Beef Steak', quantity: 1, ready: false }, { id: '4', name: 'Wine Glass', quantity: 2, ready: true }], created_at: new Date(Date.now() - 600000).toISOString() },
  { id: '3', order_number: 'ORD-003', type: 'dine-in', table_number: '3', status: 'preparing', items: [{ id: '5', name: 'Club Sandwich', quantity: 1, ready: true }, { id: '6', name: 'Tea/Coffee', quantity: 1, ready: false }], created_at: new Date(Date.now() - 900000).toISOString() },
];

export default function KitchenDisplayPage() {
  const [orders, setOrders] = useState(mockOrders);
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      restaurantAPI.getOrders(undefined, 'pending,preparing').then(res => {
        const list = res.orders || res.data || [];
        if (list.length > 0) setOrders(list);
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const getTimeSince = (date: string) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    return mins;
  };

  const getTimeColor = (mins: number) => {
    if (mins > 20) return 'text-red-600 bg-red-100';
    if (mins > 10) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const markItemReady = (orderId: string, itemId: string) => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        const updatedItems = order.items.map(item => item.id === itemId ? { ...item, ready: true } : item);
        const allReady = updatedItems.every(i => i.ready);
        return { ...order, items: updatedItems, status: allReady ? 'ready' : 'preparing' };
      }
      return order;
    }));
    if (soundEnabled) new Audio('/notification.mp3').play().catch(() => {});
    toast.success('Item marked ready');
  };

  const markOrderReady = (orderId: string) => {
    setOrders(prev => prev.map(order => 
      order.id === orderId ? { ...order, status: 'ready', items: order.items.map(i => ({ ...i, ready: true })) } : order
    ));
    toast.success('Order ready!');
    try { restaurantAPI.updateOrderStatus(orderId, 'ready').catch(() => {}); } catch {}
  };

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const preparingOrders = orders.filter(o => o.status === 'preparing');

  return (
    <ProtectedRoute allowedRoles={[UserRole.RESTAURANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChefHat className="h-8 w-8 text-indigo-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Kitchen Display</h1>
                <p className="text-gray-600">Real-time order queue</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSoundEnabled(!soundEnabled)} className={`p-3 rounded-lg ${soundEnabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </button>
              <button onClick={() => window.location.reload()} className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50">
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-yellow-100 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600" />
              <span className="font-bold text-yellow-800">{pendingOrders.length}</span>
              <span className="text-yellow-700">New Orders</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-lg">
              <ChefHat className="h-5 w-5 text-blue-600" />
              <span className="font-bold text-blue-800">{preparingOrders.length}</span>
              <span className="text-blue-700">Preparing</span>
            </div>
          </div>

          {/* Orders Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...pendingOrders, ...preparingOrders].map(order => {
              const mins = getTimeSince(order.created_at);
              const timeColor = getTimeColor(mins);
              const allReady = order.items.every(i => i.ready);
              
              return (
                <div key={order.id} className={`bg-white rounded-xl border-2 overflow-hidden ${order.status === 'pending' ? 'border-yellow-400' : 'border-blue-400'}`}>
                  {/* Header */}
                  <div className={`p-3 ${order.status === 'pending' ? 'bg-yellow-50' : 'bg-blue-50'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-lg">{order.order_number}</div>
                        <div className="text-sm text-gray-600">
                          {order.type === 'dine-in' && `Table ${order.table_number}`}
                          {order.type === 'room-service' && `Room ${order.room_number}`}
                          {order.type === 'takeaway' && 'Takeaway'}
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-bold ${timeColor}`}>
                        {mins}m
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="p-3 space-y-2">
                    {order.items.map((item: any) => (
                      <div key={item.id} className={`flex items-center justify-between p-2 rounded-lg ${item.ready ? 'bg-green-50 line-through text-gray-400' : 'bg-gray-50'}`}>
                        <span className="font-medium">{item.quantity}x {item.name}</span>
                        {!item.ready && (
                          <button onClick={() => markItemReady(order.id, item.id)} className="p-1 bg-green-500 text-white rounded hover:bg-green-600">
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="p-3 border-t">
                    <button 
                      onClick={() => markOrderReady(order.id)} 
                      disabled={!allReady && order.status === 'preparing'}
                      className={`w-full py-2 rounded-lg font-medium flex items-center justify-center gap-2 ${
                        allReady ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      <Bell className="h-4 w-4" />
                      {allReady ? 'Ready for Pickup' : order.status === 'pending' ? 'Start Preparing' : 'Mark All Ready'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {orders.filter(o => ['pending', 'preparing'].includes(o.status)).length === 0 && (
            <div className="text-center py-20 text-gray-400">
              <ChefHat className="h-16 w-16 mx-auto mb-4" />
              <p className="text-xl">No orders in queue</p>
              <p className="text-sm mt-2">New orders will appear here automatically</p>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
