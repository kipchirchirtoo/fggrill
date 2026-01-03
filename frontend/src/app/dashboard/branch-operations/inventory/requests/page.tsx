'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { branchOperationsAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  ClipboardList, RefreshCw, Check, X, Clock, Send, Filter,
  Eye, Search, ShoppingCart, Calendar, AlertCircle, Package
} from 'lucide-react';
import { formatRelative } from 'date-fns';

interface StockRequestItem {
  id: string;
  item_sku: string;
  item_name?: string;
  requested_quantity: number;
  approved_quantity?: number;
  status: string;
  rejection_reason?: string;
}

interface StockRequest {
  id: string;
  request_number: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at?: string;
  reviewed_at?: string;
  request_type: string;
  reason?: string;
  needed_by_date?: string;
  items: StockRequestItem[];
  branch?: {
    id: number;
    name: string;
  };
}

function StockRequestsPageContent() {
  const { user } = useAuth();
  const { activeBranch, activeBranchId } = useBranch();
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<StockRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Request details modal
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<StockRequest | null>(null);

  // Stats
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    fulfilled: 0,
    total: 0
  });

  // Fetch requests when branch changes
  useEffect(() => {
    if (activeBranchId) {
      fetchRequests();
    }
  }, [activeBranchId]);

  // Apply filters when search or status changes
  useEffect(() => {
    applyFilters();
  }, [requests, searchTerm, statusFilter]);

  const fetchRequests = async () => {
    if (!activeBranchId) return;

    setIsLoading(true);
    try {
      const response = await branchOperationsAPI.getStockRequests(undefined, activeBranchId);

      if (response.success) {
        const requestData = response.data || [];
        setRequests(requestData);

        // Update stats
        const newStats = {
          pending: requestData.filter((r: StockRequest) => r.status.toUpperCase() === 'PENDING' || r.status.toUpperCase() === 'UNDER_REVIEW').length,
          approved: requestData.filter((r: StockRequest) => r.status.toUpperCase() === 'APPROVED' || r.status.toUpperCase() === 'PARTIALLY_APPROVED' || r.status.toUpperCase() === 'DISPATCHED').length,
          rejected: requestData.filter((r: StockRequest) => r.status.toUpperCase() === 'REJECTED').length,
          fulfilled: requestData.filter((r: StockRequest) => r.status.toUpperCase() === 'DELIVERED' || r.status.toUpperCase() === 'FULFILLED').length,
          total: requestData.length
        };
        setStats(newStats);
      } else {
        throw new Error(response.message || 'Failed to fetch stock requests');
      }
    } catch (error) {
      console.error('Error fetching stock requests:', error);
      toast.error('Failed to load stock requests');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...requests];

    // Apply status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'PENDING') {
        filtered = filtered.filter(request => request.status.toUpperCase() === 'PENDING' || request.status.toUpperCase() === 'UNDER_REVIEW');
      } else if (statusFilter === 'APPROVED') {
        filtered = filtered.filter(request => request.status.toUpperCase() === 'APPROVED' || request.status.toUpperCase() === 'PARTIALLY_APPROVED' || request.status.toUpperCase() === 'DISPATCHED');
      } else if (statusFilter === 'DELIVERED') {
        filtered = filtered.filter(request => request.status.toUpperCase() === 'DELIVERED' || request.status.toUpperCase() === 'FULFILLED');
      } else {
        filtered = filtered.filter(request => request.status.toUpperCase() === statusFilter.toUpperCase());
      }
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(request =>
        request.request_number.toLowerCase().includes(searchLower)
      );
    }

    setFilteredRequests(filtered);
  };

  const viewRequestDetails = (request: StockRequest) => {
    setSelectedRequest(request);
    setIsDetailsModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    switch (s) {
      case 'PENDING':
      case 'UNDER_REVIEW':
        return <IOSBadge className="bg-yellow-100 text-yellow-700">Pending</IOSBadge>;
      case 'APPROVED':
      case 'PARTIALLY_APPROVED':
        return <IOSBadge className="bg-blue-100 text-blue-700">Approved</IOSBadge>;
      case 'REJECTED':
        return <IOSBadge className="bg-red-100 text-red-700">Rejected</IOSBadge>;
      case 'DELIVERED':
      case 'FULFILLED':
        return <IOSBadge className="bg-green-100 text-green-700">Fulfilled</IOSBadge>;
      case 'DISPATCHED':
        return <IOSBadge className="bg-purple-100 text-purple-700">Dispatched</IOSBadge>;
      case 'CANCELLED':
        return <IOSBadge className="bg-gray-100 text-gray-700">Cancelled</IOSBadge>;
      default:
        return <IOSBadge className="bg-gray-100 text-gray-700">{status}</IOSBadge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <IOSBadge className="bg-red-100 text-red-700">Urgent</IOSBadge>;
      case 'high':
        return <IOSBadge className="bg-orange-100 text-orange-700">High</IOSBadge>;
      case 'normal':
        return <IOSBadge className="bg-blue-100 text-blue-700">Normal</IOSBadge>;
      case 'low':
        return <IOSBadge className="bg-gray-100 text-gray-700">Low</IOSBadge>;
      default:
        return <IOSBadge className="bg-gray-100 text-gray-700">{priority}</IOSBadge>;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatRelative(date, new Date());
    } catch (error) {
      return dateString;
    }
  };

  return (
    <ProtectedRoute allowedRoles={[
      UserRole.BRANCH_OPERATIONS_MANAGER,
      UserRole.BRANCH_MANAGER,
      UserRole.BRANCH_STOREKEEPER,
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.CENTRAL_OPERATIONS_MANAGER
    ]}>
      <BranchAwareDashboardLayout
        title="Stock Requests"
        subtitle={`Manage inventory requests for ${activeBranch?.name || 'your branch'}`}
        actionButton={
          <Link href="/dashboard/branch-operations/inventory">
            <IOSButton leftIcon={<Package />}>
              Inventory
            </IOSButton>
          </Link>
        }
      >
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <IOSCard className="p-4">
              <ClipboardList className="h-5 w-5 text-gray-600 mb-2" />
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-lg font-bold">{stats.total}</p>
            </IOSCard>

            <IOSCard className="p-4">
              <Clock className="h-5 w-5 text-yellow-600 mb-2" />
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-lg font-bold text-yellow-600">{stats.pending}</p>
            </IOSCard>

            <IOSCard className="p-4">
              <Check className="h-5 w-5 text-blue-600 mb-2" />
              <p className="text-sm text-gray-500">Approved</p>
              <p className="text-lg font-bold text-blue-600">{stats.approved}</p>
            </IOSCard>

            <IOSCard className="p-4">
              <X className="h-5 w-5 text-red-600 mb-2" />
              <p className="text-sm text-gray-500">Rejected</p>
              <p className="text-lg font-bold text-red-600">{stats.rejected}</p>
            </IOSCard>

            <IOSCard className="p-4">
              <Send className="h-5 w-5 text-green-600 mb-2" />
              <p className="text-sm text-gray-500">Fulfilled</p>
              <p className="text-lg font-bold text-green-600">{stats.fulfilled}</p>
            </IOSCard>
          </div>

          {/* Search and Filter */}
          <IOSCard className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <Input
                  placeholder="Search by request number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
                >
                  <option value="all">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="DELIVERED">Fulfilled</option>
                  <option value="DISPATCHED">Dispatched</option>
                </select>
              </div>

              <div>
                <IOSButton
                  onClick={fetchRequests}
                  leftIcon={<RefreshCw />}
                  className="w-full"
                >
                  Refresh
                </IOSButton>
              </div>
            </div>
          </IOSCard>

          {/* Requests Table */}
          <IOSCard>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Priority</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center">
                        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                      </td>
                    </tr>
                  ) : filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center">
                        <div className="flex flex-col items-center">
                          <ClipboardList className="h-12 w-12 text-gray-300 mb-2" />
                          <p className="text-gray-500">No stock requests found</p>
                          <Link href="/dashboard/branch-operations/inventory" className="mt-2">
                            <IOSButton size="sm" variant="outline" leftIcon={<ShoppingCart />}>
                              Create Request
                            </IOSButton>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((request) => (
                      <tr key={request.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 font-mono text-sm">
                          {request.request_number}
                        </td>
                        <td className="px-4 py-4 capitalize">
                          {request.request_type || 'standard'}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {getStatusBadge(request.status)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {getPriorityBadge(request.priority)}
                        </td>
                        <td className="px-4 py-4 text-right font-medium">
                          {request.items?.length || 0} items
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">
                          {formatDate(request.created_at)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <IOSButton
                            size="sm"
                            variant="secondary"
                            onClick={() => viewRequestDetails(request)}
                            leftIcon={<Eye />}
                          >
                            Details
                          </IOSButton>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </IOSCard>
        </div>

        {/* Request Details Modal */}
        <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Stock Request Details</DialogTitle>
            </DialogHeader>

            {selectedRequest && (
              <div className="space-y-6 mt-4">
                {/* Request Header */}
                <div className="flex flex-col md:flex-row justify-between gap-4 pb-4 border-b">
                  <div>
                    <h3 className="text-lg font-bold">{selectedRequest.request_number}</h3>
                    <p className="text-sm text-gray-500">
                      Created {formatDate(selectedRequest.created_at)}
                    </p>
                    {selectedRequest.needed_by_date && (
                      <p className="text-sm mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Needed by: {new Date(selectedRequest.needed_by_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 items-start">
                    {getStatusBadge(selectedRequest.status)}
                    {getPriorityBadge(selectedRequest.priority)}
                  </div>
                </div>

                {/* Request Notes */}
                {selectedRequest.reason && (
                  <div className="p-3 bg-gray-50 rounded-ios-lg">
                    <p className="text-sm font-medium text-gray-700 mb-1">Notes:</p>
                    <p className="text-sm text-gray-600">{selectedRequest.reason}</p>
                  </div>
                )}

                {/* Items Table */}
                <div>
                  <h3 className="font-medium mb-3">Requested Items</h3>
                  <table className="w-full">
                    <thead className="bg-gray-50 text-xs">
                      <tr>
                        <th className="px-2 py-2 text-left font-medium text-gray-500">Item</th>
                        <th className="px-2 py-2 text-left font-medium text-gray-500">SKU</th>
                        <th className="px-2 py-2 text-right font-medium text-gray-500">Requested</th>
                        <th className="px-2 py-2 text-right font-medium text-gray-500">Approved</th>
                        <th className="px-2 py-2 text-center font-medium text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-sm">
                      {selectedRequest.items.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-2 py-3 font-medium">
                            {item.item_name || 'Unknown Item'}
                          </td>
                          <td className="px-2 py-3 font-mono">
                            {item.item_sku}
                          </td>
                          <td className="px-2 py-3 text-right">
                            {item.requested_quantity}
                          </td>
                          <td className="px-2 py-3 text-right">
                            {item.approved_quantity !== undefined ? item.approved_quantity : '-'}
                          </td>
                          <td className="px-2 py-3 text-center">
                            {item.status === 'APPROVED' ? (
                              <Check className="h-4 w-4 text-green-600 inline" />
                            ) : item.status === 'REJECTED' ? (
                              <div className="flex items-center justify-center">
                                <X className="h-4 w-4 text-red-600" />
                                {item.rejection_reason && (
                                  <span className="relative ml-1 group">
                                    <AlertCircle className="h-3 w-3 text-gray-400" />
                                    <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-xs p-1 rounded">
                                      {item.rejection_reason}
                                    </span>
                                  </span>
                                )}
                              </div>
                            ) : item.status === 'PARTIALLY_APPROVED' ? (
                              <span className="text-yellow-600 text-xs">Partial</span>
                            ) : (
                              <span className="text-gray-400 text-xs">Pending</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <IOSButton
                    variant="secondary"
                    onClick={() => setIsDetailsModalOpen(false)}
                  >
                    Close
                  </IOSButton>
                  <Link href="/dashboard/branch-operations/inventory">
                    <IOSButton leftIcon={<ShoppingCart />}>
                      New Request
                    </IOSButton>
                  </Link>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

// Export a wrapper component that provides BranchContext
export default function StockRequestsPage() {
  return (
    <BranchPageWrapper>
      <StockRequestsPageContent />
    </BranchPageWrapper>
  );
}
