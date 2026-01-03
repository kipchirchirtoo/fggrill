'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { centralOperationsAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import {
  ClipboardList, Search, Filter, RefreshCw,
  ArrowRight, FileCheck, XOctagon, AlertTriangle,
  TruckIcon, Clock
} from 'lucide-react';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { format } from 'date-fns';
import { DispatchModal } from '@/components/dispatch/DispatchModal';

// Request type
interface RequestItem {
  id: string;
  item_sku: string;
  item_name?: string;
  requested_quantity: number;
  approved_quantity?: number;
  unit?: string;
  item?: {
    item_name?: string;
    unit?: string;
  };
}

interface WarehouseRequest {
  id: string;
  request_number: string;
  requesting_branch_id: number;
  branch_name?: string;
  request_type: 'REPLENISHMENT' | 'SPECIAL_ORDER' | 'EMERGENCY';
  status: 'PENDING' | 'REVIEWED' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'DISPATCHED' | 'RECEIVED' | 'CANCELLED' | 'REJECTED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  reason?: string;
  needed_by_date?: string;
  items: RequestItem[];
  created_at: string;
  updated_at: string;
}

function WarehouseRequestsContent() {
  const { user } = useAuth();
  const { branches } = useBranch();
  const [requests, setRequests] = useState<WarehouseRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<WarehouseRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<WarehouseRequest | null>(null);
  const [requestDetails, setRequestDetails] = useState<WarehouseRequest | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);

  // Fetch requests on mount
  useEffect(() => {
    fetchRequests();
  }, []);

  // Filter requests when filters change
  useEffect(() => {
    filterRequests();
  }, [requests, searchQuery, selectedBranch, selectedStatus, selectedPriority]);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const response = await centralOperationsAPI.getAllRequests();

      if (response.success) {
        setRequests(response.data || []);
      } else {
        setRequests([]);
        toast.error(response.message || 'Failed to fetch requests');
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to load requests data');
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filterRequests = () => {
    let filtered = [...requests];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(request =>
        request.request_number.toLowerCase().includes(query) ||
        request.branch_name?.toLowerCase().includes(query) ||
        (request.reason && request.reason.toLowerCase().includes(query)) ||
        request.items.some(item => (item.item_name && item.item_name.toLowerCase().includes(query)) || item.item_sku.toLowerCase().includes(query))
      );
    }

    // Filter by branch
    if (selectedBranch !== 'all') {
      filtered = filtered.filter(request => request.requesting_branch_id === parseInt(selectedBranch));
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(request => request.status === selectedStatus);
    }

    // Filter by priority
    if (selectedPriority !== 'all') {
      filtered = filtered.filter(request => request.priority === selectedPriority);
    }

    setFilteredRequests(filtered);
  };

  const handleViewDetails = (request: WarehouseRequest) => {
    setRequestDetails(request);
    setShowDetailsModal(true);
  };

  const handleReview = async (id: string, action: 'approve' | 'reject', notes: string = '') => {
    setIsReviewing(true);
    try {
      let response;
      if (action === 'approve') {
        response = await centralOperationsAPI.approveRequest(id, { notes });
      } else {
        response = await centralOperationsAPI.rejectRequest(id, { notes });
      }

      if (response.success) {
        toast.success(`Request ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
        setShowDetailsModal(false);
        fetchRequests();
      } else {
        toast.error(response.message || `Failed to ${action} request`);
      }
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
      toast.error(`Failed to ${action} request`);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleCreateDispatch = (request: WarehouseRequest) => {
    setSelectedRequest(request);
    setDispatchModalOpen(true);
  };

  const handleDispatchSuccess = () => {
    fetchRequests();
    // Navigate to dispatches page
    window.location.href = '/dashboard/central-operations/warehouse/dispatches';
  };

  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'warning';
      case 'REVIEWED': return 'info';
      case 'APPROVED': return 'success';
      case 'PARTIALLY_APPROVED': return 'success';
      case 'DISPATCHED': return 'info';
      case 'RECEIVED': return 'success';
      case 'CANCELLED': return 'secondary';
      case 'REJECTED': return 'danger';
      default: return 'secondary';
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'danger';
      case 'HIGH': return 'warning';
      case 'NORMAL': return 'info';
      case 'LOW': return 'secondary';
      default: return 'secondary';
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.CENTRAL_OPERATIONS_MANAGER, UserRole.CENTRAL_STOREKEEPER]}>
      <BranchAwareDashboardLayout
        title="Warehouse Requests"
        subtitle="Manage inventory requests from branches"
        requireBranchContext={false}
        actionButton={
          <div className="flex space-x-2">
            <IOSButton
              variant="secondary"
              onClick={fetchRequests}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </IOSButton>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <ClipboardList className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Requests</p>
                  <p className="text-lg font-semibold">{filteredRequests.length}</p>
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Clock className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-lg font-semibold">{filteredRequests.filter(r => r.status === 'PENDING').length}</p>
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <FileCheck className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Approved</p>
                  <p className="text-lg font-semibold">{filteredRequests.filter(r => ['APPROVED', 'PARTIALLY_APPROVED'].includes(r.status)).length}</p>
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <XOctagon className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Rejected</p>
                  <p className="text-lg font-semibold">{filteredRequests.filter(r => r.status === 'REJECTED').length}</p>
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Search and Filter */}
          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by ID, branch, or requested by"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-ios-lg text-sm"
                />
              </div>

              <div className="flex space-x-4">
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                  <select
                    value={selectedBranch}
                    onChange={(e) => setSelectedBranch(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-gray-200 rounded-ios-lg text-sm appearance-none bg-white"
                  >
                    <option value="all">All Branches</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-gray-200 rounded-ios-lg text-sm appearance-none bg-white"
                  >
                    <option value="all">All Statuses</option>
                    <option value="PENDING">Pending</option>
                    <option value="REVIEWED">Reviewed</option>
                    <option value="APPROVED">Approved</option>
                    <option value="DISPATCHED">Dispatched</option>
                    <option value="RECEIVED">Received</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>

                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                  <select
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-gray-200 rounded-ios-lg text-sm appearance-none bg-white"
                  >
                    <option value="all">All Priorities</option>
                    <option value="URGENT">Urgent</option>
                    <option value="HIGH">High</option>
                    <option value="NORMAL">Normal</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>
            </div>
          </IOSCard>

          {/* Requests Table */}
          <IOSCard className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Request #</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Branch</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Needed By</th>
                    <th className="text-center p-4 text-sm font-medium text-gray-600">Status</th>
                    <th className="text-center p-4 text-sm font-medium text-gray-600">Priority</th>
                    <th className="text-center p-4 text-sm font-medium text-gray-600">Items</th>
                    <th className="text-center p-4 text-sm font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-center">
                        <div className="flex justify-center items-center py-8">
                          <RefreshCw className="h-5 w-5 text-gray-400 animate-spin" />
                          <span className="ml-2 text-gray-500">Loading requests...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-center">
                        <div className="py-8">
                          <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                          <p className="text-gray-500">No requests found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((request) => (
                      <tr key={request.id} className="border-b hover:bg-gray-50">
                        <td className="p-4 text-sm font-medium">{request.request_number}</td>
                        <td className="p-4 text-sm">{request.branch_name}</td>
                        <td className="p-4 text-sm">{
                          request.needed_by_date ? new Date(request.needed_by_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }) : '-'
                        }</td>
                        <td className="p-4 text-center">
                          <IOSBadge color={getBadgeColor(request.status)}>
                            {request.status.replace('_', ' ')}
                          </IOSBadge>
                        </td>
                        <td className="p-4 text-center">
                          <IOSBadge color={getPriorityBadgeColor(request.priority)}>
                            {request.priority}
                          </IOSBadge>
                        </td>
                        <td className="p-4 text-center text-sm">{request.items?.length || 0}</td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center space-x-2">
                            <IOSButton
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(request)}
                            >
                              View
                            </IOSButton>
                            {request.status === 'PENDING' && (
                              <>
                                <IOSButton
                                  variant="ghost"
                                  color="success"
                                  size="sm"
                                  onClick={() => handleReview(request.id, 'approve')}
                                >
                                  Approve
                                </IOSButton>
                                <IOSButton
                                  variant="ghost"
                                  color="danger"
                                  size="sm"
                                  onClick={() => handleReview(request.id, 'reject')}
                                >
                                  Reject
                                </IOSButton>
                              </>
                            )}
                            {['APPROVED', 'PARTIALLY_APPROVED'].includes(request.status) && (
                              <IOSButton
                                variant="ghost"
                                color="primary"
                                size="sm"
                                leftIcon={<TruckIcon className="h-3.5 w-3.5" />}
                                onClick={() => handleCreateDispatch(request)}
                              >
                                Dispatch
                              </IOSButton>
                            )}
                          </div>
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
        {showDetailsModal && requestDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-ios-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold">Request: {requestDetails.request_number}</h2>
                    <div className="flex space-x-2 mt-1">
                      <IOSBadge color={getBadgeColor(requestDetails.status)}>
                        {requestDetails.status.replace('_', ' ')}
                      </IOSBadge>
                      <IOSBadge color={getPriorityBadgeColor(requestDetails.priority)}>
                        {requestDetails.priority}
                      </IOSBadge>
                    </div>
                  </div>
                  <IOSButton variant="ghost" size="sm" onClick={() => setShowDetailsModal(false)}>
                    Close
                  </IOSButton>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Branch</p>
                    <p className="font-medium">{requestDetails.branch_name || `Branch ID: ${requestDetails.requesting_branch_id}`}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Request Type</p>
                    <p className="font-medium">{requestDetails.request_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Date Requested</p>
                    <p className="font-medium">
                      {new Date(requestDetails.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Last Updated</p>
                    <p className="font-medium">
                      {new Date(requestDetails.updated_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
                {requestDetails.reason && (
                  <div>
                    <p className="text-sm text-gray-500">Reason / Notes</p>
                    <p className="p-2 bg-gray-50 rounded-ios-lg mt-1">{requestDetails.reason}</p>
                  </div>
                )}

                <div>
                  <p className="font-medium mb-2">Requested Items</p>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-2 text-sm font-medium text-gray-600">SKU</th>
                        <th className="text-left p-2 text-sm font-medium text-gray-600">Item</th>
                        <th className="text-center p-2 text-sm font-medium text-gray-600">Requested</th>
                        <th className="text-center p-2 text-sm font-medium text-gray-600">Approved</th>
                        <th className="text-center p-2 text-sm font-medium text-gray-600">Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requestDetails.items.map((item, index) => (
                        <tr key={index} className="border-b">
                          <td className="p-2 text-sm">{item.item_sku}</td>
                          <td className="p-2 text-sm">{item.item?.item_name || item.item_name || '-'}</td>
                          <td className="p-2 text-sm text-center">{item.requested_quantity}</td>
                          <td className="p-2 text-sm text-center">{item.approved_quantity ?? '-'}</td>
                          <td className="p-2 text-sm text-center">{item.item?.unit || item.unit || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {requestDetails.status === 'PENDING' && (
                  <div className="flex justify-end space-x-3 pt-4">
                    <IOSButton
                      variant="secondary"
                      color="danger"
                      onClick={() => handleReview(requestDetails.id, 'reject')}
                      disabled={isReviewing}
                    >
                      Reject
                    </IOSButton>
                    <IOSButton
                      variant="primary"
                      onClick={() => handleReview(requestDetails.id, 'approve')}
                      disabled={isReviewing}
                    >
                      Approve
                    </IOSButton>
                  </div>
                )}

                {['APPROVED', 'PARTIALLY_APPROVED'].includes(requestDetails.status) && (
                  <div className="flex justify-end space-x-3 pt-4">
                    <IOSButton
                      variant="primary"
                      leftIcon={<TruckIcon className="h-4 w-4" />}
                      onClick={() => {
                        handleCreateDispatch(requestDetails);
                        setShowDetailsModal(false);
                      }}
                    >
                      Create Dispatch
                    </IOSButton>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </BranchAwareDashboardLayout>

      {/* Dispatch Modal */}
      {selectedRequest && (
        <DispatchModal
          isOpen={dispatchModalOpen}
          onClose={() => setDispatchModalOpen(false)}
          requestId={selectedRequest.id}
          requestNumber={selectedRequest.request_number}
          onSuccess={handleDispatchSuccess}
        />
      )}
    </ProtectedRoute>
  );
}

// Wrap with BranchPageWrapper to prevent hydration errors
export default function WarehouseRequestsPage() {
  return (
    <BranchPageWrapper>
      <WarehouseRequestsContent />
    </BranchPageWrapper>
  );
}
