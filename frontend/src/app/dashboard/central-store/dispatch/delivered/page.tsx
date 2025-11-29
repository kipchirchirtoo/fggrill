'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CheckCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { storeAPI } from '@/lib/api';

export default function CentralStoreDispatchDeliveredPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [dispatches, setDispatches] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await storeAPI.getDispatchHistory().catch(() => ({ dispatches: [] }));
      const all = res.dispatches || res.data || [];
      setDispatches(all.filter((d: any) => d.status === 'delivered'));
    } catch (error) {
      toast.error('Failed to load dispatches');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Delivered Dispatches</h1>
              <p className="text-gray-600 mt-1">Completed deliveries</p>
            </div>
            <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            {isLoading ? (
              <div className="text-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div></div>
            ) : dispatches.length === 0 ? (
              <div className="text-center py-12 text-gray-500"><CheckCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No delivered dispatches</p></div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dispatch ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delivered On</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dispatches.map((dispatch) => (
                    <tr key={dispatch.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium">#{dispatch.id?.toString().slice(-6)}</td>
                      <td className="px-6 py-4">{dispatch.to_branch || dispatch.destination || '-'}</td>
                      <td className="px-6 py-4">{dispatch.items?.length || 0} items</td>
                      <td className="px-6 py-4 text-sm">{dispatch.delivered_at ? new Date(dispatch.delivered_at).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
