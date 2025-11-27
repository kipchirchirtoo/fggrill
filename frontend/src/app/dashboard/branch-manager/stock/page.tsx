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
      setStock(res.stock || res || []);
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
                  {stock.map((s: any) => (
                    <tr key={s.id || s.sku} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{s.item_name || s.name}</td>
                      <td className="px-4 py-3 text-gray-600">{s.sku || s.item_sku}</td>
                      <td className="px-4 py-3">{s.quantity}</td>
                      <td className="px-4 py-3">
                        <Badge className={s.quantity <= (s.reorder_level || 10) ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                          {s.quantity <= (s.reorder_level || 10) ? 'Low' : 'OK'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
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
