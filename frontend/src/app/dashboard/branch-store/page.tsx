'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Package, Truck, Send, Clock, CheckCircle, AlertTriangle,
  ArrowRight, RefreshCw, Building2, ArrowRightLeft, BarChart3, Box, ChefHat,
  Search, Trash2, TrendingUp, TrendingDown, Calendar, FileText,
  ArrowUpRight, ArrowDownRight, Bell, Eye, Plus, Minus
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import Link from 'next/link';
import { storeAPI } from '@/lib/api';

interface DashboardStats {
  totalItems: number;
  lowStockItems: number;
  pendingRequests: number;
  incomingDeliveries: number;
  todayStockOut: number;
  branchName: string;
  branchCode: string;
  totalValue: number;
  thisMonthUsage: number;
  lastMonthUsage: number;
  wastageThisMonth: number;
}

interface MyRequest {
  id: string;
  request_number: string;
  status: string;
  items_count: number;
  priority: string;
  created_at: string;
}

interface IncomingDelivery {
  id: string;
  dispatch_number: string;
  from_branch: string;
  status: string;
  items_count: number;
  expected_delivery: string;
}

interface LowStockItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  reorder_level: number;
}

interface RecentActivity {
  id: string;
  type: 'stock_in' | 'stock_out' | 'request' | 'wastage';
  description: string;
  quantity?: number;
  created_at: string;
}

