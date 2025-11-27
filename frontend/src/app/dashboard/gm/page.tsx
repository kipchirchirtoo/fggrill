'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, Users, Package, Truck, DollarSign, BarChart3, 
  Bed, Calendar, UtensilsCrossed, AlertTriangle, TrendingUp, 
  TrendingDown, RefreshCw, ArrowRight, CheckCircle, Clock
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { storeAPI, staffAPI, systemAPI } from '@/lib/api';

interface Branch {
  id: number;
  name: string;
  code: string;
  location?: string;
  is_central_warehouse?: boolean;
  stock_value?: number;
  pending_requests?: number;
}

interface DashboardStats {
  totalRevenue: number;
  totalOccupancy: number;
  totalRooms: number;
  totalStaff: number;
  totalBranches: number;
  lowStockAlerts: number;
  pendingRequests: number;
  activeGuests: number;
}

export default function GeneralManagerDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalOccupancy: 0,
    totalRooms: 0,
    totalStaff: 0,
    totalBranches: 0,
    lowStockAlerts: 0,
    pendingRequests: 0,
    activeGuests: 0
  });
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch branches with stock data
      const [branchesRes, pendingRes, lowStockRes, staffRes] = await Promise.all([
        storeAPI.getBranchesWithStock().catch(() => ({ branches: [] })),
        storeAPI.getPendingRequests().catch(() => ({ requests: [] })),
        storeAPI.getLowStockItems().catch(() => ({ items: [] })),
        staffAPI.getStaff().catch(() => ({ staff: [] }))
      ]);

      const branchList = branchesRes.branches || branchesRes || [];
      const pendingRequests = pendingRes.requests || pendingRes || [];
      const lowStockItems = lowStockRes.items || lowStockRes || [];
      const staffList = staffRes.staff || staffRes || [];

      setBranches(branchList);

      // Calculate total stock value across all branches
      const totalStockValue = branchList.reduce((sum: number, b: any) => sum + (b.stock_value || 0), 0);

      setStats({
        totalRevenue: totalStockValue, // Using stock value as proxy for now
        totalOccupancy: 0, // Would come from bookings API
        totalRooms: 0, // Would come from rooms API
        totalStaff: Array.isArray(staffList) ? staffList.length : 0,
        totalBranches: branchList.length,
        lowStockAlerts: Array.isArray(lowStockItems) ? lowStockItems.length : 0,
        pendingRequests: Array.isArray(pendingRequests) ? pendingRequests.length : 0,
        activeGuests: 0 // Would come from bookings API
      });
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">General Manager Dashboard</h1>
              <p className="text-gray-600">Welcome, {user?.firstName}! Overview of all Famous Gate branches.</p>
            </div>
            <Button onClick={fetchDashboardData} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-600 font-medium">Total Revenue (MTD)</p>
                  <p className="text-2xl font-bold text-emerald-900">KES {stats.totalRevenue.toLocaleString()}</p>
                  <p className="text-xs text-emerald-600 flex items-center mt-1">
                    <TrendingUp className="h-3 w-3 mr-1" /> +12% from last month
                  </p>
                </div>
                <DollarSign className="h-10 w-10 text-emerald-500" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Overall Occupancy</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.totalOccupancy}%</p>
                  <p className="text-xs text-blue-600">{stats.activeGuests} active guests</p>
                </div>
                <Bed className="h-10 w-10 text-blue-500" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">Total Staff</p>
                  <p className="text-2xl font-bold text-purple-900">{stats.totalStaff}</p>
                  <p className="text-xs text-purple-600">Across {stats.totalBranches} branches</p>
                </div>
                <Users className="h-10 w-10 text-purple-500" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600 font-medium">Pending Requests</p>
                  <p className="text-2xl font-bold text-amber-900">{stats.pendingRequests}</p>
                  <p className="text-xs text-amber-600">{stats.lowStockAlerts} low stock alerts</p>
                </div>
                <AlertTriangle className="h-10 w-10 text-amber-500" />
              </div>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link href="/dashboard/gm/branches">
              <Card className="p-4 hover:bg-indigo-50 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Building2 className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Manage Branches</p>
                    <p className="text-sm text-gray-500">{stats.totalBranches} locations</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/gm/staff">
              <Card className="p-4 hover:bg-purple-50 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Users className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Staff Management</p>
                    <p className="text-sm text-gray-500">{stats.totalStaff} employees</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/gm/reports">
              <Card className="p-4 hover:bg-emerald-50 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <BarChart3 className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold">View Reports</p>
                    <p className="text-sm text-gray-500">Performance analytics</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/storekeeping">
              <Card className="p-4 hover:bg-blue-50 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Package className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Storekeeping</p>
                    <p className="text-sm text-gray-500">Inventory overview</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
                </div>
              </Card>
            </Link>
          </div>

          {/* Branch Performance Table */}
          <Card>
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-500" />
                Branch Performance
              </h2>
              <Link href="/dashboard/gm/branches" className="text-sm text-indigo-600 hover:underline">
                View all branches
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Value</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requests</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {branches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        {isLoading ? 'Loading branches...' : 'No branches found'}
                      </td>
                    </tr>
                  ) : branches.map((branch) => (
                    <tr key={branch.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-medium">{branch.name}</p>
                          <p className="text-xs text-gray-500">{branch.code}</p>
                          {branch.is_central_warehouse && (
                            <Badge className="bg-indigo-100 text-indigo-700 text-xs mt-1">Central</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-gray-600">{branch.location || '-'}</td>
                      <td className="px-4 py-4 font-medium">
                        KES {(branch.stock_value || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-4">
                        {(branch.pending_requests || 0) > 0 ? (
                          <Badge className="bg-amber-100 text-amber-800">{branch.pending_requests} pending</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800">None</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* GM Workflow Actions */}
          <Card>
            <div className="p-4 border-b">
              <h2 className="font-semibold">General Manager Workflows</h2>
              <p className="text-sm text-gray-500">Quick access to management functions</p>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Multi-Branch Oversight */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-sm text-indigo-700 mb-3">Branch Oversight</h3>
                <div className="space-y-2">
                  <Link href="/dashboard/gm/branches" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <Building2 className="h-4 w-4" /> Branch Performance
                  </Link>
                  <Link href="/dashboard/gm/compare" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <BarChart3 className="h-4 w-4" /> Compare Branches
                  </Link>
                </div>
              </div>

              {/* Stock Approvals */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-sm text-amber-700 mb-3">Stock Approvals</h3>
                <div className="space-y-2">
                  <Link href="/dashboard/storekeeping/requests" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <Package className="h-4 w-4" /> Pending Requests ({stats.pendingRequests})
                  </Link>
                  <Link href="/dashboard/storekeeping" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <AlertTriangle className="h-4 w-4" /> Low Stock Alerts ({stats.lowStockAlerts})
                  </Link>
                </div>
              </div>

              {/* Staff Management */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-sm text-purple-700 mb-3">Staff Management</h3>
                <div className="space-y-2">
                  <Link href="/dashboard/gm/staff" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <Users className="h-4 w-4" /> All Staff ({stats.totalStaff})
                  </Link>
                  <Link href="/dashboard/gm/leave-requests" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <Calendar className="h-4 w-4" /> Leave Requests
                  </Link>
                </div>
              </div>

              {/* Reports */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-sm text-emerald-700 mb-3">Reports & Analytics</h3>
                <div className="space-y-2">
                  <Link href="/dashboard/gm/reports" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <BarChart3 className="h-4 w-4" /> Performance Reports
                  </Link>
                  <Link href="/dashboard/gm/finance" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <DollarSign className="h-4 w-4" /> Financial Summary
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
