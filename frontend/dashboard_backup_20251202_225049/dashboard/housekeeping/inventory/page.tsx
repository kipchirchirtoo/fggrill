'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { storeAPI } from '@/lib/api';
import { 
  Package, RefreshCw, Search, Plus, AlertTriangle, CheckCircle,
  Minus, TrendingDown, ShoppingCart, ClipboardList
} from 'lucide-react';
import { toast } from 'sonner';

interface SupplyItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  min_quantity: number;
  unit: string;
  last_restocked?: string;
}

export default function HousekeepingInventoryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modal states
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SupplyItem | null>(null);
  const [requestQuantity, setRequestQuantity] = useState(1);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getBranchStock();
      if (response.success) {
        // Filter for housekeeping supplies
        const housekeepingItems = (response.data || []).filter((item: any) => 
          item.category?.toLowerCase().includes('housekeeping') ||
          item.category?.toLowerCase().includes('cleaning') ||
          item.category?.toLowerCase().includes('amenities') ||
          item.category?.toLowerCase().includes('linen')
        );
        setItems(housekeepingItems);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const categories = [...new Set(items.map(i => i.category))].filter(Boolean);

  const filteredItems = items.filter((item) => {
    const matchesSearch = 
      item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const lowStockItems = items.filter(i => i.quantity <= i.min_quantity);

  const openRequestModal = (item: SupplyItem) => {
    setSelectedItem(item);
    setRequestQuantity(item.min_quantity - item.quantity + 10);
    setRequestModalOpen(true);
  };

  const handleRequestStock = async () => {
    if (!selectedItem || requestQuantity <= 0) return;

    try {
      await storeAPI.createStockRequest({
        items: [{
          item_sku: selectedItem.sku,
          requested_quantity: requestQuantity,
          current_branch_stock: selectedItem.quantity,
        }],
        request_type: 'housekeeping',
        priority: selectedItem.quantity === 0 ? 'urgent' : 'normal',
        reason: 'Housekeeping supplies replenishment',
      });

      toast.success('Stock request submitted');
      setRequestModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit request');
    }
  };

  // Stats
  const stats = {
    total: items.length,
    lowStock: lowStockItems.length,
    outOfStock: items.filter(i => i.quantity === 0).length,
    adequate: items.filter(i => i.quantity > i.min_quantity).length,
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.HOUSEKEEPING, UserRole.HOUSEKEEPING_SUPERVISOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Housekeeping Supplies</h1>
              <p className="text-gray-500">Manage cleaning supplies and amenities</p>
            </div>
            <IOSButton variant="outline" onClick={fetchItems}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </IOSButton>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-ios-lg">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Items</p>
                  <p className="text-xl font-bold">{stats.total}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-ios-lg">
                  <TrendingDown className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Low Stock</p>
                  <p className="text-xl font-bold text-yellow-600">{stats.lowStock}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-ios-lg">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Out of Stock</p>
                  <p className="text-xl font-bold text-red-600">{stats.outOfStock}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-ios-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Adequate</p>
                  <p className="text-xl font-bold text-green-600">{stats.adequate}</p>
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <IOSCard className="p-4 bg-yellow-50 border-yellow-200">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <p className="font-medium text-yellow-800">Low Stock Alert ({lowStockItems.length} items)</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {lowStockItems.slice(0, 5).map((item) => (
                  <IOSButton
                    key={item.id}
                    size="sm"
                    variant="outline"
                    className="text-yellow-700 border-yellow-300"
                    onClick={() => openRequestModal(item)}
                  >
                    {item.name} ({item.quantity} left)
                  </IOSButton>
                ))}
              </div>
            </IOSCard>
          )}

          {/* Filters */}
          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search supplies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border rounded-ios-lg text-sm"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </IOSCard>

          {/* Items List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredItems.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No supplies found</p>
            </IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                const isLow = item.quantity <= item.min_quantity;
                const isOut = item.quantity === 0;

                return (
                  <IOSCard key={item.id} className={`p-4 ${isOut ? 'border-red-200 bg-red-50' : isLow ? 'border-yellow-200 bg-yellow-50' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold">{item.name}</p>
                        <p className="text-sm text-gray-500">{item.sku}</p>
                        <p className="text-xs text-gray-400">{item.category}</p>
                      </div>
                      {isOut ? (
                        <IOSBadge variant="destructive">Out of Stock</IOSBadge>
                      ) : isLow ? (
                        <IOSBadge variant="warning">Low Stock</IOSBadge>
                      ) : (
                        <IOSBadge variant="success">In Stock</IOSBadge>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold">{item.quantity}</p>
                        <p className="text-xs text-gray-500">Min: {item.min_quantity} {item.unit}</p>
                      </div>
                      <IOSButton
                        size="sm"
                        variant="outline"
                        onClick={() => openRequestModal(item)}
                      >
                        <ShoppingCart className="h-4 w-4 mr-1" />
                        Request
                      </IOSButton>
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>

        {/* Request Modal */}
        <Dialog open={requestModalOpen} onOpenChange={setRequestModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request Stock</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <div className="space-y-4 mt-4">
                <div className="p-4 bg-gray-50 rounded-ios-lg">
                  <p className="font-bold">{selectedItem.name}</p>
                  <p className="text-sm text-gray-500">{selectedItem.sku}</p>
                  <div className="flex justify-between mt-2">
                    <span className="text-sm">Current Stock:</span>
                    <span className="font-medium">{selectedItem.quantity} {selectedItem.unit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Minimum Required:</span>
                    <span className="font-medium">{selectedItem.min_quantity} {selectedItem.unit}</span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Request Quantity</label>
                  <Input
                    type="number"
                    min={1}
                    value={requestQuantity}
                    onChange={(e) => setRequestQuantity(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div className="flex gap-3">
                  <IOSButton variant="outline" onClick={() => setRequestModalOpen(false)} className="flex-1">
                    Cancel
                  </IOSButton>
                  <IOSButton onClick={handleRequestStock} className="flex-1">
                    Submit Request
                  </IOSButton>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
