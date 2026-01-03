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
  Truck, Search, Filter, RefreshCw,
  Clock, CheckCircle, ArrowRight,
  PlusCircle, PackageCheck, ArrowDown
} from 'lucide-react';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';

// Dispatch type
interface DispatchItem {
  id?: string;
  item_sku: string;
  item_name?: string;
  quantity: number;
  dispatched_quantity?: number;
  unit?: string;
  item?: {
    sku: string;
    item_name: string;
    unit: string;
  };
}

interface Dispatch {
  id: string;
  dispatch_number: string;
  request_id?: string;
  request_number?: string;
  from_branch_id: number;
  to_branch_id: number;
  requesting_branch_id: number;
  branch_name?: string;
  from_branch?: { id: number; name: string; code: string };
  to_branch?: { id: number; name: string; code: string };
  status: 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED' | 'DRAFT' | 'CONFIRMED';
  carrier?: string;
  tracking_number?: string;
  vehicle_number?: string;
  driver_name?: string;
  driver_phone?: string;
  dispatched_by?: number;
  dispatched_by_name?: string;
  received_by?: number;
  received_by_name?: string;
  items: DispatchItem[];
  notes?: string;
  dispatch_notes?: string;
  created_at: string;
  updated_at: string;
  dispatched_at?: string;
  received_at?: string;
}

