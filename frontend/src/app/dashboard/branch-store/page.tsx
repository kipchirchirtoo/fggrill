'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Package, Truck, Send, Clock, CheckCircle, AlertTriangle,
  ArrowRight, RefreshCw, Building2, ArrowRightLeft, BarChart3, Box, ChefHat
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface DashboardStats {
  totalItems: number;
  lowStockItems: number;
  pendingRequests: number;
  incomingDeliveries: number;
  todayStockOut: number;
  branchName: string;
  branchCode: string;
  totalValue: number;
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
    totalValue: 0
  });
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  const [incomingDeliveries, setIncomingDeliveries] = useState<IncomingDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      // Fetch branch-specific data
      const [stockRes, requestsRes, incomingRes, branchRes] = await Promise.all([
        fetch(`${API_URL}/api/store/branch-stock`, { headers }).catch(() => null),
        fetch(`${API_URL}/api/store/stock-requests/my-requests`, { headers }).catch(() => null),
        fetch(`${API_URL}/api/store/dispatches/incoming`, { headers }).catch(() => null),
        fetch(`${API_URL}/api/store/branches/my-branch`, { headers }).catch(() => null)
      ]);

      const stock = stockRes?.ok ? await stockRes.json() : [];
      const requests = requestsRes?.ok ? await requestsRes.json() : [];
      const incoming = incomingRes?.ok ? await incomingRes.json() : [];
      const branch = branchRes?.ok ? await branchRes.json() : {};

      // Calculate stats
      const lowStock = Array.isArray(stock) ? stock.filter((i: any) => i.quantity <= (i.reorder_level || 10)).length : 0;
      const pendingReq = Array.isArray(requests) ? requests.filter((r: any) => r.status === 'PENDING' || r.status === 'APPROVED').length : 0;
      const totalVal = Array.isArray(stock) ? stock.reduce((sum: number, i: any) => sum + ((i.quantity || 0) * (i.cost_price || 0)), 0) : 0;

      setStats({
        totalItems: Array.isArray(stock) ? stock.length : 0,
        lowStockItems: lowStock,
        pendingRequests: pendingReq,
        incomingDeliveries: Array.isArray(incoming) ? incoming.length : 0,
        todayStockOut: 0, // Would need separate endpoint
        branchName: branch.name || user?.department || 'My Branch',
        branchCode: branch.code || '',
        totalValue: totalVal
      });

      // Set my requests for quick view
      if (Array.isArray(requests)) {
        setMyRequests(requests.slice(0, 5).map((r: any) => ({
          id: r.id,
          request_number: r.request_number,
          status: r.status,
          items_count: r.items?.length || 0,
          priority: r.priority || 'NORMAL',
          created_at: r.created_at
        })));
      }

      // Set incoming deliveries
      if (Array.isArray(incoming)) {
        setIncomingDeliveries(incoming.slice(0, 5).map((d: any) => ({
          id: d.id,
          dispatch_number: d.dispatch_number,
          from_branch: d.from_branch?.name || 'Central Warehouse',
          status: d.status,
          items_count: d.items?.length || 0,
          expected_delivery: d.estimated_delivery
        })));
      }

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

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">Branch Store Dashboard</h1>
                <Badge className="bg-indigo-100 text-indigo-800">{stats.branchName}</Badge>
              </div>
              <p className="text-gray-600">Welcome back, {user?.firstName}! Manage your branch inventory.</p>
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
                  <p className="text-sm text-blue-600 font-medium">My Stock Items</p>
                  <p className="text-3xl font-bold text-blue-900">{stats.totalItems}</p>
                </div>
                <Package className="h-10 w-10 text-blue-500" />
              </div>
              <Link href="/dashboard/branch-store/stock" className="text-xs text-blue-700 hover:underline mt-2 block">
                View stock →
              </Link>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600 font-medium">Low Stock</p>
                  <p className="text-3xl font-bold text-red-900">{stats.lowStockItems}</p>
                </div>
                <AlertTriangle className="h-10 w-10 text-red-500" />
              </div>
              <Link href="/dashboard/branch-store/stock?filter=low" className="text-xs text-red-700 hover:underline mt-2 block">
                Request stock →
              </Link>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">Incoming Deliveries</p>
                  <p className="text-3xl font-bold text-purple-900">{stats.incomingDeliveries}</p>
                </div>
                <Truck className="h-10 w-10 text-purple-500" />
              </div>
              <Link href="/dashboard/branch-store/incoming" className="text-xs text-purple-700 hover:underline mt-2 block">
                View incoming →
              </Link>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600 font-medium">Pending Requests</p>
                  <p className="text-3xl font-bold text-amber-900">{stats.pendingRequests}</p>
                </div>
                <Clock className="h-10 w-10 text-amber-500" />
              </div>
              <Link href="/dashboard/branch-store/requests/pending" className="text-xs text-amber-700 hover:underline mt-2 block">
                Track requests →
              </Link>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Link href="/dashboard/branch-store/request/new">
              <Card className="p-4 hover:bg-indigo-50 cursor-pointer transition-colors border-2 border-transparent hover:border-indigo-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-100 rounded-lg">
                    <Send className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Request Stock</p>
                    <p className="text-sm text-gray-500">From central warehouse</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/branch-store/kitchen-usage">
              <Card className="p-4 hover:bg-amber-50 cursor-pointer transition-colors border-2 border-transparent hover:border-amber-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-100 rounded-lg">
                    <ChefHat className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Kitchen Usage</p>
                    <p className="text-sm text-gray-500">Track consumption</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/branch-store/stock-out">
              <Card className="p-4 hover:bg-orange-50 cursor-pointer transition-colors border-2 border-transparent hover:border-orange-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <ArrowRightLeft className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Stock Out</p>
                    <p className="text-sm text-gray-500">Record usage</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/branch-store/receive">
              <Card className="p-4 hover:bg-green-50 cursor-pointer transition-colors border-2 border-transparent hover:border-green-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold">Receive Stock</p>
                    <p className="text-sm text-gray-500">Confirm deliveries</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 ml-auto" />
                </div>
              </Card>
            </Link>
            <Link href="/dashboard/branch-store/stock-takes">
              <Card className="p-4 hover:bg-blue-50 cursor-pointer transition-colors border-2 border-transparent hover:border-blue-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Box className="h-6 w-6 text-blue-600" />
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
            {/* My Requests */}
            <Card>
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2">
                  <Send className="h-5 w-5 text-indigo-500" />
                  My Stock Requests
                </h2>
                <Link href="/dashboard/branch-store/requests" className="text-sm text-indigo-600 hover:underline">
                  View all
                </Link>
              </div>
              <div className="divide-y">
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
                    <div key={request.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{request.request_number}</span>
                            <Badge className={getStatusColor(request.status)}>{request.status}</Badge>
                            <Badge className={getPriorityColor(request.priority)} variant="outline">{request.priority}</Badge>
                          </div>
                          <p className="text-xs text-gray-400">{request.items_count} items • {new Date(request.created_at).toLocaleDateString()}</p>
                        </div>
                        <Link href={`/dashboard/branch-store/requests/${request.id}`}>
                          <Button size="sm" variant="outline">View</Button>
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
              <div className="divide-y">
                {incomingDeliveries.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Truck className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No incoming deliveries</p>
                  </div>
                ) : (
                  incomingDeliveries.map((delivery) => (
                    <div key={delivery.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{delivery.dispatch_number}</span>
                            <Badge className={getStatusColor(delivery.status)}>{delivery.status}</Badge>
                          </div>
                          <p className="text-sm text-gray-500">From: {delivery.from_branch}</p>
                          <p className="text-xs text-gray-400">
                            {delivery.items_count} items 
                            {delivery.expected_delivery && ` • Expected: ${new Date(delivery.expected_delivery).toLocaleDateString()}`}
                          </p>
                        </div>
                        {delivery.status === 'DELIVERED' ? (
                          <Link href={`/dashboard/branch-store/receive/${delivery.id}`}>
                            <Button size="sm">Receive</Button>
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

          {/* Stock Value */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Branch Stock Value</p>
                  <p className="text-2xl font-bold">KES {stats.totalValue.toLocaleString()}</p>
                </div>
              </div>
              <Link href="/dashboard/branch-store/reports">
                <Button variant="outline">View Reports</Button>
              </Link>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
