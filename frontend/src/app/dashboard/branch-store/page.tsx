'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { storeAPI } from '@/lib/api';
import {
  Package, Truck, ClipboardList, RefreshCw, AlertTriangle,
  TrendingDown, FileText, ShoppingCart, Utensils, ArrowDownToLine
} from 'lucide-react';
import Link from 'next/link';

export default function BranchStoreDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalItems: 0, lowStock: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dashboardRes] = await Promise.all([
        storeAPI.getBranchDashboard(),
      ]);
      setStats({
        totalItems: dashboardRes.data?.totalItems || 0,
        lowStock: dashboardRes.data?.lowStockItems || 0,
      });
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const quickLinks = [
    { href: '/dashboard/branch-store/stock', icon: Package, label: 'Stock', desc: 'Current inventory' },
    { href: '/dashboard/branch-store/receive', icon: ArrowDownToLine, label: 'Receive', desc: 'Confirm delivery' },
    { href: '/dashboard/branch-store/requests', icon: ShoppingCart, label: 'Requests', desc: 'Order from store' },
    { href: '/dashboard/branch-store/stock-takes', icon: ClipboardList, label: 'Stock Take', desc: 'Inventory audit' },
    { href: '/dashboard/branch-store/kitchen-usage', icon: Utensils, label: 'Kitchen', desc: 'Kitchen usage' },
    { href: '/dashboard/branch-store/stock-out', icon: TrendingDown, label: 'Stock Out', desc: 'Issue items' },
    { href: '/dashboard/branch-store/reports', icon: FileText, label: 'Reports', desc: 'Analytics' },
  ];

  const statCards = [
    { label: 'Total Items', value: stats.totalItems, icon: Package },
    { label: 'Low Stock', value: stats.lowStock, icon: AlertTriangle },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Branch Store</h1>
              <p className="text-stone-500 mt-0.5">{user?.branch_name || 'Your Branch'}</p>
            </div>
            <button onClick={fetchData} disabled={isLoading} className="btn-secondary self-start sm:self-auto">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
