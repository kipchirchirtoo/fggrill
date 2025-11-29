'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Package, Search, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { storeAPI } from '@/lib/api';

export default function CentralStoreStockPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await storeAPI.getItems().catch(() => ({ items: [] }));
      setItems(res.items || res.data || []);
    } catch (error) {
      toast.error('Failed to load stock');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredItems = items.filter(item =>
    item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Stock Levels</h1>
              <p className="text-gray-600 mt-1">Current stock in central warehouse</p>
            </div>
            <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-5 border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg"><Package className="h-5 w-5 text-indigo-600" /></div>
                <div><p className="text-sm text-gray-500">Total Items</p><p className="text-2xl font-bold">{items.length}</p></div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
                <div><p className="text-sm text-gray-500">Low Stock</p><p className="text-2xl font-bold">{items.filter(i => (i.quantity || 0) <= (i.reorder_level || 10)).length}</p></div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg"><Package className="h-5 w-5 text-green-600" /></div>
                <div><p className="text-sm text-gray-500">Total Value</p><p className="text-2xl font-bold">KES {(items.reduce((s,i) => s + (i.quantity||0)*(i.cost_price||0), 0)/1000).toFixed(0)}K</p></div>
              </div>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input type="text" placeholder="Search items..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border rounded-lg" />
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            {isLoading ? (
              <div className="text-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div></div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12 text-gray-500"><Package className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No items found</p></div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reorder Level</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredItems.slice(0, 50).map((item) => {
                    const isLow = (item.quantity || 0) <= (item.reorder_level || 10);
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium">{item.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{item.sku}</td>
                        <td className="px-6 py-4">{item.quantity || 0} {item.unit}</td>
                        <td className="px-6 py-4">{item.reorder_level || 10}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${isLow ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                            {isLow ? 'Low Stock' : 'In Stock'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
