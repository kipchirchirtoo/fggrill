'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { storeAPI } from '@/lib/api';
import { Package, Warehouse, Truck, ClipboardList, RefreshCw, AlertTriangle, Building2 } from 'lucide-react';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

export default function AdminStorekeepingPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalItems: 0, lowStock: 0, pendingRequests: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dashboardRes, requestsRes] = await Promise.all([
        storeAPI.getCentralDashboard(),
        storeAPI.getPendingRequests(),
      ]);
      setStats({
        totalItems: dashboardRes.data?.totalItems || 0,
        lowStock: dashboardRes.data?.lowStockCount || dashboardRes.data?.lowStockItems?.length || 0,
        pendingRequests: requestsRes.data?.length || 0,
      });
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const quickLinks = [
    { href: '/dashboard/admin/storekeeping/central', icon: Warehouse, label: 'Central Store', color: 'bg-blue-50 text-[#007AFF]' },
    { href: '/dashboard/admin/storekeeping/branch', icon: Building2, label: 'Branch Stores', color: 'bg-green-50 text-[#34C759]' },
    { href: '/dashboard/central-store/requests', icon: ClipboardList, label: 'Requests', color: 'bg-yellow-50 text-yellow-600' },
    { href: '/dashboard/admin/storekeeping/transfers', icon: Truck, label: 'Transfers', color: 'bg-purple-50 text-purple-600' },
    { href: '/dashboard/admin/storekeeping/stock-takes', icon: ClipboardList, label: 'Stock Takes', color: 'bg-orange-50 text-orange-600' },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Storekeeping</h1><p className="text-gray-500">Inventory management</p></div>
            <IOSButton variant="secondary" onClick={fetchData} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4"><Package className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Total Items</p><p className="text-xl font-bold">{stats.totalItems}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-yellow-500"><AlertTriangle className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Low Stock</p><p className="text-xl font-bold text-yellow-600">{stats.lowStock}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-orange-500"><ClipboardList className="h-6 w-6 text-orange-600 mb-2" /><p className="text-sm text-gray-500">Pending Requests</p><p className="text-xl font-bold text-orange-600">{stats.pendingRequests}</p></IOSCard>
          </div>

          <IOSCard className="p-6">
            <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Quick Access</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
