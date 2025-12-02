'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Building, RefreshCw, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { storeAPI } from '@/lib/api';

export default function CentralStoreSuppliersPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await storeAPI.getSuppliers().catch(() => ({ suppliers: [] }));
      setSuppliers(res.suppliers || res.data || []);
    } catch (error) {
      toast.error('Failed to load suppliers');
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
              <h1 className="text-3xl font-bold text-gray-900">Suppliers</h1>
              <p className="text-gray-600 mt-1">Manage suppliers and vendors</p>
            </div>
            <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            {isLoading ? (
              <div className="text-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div></div>
            ) : suppliers.length === 0 ? (
              <div className="text-center py-12 text-gray-500"><Building className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No suppliers found</p></div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                            <Building className="h-5 w-5 text-indigo-600" />
                          </div>
                          <span className="font-medium">{supplier.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm space-y-1">
                          {supplier.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3" />{supplier.phone}</div>}
                          {supplier.email && <div className="flex items-center gap-2"><Mail className="h-3 w-3" />{supplier.email}</div>}
                        </div>
                      </td>
                      <td className="px-6 py-4 capitalize">{supplier.category || 'General'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${supplier.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {supplier.status || 'active'}
                        </span>
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
