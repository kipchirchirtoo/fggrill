'use client';

import { useState, useEffect, useCallback } from 'react';
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
  ArrowDownUp, Search, Filter, RefreshCw, PlusCircle, 
  ArrowRightLeft, Package, Truck, Check, X, Clock,
  Building2, ChevronRight, Eye, Send, CheckCircle2, XCircle, Loader2
} from 'lucide-react';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';

interface TransferItem {
  sku: string;
  name: string;
  quantity: number;
  unit: string;
}

interface Transfer {
  id: string;
  from_branch_id: number;
  to_branch_id: number;
  from_branch_name: string;
  to_branch_name: string;
  status: string;
  requested_by: string;
  approved_by: string | null;
  completed_by: string | null;
  items: TransferItem[];
  notes: string;
  created_at: string;
  approved_at: string | null;
  shipped_at: string | null;
  received_at: string | null;
}

interface TransferStats {
  total: number;
  pending: number;
  approved: number;
  in_transit: number;
  completed: number;
  rejected: number;
}

function WarehouseTransfersContent() {
  const { user } = useAuth();
  const { branches } = useBranch();
  const [isLoading, setIsLoading] = useState(true);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [stats, setStats] = useState<TransferStats>({
    total: 0, pending: 0, approved: 0, in_transit: 0, completed: 0, rejected: 0
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Create form states
  const [fromBranchId, setFromBranchId] = useState<number | ''>('');
  const [toBranchId, setToBranchId] = useState<number | ''>('');
  const [transferItems, setTransferItems] = useState<TransferItem[]>([
    { sku: '', name: '', quantity: 1, unit: 'unit' }
  ]);
  const [transferNotes, setTransferNotes] = useState('');

  const fetchTransfers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await centralOperationsAPI.getTransfers(
        statusFilter !== 'all' ? statusFilter : undefined
      );
      
      if (response.success) {
        setTransfers(response.data || []);
        setStats(response.stats || {
          total: 0, pending: 0, approved: 0, in_transit: 0, completed: 0, rejected: 0
        });
      } else {
        toast.error('Failed to load transfers');
      }
    } catch (error) {
      console.error('Error fetching transfers:', error);
      toast.error('Failed to load transfers');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const handleCreateTransfer = async () => {
    if (!fromBranchId || !toBranchId) {
      toast.error('Please select source and destination branches');
      return;
    }
    
    if (fromBranchId === toBranchId) {
      toast.error('Source and destination branches must be different');
      return;
    }
    
    const validItems = transferItems.filter(item => item.sku && item.name && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one item to transfer');
      return;
    }
    
    setActionLoading(true);
    try {
      const response = await centralOperationsAPI.createTransfer({
        from_branch_id: fromBranchId as number,
        to_branch_id: toBranchId as number,
        items: validItems,
        notes: transferNotes
      });
      
      if (response.success) {
        toast.success(`Transfer ${response.data.id} created successfully`);
        setShowCreateModal(false);
        resetCreateForm();
        fetchTransfers();
      } else {
        toast.error(response.message || 'Failed to create transfer');
      }
    } catch (error) {
      console.error('Error creating transfer:', error);
      toast.error('Failed to create transfer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveTransfer = async (id: string) => {
    setActionLoading(true);
    try {
      const response = await centralOperationsAPI.reviewTransfer(id, { status: 'approved' });
      if (response.success) {
        toast.success('Transfer approved successfully');
        fetchTransfers();
        setShowDetailModal(false);
      } else {
        toast.error(response.message || 'Failed to approve transfer');
      }
    } catch (error) {
      console.error('Error approving transfer:', error);
      toast.error('Failed to approve transfer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectTransfer = async (id: string) => {
    setActionLoading(true);
    try {
      const response = await centralOperationsAPI.reviewTransfer(id, { status: 'rejected' });
      if (response.success) {
        toast.success('Transfer rejected');
        fetchTransfers();
        setShowDetailModal(false);
      } else {
        toast.error(response.message || 'Failed to reject transfer');
      }
    } catch (error) {
      console.error('Error rejecting transfer:', error);
      toast.error('Failed to reject transfer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleShipTransfer = async (id: string) => {
    setActionLoading(true);
    try {
      const response = await centralOperationsAPI.shipTransfer(id);
      if (response.success) {
        toast.success('Transfer shipped successfully');
        fetchTransfers();
        setShowDetailModal(false);
      } else {
        toast.error(response.message || 'Failed to ship transfer');
      }
    } catch (error) {
      console.error('Error shipping transfer:', error);
      toast.error('Failed to ship transfer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReceiveTransfer = async (id: string) => {
    setActionLoading(true);
    try {
      const response = await centralOperationsAPI.receiveTransfer(id);
      if (response.success) {
        toast.success('Transfer received and completed');
        fetchTransfers();
        setShowDetailModal(false);
      } else {
        toast.error(response.message || 'Failed to receive transfer');
      }
    } catch (error) {
      console.error('Error receiving transfer:', error);
      toast.error('Failed to receive transfer');
    } finally {
      setActionLoading(false);
    }
  };

  const resetCreateForm = () => {
    setFromBranchId('');
    setToBranchId('');
    setTransferItems([{ sku: '', name: '', quantity: 1, unit: 'unit' }]);
    setTransferNotes('');
  };

  const addTransferItem = () => {
    setTransferItems([...transferItems, { sku: '', name: '', quantity: 1, unit: 'unit' }]);
  };

  const removeTransferItem = (index: number) => {
    if (transferItems.length > 1) {
      setTransferItems(transferItems.filter((_, i) => i !== index));
    }
  };

  const updateTransferItem = (index: number, field: keyof TransferItem, value: string | number) => {
    const updated = [...transferItems];
    updated[index] = { ...updated[index], [field]: value };
    setTransferItems(updated);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary'; label: string }> = {
      pending: { variant: 'warning', label: 'Pending' },
      approved: { variant: 'default', label: 'Approved' },
      in_transit: { variant: 'secondary', label: 'In Transit' },
      completed: { variant: 'success', label: 'Completed' },
      rejected: { variant: 'destructive', label: 'Rejected' }
    };
    const config = statusConfig[status] || { variant: 'default', label: status };
    return <IOSBadge variant={config.variant}>{config.label}</IOSBadge>;
  };

  const filteredTransfers = transfers.filter(transfer => {
    const matchesSearch = searchQuery === '' || 
      transfer.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transfer.from_branch_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transfer.to_branch_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesBranch = branchFilter === 'all' || 
      transfer.from_branch_id.toString() === branchFilter ||
      transfer.to_branch_id.toString() === branchFilter;
    
    return matchesSearch && matchesBranch;
  });

  return (
    <ProtectedRoute allowedRoles={[
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.CENTRAL_OPERATIONS_MANAGER,
      UserRole.CENTRAL_STOREKEEPER
    ]}>
      <BranchAwareDashboardLayout
        title="Branch Transfers"
        subtitle="Transfer inventory items between branches"
        requireBranchContext={false}
        actionButton={
          <div className="flex space-x-2">
            <IOSButton 
              variant="secondary" 
              onClick={fetchTransfers}
              disabled={isLoading}
              leftIcon={<RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </IOSButton>
            <IOSButton 
              variant="primary" 
              onClick={() => setShowCreateModal(true)}
              leftIcon={<PlusCircle className="h-4 w-4" />}
            >
              Create Transfer
            </IOSButton>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <ArrowDownUp className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total</p>
                  <p className="text-lg font-semibold">{stats.total}</p>
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
                  <p className="text-lg font-semibold">{stats.pending}</p>
                </div>
              </div>
            </IOSCard>
            
            <IOSCard className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Check className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Approved</p>
                  <p className="text-lg font-semibold">{stats.approved}</p>
                </div>
              </div>
            </IOSCard>
            
            <IOSCard className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Truck className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">In Transit</p>
                  <p className="text-lg font-semibold">{stats.in_transit}</p>
                </div>
              </div>
            </IOSCard>
            
            <IOSCard className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Completed</p>
                  <p className="text-lg font-semibold">{stats.completed}</p>
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Search and Filter */}
          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by ID or branch..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex space-x-4">
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-ios-lg text-sm appearance-none bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Branches</option>
                  {Array.isArray(branches) && branches.map((branch: any) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
                
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-ios-lg text-sm appearance-none bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="in_transit">In Transit</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </IOSCard>

          {/* Transfers List */}
          <IOSCard className="overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            ) : filteredTransfers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <ArrowRightLeft className="h-16 w-16 text-gray-200 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Transfers Found</h3>
                <p className="text-gray-500 text-center max-w-md mb-6">
                  {transfers.length === 0 
                    ? 'Create your first transfer to move inventory between branches.'
                    : 'No transfers match your current filters.'}
                </p>
                <IOSButton 
                  variant="primary"
                  onClick={() => setShowCreateModal(true)}
                  leftIcon={<PlusCircle className="h-4 w-4" />}
                >
                  Create Transfer
                </IOSButton>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredTransfers.map((transfer) => (
                  <div 
                    key={transfer.id}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedTransfer(transfer);
                      setShowDetailModal(true);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-gray-50 rounded-lg">
                          <ArrowRightLeft className="h-5 w-5 text-gray-600" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-sm">{transfer.id}</span>
                            {getStatusBadge(transfer.status)}
                          </div>
                          <div className="flex items-center text-sm text-gray-500 mt-1">
                            <Building2 className="h-3 w-3 mr-1" />
                            <span>{transfer.from_branch_name || `Branch ${transfer.from_branch_id}`}</span>
                            <ChevronRight className="h-3 w-3 mx-1" />
                            <span>{transfer.to_branch_name || `Branch ${transfer.to_branch_id}`}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{transfer.items?.length || 0} items</p>
                        <p className="text-xs text-gray-500">
                          {new Date(transfer.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </IOSCard>
        </div>

        {/* Create Transfer Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-ios-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">Create Branch Transfer</h2>
                  <IOSButton variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>
                    <X className="h-5 w-5" />
                  </IOSButton>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">From Branch*</label>
                    <select
                      value={fromBranchId}
                      onChange={(e) => setFromBranchId(e.target.value ? parseInt(e.target.value) : '')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Select source branch</option>
                      {Array.isArray(branches) && branches.map((branch: any) => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">To Branch*</label>
                    <select
                      value={toBranchId}
                      onChange={(e) => setToBranchId(e.target.value ? parseInt(e.target.value) : '')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Select destination branch</option>
                      {Array.isArray(branches) && branches.map((branch: any) => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">Items to Transfer*</label>
                    <IOSButton variant="ghost" size="sm" onClick={addTransferItem}>
                      <PlusCircle className="h-4 w-4 mr-1" /> Add Item
                    </IOSButton>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {transferItems.map((item, index) => (
                      <div key={index} className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg">
                        <input
                          type="text"
                          placeholder="SKU"
                          value={item.sku}
                          onChange={(e) => updateTransferItem(index, 'sku', e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Item Name"
                          value={item.name}
                          onChange={(e) => updateTransferItem(index, 'name', e.target.value)}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateTransferItem(index, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          min="1"
                        />
                        <select
                          value={item.unit}
                          onChange={(e) => updateTransferItem(index, 'unit', e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="unit">unit</option>
                          <option value="kg">kg</option>
                          <option value="liter">liter</option>
                          <option value="bottle">bottle</option>
                          <option value="case">case</option>
                          <option value="box">box</option>
                        </select>
                        <button
                          onClick={() => removeTransferItem(index)}
                          className="p-1 text-gray-500 hover:bg-gray-50 rounded"
                          disabled={transferItems.length === 1}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    rows={3}
                    placeholder="Add any notes about this transfer..."
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <IOSButton variant="secondary" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </IOSButton>
                  <IOSButton 
                    variant="primary" 
                    onClick={handleCreateTransfer}
                    disabled={actionLoading}
                    leftIcon={actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  >
                    {actionLoading ? 'Creating...' : 'Create Transfer'}
                  </IOSButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transfer Detail Modal */}
        {showDetailModal && selectedTransfer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-ios-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold">{selectedTransfer.id}</h2>
                    <div className="mt-1">{getStatusBadge(selectedTransfer.status)}</div>
                  </div>
                  <IOSButton variant="ghost" size="sm" onClick={() => setShowDetailModal(false)}>
                    <X className="h-5 w-5" />
                  </IOSButton>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-500">From Branch</p>
                    <p className="font-medium">{selectedTransfer.from_branch_name || `Branch ${selectedTransfer.from_branch_id}`}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">To Branch</p>
                    <p className="font-medium">{selectedTransfer.to_branch_name || `Branch ${selectedTransfer.to_branch_id}`}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Requested By</p>
                    <p className="font-medium">{selectedTransfer.requested_by || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Created</p>
                    <p className="font-medium">{new Date(selectedTransfer.created_at).toLocaleString()}</p>
                  </div>
                  {selectedTransfer.approved_by && (
                    <div>
                      <p className="text-sm text-gray-500">Approved By</p>
                      <p className="font-medium">{selectedTransfer.approved_by}</p>
                    </div>
                  )}
                  {selectedTransfer.shipped_at && (
                    <div>
                      <p className="text-sm text-gray-500">Shipped</p>
                      <p className="font-medium">{new Date(selectedTransfer.shipped_at).toLocaleString()}</p>
                    </div>
                  )}
                  {selectedTransfer.received_at && (
                    <div>
                      <p className="text-sm text-gray-500">Received</p>
                      <p className="font-medium">{new Date(selectedTransfer.received_at).toLocaleString()}</p>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Items ({selectedTransfer.items?.length || 0})</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left">SKU</th>
                          <th className="px-4 py-2 text-left">Name</th>
                          <th className="px-4 py-2 text-right">Quantity</th>
                          <th className="px-4 py-2 text-left">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedTransfer.items?.map((item, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 font-mono text-xs">{item.sku}</td>
                            <td className="px-4 py-2">{item.name}</td>
                            <td className="px-4 py-2 text-right">{item.quantity}</td>
                            <td className="px-4 py-2">{item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {selectedTransfer.notes && (
                  <div>
                    <h3 className="font-semibold mb-2">Notes</h3>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{selectedTransfer.notes}</p>
                  </div>
                )}

                {/* Action Buttons based on status */}
                <div className="flex justify-end space-x-2 pt-4 border-t">
                  {selectedTransfer.status === 'pending' && (
                    <>
                      <IOSButton 
                        variant="destructive" 
                        onClick={() => handleRejectTransfer(selectedTransfer.id)}
                        disabled={actionLoading}
                        leftIcon={actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                      >
                        Reject
                      </IOSButton>
                      <IOSButton 
                        variant="primary" 
                        onClick={() => handleApproveTransfer(selectedTransfer.id)}
                        disabled={actionLoading}
                        leftIcon={actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      >
                        Approve
                      </IOSButton>
                    </>
                  )}
                  {selectedTransfer.status === 'approved' && (
                    <IOSButton 
                      variant="primary" 
                      onClick={() => handleShipTransfer(selectedTransfer.id)}
                      disabled={actionLoading}
                      leftIcon={actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                    >
                      Ship Transfer
                    </IOSButton>
                  )}
                  {selectedTransfer.status === 'in_transit' && (
                    <IOSButton 
                      variant="primary" 
                      onClick={() => handleReceiveTransfer(selectedTransfer.id)}
                      disabled={actionLoading}
                      leftIcon={actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    >
                      Mark as Received
                    </IOSButton>
                  )}
                  {(selectedTransfer.status === 'completed' || selectedTransfer.status === 'rejected') && (
                    <IOSButton variant="secondary" onClick={() => setShowDetailModal(false)}>
                      Close
                    </IOSButton>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

// Wrap with BranchPageWrapper to prevent hydration errors
export default function WarehouseTransfersPage() {
  return (
    <BranchPageWrapper>
      <WarehouseTransfersContent />
    </BranchPageWrapper>
  );
}
