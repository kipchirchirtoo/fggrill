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
import { useRouter } from 'next/navigation';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { KeyboardShortcutOverlay } from '@/components/KeyboardShortcutOverlay';
import { useKeyboardShortcutOverlay } from '@/hooks/useKeyboardShortcut';
import { ShortcutBadge } from '@/components/ui/ShortcutBadge';

export default function BranchStoreDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ totalItems: 0, lowStock: 0, pendingRequests: 0, incomingDispatches: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const shortcutOverlay = useKeyboardShortcutOverlay();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dashboardRes] = await Promise.all([
        storeAPI.getBranchDashboard(),
      ]);
      const d = dashboardRes.data?.stats || dashboardRes.data || {};
      setStats({
        totalItems:        d.totalItems        || 0,
        lowStock:          d.lowStock          || d.lowStockItems || 0,
        pendingRequests:   d.pendingRequests   || 0,
        incomingDispatches: d.incomingDispatches || 0,
      });
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Keyboard shortcuts
  useKeyboardShortcut('ctrl+r', fetchData, { enabled: true });
  useKeyboardShortcut('ctrl+n', () => router.push('/dashboard/branch-store/requests'), { enabled: true });
  useKeyboardShortcut('ctrl+l', () => router.push('/dashboard/branch-store/stock'), { enabled: true });
  useKeyboardShortcut('ctrl+p', () => router.push('/dashboard/branch-store/reports'), { enabled: true });

  const quickLinks = [
    { href: '/dashboard/branch-store/stock', icon: Package, label: 'Stock', desc: 'Current inventory', shortcut: 'ctrl+l' },
    { href: '/dashboard/branch-store/receive', icon: ArrowDownToLine, label: 'Receive', desc: 'Confirm delivery' },
    { href: '/dashboard/branch-store/requests', icon: ShoppingCart, label: 'Requests', desc: 'Order from store', shortcut: 'ctrl+n' },
    { href: '/dashboard/branch-store/stock-takes', icon: ClipboardList, label: 'Stock Take', desc: 'Inventory audit' },
    { href: '/dashboard/branch-store/kitchen-usage', icon: Utensils, label: 'Kitchen', desc: 'Kitchen usage' },
    { href: '/dashboard/branch-store/stock-out', icon: TrendingDown, label: 'Stock Out', desc: 'Issue items' },
    { href: '/dashboard/branch-store/kitchen-requisitions', icon: FileText, label: 'Requisitions', desc: 'Dept requests' },
  ];

  const statCards = [
    { label: 'Total Items',        value: stats.totalItems,         icon: Package,       color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'Low Stock',          value: stats.lowStock,           icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Pending Requests',   value: stats.pendingRequests,    icon: ClipboardList, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Incoming Deliveries',value: stats.incomingDispatches, icon: Truck,         color: 'text-emerald-600',bg: 'bg-emerald-50' },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Branch Store</h1>
              <p className="text-stone-500 mt-0.5">{user?.branch_name || 'Your Branch'} • Press ? for shortcuts</p>
            </div>
            <button onClick={fetchData} disabled={isLoading} className="btn-secondary self-start sm:self-auto flex items-center gap-1">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
              <ShortcutBadge shortcut="ctrl+r" variant="compact" className="opacity-50" />
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {statCards.map((stat, i) => (
              <div key={i} className="stat-card">
                <div className={`stat-icon ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <p className="stat-value">{isLoading ? '—' : stat.value}</p>
                <p className="stat-label">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Quick Access */}
          <div className="card-elevated p-5">
            <div className="section-header mb-4">
              <h2 className="section-title">Quick Access</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <div className="action-card group relative">
                    <div className="action-card-icon">
                      <link.icon className="h-5 w-5" />
                    </div>
                    <p className="action-card-label">{link.label}</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">{link.desc}</p>
                    {link.shortcut && (
                      <ShortcutBadge shortcut={link.shortcut} variant="compact" className="mt-1 opacity-50" />
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <KeyboardShortcutOverlay
          isOpen={shortcutOverlay.isOpen}
          onClose={shortcutOverlay.close}
          currentModule="branchStore"
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
