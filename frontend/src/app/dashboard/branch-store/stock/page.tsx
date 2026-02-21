'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { storeAPI, auditorReportsAPI } from '@/lib/api';
import { Package, RefreshCw, Search, AlertTriangle, ShoppingCart, FileDown, TrendingDown } from 'lucide-react';
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
      if (response.success && response.data) {
        // Map backend data to StockItem interface
        const mappedItems: StockItem[] = response.data.map((record: any) => ({
          id: record.id,
          sku: record.item_sku,
          name: record.item?.item_name || 'Unknown Item',
          category: record.item?.category || 'Uncategorized',
          quantity: record.quantity || 0,
          min_quantity: record.reorder_level || 10,
          unit: record.item?.unit_of_measure || 'units'
        }));
        setItems(mappedItems);
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filteredItems = items.filter((i) => (i.name || '').toLowerCase().includes(searchQuery.toLowerCase()));
  const lowStockItems = items.filter(i => i.quantity <= i.min_quantity);

  const handleRequestStock = async (item: StockItem) => {
    try {
      await storeAPI.createStockRequest({
        requesting_branch_id: user?.branch_id || undefined,
        items: [{ item_sku: item.sku, requested_quantity: item.min_quantity * 2, current_branch_stock: item.quantity }],
        priority: item.quantity === 0 ? 'urgent' : 'normal',
        reason: 'Stock replenishment',
      });
      toast.success('Request submitted');
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const handleExport = async () => {
    try {
      toast.loading("Generating stock ledger...");
      await auditorReportsAPI.exportComprehensiveStockAudit({
        branch_id: user?.branch_id || undefined
      });
      toast.dismiss();
      toast.success("Stock ledger generated successfully");
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error("Failed to export ledger");
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {user?.role === UserRole.AUDITOR ? 'Inventory Oversight' : 'Stock'}
              </h1>
              <p className="text-gray-500">
                {user?.role === UserRole.AUDITOR ? 'Review branch inventory levels' : 'Branch inventory'}
              </p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchItems} leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}>Refresh</IOSButton>
              {user?.role === UserRole.AUDITOR && (
                <IOSButton variant="secondary" onClick={handleExport} leftIcon={<FileDown />}>Export Ledger</IOSButton>
              )}
              {user?.role !== UserRole.AUDITOR && (
                <Link href="/dashboard/branch-store/requests"><IOSButton leftIcon={<ShoppingCart />}>Requests</IOSButton></Link>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <IOSCard className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-600">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Total Items</p>
                <p className="text-xl font-black text-stone-900">{items.length}</p>
              </div>
            </IOSCard>
            <IOSCard className="p-4 flex items-center gap-4 border-l-4 border-yellow-500">
              <div className="w-12 h-12 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest text-yellow-600">Low Stock</p>
                <p className="text-xl font-black text-yellow-600">{lowStockItems.length}</p>
              </div>
            </IOSCard>
            <IOSCard className="p-4 flex items-center gap-4 border-l-4 border-red-500">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                <TrendingDown className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest text-red-600">Stock Out</p>
                <p className="text-xl font-black text-red-600">{items.filter(i => i.quantity === 0).length}</p>
              </div>
            </IOSCard>
          </div>

          {lowStockItems.length > 0 && (
            <IOSCard className="p-4 bg-yellow-50 border-yellow-200">
              <div className="flex items-center gap-2 mb-3"><AlertTriangle className="h-5 w-5 text-yellow-600" /><p className="font-medium text-yellow-800">Low Stock Alert</p></div>
              <div className="flex flex-wrap gap-2">
                {lowStockItems.slice(0, 5).map((item) => (
                  <IOSButton key={item.id} size="sm" variant="secondary" onClick={() => handleRequestStock(item)}>{item.name} ({item.quantity})</IOSButton>
                ))}
              </div>
            </IOSCard>
          )}

          <IOSCard className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
              <Input placeholder="Search items..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
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
                      {isOut ? <IOSBadge variant="light" color="danger">Out</IOSBadge> : isLow ? <IOSBadge variant="light" color="warning">Low</IOSBadge> : null}
                    </div>
                    <div className="flex items-end justify-between mt-4">
                      <div><p className="text-2xl font-bold">{item.quantity}</p><p className="text-xs text-gray-500">Min: {item.min_quantity} {item.unit}</p></div>
                      {user?.role !== UserRole.AUDITOR && (isLow || isOut) && (
                        <IOSButton size="sm" onClick={() => handleRequestStock(item)}>Request</IOSButton>
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
