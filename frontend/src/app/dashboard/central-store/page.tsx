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
  Warehouse, Package, Truck, Send, Clock, CheckCircle, AlertTriangle,
  ArrowRight, RefreshCw, Building2, Users, BarChart3, XCircle,
  Search, ShoppingCart, FileText, ClipboardCheck, Trash2, Eye,
  TrendingUp, TrendingDown, Calendar, ArrowUpRight, ArrowDownRight,
  Plus, MapPin, Phone
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { formatDate } from '@/lib/date-utils';
import { storeAPI } from '@/lib/api';

interface DashboardStats {
  totalItems: number;
  lowStockItems: number;
  pendingRequests: number;
  pendingDispatches: number;
  inTransitDispatches: number;
  totalBranches: number;
  todayDispatches: number;
  totalValue: number;
  thisMonthDispatches: number;
  pendingPOs: number;
  pendingGRNs: number;
}

interface PendingRequest {
  id: string;
  request_number: string;
  branch_name: string;
  branch_code: string;
  items_count: number;
  priority: string;
  created_at: string;
}

interface RecentDispatch {
  id: string;
  dispatch_number: string;
  to_branch: string;
  status: string;
  items_count: number;
  created_at: string;
}

interface LowStockItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  reorder_level: number;
}

interface BranchSummary {
  id: number;
  name: string;
  code: string;
  totalItems: number;
  lowStockCount: number;
  pendingRequests: number;
}

