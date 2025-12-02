'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { storeAPI } from '@/lib/api';
import { 
  Package, Truck, ClipboardList, RefreshCw, AlertTriangle,
  TrendingDown, FileText, ShoppingCart, Utensils
} from 'lucide-react';
import Link from 'next/link';

export default function BranchStoreDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalItems: 0, lowStock: 0, pendingRequests: 0, incoming: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dashboardRes, requestsRes, incomingRes] = await Promise.all([
        storeAPI.getBranchDashboard(),
        storeAPI.getBranchRequests(),
        storeAPI.getIncomingDispatches(),
      ]);
      setStats({
        totalItems: dashboardRes.data?.totalItems || 0,
        lowStock: dashboardRes.data?.lowStockItems || 0,
        pendingRequests: (requestsRes.data || []).filter((r: any) => r.status === 'pending').length,
        incoming: (incomingRes.data || []).length,
      });
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const quickLinks = [
    { href: '/dashboard/branch-store/stock', icon: Package, label: 'Stock', desc: 'Current inventory', color: 'bg-blue-50 text-blue-600' },
    { href: '/dashboard/branch-store/requests', icon: ShoppingCart, label: 'Requests', desc: 'Stock requests', color: 'bg-yellow-50 text-yellow-600' },
    { href: '/dashboard/branch-store/incoming', icon: Truck, label: 'Incoming', desc: 'Receive stock', color: 'bg-green-50 text-green-600' },
    { href: '/dashboard/branch-store/stock-out', icon: TrendingDown, label: 'Stock Out', desc: 'Issue items', color: 'bg-red-50 text-red-600' },
    { href: '/dashboard/branch-store/kitchen-usage', icon: Utensils, label: 'Kitchen', desc: 'Kitchen usage', color: 'bg-orange-50 text-orange-600' },
    { href: '/dashboard/branch-store/reports', icon: FileText, label: 'Reports', desc: 'Analytics', color: 'bg-purple-50 text-purple-600' },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Package className="h-7 w-7" /> Branch Store</h1><p className="text-gray-500">{user?.branch_name || 'Your Branch'}</p></div>
            <IOSButton variant="secondary" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4"><Package className="h-6 w-6 text-blue-600 mb-2" /><p className="text-sm text-gray-500">Total Items</p><p className="text-xl font-bold">{stats.totalItems}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-yellow-500"><AlertTriangle className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Low Stock</p><p className="text-xl font-bold text-yellow-600">{stats.lowStock}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-orange-500"><ClipboardList className="h-6 w-6 text-orange-600 mb-2" /><p className="text-sm text-gray-500">Pending Requests</p><p className="text-xl font-bold text-orange-600">{stats.pendingRequests}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-green-500"><Truck className="h-6 w-6 text-green-600 mb-2" /><p className="text-sm text-gray-500">Incoming</p><p className="text-xl font-bold text-green-600">{stats.incoming}</p></IOSCard>
          </div>

          <IOSCard className="p-6">
            <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Quick Access</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <IOSCard className={`p-4 hover:shadow-lg transition cursor-pointer text-center ${link.color.split(' ')[0]}`}>
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
