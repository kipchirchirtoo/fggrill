'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Clock, Truck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { storeAPI } from '@/lib/api';

export default function CentralStoreDispatchPendingPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [dispatches, setDispatches] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await storeAPI.getDispatchHistory().catch(() => ({ dispatches: [] }));
      const all = res.dispatches || res.data || [];
      setDispatches(all.filter((d: any) => d.status === 'pending'));
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
              <h1 className="text-3xl font-bold text-gray-900">Pending Dispatches</h1>
              <p className="text-gray-600 mt-1">Dispatches awaiting processing</p>
            </div>
            <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            {isLoading ? (
              <div className="text-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div></div>
            ) : dispatches.length === 0 ? (
              <div className="text-center py-12 text-gray-500"><Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No pending dispatches</p></div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dispatch ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dispatches.map((dispatch) => (
                    <tr key={dispatch.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium">#{dispatch.id?.toString().slice(-6)}</td>
                      <td className="px-6 py-4">{dispatch.to_branch || dispatch.destination || '-'}</td>
                      <td className="px-6 py-4">{dispatch.items?.length || 0} items</td>
                      <td className="px-6 py-4 text-sm">{dispatch.created_at ? new Date(dispatch.created_at).toLocaleDateString() : '-'}</td>
                      <td className="px-6 py-4">
                        <button className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">Process</button>
                      </td>
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
