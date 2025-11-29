'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Truck, Plus, RefreshCw, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { storeAPI } from '@/lib/api';

export default function AdminVehiclesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [vehicles, setVehicles] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await storeAPI.getVehicles().catch(() => ({ vehicles: [] }));
      setVehicles(res.vehicles || res.data || []);
    } catch (error) {
      toast.error('Failed to load vehicles');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'in_use': return 'bg-blue-100 text-blue-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Vehicle Management</h1>
              <p className="text-gray-600 mt-1">Manage company vehicles</p>
            </div>
            <div className="flex gap-2">
              <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50">
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                <Plus className="h-4 w-4" /> Add Vehicle
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg"><Truck className="h-5 w-5 text-indigo-600" /></div>
                <div><p className="text-sm text-gray-500">Total Vehicles</p><p className="text-2xl font-bold">{vehicles.length}</p></div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg"><Truck className="h-5 w-5 text-green-600" /></div>
                <div><p className="text-sm text-gray-500">Available</p><p className="text-2xl font-bold">{vehicles.filter(v => v.status === 'available').length}</p></div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg"><Truck className="h-5 w-5 text-blue-600" /></div>
                <div><p className="text-sm text-gray-500">In Use</p><p className="text-2xl font-bold">{vehicles.filter(v => v.status === 'in_use').length}</p></div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg"><Truck className="h-5 w-5 text-yellow-600" /></div>
                <div><p className="text-sm text-gray-500">Maintenance</p><p className="text-2xl font-bold">{vehicles.filter(v => v.status === 'maintenance').length}</p></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            {isLoading ? (
              <div className="text-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div></div>
            ) : vehicles.length === 0 ? (
              <div className="text-center py-12 text-gray-500"><Truck className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No vehicles found</p></div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reg. Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium">{vehicle.name || vehicle.make}</td>
                      <td className="px-6 py-4">{vehicle.registration_number || vehicle.reg_no}</td>
                      <td className="px-6 py-4 capitalize">{vehicle.type || 'Vehicle'}</td>
                      <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(vehicle.status)}`}>{vehicle.status}</span></td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button className="p-1 text-gray-600 hover:text-indigo-600"><Edit className="h-4 w-4" /></button>
                          <button className="p-1 text-gray-600 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                        </div>
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
