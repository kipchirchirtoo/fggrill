'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, RefreshCw, Plus } from 'lucide-react';
import { storeAPI } from '@/lib/api';
import { formatDate } from '@/lib/date-utils';
import { toast } from 'sonner';

export default function StockTakesPage() {
  const { user } = useAuth();
  const [stockTakes, setStockTakes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchStockTakes(); }, []);

  const fetchStockTakes = async () => {
    setIsLoading(true);
    try {
      const res = await storeAPI.getStockTakes();
      setStockTakes(Array.isArray(res.data) ? res.data : res.stock_takes || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-700';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Stock Takes</h1>
              <p className="text-gray-600">Physical inventory counts</p>
            </div>
            <Button onClick={fetchStockTakes} variant="outline" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          <Card className="p-4">
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : stockTakes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No stock takes yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Take #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Type</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Items</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stockTakes.map((take) => (
                      <tr key={take.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{take.take_number || take.id?.slice(0,8)}</td>
                        <td className="px-4 py-3 text-sm">{formatDate(take.started_at)}</td>
                        <td className="px-4 py-3 text-sm">{take.take_type || 'FULL'}</td>
                        <td className="px-4 py-3 text-center">{take.total_items_counted || 0}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded ${getStatusColor(take.status)}`}>
                            {take.status}
                          </span>
                        </td>
                      </tr>
                    ))}
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
