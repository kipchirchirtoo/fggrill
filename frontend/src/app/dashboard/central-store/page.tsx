'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { storeAPI } from '@/lib/api';
import { 
  Package, Truck, ClipboardList, RefreshCw, AlertTriangle,
  FileText, Building2
} from 'lucide-react';
import Link from 'next/link';

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
    { href: '/dashboard/central-store/inventory', icon: Package, label: 'Inventory', desc: 'All items' },
    { href: '/dashboard/central-store/requests', icon: ClipboardList, label: 'Requests', desc: 'Branch requests' },
    { href: '/dashboard/central-store/dispatch', icon: Truck, label: 'Dispatch', desc: 'Send stock' },
    { href: '/dashboard/central-store/suppliers', icon: Building2, label: 'Suppliers', desc: 'Manage vendors' },
    { href: '/dashboard/central-store/stock-takes', icon: ClipboardList, label: 'Stock Takes', desc: 'Audits' },
    { href: '/dashboard/central-store/reports', icon: FileText, label: 'Reports', desc: 'Analytics' },
  ];

  const statCards = [
    { label: 'Total Items', value: stats.totalItems, icon: Package },
    { label: 'Low Stock', value: stats.lowStock, icon: AlertTriangle },
    { label: 'Pending Requests', value: stats.pendingRequests, icon: ClipboardList },
    { label: 'In Transit', value: stats.inTransit, icon: Truck },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Central Store</h1>
              <p className="text-stone-500 mt-0.5">Manage inventory and distribution</p>
            </div>
            <button onClick={fetchData} disabled={isLoading} className="btn-secondary self-start sm:self-auto">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statCards.map((stat, i) => (
              <div key={i} className="stat-card">
                <div className="stat-icon">
                  <stat.icon className="h-5 w-5" />
                </div>
                <p className="stat-value">{stat.value}</p>
                <p className="stat-label">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Quick Access */}
          <div className="card-elevated p-5">
            <div className="section-header mb-4">
              <h2 className="section-title">Quick Access</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <div className="action-card group">
                    <div className="action-card-icon">
                      <link.icon className="h-5 w-5" />
                    </div>
                    <p className="action-card-label">{link.label}</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">{link.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
