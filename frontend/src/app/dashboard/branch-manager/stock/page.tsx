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
import { Package, RefreshCw, Search, AlertTriangle, TrendingDown, CheckCircle, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface StockItem { id: string; sku: string; name: string; category: string; quantity: number; min_quantity: number; unit: string; }

export default function BranchStockPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getBranchStock();
      if (response.success) setItems(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filteredItems = items.filter((i) => i.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const lowStockItems = items.filter(i => i.quantity <= i.min_quantity);
  const stats = { total: items.length, lowStock: lowStockItems.length, outOfStock: items.filter(i => i.quantity === 0).length };

  const handleRequestStock = async (item: StockItem) => {
    try {
      await storeAPI.createStockRequest({
        items: [{ item_sku: item.sku, requested_quantity: item.min_quantity * 2, current_branch_stock: item.quantity }],
        priority: item.quantity === 0 ? 'urgent' : 'normal',
        reason: 'Stock replenishment',
      });
      toast.success('Request submitted');
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Stock</h1><p className="text-gray-500">Branch inventory</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchItems}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
              <Link href="/dashboard/branch-manager/requests"><IOSButton><ShoppingCart className="h-4 w-4 mr-2" /> Requests</IOSButton></Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4"><Package className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Total Items</p><p className="text-xl font-bold">{stats.total}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-yellow-500"><TrendingDown className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Low Stock</p><p className="text-xl font-bold text-yellow-600">{stats.lowStock}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-red-500"><AlertTriangle className="h-6 w-6 text-[#FF3B30] mb-2" /><p className="text-sm text-gray-500">Out of Stock</p><p className="text-xl font-bold text-[#FF3B30]">{stats.outOfStock}</p></IOSCard>
          </div>

          {lowStockItems.length > 0 && (
            <IOSCard className="p-4 bg-yellow-50 border-yellow-200">
              <div className="flex items-center gap-2 mb-3"><AlertTriangle className="h-5 w-5 text-yellow-600" /><p className="font-medium text-yellow-800">Low Stock Alert ({lowStockItems.length})</p></div>
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
              <Input placeholder="Search items..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map((item) => {
                const isLow = item.quantity <= item.min_quantity;
                const isOut = item.quantity === 0;
                return (
                  <IOSCard key={item.id} className={`p-4 ${isOut ? 'border-red-200 bg-red-50' : isLow ? 'border-yellow-200 bg-yellow-50' : ''}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div><p className="font-bold">{item.name}</p><p className="text-sm text-gray-500">{item.category}</p></div>
                      {isOut ? <IOSBadge variant="error">Out</IOSBadge> : isLow ? <IOSBadge variant="warning">Low</IOSBadge> : null}
                    </div>
                    <div className="flex items-end justify-between mt-4">
                      <div><p className="text-2xl font-bold">{item.quantity}</p><p className="text-xs text-gray-500">Min: {item.min_quantity} {item.unit}</p></div>
                      {(isLow || isOut) && <IOSButton size="sm" onClick={() => handleRequestStock(item)}>Request</IOSButton>}
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
