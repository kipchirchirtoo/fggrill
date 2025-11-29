'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import Link from 'next/link';
import {
  Package,
  Warehouse,
  Building2,
  ArrowLeftRight,
  ClipboardList,
  FileCheck,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { storeAPI } from '@/lib/api';

export default function AdminStorekeepingPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalItems: 0,
    totalValue: 0,
    lowStock: 0,
    pendingRequests: 0,
    pendingTransfers: 0
  });
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [itemsRes, branchesRes, requestsRes] = await Promise.all([
        storeAPI.getItems().catch(() => ({ items: [] })),
        storeAPI.getBranchesWithStock().catch(() => ({ branches: [] })),
        storeAPI.getPendingRequests().catch(() => ({ requests: [] }))
      ]);
      
      const items = itemsRes.items || itemsRes.data || [];
      const branchData = branchesRes.branches || branchesRes.data || [];
      const requests = requestsRes.requests || requestsRes.data || [];
      
      setBranches(Array.isArray(branchData) ? branchData : []);
      
      const totalValue = items.reduce((sum: number, i: any) => 
        sum + ((i.quantity || 0) * (i.cost_price || i.unit_cost || 0)), 0);
      const lowStock = items.filter((i: any) => 
        (i.quantity || 0) <= (i.reorder_level || i.min_quantity || 10)).length;
      
      setStats({
        totalItems: items.length,
        totalValue,
        lowStock,
        pendingRequests: requests.length,
        pendingTransfers: 0
      });
    } catch (error) {
      toast.error('Failed to load storekeeping data');
    } finally {
      setIsLoading(false);
    }
  };

  const modules = [
    {
      title: 'Central Warehouse',
      description: 'Manage central stock and dispatches',
      icon: Warehouse,
      href: '/dashboard/admin/storekeeping/central',
      color: 'bg-blue-100 text-blue-600'
    },
    {
      title: 'Branch Stock',
      description: 'View stock levels across branches',
      icon: Building2,
      href: '/dashboard/admin/storekeeping/branch',
      color: 'bg-green-100 text-green-600'
    },
    {
      title: 'Inventory',
      description: 'Master inventory catalog',
      icon: Package,
      href: '/dashboard/admin/inventory',
      color: 'bg-purple-100 text-purple-600'
    },
    {
      title: 'Transfers',
      description: 'Inter-branch stock transfers',
      icon: ArrowLeftRight,
      href: '/dashboard/admin/storekeeping/transfers',
      color: 'bg-orange-100 text-orange-600'
    },
    {
      title: 'Requests',
      description: 'Stock request management',
      icon: ClipboardList,
      href: '/dashboard/admin/storekeeping/requests',
      color: 'bg-yellow-100 text-yellow-600'
    },
    {
      title: 'Stock Takes',
      description: 'Physical stock verification',
      icon: FileCheck,
      href: '/dashboard/admin/storekeeping/stock-takes',
      color: 'bg-pink-100 text-pink-600'
    }
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Storekeeping Overview</h1>
              <p className="text-gray-600 mt-1">Manage inventory across all branches</p>
            </div>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Package className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Items</p>
                  <p className="text-2xl font-bold">{stats.totalItems}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Value</p>
                  <p className="text-2xl font-bold">KES {(stats.totalValue / 1000).toFixed(0)}K</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Low Stock</p>
                  <p className="text-2xl font-bold">{stats.lowStock}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <ClipboardList className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pending Requests</p>
                  <p className="text-2xl font-bold">{stats.pendingRequests}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Branches</p>
                  <p className="text-2xl font-bold">{branches.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Modules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((module) => (
              <Link
                key={module.href}
                href={module.href}
                className="bg-white rounded-xl p-6 border border-gray-100 hover:shadow-lg hover:border-indigo-300 transition-all group"
              >
                <div className={`inline-flex p-3 rounded-lg ${module.color} mb-4`}>
                  <module.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-indigo-600">
                  {module.title}
                </h3>
                <p className="text-sm text-gray-500 mt-1">{module.description}</p>
              </Link>
            ))}
          </div>

          {/* Branch Overview */}
          <div className="bg-white rounded-xl p-6 border border-gray-100">
            <h2 className="text-lg font-semibold mb-4">Branch Stock Overview</h2>
            {branches.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No branch data available</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {branches.map((branch: any) => (
                  <div key={branch.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{branch.name}</span>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">{branch.code}</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      <p>Items: {branch.item_count || 0}</p>
                      <p>Value: KES {((branch.total_value || 0) / 1000).toFixed(0)}K</p>
                    </div>
                    {branch.low_stock_count > 0 && (
                      <div className="mt-2 flex items-center gap-1 text-red-600 text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        {branch.low_stock_count} low stock items
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
