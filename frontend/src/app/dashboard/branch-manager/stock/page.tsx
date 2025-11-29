'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { storeAPI } from '@/lib/api';

export default function BranchManagerStockPage() {
  const { user } = useAuth();
  const [stock, setStock] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchStock(); }, [user]);

  const fetchStock = async () => {
    setIsLoading(true);
    try {
      const res = await storeAPI.getBranchStock(user?.branch_id);
      const stockData = res?.data?.stock || res?.data || res?.stock || (Array.isArray(res) ? res : []);
      setStock(Array.isArray(stockData) ? stockData : []);
    } catch (error) { console.error('Error:', error); } 
    finally { setIsLoading(false); }
  };

  const lowStock = stock.filter((s: any) => s.quantity <= (s.reorder_level || 10));

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Branch Stock</h1>
              <p className="text-gray-600">View branch inventory levels</p>
            </div>
            <Button onClick={fetchStock} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          {lowStock.length > 0 && (
            <Card className="p-4 bg-amber-50 border-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <p className="font-medium text-amber-800">{lowStock.length} items need restocking</p>
              </div>
            </Card>
          )}

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stock.map((s: any) => {
                    const itemName = s.item_name || s.name || s.item?.name || `Item #${s.item_id || s.id}`;
                    const itemSku = s.sku || s.item_sku || s.item?.sku || '-';
                    const qty = s.quantity ?? 0;
                    const isLow = qty <= (s.reorder_level || s.item?.reorder_level || 10);
                    
                    return (
                      <tr key={s.id || s.item_id || itemSku} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{itemName}</p>
                            {s.category && <p className="text-xs text-gray-500">{s.category}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-sm">{itemSku}</td>
                        <td className="px-4 py-3 font-medium">{qty}</td>
                        <td className="px-4 py-3">
                          <Badge className={isLow ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                            {isLow ? 'Low Stock' : 'In Stock'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {stock.length === 0 && <div className="p-8 text-center text-gray-500">{isLoading ? 'Loading...' : 'No stock data'}</div>}
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
