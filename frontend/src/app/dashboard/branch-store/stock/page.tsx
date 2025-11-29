'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, Search, RefreshCw, AlertTriangle } from 'lucide-react';
import { storeAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function BranchStockPage() {
  const { user } = useAuth();
  const [stock, setStock] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchStock();
  }, [user]);

  const fetchStock = async () => {
    setIsLoading(true);
    try {
      const res = await storeAPI.getBranchStock(user?.branch_id || undefined);
      setStock(Array.isArray(res.data) ? res.data : res.stock || res || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStock = stock.filter(s =>
    s.item_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.item_sku?.toLowerCase().includes(search.toLowerCase()) ||
    s.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Branch Stock</h1>
              <p className="text-gray-600">Current inventory at your branch</p>
            </div>
            <Button onClick={fetchStock} variant="outline" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Search className="h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 border rounded-lg px-3 py-2"
              />
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading stock...</div>
            ) : filteredStock.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No stock items found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">SKU</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Quantity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredStock.map((item, idx) => {
                      const isLow = item.quantity <= (item.reorder_level || 10);
                      return (
                        <tr key={item.id || idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium">{item.item_name || item.name}</p>
                            <p className="text-xs text-gray-500">{item.category}</p>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.item_sku || item.sku}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`font-bold ${isLow ? 'text-red-600' : 'text-green-600'}`}>
                              {item.quantity}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {isLow ? (
                              <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                                <AlertTriangle className="h-3 w-3" /> Low Stock
                              </span>
                            ) : (
                              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
