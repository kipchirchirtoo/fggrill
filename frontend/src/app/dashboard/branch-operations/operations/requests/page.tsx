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

// Service request interface
interface ServiceRequest {
  id: string;
  request_number: string;
  type: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  description: string;
  room_number?: string;
  requested_by: string;
  assigned_to?: string;
  comments?: string[];
}

function ServiceRequestsContent() {
  const { user } = useAuth();
  const { activeBranch, activeBranchId } = useBranch();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<ServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal state
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    type: '',
    priority: 'medium',
    room_number: '',
    description: '',
    assigned_to: ''
  });

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0
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
      const response = await branchOperationsAPI.getServiceRequests(
        {
          type: typeFilter !== 'all' ? typeFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined
        },
        activeBranchId ?? undefined
      );

      if (response.success) {
        const requestsData = response.data || [];
        setRequests(requestsData);

        // Calculate stats
        const pending = requestsData.filter((r: ServiceRequest) => r.status === 'pending').length;
        const inProgress = requestsData.filter((r: ServiceRequest) => r.status === 'in_progress').length;
        const completed = requestsData.filter((r: ServiceRequest) => r.status === 'completed').length;

        setStats({
          total: requestsData.length,
          pending,
          inProgress,
          completed
        });
      } else {
        throw new Error(response.message || 'Failed to fetch service requests');
      }
    } catch (error) {
      console.error('Error fetching service requests:', error);
      toast.error('Failed to load service requests');
      setRequests([]);
      setStats({ total: 0, pending: 0, inProgress: 0, completed: 0 });
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatsFromData = (data: ServiceRequest[]) => {
    const pending = data.filter(r => r.status === 'pending').length;
    const inProgress = data.filter(r => r.status === 'in_progress').length;
    const completed = data.filter(r => r.status === 'completed').length;

    setStats({
      total: data.length,
      pending,
      inProgress,
      completed
    });
  };

  const handleOpenNewRequest = () => {
    setShowNewRequestModal(true);
  };

  const handleCloseModal = () => {
    setShowNewRequestModal(false);
    setFormData({
      type: '',
      priority: 'medium',
      room_number: '',
      description: '',
      assigned_to: ''
    });
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await branchOperationsAPI.createServiceRequest(
        formData,
        activeBranchId ?? undefined
      );

      if (response.success) {
        toast.success('Service request created successfully!');
        handleCloseModal();
        fetchRequests(); // Refresh the list
      } else {
        throw new Error(response.message || 'Failed to create service request');
      }
    } catch (error: any) {
      console.error('Error creating service request:', error);
      toast.error(error.message || 'Failed to create service request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...requests];

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(request => request.type === typeFilter);
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
        request.description.toLowerCase().includes(searchLower) ||
        (request.room_number && request.room_number.toLowerCase().includes(searchLower))
      );
    }

    setFilteredRequests(filtered);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <IOSBadge className="bg-yellow-100 text-yellow-700">Pending</IOSBadge>;
      case 'in_progress':
        return <IOSBadge className="bg-blue-100 text-blue-700">In Progress</IOSBadge>;
      case 'completed':
        return <IOSBadge className="bg-green-100 text-green-700">Completed</IOSBadge>;
      case 'cancelled':
        return <IOSBadge className="bg-red-100 text-red-700">Cancelled</IOSBadge>;
      default:
        return <IOSBadge className="bg-gray-100 text-gray-700">{status}</IOSBadge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <IOSBadge className="bg-red-100 text-red-700">High</IOSBadge>;
      case 'medium':
        return <IOSBadge className="bg-orange-100 text-orange-700">Medium</IOSBadge>;
      case 'low':
        return <IOSBadge className="bg-green-100 text-green-700">Low</IOSBadge>;
      default:
        return <IOSBadge className="bg-gray-100 text-gray-700">{priority}</IOSBadge>;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'maintenance':
        return 'Maintenance';
      case 'housekeeping':
        return 'Housekeeping';
      case 'facility':
        return 'Facility';
      case 'it':
        return 'IT Support';
      case 'security':
        return 'Security';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
    } catch (error) {
      return dateString;
    }
  };

  const handleStatusChange = async (requestId: string, newStatus: string) => {
    try {
      const response = await branchOperationsAPI.updateServiceRequestStatus(
        requestId,
        newStatus,
        activeBranchId ?? undefined
      );

      if (response.success) {
        toast.success(`Request status updated to ${newStatus}`);
        fetchRequests(); // Refresh the list
      } else {
        throw new Error(response.message || 'Failed to update status');
      }
    } catch (error: any) {
      console.error('Error updating request status:', error);
      toast.error(error.message || 'Failed to update request status');
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
        title="Service Requests"
        subtitle={`Manage service requests for ${activeBranch?.name || 'your branch'}`}
        actionButton={
          <IOSButton leftIcon={<Plus />} onClick={handleOpenNewRequest}>
            New Request
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
              <Clock className="h-5 w-5 text-blue-600 mb-2" />
              <p className="text-sm text-gray-500">In Progress</p>
              <p className="text-lg font-bold text-blue-600">{stats.inProgress}</p>
            </IOSCard>

            <IOSCard className="p-4">
              <CheckCircle2 className="h-5 w-5 text-green-600 mb-2" />
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-lg font-bold text-green-600">{stats.completed}</p>
            </IOSCard>
          </div>

          {/* Search and Filter */}
          <IOSCard className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search requests..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
                >
                  <option value="all">All Types</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="housekeeping">Housekeeping</option>
                  <option value="facility">Facility</option>
                  <option value="it">IT Support</option>
                  <option value="security">Security</option>
                </select>
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Room</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Priority</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Created</th>
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
                          {getTypeLabel(request.type)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="truncate max-w-xs">
                            {request.description}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {request.room_number || '-'}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {getPriorityBadge(request.priority)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {getStatusBadge(request.status)}
                        </td>
                        <td className="px-4 py-4 text-center text-sm">
                          {formatDate(request.created_at)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-center space-x-2">
                            {request.status === 'pending' && (
                              <IOSButton
                                size="sm"
                                variant="secondary"
                                onClick={() => handleStatusChange(request.id, 'in_progress')}
                              >
                                Start
                              </IOSButton>
                            )}
                            {request.status === 'in_progress' && (
                              <IOSButton
                                size="sm"
                                variant="secondary"
                                onClick={() => handleStatusChange(request.id, 'completed')}
                              >
                                Complete
                              </IOSButton>
                            )}
                            <IOSButton
                              size="sm"
                              variant="outline"
                              leftIcon={<MessageSquare className="h-3 w-3" />}
                            >
                              Comment
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Service Request</DialogTitle>
            <DialogDescription>
              Submit a new service request for {activeBranch?.name}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateRequest} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">Request Type *</Label>
              <select
                id="type"
                required
                value={formData.type}
                onChange={(e) => handleFormChange('type', e.target.value)}
                className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
              >
                <option value="">Select Type</option>
                <option value="maintenance">Maintenance</option>
                <option value="housekeeping">Housekeeping</option>
                <option value="facility">Facility</option>
                <option value="it">IT Support</option>
                <option value="security">Security</option>
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
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="room_number">Room Number (Optional)</Label>
              <Input
                id="room_number"
                value={formData.room_number}
                onChange={(e) => handleFormChange('room_number', e.target.value)}
                placeholder="e.g., 301"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                required
                value={formData.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
                placeholder="Describe the issue or request..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assign To (Optional)</Label>
              <Input
                id="assigned_to"
                value={formData.assigned_to}
                onChange={(e) => handleFormChange('assigned_to', e.target.value)}
                placeholder="e.g., Maintenance Team"
              />
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
                {isSubmitting ? 'Creating...' : 'Create Request'}
              </IOSButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
}

// Export a wrapper component that provides BranchContext
export default function ServiceRequestsPage() {
  return (
    <BranchPageWrapper>
      <ServiceRequestsContent />
    </BranchPageWrapper>
  );
}
