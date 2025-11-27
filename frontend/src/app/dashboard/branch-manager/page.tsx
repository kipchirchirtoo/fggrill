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
  RefreshCw, ArrowRight, CheckCircle, Clock, Home, Wrench,
  Send, ArrowRightLeft
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { storeAPI, staffAPI } from '@/lib/api';

interface DashboardStats {
  branchName: string;
  branchCode: string;
  totalStockValue: number;
  totalItems: number;
  lowStockItems: number;
  pendingRequests: number;
  incomingDeliveries: number;
  staffCount: number;
}

export default function BranchManagerDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    branchName: '',
    branchCode: '',
    totalStockValue: 0,
    totalItems: 0,
    lowStockItems: 0,
    pendingRequests: 0,
    incomingDeliveries: 0,
    staffCount: 0
  });
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const branchId = user?.branch_id;
      
      // Fetch branch-specific data
      const [stockRes, lowStockRes, requestsRes, incomingRes, staffRes] = await Promise.all([
        storeAPI.getBranchStock(branchId).catch(() => ({ stock: [] })),
        storeAPI.getLowStockItems(branchId).catch(() => ({ items: [] })),
        storeAPI.getBranchRequests().catch(() => ({ requests: [] })),
        storeAPI.getIncomingDispatches().catch(() => ({ dispatches: [] })),
        staffAPI.getStaff(branchId).catch(() => ({ staff: [] }))
      ]);

      const stockList = stockRes.stock || stockRes || [];
      const lowStock = lowStockRes.items || lowStockRes || [];
      const requests = requestsRes.requests || requestsRes || [];
      const incoming = incomingRes.dispatches || incomingRes || [];
      const staffList = staffRes.staff || staffRes || [];

      // Calculate total stock value
      const totalValue = Array.isArray(stockList) 
        ? stockList.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.cost_price || 0)), 0)
        : 0;

      setStats({
        branchName: user?.branch_name || 'My Branch',
        branchCode: '',
        totalStockValue: totalValue,
        totalItems: Array.isArray(stockList) ? stockList.length : 0,
        lowStockItems: Array.isArray(lowStock) ? lowStock.length : 0,
        pendingRequests: Array.isArray(requests) ? requests.filter((r: any) => r.status === 'PENDING').length : 0,
        incomingDeliveries: Array.isArray(incoming) ? incoming.filter((d: any) => d.status === 'IN_TRANSIT').length : 0,
        staffCount: Array.isArray(staffList) ? staffList.length : 0
      });

      setLowStockItems(Array.isArray(lowStock) ? lowStock.slice(0, 5) : []);
      setPendingRequests(Array.isArray(requests) ? requests.slice(0, 5) : []);

    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Failed to load dashboard');
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">Branch Manager Dashboard</h1>
                <Badge className="bg-indigo-100 text-indigo-800">{stats.branchName}</Badge>
              </div>
              <p className="text-gray-600">Welcome, {user?.firstName}! Here's your branch overview.</p>
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
                  <p className="text-sm text-emerald-600 font-medium">Stock Value</p>
                  <p className="text-2xl font-bold text-emerald-900">KES {stats.totalStockValue.toLocaleString()}</p>
                  <p className="text-xs text-emerald-600">{stats.totalItems} items in stock</p>
                </div>
                <DollarSign className="h-10 w-10 text-emerald-500" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Incoming</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.incomingDeliveries}</p>
                  <p className="text-xs text-blue-600">Deliveries in transit</p>
                </div>
                <Truck className="h-10 w-10 text-blue-500" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">Staff</p>
                  <p className="text-2xl font-bold text-purple-900">{stats.staffCount}</p>
                  <p className="text-xs text-purple-600">Team members</p>
                </div>
                <Users className="h-10 w-10 text-purple-500" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600 font-medium">Low Stock Alerts</p>
                  <p className="text-2xl font-bold text-amber-900">{stats.lowStockItems}</p>
                  <p className="text-xs text-amber-600">{stats.pendingRequests} pending requests</p>
                </div>
                <AlertTriangle className="h-10 w-10 text-amber-500" />
              </div>
            </Card>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Link href="/dashboard/branch-manager/reservations">
              <Card className="p-4 hover:bg-blue-50 cursor-pointer transition-colors text-center">
                <Calendar className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm font-medium">Reservations</p>
              </Card>
            </Link>
            <Link href="/dashboard/branch-manager/checkin">
              <Card className="p-4 hover:bg-green-50 cursor-pointer transition-colors text-center">
                <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm font-medium">Check In/Out</p>
              </Card>
            </Link>
            <Link href="/dashboard/branch-manager/rooms">
              <Card className="p-4 hover:bg-indigo-50 cursor-pointer transition-colors text-center">
                <Bed className="h-8 w-8 text-indigo-600 mx-auto mb-2" />
                <p className="text-sm font-medium">Rooms</p>
              </Card>
            </Link>
            <Link href="/dashboard/branch-manager/housekeeping">
              <Card className="p-4 hover:bg-purple-50 cursor-pointer transition-colors text-center">
                <Home className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <p className="text-sm font-medium">Housekeeping</p>
              </Card>
            </Link>
            <Link href="/dashboard/branch-manager/restaurant">
              <Card className="p-4 hover:bg-orange-50 cursor-pointer transition-colors text-center">
                <UtensilsCrossed className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                <p className="text-sm font-medium">Restaurant</p>
              </Card>
            </Link>
            <Link href="/dashboard/branch-manager/stock">
              <Card className="p-4 hover:bg-amber-50 cursor-pointer transition-colors text-center">
                <Package className="h-8 w-8 text-amber-600 mx-auto mb-2" />
                <p className="text-sm font-medium">Stock</p>
              </Card>
            </Link>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Low Stock Items */}
            <Card>
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Low Stock Items
                </h2>
                <Link href="/dashboard/branch-manager/stock" className="text-sm text-indigo-600 hover:underline">
                  View all
                </Link>
              </div>
              <div className="divide-y">
                {lowStockItems.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    {isLoading ? 'Loading...' : 'No low stock items'}
                  </div>
                ) : lowStockItems.map((item: any) => (
                  <div key={item.id || item.sku} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{item.item_name || item.name}</p>
                      <p className="text-xs text-gray-500">{item.sku || item.item_sku}</p>
                    </div>
                    <Badge className="bg-red-100 text-red-800">{item.quantity} left</Badge>
                  </div>
                ))}
              </div>
            </Card>

            {/* Pending Requests */}
            <Card>
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <Send className="h-5 w-5 text-blue-500" />
                  My Requests
                </h2>
                <Link href="/dashboard/branch-manager/requests" className="text-sm text-indigo-600 hover:underline">
                  View all
                </Link>
              </div>
              <div className="divide-y">
                {pendingRequests.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    {isLoading ? 'Loading...' : 'No pending requests'}
                  </div>
                ) : pendingRequests.map((req: any) => (
                  <div key={req.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{req.request_number}</p>
                      <p className="text-xs text-gray-500">{new Date(req.created_at).toLocaleDateString()}</p>
                    </div>
                    <Badge className={req.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                      {req.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Staff Overview */}
          <Card>
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-500" />
                Branch Staff
              </h2>
              <Link href="/dashboard/branch-manager/staff" className="text-sm text-indigo-600 hover:underline">
                Manage Staff
              </Link>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Total Staff</span>
                <span className="font-bold">{stats.staffCount}</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">Staff data loaded from API</p>
            </div>
          </Card>

          {/* Branch Manager Workflow Actions */}
          <Card>
            <div className="p-4 border-b">
              <h2 className="font-semibold">Branch Manager Workflows</h2>
              <p className="text-sm text-gray-500">Quick access to your key functions</p>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Daily Operations */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-sm text-gray-700 mb-3">Daily Operations</h3>
                <div className="space-y-2">
                  <Link href="/dashboard/branch-manager/arrivals" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <Clock className="h-4 w-4" /> Today's Arrivals
                  </Link>
                  <Link href="/dashboard/branch-manager/departures" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <ArrowRightLeft className="h-4 w-4" /> Today's Departures
                  </Link>
                  <Link href="/dashboard/branch-manager/housekeeping" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <Home className="h-4 w-4" /> Housekeeping Status
                  </Link>
                </div>
              </div>

              {/* Stock Management */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-sm text-gray-700 mb-3">Stock Management</h3>
                <div className="space-y-2">
                  <Link href="/dashboard/storekeeping/branch" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <Package className="h-4 w-4" /> View Branch Stock
                  </Link>
                  <Link href="/dashboard/storekeeping/requests" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <Send className="h-4 w-4" /> Create Request
                  </Link>
                  <Link href="/dashboard/branch-manager/incoming" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <Truck className="h-4 w-4" /> Incoming Deliveries
                  </Link>
                </div>
              </div>

              {/* Staff & Reports */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-sm text-gray-700 mb-3">Staff & Reports</h3>
                <div className="space-y-2">
                  <Link href="/dashboard/branch-manager/staff" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <Users className="h-4 w-4" /> Staff Schedules
                  </Link>
                  <Link href="/dashboard/branch-manager/attendance" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <CheckCircle className="h-4 w-4" /> Attendance
                  </Link>
                  <Link href="/dashboard/branch-manager/reports" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <BarChart3 className="h-4 w-4" /> Reports
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
