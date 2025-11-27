'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Package, Warehouse, Truck, AlertTriangle, TrendingUp,
  Building2, ArrowRight, RefreshCw, BarChart3, ClipboardList,
  Plus, Eye, Car, User, Users, FileText, Settings
} from 'lucide-react';
import { toast } from 'sonner';

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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
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
              <Button variant="outline" onClick={fetchDashboardData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={() => router.push('/dashboard/storekeeping/inventory')}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/dashboard/storekeeping/inventory')}>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Items</p>
                  <p className="text-2xl font-bold">{stats.totalItems}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/dashboard/storekeeping/inventory')}>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Low Stock</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.lowStockItems}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/dashboard/storekeeping/reports')}>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-xl">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Value</p>
                  <p className="text-2xl font-bold">KES {stats.totalValue.toLocaleString()}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/dashboard/storekeeping/central')}>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-xl">
                  <Building2 className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Branches</p>
                  <p className="text-2xl font-bold">{stats.branches}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-indigo-500" onClick={() => router.push('/dashboard/storekeeping/central')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Warehouse className="h-8 w-8 text-indigo-600" />
                  <div>
                    <h3 className="font-semibold">Central Warehouse</h3>
                    <p className="text-sm text-gray-500">Manage central stock & dispatches</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-green-500" onClick={() => router.push('/dashboard/storekeeping/branch')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Package className="h-8 w-8 text-green-600" />
                  <div>
                    <h3 className="font-semibold">Branch Stock</h3>
                    <p className="text-sm text-gray-500">View branch inventory levels</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-blue-500" onClick={() => router.push('/dashboard/storekeeping/transfers')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Truck className="h-8 w-8 text-blue-600" />
                  <div>
                    <h3 className="font-semibold">Transfers</h3>
                    <p className="text-sm text-gray-500">Track dispatches & deliveries</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-gray-400" />
              </div>
            </Card>
          </div>

          {/* Additional Resources */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/dashboard/storekeeping/vehicles')}>
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="p-3 bg-blue-100 rounded-full"><Car className="h-6 w-6 text-blue-600" /></div>
                <h4 className="font-medium">Vehicles</h4>
                <p className="text-xs text-gray-500">Delivery fleet</p>
              </div>
            </Card>
            <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/dashboard/storekeeping/drivers')}>
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="p-3 bg-green-100 rounded-full"><User className="h-6 w-6 text-green-600" /></div>
                <h4 className="font-medium">Drivers</h4>
                <p className="text-xs text-gray-500">Delivery staff</p>
              </div>
            </Card>
            <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/dashboard/storekeeping/suppliers')}>
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="p-3 bg-purple-100 rounded-full"><Users className="h-6 w-6 text-purple-600" /></div>
                <h4 className="font-medium">Suppliers</h4>
                <p className="text-xs text-gray-500">Vendors</p>
              </div>
            </Card>
            <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push('/dashboard/storekeeping/stock-takes')}>
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="p-3 bg-amber-100 rounded-full"><ClipboardList className="h-6 w-6 text-amber-600" /></div>
                <h4 className="font-medium">Stock Takes</h4>
                <p className="text-xs text-gray-500">Inventory counts</p>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Low Stock Alert */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Low Stock Items
                </h3>
                <Button size="sm" variant="outline" onClick={() => router.push('/dashboard/storekeeping/inventory')}>
                  View All
                </Button>
              </div>
              <div className="space-y-3">
                {lowStockItems.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No low stock items</p>
                ) : (
                  lowStockItems.map((item) => (
                    <div key={item.sku} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                      <div>
                        <p className="font-medium">{item.item_name}</p>
                        <p className="text-xs text-gray-500 font-mono">{item.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-amber-600">{item.quantity}</p>
                        <p className="text-xs text-gray-500">Reorder: {item.reorder_level || 10}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Branches Overview */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-indigo-500" />
                  Branches
                </h3>
                <Button size="sm" variant="outline" onClick={() => router.push('/dashboard/storekeeping/central')}>
                  Manage
                </Button>
              </div>
              <div className="space-y-3">
                {branches.slice(0, 5).map((branch) => (
                  <div key={branch.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      {branch.is_central_warehouse ? (
                        <Warehouse className="h-5 w-5 text-indigo-600" />
                      ) : (
                        <Building2 className="h-5 w-5 text-gray-400" />
                      )}
                      <div>
                        <p className="font-medium">{branch.name}</p>
                        <p className="text-xs text-gray-500">{branch.location}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{branch.totalItems || 0} items</p>
                      {(branch.lowStockItems || 0) > 0 && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          {branch.lowStockItems} low
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
