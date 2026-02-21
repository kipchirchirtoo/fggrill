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
  Package, Search, Plus, Filter, AlertTriangle, RefreshCw,
  ShoppingCart, ArrowRight, ClipboardList, Check, X
} from 'lucide-react';

interface InventoryItem {
  id: string;
  item_sku: string;
  item_name: string;
  description?: string;
  category: string;
  unit_of_measure: string;
  quantity: number;
  reserved_quantity: number;
  reorder_level: number;
  max_stock_level: number;
  bin_location?: string;
  last_stock_in?: string;
  last_stock_out?: string;
  last_counted?: string;
}

// Wrap the dashboard with BranchPageWrapper to prevent hydration errors
export default function BranchInventoryPage() {
  return (
    <BranchPageWrapper>
      <BranchInventoryPageContent />
    </BranchPageWrapper>
  );
}

const CATEGORIES = ['Beverages', 'Food', 'Cleaning', 'Amenities', 'Kitchen', 'Office', 'Other'];

function BranchInventoryPageContent() {
  const { user } = useAuth();
  const { activeBranch, activeBranchId } = useBranch();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);

  // Request modal state
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<{ [key: string]: { quantity: number } }>({});
  const [requestForm, setRequestForm] = useState({
    priority: 'normal',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch inventory data when branch changes
  useEffect(() => {
    if (activeBranchId) {
      fetchInventory();
    }
  }, [activeBranchId]);

  // Apply filters when search or category changes
  useEffect(() => {
    applyFilters();
  }, [inventory, searchTerm, categoryFilter, showLowStock]);

  const fetchInventory = async () => {
    if (!activeBranchId) return;

    setIsLoading(true);
    try {
      const response = await branchOperationsAPI.getInventory(
        { category: categoryFilter, lowStock: showLowStock },
        activeBranchId
      );

      if (response.success) {
        const items = response.data || [];
        setInventory(items);
      } else {
        throw new Error(response.message || 'Failed to fetch inventory');
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Failed to load inventory data');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...inventory];

    // Apply category filter
    if (categoryFilter) {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.item_name.toLowerCase().includes(searchLower) ||
        item.item_sku.toLowerCase().includes(searchLower) ||
        (item.description && item.description.toLowerCase().includes(searchLower))
      );
    }

    // Apply low stock filter
    if (showLowStock) {
      filtered = filtered.filter(item =>
        item.quantity <= (item.reorder_level || 10)
      );
    }

    setFilteredItems(filtered);
  };

  const toggleItemSelection = (item: InventoryItem) => {
    const newSelected = { ...selectedItems };

    if (newSelected[item.item_sku]) {
      delete newSelected[item.item_sku];
    } else {
      newSelected[item.item_sku] = { quantity: 1 };
    }

    setSelectedItems(newSelected);
  };

  const updateRequestQuantity = (sku: string, quantity: number) => {
    if (quantity < 1) return;

    setSelectedItems(prev => ({
      ...prev,
      [sku]: { quantity }
    }));
  };

  const openRequestModal = () => {
    // Pre-select low stock items
    const lowStockItems = inventory.filter(item =>
      item.quantity <= (item.reorder_level || 10)
    );

    const preSelected: { [key: string]: { quantity: number } } = {};
    lowStockItems.forEach(item => {
      const neededQuantity = (item.reorder_level || 10) - item.quantity;
      if (neededQuantity > 0) {
        preSelected[item.item_sku] = { quantity: neededQuantity };
      }
    });

    setSelectedItems(preSelected);
    setRequestForm({
      priority: 'normal',
      notes: '',
    });
    setIsRequestModalOpen(true);
  };

  const handleCreateRequest = async () => {
    if (!activeBranchId) return;

    // Convert selected items to request format
    const items = Object.keys(selectedItems).map(sku => {
      const item = inventory.find(i => i.item_sku === sku);
      return {
        item_sku: sku,
        requested_quantity: selectedItems[sku].quantity
      };
    });

    if (items.length === 0) {
      toast.error('Please select at least one item');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await branchOperationsAPI.createStockRequest({
        requesting_branch_id: activeBranchId,
        items,
        priority: requestForm.priority.toUpperCase(),
        reason: requestForm.notes,
        request_type: 'REPLENISHMENT'
      }, activeBranchId);

      if (response.success) {
        toast.success('Stock request created successfully');
        setIsRequestModalOpen(false);
        setSelectedItems({});
      } else {
        throw new Error(response.message || 'Failed to create stock request');
      }
    } catch (error) {
      console.error('Error creating stock request:', error);
      toast.error('Failed to create stock request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStockLevel = (item: InventoryItem) => {
    const reorderLevel = item.reorder_level || 10;
    if (item.quantity <= 0) return 'out';
    if (item.quantity <= reorderLevel * 0.5) return 'critical';
    if (item.quantity <= reorderLevel) return 'low';
    return 'normal';
  };

  const getStockBadge = (stockLevel: string) => {
    switch (stockLevel) {
      case 'out':
        return <IOSBadge className="bg-red-100 text-red-700">Out of Stock</IOSBadge>;
      case 'critical':
        return <IOSBadge className="bg-orange-100 text-orange-700">Critical</IOSBadge>;
      case 'low':
        return <IOSBadge className="bg-yellow-100 text-yellow-700">Low</IOSBadge>;
      default:
        return <IOSBadge className="bg-green-100 text-green-700">In Stock</IOSBadge>;
    }
  };

  return (
    <ProtectedRoute allowedRoles={[
      UserRole.BRANCH_OPERATIONS_MANAGER,
      UserRole.BRANCH_MANAGER,
      UserRole.BRANCH_STOREKEEPER,
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.AUDITOR
    ]}>
      <BranchAwareDashboardLayout
        title="Branch Inventory"
        subtitle={`Manage inventory for ${activeBranch?.name || 'your branch'}`}
        actionButton={
          <IOSButton onClick={openRequestModal} leftIcon={<ShoppingCart />}>
            Request Stock
          </IOSButton>
        }
      >
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <Package className="h-5 w-5 text-blue-600 mb-2" />
              <p className="text-sm text-gray-500">Total Items</p>
              <p className="text-lg font-bold">{inventory.length}</p>
            </IOSCard>

            <IOSCard className="p-4">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mb-2" />
              <p className="text-sm text-gray-500">Low Stock Items</p>
              <p className="text-lg font-bold text-yellow-600">
                {inventory.filter(i => i.quantity <= (i.reorder_level || 10)).length}
              </p>
            </IOSCard>

            <IOSCard className="p-4">
              <ClipboardList className="h-5 w-5 text-purple-600 mb-2" />
              <p className="text-sm text-gray-500">Active Categories</p>
              <p className="text-lg font-bold">
                {new Set(inventory.map(i => i.category)).size}
              </p>
            </IOSCard>

            <IOSCard className="p-4">
              <ShoppingCart className="h-5 w-5 text-green-600 mb-2" />
              <p className="text-sm text-gray-500">Selected Items</p>
              <p className="text-lg font-bold text-green-600">{Object.keys(selectedItems).length}</p>
            </IOSCard>
          </div>

          {/* Search and Filter */}
          <IOSCard className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <Input
                  placeholder="Search by name, SKU, or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center space-x-2 h-10 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLowStock}
                    onChange={() => setShowLowStock(!showLowStock)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span>Show Low Stock Only</span>
                </label>
              </div>

              <div>
                <IOSButton
                  onClick={fetchInventory}
                  leftIcon={<RefreshCw />}
                  className="w-full"
                >
                  Refresh
                </IOSButton>
              </div>
            </div>
          </IOSCard>

          {/* Inventory Table */}
          <IOSCard>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
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
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center">
                        <div className="flex flex-col items-center">
                          <Package className="h-12 w-12 text-gray-300 mb-2" />
                          <p className="text-gray-500">No inventory items found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const stockLevel = getStockLevel(item);
                      const isSelected = !!selectedItems[item.item_sku];

                      return (
                        <tr key={item.item_sku} className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleItemSelection(item)}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <div>
                              <p className="font-medium">{item.item_name}</p>
                              <p className="text-xs text-gray-500 truncate max-w-xs">{item.description || '-'}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4 font-mono text-sm">{item.item_sku}</td>
                          <td className="px-4 py-4">{item.category}</td>
                          <td className="px-4 py-4 text-right font-bold">
                            <span className={
                              stockLevel === 'out' ? 'text-red-600' :
                                stockLevel === 'critical' ? 'text-orange-600' :
                                  stockLevel === 'low' ? 'text-yellow-600' :
                                    'text-green-600'
                            }>
                              {item.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right text-gray-500">{item.unit_of_measure}</td>
                          <td className="px-4 py-4 text-center">
                            {getStockBadge(stockLevel)}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="flex justify-center space-x-2">
                              <IOSButton
                                size="sm"
                                variant={isSelected ? 'primary' : 'secondary'}
                                onClick={() => toggleItemSelection(item)}
                              >
                                {isSelected ? <Check className="h-4 w-4" /> : 'Select'}
                              </IOSButton>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </IOSCard>
        </div>

        {/* Stock Request Modal */}
        <Dialog open={isRequestModalOpen} onOpenChange={setIsRequestModalOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Create Stock Request</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Selected Items ({Object.keys(selectedItems).length})</h3>
                <div>
                  <label className="flex items-center space-x-2">
                    <span>Priority:</span>
                    <select
                      value={requestForm.priority}
                      onChange={(e) => setRequestForm({ ...requestForm, priority: e.target.value })}
                      className="px-2 py-1 border rounded-ios-lg"
                    >
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="overflow-y-auto max-h-64">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Request Qty</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {Object.keys(selectedItems).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                          No items selected. Please select items from inventory.
                        </td>
                      </tr>
                    ) : (
                      Object.keys(selectedItems).map(sku => {
                        const item = inventory.find(i => i.item_sku === sku);
                        if (!item) return null;

                        return (
                          <tr key={sku} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="font-medium">{item.item_name}</p>
                            </td>
                            <td className="px-4 py-3 font-mono text-sm">{sku}</td>
                            <td className="px-4 py-3 text-right">{item.quantity}</td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="1"
                                value={selectedItems[sku].quantity}
                                onChange={(e) => updateRequestQuantity(sku, parseInt(e.target.value))}
                                className="w-20 px-2 py-1 border rounded-ios-lg text-center"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <IOSButton
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleItemSelection(item)}
                              >
                                <X className="h-4 w-4" />
                              </IOSButton>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={requestForm.notes}
                  onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
                  placeholder="Add any details or special instructions..."
                  className="w-full px-3 py-2 border rounded-ios-lg"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 mt-4 border-t">
                <IOSButton
                  variant="secondary"
                  onClick={() => setIsRequestModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </IOSButton>
                <IOSButton
                  onClick={handleCreateRequest}
                  disabled={isSubmitting || Object.keys(selectedItems).length === 0}
                  leftIcon={isSubmitting ? undefined : <ArrowRight />}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}
