'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { storeAPI } from '@/lib/api';
import { Wine, RefreshCw, Search, AlertTriangle, TrendingDown, CheckCircle, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface InventoryItem { id: string; sku: string; name: string; category: string; quantity: number; min_quantity: number; unit: string; }

export default function BarInventoryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getBranchStock();
      if (response.success) {
        const barItems = (response.data || []).filter((item: any) =>
          item.category?.toLowerCase().includes('beverage') ||
          item.category?.toLowerCase().includes('alcohol') ||
          item.category?.toLowerCase().includes('drink') ||
          item.category?.toLowerCase().includes('bar')
        );
        setItems(barItems);
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filteredItems = items.filter((item) => item.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const lowStockItems = items.filter(i => i.quantity <= i.min_quantity);

  const handleRequestStock = async (item: InventoryItem) => {
    try {
      await storeAPI.createStockRequest({
        items: [{ item_sku: item.sku, requested_quantity: item.min_quantity * 2, current_branch_stock: item.quantity }],
        request_type: 'bar', priority: item.quantity === 0 ? 'urgent' : 'normal', reason: 'Bar stock replenishment',
      });
      toast.success('Request submitted');
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const stats = { total: items.length, lowStock: lowStockItems.length, outOfStock: items.filter(i => i.quantity === 0).length, adequate: items.filter(i => i.quantity > i.min_quantity).length };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BARTENDER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Bar Inventory</h1><p className="text-gray-500">Track drinks and supplies</p></div>
            <IOSButton variant="secondary" onClick={fetchItems} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4"><Wine className="h-8 w-8 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Total</p><p className="text-xl font-bold">{stats.total}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-yellow-500"><TrendingDown className="h-8 w-8 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Low Stock</p><p className="text-xl font-bold text-yellow-600">{stats.lowStock}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-red-500"><AlertTriangle className="h-8 w-8 text-[#FF3B30] mb-2" /><p className="text-sm text-gray-500">Out of Stock</p><p className="text-xl font-bold text-[#FF3B30]">{stats.outOfStock}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-green-500"><CheckCircle className="h-8 w-8 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Adequate</p><p className="text-xl font-bold text-[#34C759]">{stats.adequate}</p></IOSCard>
          </div>

          {lowStockItems.length > 0 && (
            <IOSCard className="p-4 bg-yellow-50 border-yellow-200">
              <div className="flex items-center gap-2 mb-3"><AlertTriangle className="h-5 w-5 text-yellow-600" /><p className="font-medium text-yellow-800">Low Stock ({lowStockItems.length})</p></div>
              <div className="flex flex-wrap gap-2">
                {lowStockItems.slice(0, 5).map((item) => (
                  <IOSButton key={item.id} size="sm" variant="secondary" onClick={() => handleRequestStock(item)}>{item.name} ({item.quantity})</IOSButton>
                ))}
              </div>
            </IOSCard>
          )}

          <IOSCard className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredItems.length === 0 ? (
            <IOSCard className="p-12 text-center"><Wine className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No items found</p></IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map((item) => {
                const isLow = item.quantity <= item.min_quantity;
                const isOut = item.quantity === 0;
                return (
                  <IOSCard key={item.id} className={`p-4 ${isOut ? 'border-red-200 bg-red-50' : isLow ? 'border-yellow-200 bg-yellow-50' : ''}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div><p className="font-bold">{item.name}</p><p className="text-sm text-gray-500">{item.category}</p></div>
                      {isOut ? <IOSBadge variant="light" color="danger">Out</IOSBadge> : isLow ? <IOSBadge variant="light" color="warning">Low</IOSBadge> : null}
                    </div>
                    <div className="flex items-end justify-between mt-4">
                      <div><p className="text-2xl font-bold">{item.quantity}</p><p className="text-xs text-gray-500">Min: {item.min_quantity} {item.unit}</p></div>
                      {(isLow || isOut) && <IOSButton size="sm" onClick={() => handleRequestStock(item)}><ShoppingCart className="h-3 w-3 mr-1" /> Request</IOSButton>}
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
