'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { storeAPI } from '@/lib/api';
import { User, RefreshCw, Plus, Phone, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Driver { id: string; name: string; phone?: string; license_number?: string; status: 'available' | 'on_trip' | 'off_duty'; }

export default function CentralDriversPage() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', license_number: '' });

  const fetchDrivers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getDrivers();
      if (response.success) setDrivers(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  const handleAddDriver = async () => {
    if (!formData.name) { toast.error('Name is required'); return; }
    try {
      await storeAPI.createDriver(formData);
      toast.success('Driver added');
      setAddModalOpen(false);
      fetchDrivers();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const statusConfig: Record<string, { color: string; bg: string }> = {
    available: { color: 'text-green-700', bg: 'bg-green-100' },
    on_trip: { color: 'text-blue-700', bg: 'bg-blue-100' },
    off_duty: { color: 'text-gray-700', bg: 'bg-gray-100' },
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Drivers</h1><p className="text-gray-500">Manage delivery drivers</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchDrivers}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
              <IOSButton onClick={() => setAddModalOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add Driver</IOSButton>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : drivers.length === 0 ? (
            <IOSCard className="p-12 text-center"><User className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No drivers</p></IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {drivers.map((driver) => {
                const status = statusConfig[driver.status] || statusConfig.available;
                return (
                  <IOSCard key={driver.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"><User className="h-5 w-5 text-[#007AFF]" /></div>
                        <div><p className="font-bold">{driver.name}</p>{driver.license_number && <p className="text-xs text-gray-500">{driver.license_number}</p>}</div>
                      </div>
                      <IOSBadge className={`${status.bg} ${status.color}`}>{driver.status?.replace('_', ' ')}</IOSBadge>
                    </div>
                    {driver.phone && <p className="text-sm text-gray-500 flex items-center gap-2"><Phone className="h-3 w-3" /> {driver.phone}</p>}
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>

        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Driver</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Name *</label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Phone</label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
              <div><label className="text-sm font-medium">License Number</label><Input value={formData.license_number} onChange={(e) => setFormData({ ...formData, license_number: e.target.value })} /></div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleAddDriver} className="flex-1">Add</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
