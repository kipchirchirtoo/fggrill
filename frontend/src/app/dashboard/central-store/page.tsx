'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { storeAPI } from '@/lib/api';
import {
  Package, Truck, ClipboardList, RefreshCw, AlertTriangle,
  Building2, Apple, Beer, Box, Navigation, ChevronRight, BarChart3
} from 'lucide-react';
import Link from 'next/link';

export default function CentralStoreDashboard() {
  const [stats, setStats] = useState({ totalItems: 0, lowStock: 0, inTransit: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const dashboardRes = await storeAPI.getCentralDashboard();
      if (dashboardRes.success) {
        const data = dashboardRes.data || {};
        const stats = data.stats || {};

        // Handle potentially nested stats or direct values
        // lowStockItems comes as an array from the specific controller endpoint
        const lowStockCount = Array.isArray(data.lowStockItems)
          ? data.lowStockItems.length
          : (data.lowStockItems || stats.lowStock || 0);

        setStats({
          totalItems: stats.totalItems || data.totalItems || 0,
          lowStock: typeof lowStockCount === 'number' ? lowStockCount : 0,
          inTransit: stats.inTransit || data.inTransit || 0,
        });
      }
    } catch (error) { console.error('Error fetching dashboard stats:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sections = [
    {
      title: "Inventory Control",
      links: [
        { href: '/dashboard/central-store/inventory', icon: Package, label: 'Master Catalog', desc: 'Global inventory' },
        { href: '/dashboard/central-store/foodstuffs', icon: Apple, label: 'Foodstuffs', desc: 'Kitchen & Dry store' },
        { href: '/dashboard/central-store/bar-items', icon: Beer, label: 'Bar Store', desc: 'Beverages & Liquor' },
      ]
    },
    {
      title: "Logistics Hub",
      links: [
        { href: '/dashboard/central-store/requests', icon: ClipboardList, label: 'Requisitions', desc: 'Monitor requests' },
        { href: '/dashboard/central-store/packing', icon: Box, label: 'Packing Station', desc: 'Order fulfillment' },
        { href: '/dashboard/central-store/dispatch', icon: Truck, label: 'Dispatch', desc: 'Transit tracking' },
        { href: '/dashboard/central-store/vehicles', icon: Navigation, label: 'Fleet Management', desc: 'Vehicles & drivers' },
      ]
    }
  ];

  const statCards = [
    { label: 'Master Items', value: stats.totalItems, icon: Package },
    { label: 'Low Stock', value: stats.lowStock, icon: AlertTriangle },
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
              <p className="text-stone-500 mt-0.5">Inventory and logistics distribution center</p>
            </div>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="btn-secondary self-start sm:self-auto"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Stats Grid - Using standardized stat-card class */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {statCards.map((stat, i) => (
              <div key={i} className="stat-card">
                <div className="stat-icon">
                  <stat.icon className="h-5 w-5" />
                </div>
                <p className="stat-value text-[22px]">{stat.value}</p>
                <p className="stat-label text-[12px] mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Navigation Sections */}
          {sections.map((section, idx) => (
            <div key={idx} className="card-elevated p-5">
              <div className="section-header mb-4">
                <h2 className="section-title text-[14px] uppercase tracking-wider text-stone-400 font-bold">{section.title}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {section.links.map((link) => (
                  <Link key={link.href} href={link.href}>
                    <div className="action-card group flex items-center gap-3 text-left py-4 px-4 bg-white hover:bg-stone-50 transition-colors border border-stone-100 rounded-lg">
                      <div className="action-card-icon w-10 h-10 bg-stone-100 group-hover:bg-stone-200 flex items-center justify-center rounded-lg shrink-0 transition-colors">
                        <link.icon className="h-4 w-4 text-stone-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-stone-800 text-[14px] truncate">{link.label}</p>
                        <p className="text-[11px] text-stone-400 truncate">{link.desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-400 shrink-0 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          {/* Bottom Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/dashboard/central-store/suppliers">
              <div className="flex items-center justify-between p-4 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg transition-colors group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-stone-200/50 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-stone-600" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-stone-800">Suppliers & Vendors</p>
                    <p className="text-[11px] text-stone-500">Manage partners</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-400 transition-colors" />
              </div>
            </Link>

            <Link href="/dashboard/central-store/reports">
              <div className="flex items-center justify-between p-4 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg transition-colors group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-stone-200/50 flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-stone-600" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-stone-800">Central Reports</p>
                    <p className="text-[11px] text-stone-500">Analytics & PDFs</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-400 transition-colors" />
              </div>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
