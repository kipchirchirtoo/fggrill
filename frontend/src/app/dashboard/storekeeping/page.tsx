'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from "@/components/ui/minimal/button";
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { IOSBadge } from '@/components/ui/ios-badge';
import {
  Package, Warehouse, Truck, AlertTriangle, TrendingUp,
  Building2, ArrowRight, RefreshCw, BarChart3, ClipboardList,
  Plus, Eye, Car, User, Users, FileText, Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

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
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
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
  }, [authLoading, user, router]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch all data in parallel
      const [itemsRes, branchesRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/store/items`, { headers }),
        fetch(`${API_URL}/api/store/branches`, { headers }),
        fetch(`${API_URL}/api/inventory/stats/overview`, { headers })
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
  };

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Storekeeping Dashboard</h1>
              <p className="text-gray-600">
                {isCentral ? 'Central Warehouse Management' : 'Branch Stock Management'}
              </p>
            </div>
            <div className="flex gap-3">
              <IOSButton variant="outline" onClick={fetchDashboardData} leftIcon={<RefreshCw />}>Refresh
              </IOSButton>
              <IOSButton onClick={() => router.push('/dashboard/storekeeping/inventory')} leftIcon={<Plus />}>
                Add Item
              </IOSButton>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <IOSCard className="p-6 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition-shadow cursor-pointer" onClick={() => router.push('/dashboard/storekeeping/inventory')}>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#F2F2F7] rounded-xl">
                  <Package className="h-6 w-6 text-[#3C3C43]" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Items</p>
                  <p className="text-2xl font-bold">{stats.totalItems}</p>
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-6 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition-shadow cursor-pointer" onClick={() => router.push('/dashboard/storekeeping/inventory')}>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#F2F2F7] rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-[#3C3C43]" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Low Stock</p>
                  <p className="text-2xl font-bold text-[#3C3C43]">{stats.lowStockItems}</p>
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-6 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition-shadow cursor-pointer" onClick={() => router.push('/dashboard/storekeeping/reports')}>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#F2F2F7] rounded-xl">
                  <TrendingUp className="h-6 w-6 text-[#3C3C43]" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Value</p>
                  <p className="text-2xl font-bold">KES {stats.totalValue.toLocaleString()}</p>
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-6 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition-shadow cursor-pointer" onClick={() => router.push('/dashboard/storekeeping/central')}>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#F2F2F7] rounded-xl">
                  <Building2 className="h-6 w-6 text-[#3C3C43]" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Branches</p>
                  <p className="text-2xl font-bold">{stats.branches}</p>
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <IOSCard className="p-6 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition-shadow cursor-pointer border-l-4 border-l-indigo-500" onClick={() => router.push('/dashboard/storekeeping/central')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Warehouse className="h-8 w-8 text-[#3C3C43]" />
                  <div>
                    <h3 className="font-semibold font-sf-pro-display">Central Warehouse</h3>
                    <p className="text-sm text-gray-500">Manage central stock & dispatches</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
            </IOSCard>

            <IOSCard className="p-6 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition-shadow cursor-pointer border-l-4 border-l-green-500" onClick={() => router.push('/dashboard/storekeeping/branch')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Package className="h-8 w-8 text-[#3C3C43]" />
                  <div>
                    <h3 className="font-semibold font-sf-pro-display">Branch Stock</h3>
                    <p className="text-sm text-gray-500">View branch inventory levels</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
            </IOSCard>

            <IOSCard className="p-6 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition-shadow cursor-pointer border-l-4 border-l-blue-500" onClick={() => router.push('/dashboard/storekeeping/transfers')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Truck className="h-8 w-8 text-[#3C3C43]" />
                  <div>
                    <h3 className="font-semibold font-sf-pro-display">Transfers</h3>
                    <p className="text-sm text-gray-500">Track dispatches & deliveries</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
            </IOSCard>
          </div>

          {/* Procurement & Receiving */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <IOSCard className="p-6 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition-shadow cursor-pointer border-l-4 border-l-[#3C3C43]" onClick={() => router.push('/dashboard/storekeeping/purchase-orders')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-[#F2F2F7] rounded-xl">
                    <Package className="h-8 w-8 text-[#3C3C43]" />
                  </div>
                  <div>
                    <h3 className="font-semibold font-sf-pro-display">Purchase Orders</h3>
                    <p className="text-sm text-gray-500">Create & manage stock procurement</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
            </IOSCard>

            <IOSCard className="p-6 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition-shadow cursor-pointer border-l-4 border-l-teal-500" onClick={() => router.push('/dashboard/storekeeping/grn')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-[#F2F2F7] rounded-xl">
                    <ClipboardList className="h-8 w-8 text-[#3C3C43]" />
                  </div>
                  <div>
                    <h3 className="font-semibold font-sf-pro-display">Goods Received (GRN)</h3>
                    <p className="text-sm text-gray-500">Record incoming stock receipts</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
            </IOSCard>
          </div>

          {/* Additional Resources */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition-shadow cursor-pointer" onClick={() => router.push('/dashboard/storekeeping/vehicles')}>
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="p-3 bg-[#F2F2F7] rounded-full"><Car className="h-6 w-6 text-[#3C3C43]" /></div>
                <h4 className="font-medium">Vehicles</h4>
                <p className="text-xs text-gray-500">Delivery fleet</p>
              </div>
            </IOSCard>
            <IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition-shadow cursor-pointer" onClick={() => router.push('/dashboard/storekeeping/drivers')}>
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="p-3 bg-[#F2F2F7] rounded-full"><User className="h-6 w-6 text-[#3C3C43]" /></div>
                <h4 className="font-medium">Drivers</h4>
                <p className="text-xs text-gray-500">Delivery staff</p>
              </div>
            </IOSCard>
            <IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition-shadow cursor-pointer" onClick={() => router.push('/dashboard/storekeeping/suppliers')}>
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="p-3 bg-[#F2F2F7] rounded-full"><Users className="h-6 w-6 text-[#3C3C43]" /></div>
                <h4 className="font-medium">Suppliers</h4>
                <p className="text-xs text-gray-500">Vendors</p>
              </div>
            </IOSCard>
            <IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition-shadow cursor-pointer" onClick={() => router.push('/dashboard/storekeeping/stock-takes')}>
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="p-3 bg-[#F2F2F7] rounded-full"><ClipboardList className="h-6 w-6 text-[#3C3C43]" /></div>
                <h4 className="font-medium">Stock Takes</h4>
                <p className="text-xs text-gray-500">Inventory counts</p>
              </div>
            </IOSCard>
            <IOSCard className="p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition-shadow cursor-pointer border-2 border-[rgba(60,60,67,0.12)]" onClick={() => router.push('/dashboard/storekeeping/wastage')}>
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="p-3 bg-[#F2F2F7] rounded-full"><AlertTriangle className="h-6 w-6 text-[#3C3C43]" /></div>
                <h4 className="font-medium">Wastage</h4>
                <p className="text-xs text-gray-500">Track losses</p>
              </div>
            </IOSCard>
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
