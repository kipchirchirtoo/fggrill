'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ArrowLeftRight, Plus, RefreshCw, CheckCircle, Clock, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { storeAPI } from '@/lib/api';

export default function AdminTransfersPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [transfers, setTransfers] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await storeAPI.getDispatchHistory().catch(() => ({ dispatches: [] }));
      setTransfers(res.dispatches || res.data || []);
    } catch (error) {
      toast.error('Failed to load transfers');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'in_transit': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Stock Transfers</h1>
              <p className="text-gray-600 mt-1">Manage inter-branch stock transfers</p>
            </div>
            <div className="flex gap-2">
              <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50">
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                <Plus className="h-4 w-4" /> New Transfer
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg"><Clock className="h-5 w-5 text-yellow-600" /></div>
                <div><p className="text-sm text-gray-500">Pending</p><p className="text-2xl font-bold">{transfers.filter(t => t.status === 'pending').length}</p></div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg"><Truck className="h-5 w-5 text-blue-600" /></div>
                <div><p className="text-sm text-gray-500">In Transit</p><p className="text-2xl font-bold">{transfers.filter(t => t.status === 'in_transit').length}</p></div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg"><CheckCircle className="h-5 w-5 text-green-600" /></div>
                <div><p className="text-sm text-gray-500">Delivered</p><p className="text-2xl font-bold">{transfers.filter(t => t.status === 'delivered').length}</p></div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg"><ArrowLeftRight className="h-5 w-5 text-indigo-600" /></div>
                <div><p className="text-sm text-gray-500">Total</p><p className="text-2xl font-bold">{transfers.length}</p></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            {isLoading ? (
              <div className="text-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div></div>
            ) : transfers.length === 0 ? (
              <div className="text-center py-12 text-gray-500"><ArrowLeftRight className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No transfers found</p></div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transfer ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transfers.map((transfer) => (
                    <tr key={transfer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium">#{transfer.id?.toString().slice(-6)}</td>
                      <td className="px-6 py-4">{transfer.from_branch || 'Central'}</td>
                      <td className="px-6 py-4">{transfer.to_branch || '-'}</td>
                      <td className="px-6 py-4">{transfer.item_count || transfer.items?.length || 0} items</td>
                      <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(transfer.status)}`}>{transfer.status}</span></td>
                      <td className="px-6 py-4 text-sm text-gray-500">{transfer.created_at ? new Date(transfer.created_at).toLocaleDateString() : '-'}</td>
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