function WarehouseDispatchesContent() {
  const { user } = useAuth();
  const { branches } = useBranch();
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [filteredDispatches, setFilteredDispatches] = useState<Dispatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [dispatchDetails, setDispatchDetails] = useState<Dispatch | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedItems, setSelectedItems] = useState<DispatchItem[]>([
    { item_sku: '', item_name: '', quantity: 0, unit: '' }
  ]);
  const [newDispatchBranch, setNewDispatchBranch] = useState<string>('');
  const [newDispatchNotes, setNewDispatchNotes] = useState<string>('');
  const [inventory, setInventory] = useState<any[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);

  // Fetch dispatches on mount
  useEffect(() => {
    fetchDispatches();
  }, []);

  // Filter dispatches when filters change
  useEffect(() => {
    filterDispatches();
  }, [dispatches, searchQuery, selectedBranch, selectedStatus]);

  const fetchDispatches = async () => {
    setIsLoading(true);
    try {
      const response = await centralOperationsAPI.getDispatches();

      if (response.success) {
        setDispatches(response.data || []);
      } else {
        setDispatches([]);
        toast.error(response.message || 'Failed to fetch dispatches');
      }
    } catch (error) {
      console.error('Error fetching dispatches:', error);
      toast.error('Failed to load dispatches data');
      setDispatches([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filterDispatches = () => {
    let filtered = [...dispatches];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(dispatch =>
        dispatch.dispatch_number.toLowerCase().includes(query) ||
        dispatch.branch_name?.toLowerCase().includes(query) ||
        dispatch.request_number?.toLowerCase().includes(query) ||
        (dispatch.tracking_number && dispatch.tracking_number.toLowerCase().includes(query)) ||
        dispatch.items.some(item => (item.item_name && item.item_name.toLowerCase().includes(query)) || item.item_sku.toLowerCase().includes(query))
      );
    }

    // Filter by branch
    if (selectedBranch !== 'all') {
      filtered = filtered.filter(dispatch => dispatch.requesting_branch_id === parseInt(selectedBranch));
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(dispatch => dispatch.status === selectedStatus);
    }

    setFilteredDispatches(filtered);
  };

  const handleViewDetails = async (dispatch: Dispatch) => {
    setDispatchDetails(dispatch);
    setShowDetailsModal(true);

    // Fetch full details to get enriched data
    try {
      const response = await centralOperationsAPI.getDispatchNote(dispatch.id);
      if (response.success) {
        setDispatchDetails(response.data);
      }
    } catch (error) {
      console.error('Error fetching dispatch details:', error);
    }
  };

  const handleDispatch = async (id: string) => {
    setIsDispatching(true);
    try {
      const response = await centralOperationsAPI.dispatchNote(id, {
        carrier: 'Internal',
        tracking_number: `TRK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
      });

      if (response.success) {
        toast.success('Items dispatched successfully');
        setShowDetailsModal(false);
        fetchDispatches();
      } else {
        toast.error(response.message || 'Failed to dispatch items');
      }
    } catch (error) {
      console.error('Error dispatching items:', error);
      toast.error('Failed to dispatch items');
    } finally {
      setIsDispatching(false);
    }
  };

  const fetchInventory = async () => {
    setIsLoadingInventory(true);
    try {
      const response = await centralOperationsAPI.getWarehouseInventory();

      if (response.success) {
        setInventory(response.data || []);
      } else {
        toast.error(response.message || 'Failed to fetch inventory');
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Failed to load inventory data');
    } finally {
      setIsLoadingInventory(false);
    }
  };

  const handleOpenCreateModal = () => {
    fetchInventory();
    setSelectedItems([{ item_sku: '', item_name: '', quantity: 0, unit: '' }]);
    setNewDispatchBranch('');
    setNewDispatchNotes('');
    setShowCreateModal(true);
  };

  const handleAddItem = () => {
    setSelectedItems([...selectedItems, { item_sku: '', item_name: '', quantity: 0, unit: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (selectedItems.length > 1) {
      setSelectedItems(selectedItems.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: keyof DispatchItem, value: any) => {
    const newItems = [...selectedItems];

    if (field === 'item_sku' && value) {
      const inventoryItem = inventory.find(item => item.item_sku === value);
      if (inventoryItem) {
        newItems[index] = {
          ...newItems[index],
          item_sku: inventoryItem.item_sku,
          item_name: inventoryItem.item_name,
          unit: inventoryItem.unit_of_measure
        };
      } else {
        newItems[index][field] = value;
      }
    } else {
      (newItems[index] as any)[field] = value;
    }

    setSelectedItems(newItems);
  };

  const handleCreateDispatch = async () => {
    if (!newDispatchBranch) {
      toast.error('Please select a branch');
      return;
    }

    if (selectedItems.some(item => !item.item_sku || !item.quantity)) {
      toast.error('Please fill in all item fields');
      return;
    }

    setIsDispatching(true);
    try {
      const response = await centralOperationsAPI.createDispatch({
        requesting_branch_id: parseInt(newDispatchBranch),
        items: selectedItems.map(item => ({
          item_sku: item.item_sku,
          quantity: item.quantity
        })),
        notes: newDispatchNotes
      });

      if (response.success) {
        toast.success('Dispatch created successfully');
        setShowCreateModal(false);
        fetchDispatches();
      } else {
        toast.error(response.message || 'Failed to create dispatch');
      }
    } catch (error) {
      console.error('Error creating dispatch:', error);
      toast.error('Failed to create dispatch');
    } finally {
      setIsDispatching(false);
    }
  };

  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'warning';
      case 'IN_TRANSIT': return 'primary';
      case 'DELIVERED': return 'success';
      case 'CANCELLED': return 'danger';
      default: return 'secondary';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.CENTRAL_OPERATIONS_MANAGER, UserRole.CENTRAL_STOREKEEPER]}>
      <BranchAwareDashboardLayout
        title="Warehouse Dispatches"
        subtitle="Manage inventory dispatches to branches"
        requireBranchContext={false}
        actionButton={
          <div className="flex space-x-2">
            <IOSButton
              variant="secondary"
              onClick={fetchDispatches}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </IOSButton>
            <IOSButton
              variant="primary"
              onClick={handleOpenCreateModal}
              leftIcon={<PlusCircle className="h-4 w-4" />}
            >
              Create Dispatch
            </IOSButton>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Clock className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-lg font-semibold">{filteredDispatches.filter(d => d.status === 'PENDING').length}</p>
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
                  <p className="text-lg font-semibold">{filteredDispatches.filter(d => d.status === 'IN_TRANSIT').length}</p>
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Delivered</p>
                  <p className="text-lg font-semibold">{filteredDispatches.filter(d => d.status === 'DELIVERED').length}</p>
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
                  placeholder="Search by ID, branch, or items"
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
                    <option value="IN_TRANSIT">In Transit</option>
                    <option value="DELIVERED">Delivered</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>
          </IOSCard>

          {/* Dispatches Table */}
          <IOSCard className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Dispatch #</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Branch</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Date Created</th>
                    <th className="text-center p-4 text-sm font-medium text-gray-600">Status</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Request #</th>
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
                          <span className="ml-2 text-gray-500">Loading dispatches...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredDispatches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-center">
                        <div className="py-8">
                          <Truck className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                          <p className="text-gray-500">No dispatches found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredDispatches.map((dispatch) => (
                      <tr key={dispatch.id} className="border-b hover:bg-gray-50">
                        <td className="p-4 text-sm font-medium">{dispatch.dispatch_number}</td>
                        <td className="p-4 text-sm">{dispatch.branch_name}</td>
                        <td className="p-4 text-sm">{formatDate(dispatch.created_at)}</td>
                        <td className="p-4 text-center">
                          <IOSBadge color={getBadgeColor(dispatch.status)}>
                            {dispatch.status.replace('_', ' ')}
                          </IOSBadge>
                        </td>
                        <td className="p-4 text-sm">{dispatch.request_number || '-'}</td>
                        <td className="p-4 text-sm text-center">{dispatch.items ? dispatch.items.length : 0}</td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center space-x-2">
                            <IOSButton
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(dispatch)}
                            >
                              View
                            </IOSButton>
                            {dispatch.status === 'PENDING' && (
                              <IOSButton
                                variant="ghost"
                                color="primary"
                                size="sm"
                                leftIcon={<Truck className="h-3.5 w-3.5" />}
                                onClick={() => handleDispatch(dispatch.id)}
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

        {/* Dispatch Details Modal */}
        {showDetailsModal && dispatchDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-ios-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold">Dispatch: {dispatchDetails.dispatch_number}</h2>
                    <div className="flex space-x-2 mt-1">
                      <IOSBadge color={getBadgeColor(dispatchDetails.status)}>
                        {dispatchDetails.status.replace('_', ' ')}
                      </IOSBadge>
                    </div>
                  </div>
                  <IOSButton variant="ghost" size="sm" onClick={() => setShowDetailsModal(false)}>
                    Close
                  </IOSButton>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900 border-b pb-2">Branch Information</h3>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold">From Branch</p>
                      <p className="font-medium">{dispatchDetails.from_branch?.name || 'Central Warehouse'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold">To Branch</p>
                      <p className="font-medium text-blue-600">{dispatchDetails.to_branch?.name || dispatchDetails.branch_name || `Branch ID: ${dispatchDetails.to_branch_id || dispatchDetails.requesting_branch_id}`}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold">Related Request</p>
                      <p className="font-medium">{dispatchDetails.request_number || dispatchDetails.stock_request?.request_number || 'Direct Dispatch'}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900 border-b pb-2">Logistics Details</h3>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold">Vehicle Number</p>
                      <p className="font-medium">{dispatchDetails.vehicle_number || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold">Driver Name</p>
                      <p className="font-medium">{dispatchDetails.driver_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold">Driver Phone</p>
                      <p className="font-medium">{dispatchDetails.driver_phone || '-'}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900 border-b pb-2">Timeline</h3>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold">Created Date</p>
                      <p className="font-medium">{formatDate(dispatchDetails.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold">Dispatched Date</p>
                      <p className="font-medium">{formatDate(dispatchDetails.dispatched_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold">Received Date</p>
                      <p className="font-medium">{formatDate(dispatchDetails.received_at)}</p>
                    </div>
                  </div>
                </div>

                {(dispatchDetails.notes || dispatchDetails.dispatch_notes) && (
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Notes</p>
                    <p className="text-sm">{dispatchDetails.notes || dispatchDetails.dispatch_notes}</p>
                  </div>
                )}

                <div>
                  <p className="font-medium mb-2">Dispatched Items</p>
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left p-3 text-xs font-bold text-gray-500 uppercase">SKU</th>
                          <th className="text-left p-3 text-xs font-bold text-gray-500 uppercase">Item</th>
                          <th className="text-center p-3 text-xs font-bold text-gray-500 uppercase">Quantity</th>
                          <th className="text-center p-3 text-xs font-bold text-gray-500 uppercase">Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dispatchDetails.items.map((item, index) => (
                          <tr key={index} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                            <td className="p-3 text-sm font-mono text-gray-600">{item.item_sku}</td>
                            <td className="p-3 text-sm font-medium text-gray-900">{item.item_name || item.item?.item_name || '-'}</td>
                            <td className="p-3 text-sm text-center font-semibold text-blue-600">
                              {item.dispatched_quantity || item.quantity}
                            </td>
                            <td className="p-3 text-sm text-center text-gray-600">{item.unit || item.item?.unit || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {dispatchDetails.status === 'PENDING' && (
                  <div className="flex justify-end space-x-3 pt-4">
                    <IOSButton
                      variant="primary"
                      leftIcon={<Truck className="h-4 w-4" />}
                      onClick={() => {
                        handleDispatch(dispatchDetails.id);
                      }}
                      disabled={isDispatching}
                    >
                      Dispatch Items
                    </IOSButton>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Create Dispatch Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-ios-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">Create New Dispatch</h2>
                  <IOSButton variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>
                    Close
                  </IOSButton>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                    <select
                      value={newDispatchBranch}
                      onChange={(e) => setNewDispatchBranch(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Branch</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                    <textarea
                      value={newDispatchNotes}
                      onChange={(e) => setNewDispatchNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      rows={3}
                      placeholder="Add any notes about this dispatch..."
                    ></textarea>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700">Items</label>
                      <IOSButton
                        size="sm"
                        variant="ghost"
                        onClick={handleAddItem}
                        leftIcon={<PlusCircle className="h-3.5 w-3.5" />}
                      >
                        Add Item
                      </IOSButton>
                    </div>

                    {isLoadingInventory ? (
                      <div className="flex justify-center items-center py-8">
                        <RefreshCw className="h-5 w-5 text-gray-400 animate-spin" />
                        <span className="ml-2 text-gray-500">Loading inventory...</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedItems.map((item, index) => (
                          <div key={index} className="flex space-x-3">
                            <div className="flex-1">
                              <label className="text-xs text-gray-500">Item</label>
                              <select
                                value={item.item_sku}
                                onChange={(e) => handleItemChange(index, 'item_sku', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                required
                              >
                                <option value="">Select Item</option>
                                {inventory.map((invItem) => (
                                  <option key={invItem.item_sku} value={invItem.item_sku}>
                                    {invItem.item_sku} - {invItem.item_name} ({invItem.quantity} in stock)
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">Quantity</label>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                min="1"
                                required
                              />
                            </div>
                            <div className="flex items-end pb-2">
                              {selectedItems.length > 1 && (
                                <IOSButton
                                  size="sm"
                                  variant="ghost"
                                  color="danger"
                                  onClick={() => handleRemoveItem(index)}
                                  leftIcon={<ArrowDown className="h-3.5 w-3.5" />}
                                >
                                  Remove
                                </IOSButton>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <IOSButton
                      variant="secondary"
                      onClick={() => setShowCreateModal(false)}
                    >
                      Cancel
                    </IOSButton>
                    <IOSButton
                      variant="primary"
                      onClick={handleCreateDispatch}
                      disabled={isDispatching}
                      leftIcon={<PackageCheck className="h-4 w-4" />}
                    >
                      Create Dispatch
                    </IOSButton>
                  </div>
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
export default function WarehouseDispatchesPage() {
  return (
    <BranchPageWrapper>
      <WarehouseDispatchesContent />
    </BranchPageWrapper>
  );
}
