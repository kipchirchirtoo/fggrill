'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Warehouse, Package, Truck, Send, Clock, CheckCircle, AlertTriangle,
  ArrowRight, RefreshCw, Building2, Users, BarChart3, XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface DashboardStats {
  totalItems: number;
  lowStockItems: number;
  pendingRequests: number;
  pendingDispatches: number;
  inTransitDispatches: number;
  totalBranches: number;
  todayDispatches: number;
  totalValue: number;
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
    totalValue: 0
  });
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [recentDispatches, setRecentDispatches] = useState<RecentDispatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch stats
      const [itemsRes, requestsRes, dispatchesRes, branchesRes] = await Promise.all([
        fetch(`${API_URL}/api/store/items`, { headers }).catch(() => null),
        fetch(`${API_URL}/api/store/stock-requests/pending`, { headers }).catch(() => null),
        fetch(`${API_URL}/api/store/dispatches`, { headers }).catch(() => null),
        fetch(`${API_URL}/api/store/branches`, { headers }).catch(() => null)
      ]);

      const items = itemsRes?.ok ? await itemsRes.json() : [];
      const requests = requestsRes?.ok ? await requestsRes.json() : [];
      const dispatches = dispatchesRes?.ok ? await dispatchesRes.json() : [];
      const branches = branchesRes?.ok ? await branchesRes.json() : [];

      // Calculate stats
      const lowStock = Array.isArray(items) ? items.filter((i: any) => i.quantity <= (i.reorder_level || 10)).length : 0;
      const pendingDisp = Array.isArray(dispatches) ? dispatches.filter((d: any) => d.status === 'PENDING' || d.status === 'PREPARING').length : 0;
      const inTransit = Array.isArray(dispatches) ? dispatches.filter((d: any) => d.status === 'IN_TRANSIT').length : 0;
      const todayDisp = Array.isArray(dispatches) ? dispatches.filter((d: any) => {
        const today = new Date().toDateString();
        return new Date(d.created_at).toDateString() === today;
      }).length : 0;
      const totalVal = Array.isArray(items) ? items.reduce((sum: number, i: any) => sum + ((i.quantity || 0) * (i.cost_price || 0)), 0) : 0;

      setStats({
        totalItems: Array.isArray(items) ? items.length : 0,
        lowStockItems: lowStock,
        pendingRequests: Array.isArray(requests) ? requests.length : 0,
        pendingDispatches: pendingDisp,
        inTransitDispatches: inTransit,
        totalBranches: Array.isArray(branches) ? branches.filter((b: any) => !b.is_central_warehouse).length : 0,
        todayDispatches: todayDisp,
        totalValue: totalVal
      });

      // Set pending requests for quick view
      if (Array.isArray(requests)) {
        setPendingRequests(requests.slice(0, 5).map((r: any) => ({
          id: r.id,
          request_number: r.request_number,
          branch_name: r.branch?.name || 'Unknown',
          branch_code: r.branch?.code || '',
          items_count: r.items?.length || 0,
          priority: r.priority || 'NORMAL',
          created_at: r.created_at
        })));
      }

      // Set recent dispatches
      if (Array.isArray(dispatches)) {
        setRecentDispatches(dispatches.slice(0, 5).map((d: any) => ({
          id: d.id,
          dispatch_number: d.dispatch_number,
          to_branch: d.to_branch?.name || 'Unknown',
          status: d.status,
          items_count: d.items?.length || 0,
          created_at: d.created_at
        })));
      }

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Central Warehouse Dashboard</h1>
              <p className="text-gray-600">Welcome back, {user?.firstName}! Manage inventory and fulfill branch requests.</p>
            </div>
            <Button onClick={fetchDashboardData} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Total Items</p>
                  <p className="text-3xl font-bold text-blue-900">{stats.totalItems}</p>
                </div>
                <Package className="h-10 w-10 text-blue-500" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600 font-medium">Pending Requests</p>
                  <p className="text-3xl font-bold text-amber-900">{stats.pendingRequests}</p>
                </div>
                <Clock className="h-10 w-10 text-amber-500" />
              </div>
              <Link href="/dashboard/central-store/requests" className="text-xs text-amber-700 hover:underline mt-2 block">
                View all requests →
              </Link>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">In Transit</p>
                  <p className="text-3xl font-bold text-purple-900">{stats.inTransitDispatches}</p>
                </div>
                <Truck className="h-10 w-10 text-purple-500" />
              </div>
              <Link href="/dashboard/central-store/dispatch/transit" className="text-xs text-purple-700 hover:underline mt-2 block">
                Track deliveries →
              </Link>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600 font-medium">Low Stock Items</p>
                  <p className="text-3xl font-bold text-red-900">{stats.lowStockItems}</p>
                </div>
                <AlertTriangle className="h-10 w-10 text-red-500" />
              </div>
              <Link href="/dashboard/central-store/inventory?filter=low" className="text-xs text-red-700 hover:underline mt-2 block">
                View low stock →
              </Link>
            </Card>
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Today's Dispatches</p>
                  <p className="text-xl font-bold">{stats.todayDispatches}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Building2 className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Active Branches</p>
                  <p className="text-xl font-bold">{stats.totalBranches}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Send className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pending Dispatches</p>
                  <p className="text-xl font-bold">{stats.pendingDispatches}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Stock Value</p>
                  <p className="text-xl font-bold">KES {stats.totalValue.toLocaleString()}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link href="/dashboard/central-store/dispatch/new">
              <Card className="p-4 hover:bg-indigo-50 cursor-pointer transition-colors border-2 border-transparent hover:border-indigo-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-100 rounded-lg">
                    <Send className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Create Dispatch</p>
                    <p className="text-sm text-gray-500">Send stock to branches</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/central-store/requests">
              <Card className="p-4 hover:bg-amber-50 cursor-pointer transition-colors border-2 border-transparent hover:border-amber-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-100 rounded-lg">
                    <Clock className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Review Requests</p>
                    <p className="text-sm text-gray-500">{stats.pendingRequests} pending</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/central-store/inventory">
              <Card className="p-4 hover:bg-blue-50 cursor-pointer transition-colors border-2 border-transparent hover:border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Package className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Manage Inventory</p>
                    <p className="text-sm text-gray-500">{stats.totalItems} items</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/central-store/stock-takes">
              <Card className="p-4 hover:bg-green-50 cursor-pointer transition-colors border-2 border-transparent hover:border-green-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Stock Take</p>
                    <p className="text-sm text-gray-500">Physical count</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
                </div>
              </Card>
            </Link>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending Requests */}
            <Card>
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  Pending Branch Requests
                </h2>
                <Link href="/dashboard/central-store/requests" className="text-sm text-indigo-600 hover:underline">
                  View all
                </Link>
              </div>
              <div className="divide-y">
                {pendingRequests.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-300" />
                    <p>No pending requests</p>
                  </div>
                ) : (
                  pendingRequests.map((request) => (
                    <div key={request.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{request.request_number}</span>
                            <Badge className={getPriorityColor(request.priority)}>{request.priority}</Badge>
                          </div>
                          <p className="text-sm text-gray-500">{request.branch_name} ({request.branch_code})</p>
                          <p className="text-xs text-gray-400">{request.items_count} items • {new Date(request.created_at).toLocaleDateString()}</p>
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
              <div className="divide-y">
                {recentDispatches.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Truck className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No dispatches yet</p>
                  </div>
                ) : (
                  recentDispatches.map((dispatch) => (
                    <div key={dispatch.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{dispatch.dispatch_number}</span>
                            <Badge className={getStatusColor(dispatch.status)}>{dispatch.status}</Badge>
                          </div>
                          <p className="text-sm text-gray-500">To: {dispatch.to_branch}</p>
                          <p className="text-xs text-gray-400">{dispatch.items_count} items • {new Date(dispatch.created_at).toLocaleDateString()}</p>
                        </div>
                        <Link href={`/dashboard/central-store/dispatch/${dispatch.id}`}>
                          <Button size="sm" variant="outline">View</Button>
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
