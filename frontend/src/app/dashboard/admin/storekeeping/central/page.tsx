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
import { Warehouse, RefreshCw, Search, Package, AlertTriangle } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface StockItem { id: string; sku: string; name: string; category: string; quantity: number; min_quantity: number; unit: string; }

export default function AdminCentralStorePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getItems();
      if (response.success) setItems(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filteredItems = items.filter((i) => i.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const lowStock = items.filter(i => i.quantity <= i.min_quantity).length;

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Central Store</h1><p className="text-gray-500">Central warehouse inventory</p></div>
            <IOSButton variant="secondary" onClick={fetchItems} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <IOSCard className="p-4"><Package className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Total Items</p><p className="text-xl font-bold">{items.length}</p></IOSCard>
            <IOSCard className="p-4"><AlertTriangle className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Low Stock</p><p className="text-xl font-bold text-yellow-600">{lowStock}</p></IOSCard>
          </div>

          <IOSCard className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
              <Input placeholder="Search items..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => {
                const isLow = item.quantity <= item.min_quantity;
                return (
                  <IOSCard key={item.id} className={`p-4 ${isLow ? 'border-yellow-200 bg-yellow-50' : ''}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div><p className="font-bold">{item.name}</p><p className="text-sm text-gray-500">{item.sku}</p></div>
                      {isLow && <IOSBadge variant="light" color="warning">Low</IOSBadge>}
                    </div>
                    <div className="flex items-end justify-between mt-4">
                      <div><p className="text-2xl font-bold">{item.quantity}</p><p className="text-xs text-gray-500">{item.unit}</p></div>
                      <p className="text-sm text-gray-500">{item.category}</p>
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
