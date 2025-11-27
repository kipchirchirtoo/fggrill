'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { BarChart3, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { storeAPI } from '@/lib/api';

export default function GMComparePage() {
  const [branches, setBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    setIsLoading(true);
    try {
      const res = await storeAPI.getBranchesWithStock();
      setBranches(res.branches || res || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const maxStock = Math.max(...branches.map((b: any) => b.stock_value || 0), 1);

  return (
    <ProtectedRoute allowedRoles={[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Branch Comparison</h1>
              <p className="text-gray-600">Compare performance across branches</p>
            </div>
            <Button onClick={fetchBranches} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Stock Value Comparison */}
          <Card className="p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
              Stock Value Comparison
            </h2>
            <div className="space-y-4">
              {branches.map((branch: any) => {
                const percentage = ((branch.stock_value || 0) / maxStock) * 100;
                return (
                  <div key={branch.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{branch.name}</span>
                      <span>KES {(branch.stock_value || 0).toLocaleString()}</span>
                    </div>
                    <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Branch Summary Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Value</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pending Requests</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {branches.map((branch: any) => (
                    <tr key={branch.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{branch.name}</td>
                      <td className="px-4 py-3 text-gray-600">{branch.code}</td>
                      <td className="px-4 py-3">KES {(branch.stock_value || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">{branch.pending_requests || 0}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${branch.is_central_warehouse ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'}`}>
                          {branch.is_central_warehouse ? 'Central' : 'Branch'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
