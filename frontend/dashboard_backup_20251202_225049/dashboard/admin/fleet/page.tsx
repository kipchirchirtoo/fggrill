'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { storeAPI } from '@/lib/api';
import { Truck, RefreshCw, Car, User, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function AdminFleetPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ vehicles: 0, drivers: 0, available: 0, inUse: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [vehiclesRes, driversRes] = await Promise.allSettled([storeAPI.getVehicles(), storeAPI.getDrivers()]);
      const vehicles = vehiclesRes.status === 'fulfilled' ? vehiclesRes.value?.data || [] : [];
      const drivers = driversRes.status === 'fulfilled' ? driversRes.value?.data || [] : [];
      setStats({
        vehicles: vehicles.length,
        drivers: drivers.length,
        available: vehicles.filter((v: any) => v.status === 'available').length,
        inUse: vehicles.filter((v: any) => v.status === 'in_use').length,
      });
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Fleet Management</h1><p className="text-gray-500">Vehicles and drivers</p></div>
            <IOSButton variant="secondary" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4"><Car className="h-6 w-6 text-blue-600 mb-2" /><p className="text-sm text-gray-500">Vehicles</p><p className="text-xl font-bold">{stats.vehicles}</p></IOSCard>
            <IOSCard className="p-4"><User className="h-6 w-6 text-purple-600 mb-2" /><p className="text-sm text-gray-500">Drivers</p><p className="text-xl font-bold">{stats.drivers}</p></IOSCard>
            <IOSCard className="p-4"><CheckCircle className="h-6 w-6 text-green-600 mb-2" /><p className="text-sm text-gray-500">Available</p><p className="text-xl font-bold text-green-600">{stats.available}</p></IOSCard>
            <IOSCard className="p-4"><Truck className="h-6 w-6 text-orange-600 mb-2" /><p className="text-sm text-gray-500">In Use</p><p className="text-xl font-bold text-orange-600">{stats.inUse}</p></IOSCard>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Link href="/dashboard/admin/vehicles">
              <IOSCard className="p-6 hover:shadow-lg transition cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-blue-100 rounded-ios-lg"><Car className="h-8 w-8 text-blue-600" /></div>
                  <div><p className="font-bold text-lg">Vehicles</p><p className="text-gray-500">Manage fleet vehicles</p></div>
                </div>
              </IOSCard>
            </Link>
            <Link href="/dashboard/admin/drivers">
              <IOSCard className="p-6 hover:shadow-lg transition cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-purple-100 rounded-ios-lg"><User className="h-8 w-8 text-purple-600" /></div>
                  <div><p className="font-bold text-lg">Drivers</p><p className="text-gray-500">Manage drivers</p></div>
                </div>
              </IOSCard>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
