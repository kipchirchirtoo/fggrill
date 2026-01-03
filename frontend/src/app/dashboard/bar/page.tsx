'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { IOSBadge } from '@/components/ui/ios-badge';
import { barAPI } from '@/lib/api';
import {
  Wine, ShoppingCart, DollarSign, Clock, GlassWater,
  Plus, ArrowRight, CreditCard, RefreshCw, TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Order {
  id: string;
  order_number?: string;
  seat_number?: string;
  guest_name?: string;
  status: string;
  total: number;
  items?: any[];
  created_at: string;
}

export default function BarDashboard() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState({ todayOrders: 0, todayRevenue: 0, openTabs: 0, avgOrder: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const ordersRes = await barAPI.getOrders(activeBranchId || undefined);
      if (ordersRes.success) {
        const allOrders = ordersRes.data || [];
        setOrders(allOrders.slice(0, 8));
        const total = allOrders.reduce((sum: number, o: Order) => sum + (o.total || 0), 0);
        setStats({
          todayOrders: allOrders.length,
          todayRevenue: total,
          openTabs: allOrders.filter((o: Order) => o.status === 'pending').length,
          avgOrder: allOrders.length > 0 ? Math.round(total / allOrders.length) : 0,
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const canSeeRevenue = [
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.ACCOUNTANT
  ].includes(user?.role as UserRole);

  const statCards = [
    { label: 'Orders', value: stats.todayOrders, icon: ShoppingCart, show: true },
    { label: 'Revenue', value: `KES ${stats.todayRevenue.toLocaleString()}`, icon: DollarSign, show: canSeeRevenue },
    { label: 'Open Tabs', value: stats.openTabs, icon: CreditCard, show: true },
    { label: 'Avg Order', value: `KES ${stats.avgOrder.toLocaleString()}`, icon: TrendingUp, show: canSeeRevenue },
  ].filter(s => s.show);

  return (
    <ProtectedRoute allowedRoles={[UserRole.BARTENDER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Bar Dashboard</h1>
              <p className="text-stone-500 mt-0.5">Manage bar orders and tabs</p>
            </div>
            <div className="flex gap-2">
              <button onClick={fetchData} disabled={isLoading} className="btn-secondary">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <Link href="/dashboard/bar/pos">
                <button className="btn-primary">
                  <Plus className="h-4 w-4" />
                  <span>New Order</span>
                </button>
              </Link>
            </div>
          </div>

          {/* Stats Grid */}
          <div className={`grid grid-cols-2 ${canSeeRevenue ? 'md:grid-cols-4' : 'md:grid-cols-2'} gap-3`}>
            {statCards.map((stat, i) => (
              <div key={i} className="stat-card">
                <div className="stat-icon">
                  <stat.icon className="h-5 w-5" />
                </div>
                <p className="stat-value text-[20px]">{stat.value}</p>
                <p className="stat-label">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-5">
            {/* Recent Orders */}
            <div className="card-elevated p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-semibold text-stone-900">Recent Orders</h2>
                <Link href="/dashboard/bar/orders">
                  <button className="text-[13px] font-medium text-stone-600 hover:text-stone-900">View All</button>
                </Link>
              </div>
              {isLoading ? (
                <div className="flex justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-stone-400" /></div>
              ) : orders.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Wine className="h-6 w-6 text-stone-400" /></div>
                  <p className="empty-state-title">No orders yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
                  {orders.map((order) => (
                    <div key={order.id} className="p-3 bg-stone-50 rounded-lg flex items-center justify-between hover:bg-stone-100 transition-colors">
                      <div>
                        <p className="text-[13px] font-medium text-stone-800">#{order.order_number}</p>
                        <p className="text-[11px] text-stone-500">{order.items?.length || 0} items • KES {order.total?.toLocaleString()}</p>
                      </div>
                      <span className={`text-[11px] font-medium px-2 py-1 rounded-full ${order.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {order.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="card-elevated p-5">
              <h2 className="text-[15px] font-semibold text-stone-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { href: '/dashboard/bar/pos', icon: ShoppingCart, label: 'POS', desc: 'Take orders' },
                  { href: '/dashboard/bar/tabs', icon: CreditCard, label: 'Tabs', desc: 'Open tabs' },
                  { href: '/dashboard/bar/orders', icon: GlassWater, label: 'Orders', desc: 'View orders' },
                  { href: '/dashboard/bar/inventory', icon: Wine, label: 'Stock', desc: 'Inventory' },
                ].map((item) => (
                  <Link key={item.href} href={item.href}>
                    <div className="action-card group">
                      <div className="action-card-icon">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <p className="action-card-label">{item.label}</p>
                      <p className="text-[11px] text-stone-400 mt-0.5">{item.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
