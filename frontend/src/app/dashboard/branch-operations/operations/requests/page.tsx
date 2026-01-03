'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { branchOperationsAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import {
  Search, RefreshCw, ClipboardList, CheckCircle2, Clock,
  AlertCircle, Plus, CalendarClock, MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Stock request interface
interface StockRequestItem {
  id: string;
  item_sku: string;
  item_name?: string;
  requested_quantity: number;
  approved_quantity?: number;
  unit?: string;
}

interface StockRequest {
  id: string;
  request_number: string;
  request_type: 'REPLENISHMENT' | 'SPECIAL_ORDER' | 'EMERGENCY';
  status: 'PENDING' | 'REVIEWED' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'DISPATCHED' | 'RECEIVED' | 'CANCELLED' | 'REJECTED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  reason?: string;
  needed_by_date?: string;
  created_at: string;
  updated_at: string;
  requesting_branch_id: number;
  items?: StockRequestItem[];
}

function StockRequestsContent() {
  const { user } = useAuth();
  const { activeBranch, activeBranchId } = useBranch();
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<StockRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal state
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    request_type: 'REPLENISHMENT',
    priority: 'NORMAL',
    reason: '',
    needed_by_date: format(new Date(), 'yyyy-MM-dd'),
    items: [{ item_sku: '', requested_quantity: 1 }]
  });

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    dispatched: 0
  });

  useEffect(() => {
    if (activeBranchId) {
      fetchRequests();
    }
  }, [activeBranchId]);

  useEffect(() => {
    applyFilters();
  }, [requests, searchTerm, typeFilter, statusFilter]);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const response = await branchOperationsAPI.getStockRequests(
        {
          status: statusFilter !== 'all' ? statusFilter : undefined
        },
        activeBranchId ?? undefined
      );

      if (response.success) {
        const requestsData = response.data || [];
        setRequests(requestsData);

        // Calculate stats
        const pending = requestsData.filter((r: StockRequest) => r.status === 'PENDING').length;
        const approved = requestsData.filter((r: StockRequest) => ['APPROVED', 'PARTIALLY_APPROVED'].includes(r.status)).length;
        const dispatched = requestsData.filter((r: StockRequest) => r.status === 'DISPATCHED').length;

        setStats({
          total: requestsData.length,
          pending,
          approved,
          dispatched
        });
      } else {
        throw new Error(response.message || 'Failed to fetch stock requests');
      }
    } catch (error) {
      console.error('Error fetching stock requests:', error);
      toast.error('Failed to load stock requests');
      setRequests([]);
      setStats({ total: 0, pending: 0, approved: 0, dispatched: 0 });
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatsFromData = (data: StockRequest[]) => {
    const pending = data.filter(r => r.status === 'PENDING').length;
    const approved = data.filter(r => ['APPROVED', 'PARTIALLY_APPROVED'].includes(r.status)).length;
    const dispatched = data.filter(r => r.status === 'DISPATCHED').length;

    setStats({
      total: data.length,
      pending,
      approved,
      dispatched
    });
  };

  const handleOpenNewRequest = () => {
    setShowNewRequestModal(true);
  };

  const handleCloseModal = () => {
    setShowNewRequestModal(false);
    setFormData({
      request_type: 'REPLENISHMENT',
      priority: 'NORMAL',
      reason: '',
      needed_by_date: format(new Date(), 'yyyy-MM-dd'),
      items: [{ item_sku: '', requested_quantity: 1 }]
    });
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await branchOperationsAPI.createStockRequest(
        {
          ...formData,
          requesting_branch_id: activeBranchId
        },
        activeBranchId ?? undefined
      );

      if (response.success) {
        toast.success('Stock request created successfully!');
        handleCloseModal();
        fetchRequests(); // Refresh the list
      } else {
        throw new Error(response.message || 'Failed to create stock request');
      }
    } catch (error: any) {
      console.error('Error creating stock request:', error);
      toast.error(error.message || 'Failed to create stock request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...requests];

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(request => request.request_type === typeFilter);
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(request => request.status === statusFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(request =>
        request.request_number.toLowerCase().includes(searchLower) ||
        (request.reason && request.reason.toLowerCase().includes(searchLower))
      );
    }

    setFilteredRequests(filtered);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <IOSBadge className="bg-yellow-100 text-yellow-700">Pending</IOSBadge>;
      case 'REVIEWED':
        return <IOSBadge className="bg-blue-100 text-blue-700">Reviewed</IOSBadge>;
      case 'APPROVED':
        return <IOSBadge className="bg-green-100 text-green-700">Approved</IOSBadge>;
      case 'PARTIALLY_APPROVED':
        return <IOSBadge className="bg-emerald-100 text-emerald-700">Partially Approved</IOSBadge>;
      case 'DISPATCHED':
        return <IOSBadge className="bg-purple-100 text-purple-700">Dispatched</IOSBadge>;
      case 'RECEIVED':
        return <IOSBadge className="bg-indigo-100 text-indigo-700">Received</IOSBadge>;
      case 'CANCELLED':
        return <IOSBadge className="bg-red-100 text-red-700">Cancelled</IOSBadge>;
      case 'REJECTED':
        return <IOSBadge className="bg-orange-100 text-orange-700">Rejected</IOSBadge>;
      default:
        return <IOSBadge className="bg-gray-100 text-gray-700">{status}</IOSBadge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return <IOSBadge className="bg-red-100 text-red-700">Urgent</IOSBadge>;
      case 'HIGH':
        return <IOSBadge className="bg-orange-100 text-orange-700">High</IOSBadge>;
      case 'NORMAL':
        return <IOSBadge className="bg-blue-100 text-blue-700">Normal</IOSBadge>;
      case 'LOW':
        return <IOSBadge className="bg-green-100 text-green-700">Low</IOSBadge>;
      default:
        return <IOSBadge className="bg-gray-100 text-gray-700">{priority}</IOSBadge>;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'REPLENISHMENT':
        return 'Replenishment';
      case 'SPECIAL_ORDER':
        return 'Special Order';
      case 'EMERGENCY':
        return 'Emergency';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
    } catch (error) {
      return dateString;
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to cancel this request?')) return;

    try {
      const response = await branchOperationsAPI.cancelStockRequest(
        requestId,
        activeBranchId ?? undefined
      );

      if (response.success) {
        toast.success(`Request cancelled successfully`);
        fetchRequests(); // Refresh the list
      } else {
        throw new Error(response.message || 'Failed to cancel request');
      }
    } catch (error: any) {
      console.error('Error cancelling request:', error);
      toast.error(error.message || 'Failed to cancel request');
    }
  };

  return (
    <ProtectedRoute allowedRoles={[
      UserRole.BRANCH_OPERATIONS_MANAGER,
      UserRole.BRANCH_MANAGER,
      UserRole.MAINTENANCE,
      UserRole.HOUSEKEEPING,
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER
    ]}>
      <BranchAwareDashboardLayout
        title="Stock Requests"
        subtitle={`Manage inventory requests for ${activeBranch?.name || 'your branch'}`}
        actionButton={
          <IOSButton leftIcon={<Plus />} onClick={handleOpenNewRequest}>
            New Stock Request
          </IOSButton>
        }
      >
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <ClipboardList className="h-5 w-5 text-gray-600 mb-2" />
              <p className="text-sm text-gray-500">Total Requests</p>
              <p className="text-lg font-bold">{stats.total}</p>
            </IOSCard>

            <IOSCard className="p-4">
              <AlertCircle className="h-5 w-5 text-yellow-600 mb-2" />
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-lg font-bold text-yellow-600">{stats.pending}</p>
            </IOSCard>

            <IOSCard className="p-4">
              <CheckCircle2 className="h-5 w-5 text-green-600 mb-2" />
              <p className="text-sm text-gray-500">Approved</p>
              <p className="text-lg font-bold text-green-600">{stats.approved}</p>
            </IOSCard>

            <IOSCard className="p-4">
              <RefreshCw className="h-5 w-5 text-purple-600 mb-2" />
              <p className="text-sm text-gray-500">Dispatched</p>
              <p className="text-lg font-bold text-purple-600">{stats.dispatched}</p>
            </IOSCard>
          </div>

          {/* Search and Filter */}
          <IOSCard className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <Input
                  placeholder="Search requests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
                >
                  <option value="all">All Types</option>
                  <option value="REPLENISHMENT">Replenishment</option>
                  <option value="SPECIAL_ORDER">Special Order</option>
                  <option value="EMERGENCY">Emergency</option>
                </select>
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Priority</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Needed By</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center">
                        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                      </td>
                    </tr>
                  ) : filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center">
                        <div className="flex flex-col items-center">
                          <ClipboardList className="h-12 w-12 text-gray-300 mb-2" />
                          <p className="text-gray-500">No requests found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((request) => (
                      <tr key={request.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 font-mono text-sm">
                          {request.request_number}
                        </td>
                        <td className="px-4 py-4">
                          {getTypeLabel(request.request_type)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="truncate max-w-xs">
                            {request.reason || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {request.items?.length || 0} items
                        </td>
                        <td className="px-4 py-4 text-center">
                          {getPriorityBadge(request.priority)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {getStatusBadge(request.status)}
                        </td>
                        <td className="px-4 py-4 text-center text-sm">
                          {request.needed_by_date ? formatDate(request.needed_by_date) : '-'}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-center space-x-2">
                            {request.status === 'PENDING' && (
                              <IOSButton
                                size="sm"
                                variant="secondary"
                                onClick={() => handleCancelRequest(request.id)}
                              >
                                Cancel
                              </IOSButton>
                            )}
                            <IOSButton
                              size="sm"
                              variant="outline"
                              leftIcon={<ClipboardList className="h-3 w-3" />}
                            >
                              Details
                            </IOSButton>
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
      </BranchAwareDashboardLayout>

      {/* New Request Modal */}
      <Dialog open={showNewRequestModal} onOpenChange={setShowNewRequestModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Stock Request</DialogTitle>
            <DialogDescription>
              Submit a new inventory request for {activeBranch?.name}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateRequest} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="request_type">Request Type *</Label>
                <select
                  id="request_type"
                  required
                  value={formData.request_type}
                  onChange={(e) => handleFormChange('request_type', e.target.value)}
                  className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
                >
                  <option value="REPLENISHMENT">Replenishment</option>
                  <option value="SPECIAL_ORDER">Special Order</option>
                  <option value="EMERGENCY">Emergency</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <select
                  id="priority"
                  value={formData.priority}
                  onChange={(e) => handleFormChange('priority', e.target.value)}
                  className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="needed_by_date">Needed By Date</Label>
              <Input
                id="needed_by_date"
                type="date"
                value={formData.needed_by_date}
                onChange={(e) => handleFormChange('needed_by_date', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason / Notes</Label>
              <Textarea
                id="reason"
                value={formData.reason}
                onChange={(e) => handleFormChange('reason', e.target.value)}
                placeholder="Why is this stock needed?"
                rows={2}
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label>Items Requested</Label>
                <IOSButton
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setFormData({
                    ...formData,
                    items: [...formData.items, { item_sku: '', requested_quantity: 1 }]
                  })}
                >
                  Add Item
                </IOSButton>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                {formData.items.map((item, index) => (
                  <div key={index} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">SKU / Item Name</Label>
                      <Input
                        value={item.item_sku}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[index].item_sku = e.target.value;
                          setFormData({ ...formData, items: newItems });
                        }}
                        placeholder="e.g. BEV-TUSK-001"
                        required
                      />
                    </div>
                    <div className="w-24 space-y-1">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.requested_quantity}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[index].requested_quantity = parseInt(e.target.value) || 0;
                          setFormData({ ...formData, items: newItems });
                        }}
                        required
                      />
                    </div>
                    {formData.items.length > 1 && (
                      <IOSButton
                        type="button"
                        variant="ghost"
                        className="text-red-500 h-10"
                        onClick={() => {
                          const newItems = formData.items.filter((_, i) => i !== index);
                          setFormData({ ...formData, items: newItems });
                        }}
                      >
                        &times;
                      </IOSButton>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <IOSButton
                type="button"
                variant="outline"
                onClick={handleCloseModal}
                disabled={isSubmitting}
              >
                Cancel
              </IOSButton>
              <IOSButton
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </IOSButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
}

// Export a wrapper component that provides BranchContext
export default function StockRequestsPage() {
  return (
    <BranchPageWrapper>
      <StockRequestsContent />
    </BranchPageWrapper>
  );
}
