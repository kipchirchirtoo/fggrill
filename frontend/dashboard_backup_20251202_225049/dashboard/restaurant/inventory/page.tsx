'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { storeAPI } from '@/lib/api';
import { 
  Package, RefreshCw, Search, AlertTriangle, TrendingDown,
  CheckCircle, ShoppingCart
} from 'lucide-react';
import { toast } from 'sonner';

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  min_quantity: number;
  unit: string;
}

export default function RestaurantInventoryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getBranchStock();
      if (response.success) {
        // Filter for restaurant/kitchen items
        const restaurantItems = (response.data || []).filter((item: any) =>
          item.category?.toLowerCase().includes('food') ||
          item.category?.toLowerCase().includes('kitchen') ||
          item.category?.toLowerCase().includes('beverage') ||
          item.category?.toLowerCase().includes('ingredient')
        );
        setItems(restaurantItems);
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
    const matchesSearch = item.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const lowStockItems = items.filter(i => i.quantity <= i.min_quantity);

  const handleRequestStock = async (item: InventoryItem) => {
    try {
      await storeAPI.createStockRequest({
        items: [{
          item_sku: item.sku,
          requested_quantity: item.min_quantity * 2,
          current_branch_stock: item.quantity,
        }],
        request_type: 'restaurant',
        priority: item.quantity === 0 ? 'urgent' : 'normal',
        reason: 'Kitchen stock replenishment',
      });
      toast.success('Stock request submitted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit request');
    }
  };

  const stats = {
    total: items.length,
    lowStock: lowStockItems.length,
    outOfStock: items.filter(i => i.quantity === 0).length,
    adequate: items.filter(i => i.quantity > i.min_quantity).length,
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.RESTAURANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Kitchen Inventory</h1>
              <p className="text-gray-500">Track ingredients and supplies</p>
            </div>
            <IOSButton variant="secondary" onClick={fetchItems}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </IOSButton>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-500">Total Items</p>
                  <p className="text-xl font-bold">{stats.total}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4 border-l-4 border-yellow-500">
              <div className="flex items-center gap-3">
                <TrendingDown className="h-8 w-8 text-yellow-600" />
                <div>
                  <p className="text-sm text-gray-500">Low Stock</p>
                  <p className="text-xl font-bold text-yellow-600">{stats.lowStock}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4 border-l-4 border-red-500">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-red-600" />
                <div>
                  <p className="text-sm text-gray-500">Out of Stock</p>
                  <p className="text-xl font-bold text-red-600">{stats.outOfStock}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4 border-l-4 border-green-500">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
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
                    variant="secondary"
                    onClick={() => handleRequestStock(item)}
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
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border rounded-ios-lg"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </IOSCard>

          {/* Items Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredItems.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No inventory items found</p>
            </IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map((item) => {
                const isLow = item.quantity <= item.min_quantity;
                const isOut = item.quantity === 0;

                return (
                  <IOSCard
                    key={item.id}
                    className={`p-4 ${isOut ? 'border-red-200 bg-red-50' : isLow ? 'border-yellow-200 bg-yellow-50' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold">{item.name}</p>
                        <p className="text-sm text-gray-500">{item.category}</p>
                      </div>
                      {isOut ? (
                        <IOSBadge variant="error">Out</IOSBadge>
                      ) : isLow ? (
                        <IOSBadge variant="warning">Low</IOSBadge>
                      ) : null}
                    </div>

                    <div className="flex items-end justify-between mt-4">
                      <div>
                        <p className="text-2xl font-bold">{item.quantity}</p>
                        <p className="text-xs text-gray-500">Min: {item.min_quantity} {item.unit}</p>
                      </div>
                      {(isLow || isOut) && (
                        <IOSButton size="sm" onClick={() => handleRequestStock(item)}>
                          <ShoppingCart className="h-3 w-3 mr-1" />
                          Request
                        </IOSButton>
                      )}
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
