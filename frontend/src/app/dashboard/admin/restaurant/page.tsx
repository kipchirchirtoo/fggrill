'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { restaurantAPI } from '@/lib/api';
import { Utensils, ShoppingCart, DollarSign, RefreshCw, Menu, ChefHat, Settings } from 'lucide-react';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

export default function AdminRestaurantPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ orders: 0, revenue: 0, menuItems: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [ordersRes, menuRes, salesRes] = await Promise.all([
        restaurantAPI.getOrders(),
        restaurantAPI.getMenuItems(),
        restaurantAPI.getDailySales(),
      ]);
      setStats({
        orders: ordersRes.data?.length || 0,
        menuItems: menuRes.data?.length || 0,
        revenue: salesRes.data?.total || 0,
      });
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const quickLinks = [
    { href: '/dashboard/admin/restaurant/menu', icon: Menu, label: 'Menu', color: 'bg-blue-50 text-[#007AFF]' },
    { href: '/dashboard/pos-kitchen', icon: ShoppingCart, label: 'POS & Kitchen', color: 'bg-green-50 text-[#34C759]' },
    { href: '/dashboard/pos-kitchen', icon: ChefHat, label: 'Kitchen Display', color: 'bg-orange-50 text-orange-600' },
    { href: '/dashboard/admin/restaurant/pos-control', icon: Settings, label: 'POS Control', color: 'bg-purple-50 text-purple-600' },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Restaurant</h1><p className="text-gray-500">F&B management</p></div>
            <IOSButton variant="secondary" onClick={fetchData} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4"><ShoppingCart className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Orders Today</p><p className="text-xl font-bold">{stats.orders}</p></IOSCard>
            <IOSCard className="p-4"><Utensils className="h-6 w-6 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Menu Items</p><p className="text-xl font-bold">{stats.menuItems}</p></IOSCard>
            <IOSCard className="p-4"><DollarSign className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Revenue</p><p className="text-xl font-bold text-[#34C759]">KES {stats.revenue.toLocaleString()}</p></IOSCard>
          </div>

          <IOSCard className="p-6">
            <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Quick Access</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <IOSCard className={`p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer text-center ${link.color.split(' ')[0]}`}>
                    <link.icon className={`h-8 w-8 mx-auto mb-2 ${link.color.split(' ')[1]}`} />
                    <p className="font-medium">{link.label}</p>
                  </IOSCard>
                </Link>
              ))}
            </div>
          </IOSCard>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