export default function CentralStoreDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    lowStockItems: 0,
    pendingRequests: 0,
    pendingDispatches: 0,
    inTransitDispatches: 0,
    totalBranches: 0,
    todayDispatches: 0,
    totalValue: 0,
    thisMonthDispatches: 0,
    pendingPOs: 0,
    pendingGRNs: 0
  });
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [recentDispatches, setRecentDispatches] = useState<RecentDispatch[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [branchSummaries, setBranchSummaries] = useState<BranchSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    
    try {
      const [itemsRes, requestsRes, dispatchesRes, branchesRes] = await Promise.all([
        storeAPI.getItems().catch((err) => { console.error('Items error:', err); return { items: [] }; }),
        storeAPI.getPendingRequests().catch((err) => { console.error('Requests error:', err); return { requests: [] }; }),
        storeAPI.getDispatchHistory().catch((err) => { console.error('Dispatches error:', err); return { dispatches: [] }; }),
        storeAPI.getBranches().catch((err) => { console.error('Branches error:', err); return { branches: [] }; })
      ]);

      const items = itemsRes.items || itemsRes.data || itemsRes || [];
      const requests = requestsRes.requests || requestsRes.data || requestsRes || [];
      const dispatches = dispatchesRes.dispatches || dispatchesRes.data || dispatchesRes || [];
      const branches = branchesRes.branches || branchesRes.data || branchesRes || [];

      const itemsArray = Array.isArray(items) ? items : [];
      const dispatchesArray = Array.isArray(dispatches) ? dispatches : [];
      const branchesArray = Array.isArray(branches) ? branches : [];
      const requestsArray = Array.isArray(requests) ? requests : [];

      const lowStock = itemsArray.filter((i: any) => i.quantity <= (i.reorder_level || i.min_level || 10));
      const pendingDisp = dispatchesArray.filter((d: any) => d.status === 'PENDING' || d.status === 'PREPARING').length;
      const inTransit = dispatchesArray.filter((d: any) => d.status === 'IN_TRANSIT' || d.status === 'in_transit').length;
      const today = new Date().toDateString();
      const todayDisp = dispatchesArray.filter((d: any) => new Date(d.created_at).toDateString() === today).length;
      const totalVal = itemsArray.reduce((sum: number, i: any) => sum + ((i.quantity || 0) * (i.cost_price || i.unit_cost || 0)), 0);

      // This month dispatches
      const now = new Date();
      const thisMonthDisp = dispatchesArray.filter((d: any) => {
        const date = new Date(d.created_at);
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }).length;

      setStats({
        totalItems: itemsArray.length,
        lowStockItems: lowStock.length,
        pendingRequests: requestsArray.length,
        pendingDispatches: pendingDisp,
        inTransitDispatches: inTransit,
        totalBranches: branchesArray.filter((b: any) => !b.is_central_warehouse).length,
        todayDispatches: todayDisp,
        totalValue: totalVal,
        thisMonthDispatches: thisMonthDisp,
        pendingPOs: 0,
        pendingGRNs: 0
      });

      // Set low stock items
      setLowStockItems(lowStock.slice(0, 5).map((i: any) => ({
        id: i.id,
        name: i.name || 'Unknown',
        sku: i.sku || '',
        quantity: i.quantity || 0,
        reorder_level: i.reorder_level || 10
      })));

      // Set pending requests for quick view
      setPendingRequests(requestsArray.slice(0, 5).map((r: any) => ({
        id: r.id,
        request_number: r.request_number,
        branch_name: r.branch?.name || 'Unknown',
        branch_code: r.branch?.code || '',
        items_count: r.items?.length || 0,
        priority: r.priority || 'NORMAL',
        created_at: r.created_at
      })));

      // Set recent dispatches
      setRecentDispatches(dispatchesArray.slice(0, 5).map((d: any) => ({
        id: d.id,
        dispatch_number: d.dispatch_number,
        to_branch: d.to_branch?.name || 'Unknown',
        status: d.status,
        items_count: d.items?.length || 0,
        created_at: d.created_at
      })));

      // Set branch summaries
      setBranchSummaries(branchesArray.filter((b: any) => !b.is_central_warehouse).slice(0, 6).map((b: any) => ({
        id: b.id,
        name: b.name,
        code: b.code,
        totalItems: b.stock_count || 0,
        lowStockCount: b.low_stock_count || 0,
        pendingRequests: requestsArray.filter((r: any) => r.branch_id === b.id).length
      })));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-amber-100 text-amber-800',
      PREPARING: 'bg-blue-100 text-blue-800',
      IN_TRANSIT: 'bg-purple-100 text-purple-800',
      DELIVERED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Warehouse className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Central Warehouse Dashboard</h1>
                  <p className="text-gray-600">Welcome back, {user?.firstName}! Manage inventory and fulfill branch requests.</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search items..."
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

          {/* Pending Requests Alert */}
          {stats.pendingRequests > 0 && (
            <Card className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-full animate-pulse">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-amber-800">Pending Branch Requests</p>
                    <p className="text-sm text-amber-700">{stats.pendingRequests} requests awaiting review</p>
                  </div>
                </div>
                <Link href="/dashboard/central-store/requests">
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700">
                    Review Now
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </Card>
          )}

          {/* Main Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-5 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Total Items</p>
                  <p className="text-3xl font-bold text-blue-900 mt-1">{stats.totalItems}</p>
                  <Link href="/dashboard/central-store/inventory" className="text-xs text-blue-700 hover:underline mt-2 inline-block">
                    Manage inventory →
                  </Link>
                </div>
                <div className="p-3 bg-blue-200 rounded-full">
                  <Package className="h-6 w-6 text-blue-700" />
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600 font-medium">Pending Requests</p>
                  <p className="text-3xl font-bold text-amber-900 mt-1">{stats.pendingRequests}</p>
                  <Link href="/dashboard/central-store/requests" className="text-xs text-amber-700 hover:underline mt-2 inline-block">
                    Review all →
                  </Link>
                </div>
                <div className="p-3 bg-amber-200 rounded-full">
                  <Clock className="h-6 w-6 text-amber-700" />
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">In Transit</p>
                  <p className="text-3xl font-bold text-purple-900 mt-1">{stats.inTransitDispatches}</p>
                  <Link href="/dashboard/central-store/dispatch/transit" className="text-xs text-purple-700 hover:underline mt-2 inline-block">
                    Track deliveries →
                  </Link>
                </div>
                <div className="p-3 bg-purple-200 rounded-full">
                  <Truck className="h-6 w-6 text-purple-700" />
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600 font-medium">Low Stock</p>
                  <p className="text-3xl font-bold text-red-900 mt-1">{stats.lowStockItems}</p>
                  <Link href="/dashboard/central-store/inventory?filter=low" className="text-xs text-red-700 hover:underline mt-2 inline-block">
                    Order stock →
                  </Link>
                </div>
                <div className="p-3 bg-red-200 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-red-700" />
                </div>
              </div>
            </Card>
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-full">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Today's Dispatches</p>
                  <p className="text-xl font-bold">{stats.todayDispatches}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-full">
                  <Building2 className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Active Branches</p>
                  <p className="text-xl font-bold">{stats.totalBranches}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Send className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Pending Dispatches</p>
                  <p className="text-xl font-bold">{stats.pendingDispatches}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-full">
                  <BarChart3 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Stock Value</p>
                  <p className="text-lg font-bold">KES {(stats.totalValue / 1000000).toFixed(1)}M</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-full">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">This Month</p>
                  <p className="text-xl font-bold">{stats.thisMonthDispatches} dispatches</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Link href="/dashboard/central-store/dispatch/new">
              <Card className="p-4 hover:bg-indigo-50 cursor-pointer transition-all border-2 border-transparent hover:border-indigo-200 hover:shadow-md">
                <div className="text-center">
                  <div className="p-3 bg-indigo-100 rounded-full w-fit mx-auto mb-2">
                    <Send className="h-5 w-5 text-indigo-600" />
                  </div>
                  <p className="font-medium text-sm">Create Dispatch</p>
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/central-store/requests">
              <Card className="p-4 hover:bg-amber-50 cursor-pointer transition-all border-2 border-transparent hover:border-amber-200 hover:shadow-md">
                <div className="text-center">
                  <div className="p-3 bg-amber-100 rounded-full w-fit mx-auto mb-2">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <p className="font-medium text-sm">Review Requests</p>
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/storekeeping/purchase-orders">
              <Card className="p-4 hover:bg-blue-50 cursor-pointer transition-all border-2 border-transparent hover:border-blue-200 hover:shadow-md">
                <div className="text-center">
                  <div className="p-3 bg-blue-100 rounded-full w-fit mx-auto mb-2">
                    <ShoppingCart className="h-5 w-5 text-blue-600" />
                  </div>
                  <p className="font-medium text-sm">Purchase Orders</p>
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/storekeeping/grn">
              <Card className="p-4 hover:bg-green-50 cursor-pointer transition-all border-2 border-transparent hover:border-green-200 hover:shadow-md">
                <div className="text-center">
                  <div className="p-3 bg-green-100 rounded-full w-fit mx-auto mb-2">
                    <ClipboardCheck className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="font-medium text-sm">Goods Received</p>
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/central-store/stock-takes">
              <Card className="p-4 hover:bg-purple-50 cursor-pointer transition-all border-2 border-transparent hover:border-purple-200 hover:shadow-md">
                <div className="text-center">
                  <div className="p-3 bg-purple-100 rounded-full w-fit mx-auto mb-2">
                    <FileText className="h-5 w-5 text-purple-600" />
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
            {/* Pending Requests */}
            <Card>
              <div className="p-4 border-b flex items-center justify-between bg-amber-50">
                <h2 className="font-semibold flex items-center gap-2 text-amber-800">
                  <Clock className="h-5 w-5" />
                  Branch Requests
                </h2>
                <Link href="/dashboard/central-store/requests" className="text-sm text-amber-600 hover:underline">
                  View all
                </Link>
              </div>
              <div className="divide-y max-h-80 overflow-y-auto">
                {pendingRequests.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-300" />
                    <p className="text-green-600 font-medium">All caught up!</p>
                  </div>
                ) : (
                  pendingRequests.map((request) => (
                    <div key={request.id} className="p-3 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{request.request_number}</span>
                            <Badge className={getPriorityColor(request.priority)} variant="outline">{request.priority}</Badge>
                          </div>
                          <p className="text-sm text-gray-600">{request.branch_name}</p>
                          <p className="text-xs text-gray-400">{request.items_count} items • {formatDate(request.created_at)}</p>
                        </div>
                        <Link href={`/dashboard/central-store/requests/${request.id}`}>
                          <Button size="sm">Review</Button>
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Recent Dispatches */}
            <Card>
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <Truck className="h-5 w-5 text-purple-500" />
                  Recent Dispatches
                </h2>
                <Link href="/dashboard/central-store/dispatch" className="text-sm text-indigo-600 hover:underline">
                  View all
                </Link>
              </div>
              <div className="divide-y max-h-80 overflow-y-auto">
                {recentDispatches.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Truck className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No dispatches yet</p>
                    <Link href="/dashboard/central-store/dispatch/new">
                      <Button size="sm" className="mt-2">Create Dispatch</Button>
                    </Link>
                  </div>
                ) : (
                  recentDispatches.map((dispatch) => (
                    <div key={dispatch.id} className="p-3 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{dispatch.dispatch_number}</span>
                            <Badge className={getStatusColor(dispatch.status)} variant="outline">{dispatch.status}</Badge>
                          </div>
                          <p className="text-sm text-gray-600">To: {dispatch.to_branch}</p>
                          <p className="text-xs text-gray-400">{dispatch.items_count} items • {formatDate(dispatch.created_at)}</p>
                        </div>
                        <Link href={`/dashboard/central-store/dispatch/${dispatch.id}`}>
                          <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Low Stock Items */}
            <Card>
              <div className="p-4 border-b flex items-center justify-between bg-red-50">
                <h2 className="font-semibold flex items-center gap-2 text-red-800">
                  <AlertTriangle className="h-5 w-5" />
                  Low Stock Items
                </h2>
                <Link href="/dashboard/central-store/inventory?filter=low" className="text-sm text-red-600 hover:underline">
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
          </div>

          {/* Branch Overview */}
          <Card>
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-500" />
                Branch Overview
              </h2>
              <Link href="/dashboard/storekeeping/branch" className="text-sm text-indigo-600 hover:underline">
                View all branches
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {branchSummaries.length === 0 ? (
                <div className="col-span-full p-8 text-center text-gray-500">
                  <Building2 className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No branches found</p>
                </div>
              ) : (
                branchSummaries.map((branch) => (
                  <Card key={branch.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{branch.name}</h3>
                        <p className="text-xs text-gray-500 font-mono">{branch.code}</p>
                      </div>
                      {branch.pendingRequests > 0 && (
                        <Badge className="bg-amber-100 text-amber-700">{branch.pendingRequests} pending</Badge>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Package className="h-4 w-4 text-blue-500" />
                        <span>{branch.totalItems} items</span>
                      </div>
                      {branch.lowStockCount > 0 && (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span>{branch.lowStockCount} low</span>
                        </div>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </Card>

          {/* Supplier Links */}
          <Card className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 rounded-lg">
                  <Users className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-900">Supplier Management</p>
                  <p className="text-sm text-emerald-600">Manage vendors, create purchase orders, and track deliveries</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href="/dashboard/storekeeping/suppliers">
                  <Button variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-100">
                    Suppliers
                  </Button>
                </Link>
                <Link href="/dashboard/storekeeping/purchase-orders">
                  <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="h-4 w-4 mr-2" />
                    New PO
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
