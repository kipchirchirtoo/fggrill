'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Building2, Package, AlertTriangle, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { storeAPI } from '@/lib/api';

export default function AdminBranchStockPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [branchStock, setBranchStock] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const branchesRes = await storeAPI.getBranchesWithStock().catch(() => ({ branches: [] }));
      setBranches(branchesRes.branches || branchesRes.data || []);
      const stockRes = await storeAPI.getBranchStock().catch(() => ({ items: [] }));
      setBranchStock(stockRes.items || stockRes.data || []);
    } catch (error) {
      toast.error('Failed to load branch stock');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Branch Stock</h1>
              <p className="text-gray-600 mt-1">View stock levels across all branches</p>
            </div>
            <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>

          <div className="flex gap-4">
            <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="px-4 py-2 border rounded-lg">
              <option value="all">All Branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {isLoading ? (
            <div className="text-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {branches.map(branch => (
                <div key={branch.id} className="bg-white rounded-xl p-6 border hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-100 rounded-lg"><Building2 className="h-5 w-5 text-indigo-600" /></div>
                    <div>
                      <h3 className="font-semibold">{branch.name}</h3>
                      <p className="text-sm text-gray-500">{branch.code}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between"><span className="text-gray-500">Items</span><span className="font-medium">{branch.item_count || 0}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Total Value</span><span className="font-medium">KES {((branch.total_value || 0)/1000).toFixed(0)}K</span></div>
                    {(branch.low_stock_count || 0) > 0 && (
                      <div className="flex items-center gap-2 text-red-600 text-sm mt-2">
                        <AlertTriangle className="h-4 w-4" /> {branch.low_stock_count} items low
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
