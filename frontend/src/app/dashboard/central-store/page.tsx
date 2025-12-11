'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { storeAPI } from '@/lib/api';
import { 
  Warehouse, Package, Truck, ClipboardList, RefreshCw, AlertTriangle,
  TrendingUp, Users, FileText, ShoppingCart, Building2
} from 'lucide-react';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

export default function CentralStoreDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalItems: 0, lowStock: 0, pendingRequests: 0, inTransit: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dashboardRes, requestsRes] = await Promise.allSettled([
        storeAPI.getCentralDashboard(),
        storeAPI.getPendingRequests(),
      ]);
      setStats({
        totalItems: dashboardRes.status === 'fulfilled' ? dashboardRes.value?.data?.totalItems || 0 : 0,
        lowStock: dashboardRes.status === 'fulfilled' ? dashboardRes.value?.data?.lowStockItems || 0 : 0,
        pendingRequests: requestsRes.status === 'fulfilled' ? requestsRes.value?.data?.length || 0 : 0,
        inTransit: dashboardRes.status === 'fulfilled' ? dashboardRes.value?.data?.inTransit || 0 : 0,
      });
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const quickLinks = [
    { href: '/dashboard/central-store/inventory', icon: Package, label: 'Inventory', desc: 'All items', color: 'bg-blue-50 text-[#007AFF]' },
    { href: '/dashboard/central-store/requests', icon: ClipboardList, label: 'Requests', desc: 'Branch requests', color: 'bg-yellow-50 text-yellow-600' },
    { href: '/dashboard/central-store/dispatch', icon: Truck, label: 'Dispatch', desc: 'Send stock', color: 'bg-green-50 text-[#34C759]' },
    { href: '/dashboard/central-store/suppliers', icon: Building2, label: 'Suppliers', desc: 'Manage vendors', color: 'bg-purple-50 text-purple-600' },
    { href: '/dashboard/central-store/stock-takes', icon: ClipboardList, label: 'Stock Takes', desc: 'Audits', color: 'bg-orange-50 text-orange-600' },
    { href: '/dashboard/central-store/reports', icon: FileText, label: 'Reports', desc: 'Analytics', color: 'bg-indigo-50 text-indigo-600' },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Warehouse className="h-7 w-7" /> Central Store</h1><p className="text-gray-500">Manage inventory and distribution</p></div>
            <IOSButton variant="secondary" onClick={fetchData} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4"><Package className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Total Items</p><p className="text-xl font-bold">{stats.totalItems}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-yellow-500"><AlertTriangle className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Low Stock</p><p className="text-xl font-bold text-yellow-600">{stats.lowStock}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-orange-500"><ClipboardList className="h-6 w-6 text-orange-600 mb-2" /><p className="text-sm text-gray-500">Pending Requests</p><p className="text-xl font-bold text-orange-600">{stats.pendingRequests}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-[#007AFF]"><Truck className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">In Transit</p><p className="text-xl font-bold text-[#007AFF]">{stats.inTransit}</p></IOSCard>
          </div>

          <IOSCard className="p-6">
            <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Quick Access</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <IOSCard className={`p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer text-center ${link.color.split(' ')[0]}`}>
                    <link.icon className={`h-8 w-8 mx-auto mb-2 ${link.color.split(' ')[1]}`} />
                    <p className="font-medium">{link.label}</p>
                    <p className="text-sm text-gray-500">{link.desc}</p>
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
