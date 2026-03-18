'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from "@/components/ui/minimal/button";
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { IOSBadge } from '@/components/ui/ios-badge';
import { BranchSelector } from '@/components/ui/branch-selector';
import {
  Package, Warehouse, Truck, AlertTriangle, TrendingUp,
  Building2, ArrowRight, RefreshCw, BarChart3, ClipboardList,
  Plus, Eye, Car, User, Users, FileText, Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';


interface DashboardStats {
  totalItems: number;
  lowStockItems: number;
  totalValue: number;
  pendingRequests: number;
  inTransit: number;
  branches: number;
}

interface Branch {
  id: number;
  name: string;
  code: string;
  location: string;
  is_central_warehouse: boolean;
  totalItems?: number;
  lowStockItems?: number;
}

interface LowStockItem {
  sku: string;
  item_name: string;
  quantity: number;
  reorder_level: number;
  category: string;
}

export default function StorekeepingDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { activeBranchId, activeBranch, userBranches } = useBranch();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    lowStockItems: 0,
    totalValue: 0,
    pendingRequests: 0,
    inTransit: 0,
    branches: 0
  });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);

  // Effective branch for filtering
  const effectiveBranchId = selectedBranchId || activeBranchId;

  useEffect(() => {
    if (!authLoading && user) {
      // Strict redirect for Storekeepers to their dedicated dashboards
      if (user.role === UserRole.CENTRAL_STOREKEEPER) {
        router.push('/dashboard/central-store');
        return;
      }
      if (user.role === UserRole.BRANCH_STOREKEEPER) {
        router.push('/dashboard/branch-store');
        return;
      }
      fetchDashboardData();
    }
  }, [authLoading, user, router, effectiveBranchId]);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const branchQuery = effectiveBranchId ? `?branch_id=${effectiveBranchId}` : '';

      // Fetch all data in parallel with branch filter
      const [itemsRes, branchesRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/store/items${branchQuery}`, { headers }),
        fetch(`${API_URL}/api/store/branches`, { headers }),
        fetch(`${API_URL}/api/inventory/stats/overview${branchQuery}`, { headers })
      ]);

      if (itemsRes.ok) {
        const data = await itemsRes.json();
        const items = data.data || [];
        const lowStock = items.filter((i: any) => (i.quantity || 0) <= (i.reorder_level || 10));
        setLowStockItems(lowStock.slice(0, 5));
        setStats(prev => ({
          ...prev,
          totalItems: items.length,
          lowStockItems: lowStock.length,
          totalValue: items.reduce((sum: number, i: any) => sum + ((i.quantity || 0) * (i.cost_price || 0)), 0)
        }));
      }

      if (branchesRes.ok) {
        const data = await branchesRes.json();
        setBranches(data.data || []);
        setStats(prev => ({ ...prev, branches: (data.data || []).length }));
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        if (data.data) {
          setStats(prev => ({
            ...prev,
            totalItems: data.data.totalItems || prev.totalItems,
            lowStockItems: data.data.lowStockCount || prev.lowStockItems
          }));
        }
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveBranchId]);

  const isCentral = user?.is_central || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER;

  if (isLoading) {
    return (
      <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[rgba(60,60,67,0.12)] mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading dashboard...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[22px] sm:text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Storekeeping</h1>
              <p className="text-stone-500 text-sm mt-0.5">
                {isCentral ? 'Central Warehouse Management' : (activeBranch?.name || 'Branch Stock Management')}
              </p>
            </div>
            <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-3">
              {isCentral && userBranches.length > 1 && (
                <div className="flex-1 xs:flex-none">
                  <BranchSelector
                    size="sm"
                    showAllOption={true}
                    allOptionLabel="All Branches"
                    value={selectedBranchId}
                    onChange={setSelectedBranchId}
                  />
                </div>
              )}
              <div className="flex gap-2 flex-1 xs:flex-none">
                <button
                  onClick={fetchDashboardData}
                  disabled={isLoading}
                  className="btn-secondary h-[40px] px-3 flex-1 flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden xs:inline">Refresh</span>
                </button>
                <button
                  onClick={() => router.push('/dashboard/storekeeping/inventory')}
                  className="btn-primary h-[40px] px-3 flex-1 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Item</span>
                </button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Total Items', value: stats.totalItems, icon: Package, color: 'text-stone-600', bg: 'bg-stone-50', path: '/dashboard/storekeeping/inventory' },
              { label: 'Low Stock', value: stats.lowStockItems, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', path: '/dashboard/storekeeping/inventory' },
              { label: 'Inventory Value', value: `KES ${stats.totalValue.toLocaleString()}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', path: '/dashboard/storekeeping/reports', span: true },
              { label: 'Branches', value: stats.branches, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50', path: '/dashboard/storekeeping/central' },
            ].map((stat, i) => (
              <IOSCard
                key={i}
                className={`p-3 sm:p-4 shadow-sm hover:border-stone-300 transition-all cursor-pointer flex items-center gap-3 sm:gap-4 ${stat.span ? 'col-span-2 md:col-span-1' : ''}`}
                onClick={() => router.push(stat.path)}
              >
                <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">{stat.label}</p>
                  <p className="text-lg sm:text-xl font-bold text-stone-900 truncate">{stat.value}</p>
                </div>
              </IOSCard>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { title: 'Central Warehouse', desc: 'Manage central stock & dispatches', icon: Warehouse, color: 'border-l-indigo-500', path: '/dashboard/storekeeping/central' },
              { title: 'Branch Stock', desc: 'View branch inventory levels', icon: Package, color: 'border-l-green-500', path: '/dashboard/storekeeping/branch' },
              { title: 'Transfers', desc: 'Track dispatches & deliveries', icon: Truck, color: 'border-l-blue-500', path: '/dashboard/storekeeping/transfers' },
            ].map((action, i) => (
              <IOSCard
                key={i}
                className={`p-4 sm:p-5 hover:border-stone-300 transition-all cursor-pointer border-l-4 ${action.color}`}
                onClick={() => router.push(action.path)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 sm:p-3 bg-stone-50 rounded-xl">
                      <action.icon className="h-6 w-6 sm:h-8 sm:w-8 text-stone-700" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-stone-900 truncate">{action.title}</h3>
                      <p className="text-xs text-stone-500 mt-0.5">{action.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-stone-300 shrink-0" />
                </div>
              </IOSCard>
            ))}
          </div>

          {/* Procurement & Receiving */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <IOSCard
              className="p-4 sm:p-5 hover:border-stone-300 transition-all cursor-pointer border-l-4 border-l-stone-900"
              onClick={() => router.push('/dashboard/storekeeping/purchase-orders')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 sm:p-3 bg-stone-50 rounded-xl">
                    <ClipboardList className="h-6 w-6 sm:h-8 sm:w-8 text-stone-900" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-stone-900">Purchase Orders</h3>
                    <p className="text-xs text-stone-500 mt-0.5">Manage stock procurement</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-stone-300 shrink-0" />
              </div>
            </IOSCard>

            <IOSCard
              className="p-4 sm:p-5 hover:border-stone-300 transition-all cursor-pointer border-l-4 border-l-teal-500"
              onClick={() => router.push('/dashboard/storekeeping/grn')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 sm:p-3 bg-stone-50 rounded-xl">
                    <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-teal-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-stone-900">Goods Received (GRN)</h3>
                    <p className="text-xs text-stone-500 mt-0.5">Record incoming stock receipts</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-stone-300 shrink-0" />
              </div>
            </IOSCard>
          </div>

          {/* Additional Resources */}
          <div className="grid grid-cols-3 xs:grid-cols-5 gap-3">
            {[
              { label: 'Vehicles', icon: Car, path: '/dashboard/storekeeping/vehicles' },
              { label: 'Drivers', icon: User, path: '/dashboard/storekeeping/drivers' },
              { label: 'Suppliers', icon: Users, path: '/dashboard/storekeeping/suppliers' },
              { label: 'Counts', icon: ClipboardList, path: '/dashboard/storekeeping/stock-takes' },
              { label: 'Wastage', icon: AlertTriangle, path: '/dashboard/storekeeping/wastage', danger: true },
            ].map((res, i) => (
              <IOSCard
                key={i}
                className="p-3 sm:p-4 hover:border-stone-300 transition-all cursor-pointer"
                onClick={() => router.push(res.path)}
              >
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className={`p-2.5 sm:p-3 bg-stone-50 rounded-full ${res.danger ? 'bg-red-50' : ''}`}>
                    <res.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${res.danger ? 'text-red-500' : 'text-stone-700'}`} />
                  </div>
                  <h4 className="text-[12px] sm:text-sm font-bold text-stone-900">{res.label}</h4>
                </div>
              </IOSCard>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Low Stock Alert */}
            <IOSCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold font-sf-pro-display text-gray-900 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-[#3C3C43]" />
                  Low Stock Items
                </h3>
                <IOSButton size="sm" variant="outline" onClick={() => router.push('/dashboard/storekeeping/inventory')}>
                  View All
                </IOSButton>
              </div>
              <div className="space-y-3">
                {lowStockItems.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No low stock items</p>
                ) : (
                  lowStockItems.map((item) => (
                    <div key={item.sku} className="flex items-center justify-between p-3 bg-[#F2F2F7] rounded-ios-lg">
                      <div>
                        <p className="font-medium">{item.item_name}</p>
                        <p className="text-xs text-gray-500 font-mono">{item.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-[#3C3C43]">{item.quantity}</p>
                        <p className="text-xs text-gray-500">Reorder: {item.reorder_level || 10}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </IOSCard>

            {/* Branches Overview */}
            <IOSCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold font-sf-pro-display text-gray-900 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-[#3C3C43]" />
                  Branches
                </h3>
                <IOSButton size="sm" variant="outline" onClick={() => router.push('/dashboard/storekeeping/central')}>
                  Manage
                </IOSButton>
              </div>
              <div className="space-y-3">
                {branches.slice(0, 5).map((branch) => (
                  <div key={branch.id} className="flex items-center justify-between p-3 border rounded-ios-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      {branch.is_central_warehouse ? (
                        <Warehouse className="h-5 w-5 text-[#3C3C43]" />
                      ) : (
                        <Building2 className="h-5 w-5 text-gray-400" />
                      )}
                      <div>
                        <p className="font-medium">{branch.name}</p>
                        <p className="text-xs text-gray-500">{branch.location}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold font-sf-pro-display">{branch.totalItems || 0} items</p>
                      {(branch.lowStockItems || 0) > 0 && (
                        <IOSBadge variant="light" color="secondary" className="text-[#3C3C43] border-[rgba(60,60,67,0.12)]">
                          {branch.lowStockItems} low
                        </IOSBadge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </IOSCard>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