export default function BranchStoreDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    lowStockItems: 0,
    pendingRequests: 0,
    incomingDeliveries: 0,
    todayStockOut: 0,
    branchName: '',
    branchCode: '',
    totalValue: 0,
    thisMonthUsage: 0,
    lastMonthUsage: 0,
    wastageThisMonth: 0
  });
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  const [incomingDeliveries, setIncomingDeliveries] = useState<IncomingDelivery[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    
    try {
      const [stockRes, requestsRes, incomingRes] = await Promise.all([
        storeAPI.getBranchStock().catch((err) => { console.error('Stock error:', err); return { stock: [] }; }),
        storeAPI.getBranchRequests().catch((err) => { console.error('Requests error:', err); return { requests: [] }; }),
        storeAPI.getIncomingDispatches().catch((err) => { console.error('Dispatches error:', err); return { dispatches: [] }; })
      ]);

      const stock = stockRes.stock || stockRes.data || stockRes || [];
      const requests = requestsRes.requests || requestsRes.data || requestsRes || [];
      const incoming = incomingRes.dispatches || incomingRes.data || incomingRes || [];

      const stockArray = Array.isArray(stock) ? stock : [];
      const lowStock = stockArray.filter((i: any) => i.quantity <= (i.reorder_level || i.min_level || 10));
      const requestsArray = Array.isArray(requests) ? requests : [];
      const pendingReq = requestsArray.filter((r: any) => r.status === 'PENDING' || r.status === 'APPROVED').length;
      const totalVal = stockArray.reduce((sum: number, i: any) => sum + ((i.quantity || 0) * (i.cost_price || i.unit_cost || 0)), 0);

      setStats({
        totalItems: stockArray.length,
        lowStockItems: lowStock.length,
        pendingRequests: pendingReq,
        incomingDeliveries: Array.isArray(incoming) ? incoming.length : 0,
        todayStockOut: 0,
        branchName: user?.branch_name || 'My Branch',
        branchCode: '',
        totalValue: totalVal,
        thisMonthUsage: 0,
        lastMonthUsage: 0,
        wastageThisMonth: 0
      });

      // Set low stock items for quick view
      setLowStockItems(lowStock.slice(0, 5).map((i: any) => ({
        id: i.id,
        name: i.item_name || i.name || 'Unknown',
        sku: i.sku || i.item_sku || '',
        quantity: i.quantity || 0,
        reorder_level: i.reorder_level || i.min_level || 10
      })));

      // Set my requests for quick view
      setMyRequests(requestsArray.slice(0, 5).map((r: any) => ({
        id: r.id,
        request_number: r.request_number,
        status: r.status,
        items_count: r.items?.length || 0,
        priority: r.priority || 'NORMAL',
        created_at: r.created_at
      })));

      // Set incoming deliveries
      const incomingArray = Array.isArray(incoming) ? incoming : [];
      setIncomingDeliveries(incomingArray.slice(0, 5).map((d: any) => ({
        id: d.id,
        dispatch_number: d.dispatch_number,
        from_branch: d.from_branch?.name || 'Central Warehouse',
        status: d.status,
        items_count: d.items?.length || 0,
        expected_delivery: d.estimated_delivery
      })));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-amber-100 text-amber-800',
      APPROVED: 'bg-blue-100 text-blue-800',
      DISPATCHED: 'bg-purple-100 text-purple-800',
      IN_TRANSIT: 'bg-purple-100 text-purple-800',
      DELIVERED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      URGENT: 'bg-red-100 text-red-800',
      HIGH: 'bg-orange-100 text-orange-800',
      NORMAL: 'bg-blue-100 text-blue-800',
      LOW: 'bg-gray-100 text-gray-800'
    };
    return colors[priority] || colors.NORMAL;
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'stock_in': return <Plus className="h-4 w-4 text-green-500" />;
      case 'stock_out': return <Minus className="h-4 w-4 text-orange-500" />;
      case 'request': return <Send className="h-4 w-4 text-blue-500" />;
      case 'wastage': return <Trash2 className="h-4 w-4 text-red-500" />;
      default: return <Package className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header with Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Building2 className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Branch Store Dashboard</h1>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className="bg-indigo-100 text-indigo-800">{stats.branchName}</Badge>
                    {stats.branchCode && <span className="text-sm text-gray-500">({stats.branchCode})</span>}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Quick search stock..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button onClick={fetchDashboardData} variant="outline">
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Low Stock Alert Banner */}
          {stats.lowStockItems > 0 && (
            <Card className="p-4 bg-gradient-to-r from-amber-50 to-red-50 border-amber-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-full animate-pulse">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-amber-800">Low Stock Alert!</p>
                    <p className="text-sm text-amber-700">{stats.lowStockItems} items need restocking</p>
                  </div>
                </div>
                <Link href="/dashboard/branch-store/request/new">
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                    <Send className="h-4 w-4 mr-2" />
                    Request Stock
                  </Button>
                </Link>
              </div>
            </Card>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Total Stock Items</p>
                  <p className="text-3xl font-bold text-blue-900 mt-1">{stats.totalItems}</p>
                  <Link href="/dashboard/branch-store/stock" className="text-xs text-blue-700 hover:underline mt-2 inline-block">
                    View all →
                  </Link>
                </div>
                <div className="p-3 bg-blue-200 rounded-full">
                  <Package className="h-6 w-6 text-blue-700" />
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600 font-medium">Low Stock</p>
                  <p className="text-3xl font-bold text-red-900 mt-1">{stats.lowStockItems}</p>
                  <Link href="/dashboard/branch-store/stock?filter=low" className="text-xs text-red-700 hover:underline mt-2 inline-block">
                    View items →
                  </Link>
                </div>
                <div className="p-3 bg-red-200 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-700" />
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">Incoming</p>
                  <p className="text-3xl font-bold text-purple-900 mt-1">{stats.incomingDeliveries}</p>
                  <Link href="/dashboard/branch-store/incoming" className="text-xs text-purple-700 hover:underline mt-2 inline-block">
                    Track deliveries →
                  </Link>
                </div>
                <div className="p-3 bg-purple-200 rounded-full">
                  <Truck className="h-6 w-6 text-purple-700" />
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600 font-medium">My Requests</p>
                  <p className="text-3xl font-bold text-amber-900 mt-1">{stats.pendingRequests}</p>
                  <Link href="/dashboard/branch-store/requests" className="text-xs text-amber-700 hover:underline mt-2 inline-block">
                    Track status →
                  </Link>
                </div>
                <div className="p-3 bg-amber-200 rounded-full">
                  <Clock className="h-6 w-6 text-amber-700" />
                </div>
              </div>
            </Card>
          </div>

          {/* Stock Value & Usage Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-200 rounded-full">
                  <BarChart3 className="h-6 w-6 text-emerald-700" />
                </div>
                <div>
                  <p className="text-sm text-emerald-600 font-medium">Stock Value</p>
                  <p className="text-2xl font-bold text-emerald-800">KES {stats.totalValue.toLocaleString()}</p>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-full">
                  <ArrowRightLeft className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Today's Stock Out</p>
                  <p className="text-2xl font-bold">{stats.todayStockOut}</p>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Wastage This Month</p>
                  <p className="text-2xl font-bold text-red-600">{stats.wastageThisMonth}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Link href="/dashboard/branch-store/request/new">
              <Card className="p-4 hover:bg-indigo-50 cursor-pointer transition-all border-2 border-transparent hover:border-indigo-200 hover:shadow-md">
                <div className="text-center">
                  <div className="p-3 bg-indigo-100 rounded-full w-fit mx-auto mb-2">
                    <Send className="h-5 w-5 text-indigo-600" />
                  </div>
                  <p className="font-medium text-sm">Request Stock</p>
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/branch-store/stock-out">
              <Card className="p-4 hover:bg-orange-50 cursor-pointer transition-all border-2 border-transparent hover:border-orange-200 hover:shadow-md">
                <div className="text-center">
                  <div className="p-3 bg-orange-100 rounded-full w-fit mx-auto mb-2">
                    <ArrowRightLeft className="h-5 w-5 text-orange-600" />
                  </div>
                  <p className="font-medium text-sm">Stock Out</p>
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/branch-store/kitchen-usage">
              <Card className="p-4 hover:bg-amber-50 cursor-pointer transition-all border-2 border-transparent hover:border-amber-200 hover:shadow-md">
                <div className="text-center">
                  <div className="p-3 bg-amber-100 rounded-full w-fit mx-auto mb-2">
                    <ChefHat className="h-5 w-5 text-amber-600" />
                  </div>
                  <p className="font-medium text-sm">Kitchen Usage</p>
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/branch-store/receive">
              <Card className="p-4 hover:bg-green-50 cursor-pointer transition-all border-2 border-transparent hover:border-green-200 hover:shadow-md">
                <div className="text-center">
                  <div className="p-3 bg-green-100 rounded-full w-fit mx-auto mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="font-medium text-sm">Receive Stock</p>
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/branch-store/stock-takes">
              <Card className="p-4 hover:bg-blue-50 cursor-pointer transition-all border-2 border-transparent hover:border-blue-200 hover:shadow-md">
                <div className="text-center">
                  <div className="p-3 bg-blue-100 rounded-full w-fit mx-auto mb-2">
                    <Box className="h-5 w-5 text-blue-600" />
                  </div>
                  <p className="font-medium text-sm">Stock Take</p>
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/storekeeping/wastage">
              <Card className="p-4 hover:bg-red-50 cursor-pointer transition-all border-2 border-transparent hover:border-red-200 hover:shadow-md">
                <div className="text-center">
                  <div className="p-3 bg-red-100 rounded-full w-fit mx-auto mb-2">
                    <Trash2 className="h-5 w-5 text-red-600" />
                  </div>
                  <p className="font-medium text-sm">Wastage</p>
                </div>
              </Card>
            </Link>
          </div>

          {/* Three Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Low Stock Items */}
            <Card>
              <div className="p-4 border-b flex items-center justify-between bg-red-50">
                <h2 className="font-semibold flex items-center gap-2 text-red-800">
                  <AlertTriangle className="h-5 w-5" />
                  Low Stock Items
                </h2>
                <Link href="/dashboard/branch-store/stock?filter=low" className="text-sm text-red-600 hover:underline">
                  View all
                </Link>
              </div>
              <div className="divide-y max-h-80 overflow-y-auto">
                {lowStockItems.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-300" />
                    <p className="text-green-600 font-medium">All items stocked!</p>
                  </div>
                ) : (
                  lowStockItems.map((item) => (
                    <div key={item.id} className="p-3 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{item.sku}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-red-600">{item.quantity}</p>
                          <p className="text-xs text-gray-400">Min: {item.reorder_level}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* My Requests */}
            <Card>
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <Send className="h-5 w-5 text-indigo-500" />
                  My Requests
                </h2>
                <Link href="/dashboard/branch-store/requests" className="text-sm text-indigo-600 hover:underline">
                  View all
                </Link>
              </div>
              <div className="divide-y max-h-80 overflow-y-auto">
                {myRequests.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Send className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No requests yet</p>
                    <Link href="/dashboard/branch-store/request/new">
                      <Button size="sm" className="mt-2">Create Request</Button>
                    </Link>
                  </div>
                ) : (
                  myRequests.map((request) => (
                    <div key={request.id} className="p-3 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{request.request_number}</span>
                            <Badge className={getStatusColor(request.status)} variant="outline">{request.status}</Badge>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{request.items_count} items • {formatDate(request.created_at)}</p>
                        </div>
                        <Link href={`/dashboard/branch-store/requests/${request.id}`}>
                          <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Incoming Deliveries */}
            <Card>
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <Truck className="h-5 w-5 text-purple-500" />
                  Incoming Deliveries
                </h2>
                <Link href="/dashboard/branch-store/incoming" className="text-sm text-indigo-600 hover:underline">
                  View all
                </Link>
              </div>
              <div className="divide-y max-h-80 overflow-y-auto">
                {incomingDeliveries.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Truck className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No incoming deliveries</p>
                  </div>
                ) : (
                  incomingDeliveries.map((delivery) => (
                    <div key={delivery.id} className="p-3 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{delivery.dispatch_number}</span>
                            <Badge className={getStatusColor(delivery.status)} variant="outline">{delivery.status}</Badge>
                          </div>
                          <p className="text-xs text-gray-500">From: {delivery.from_branch}</p>
                          <p className="text-xs text-gray-400">{delivery.items_count} items</p>
                        </div>
                        {delivery.status === 'DELIVERED' ? (
                          <Link href={`/dashboard/branch-store/receive/${delivery.id}`}>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700">Receive</Button>
                          </Link>
                        ) : (
                          <Link href={`/dashboard/branch-store/incoming/${delivery.id}`}>
                            <Button size="sm" variant="outline">Track</Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Reports Link */}
          <Card className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-100 rounded-lg">
                  <FileText className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-indigo-900">Branch Reports</p>
                  <p className="text-sm text-indigo-600">View stock movement, usage trends, and analytics</p>
                </div>
              </div>
              <Link href="/dashboard/branch-store/reports">
                <Button variant="outline" className="border-indigo-300 text-indigo-700 hover:bg-indigo-100">
                  View Reports
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
