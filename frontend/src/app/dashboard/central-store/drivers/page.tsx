'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { storeAPI } from '@/lib/api';
import { User, RefreshCw, Plus, Phone, Edit2, Trash2, Car } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Driver {
  id: string;
  name: string;
  phone: string;
  license_number?: string;
  license_expiry?: string;
  status: 'active' | 'inactive';
  source?: 'staff' | 'drivers_table';
  position?: string;
  employee_id?: string;
}

export default function CentralDriversPage() {
  const { user } = useAuth();
  const isManager = user?.role === UserRole.AUDITOR || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.CENTRAL_STOREKEEPER;
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    license_number: '',
    license_expiry: '',
    status: 'active' as 'active' | 'inactive'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchDrivers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getDrivers();
      if (response.success && Array.isArray(response.data)) {
        setDrivers(response.data);
      }
    } catch (error) { console.error('Error fetching drivers:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  const handleCreateOrUpdate = async () => {
    if (!formData.name || !formData.phone) {
      toast.error('Name and phone are required');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        await storeAPI.updateDriver(editingId, {
          name: formData.name,
          phone: formData.phone,
          license_number: formData.license_number,
          license_expiry: formData.license_expiry || null,
          status: formData.status
        });
        toast.success('Driver updated');
      } else {
        await storeAPI.createDriver({
          name: formData.name,
          phone: formData.phone,
          license_number: formData.license_number,
          license_expiry: formData.license_expiry || null,
          status: formData.status
        });
        toast.success('Driver added');
      }
      setAddModalOpen(false);
      setEditingId(null);
      resetForm();
      fetchDrivers();
    } catch (error: any) {
      toast.error(error.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      license_number: '',
      license_expiry: '',
      status: 'active'
    });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this driver?')) return;
    try {
      await storeAPI.deleteDriver(id);
      toast.success('Driver removed');
      fetchDrivers();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const startEdit = (driver: Driver) => {
    setEditingId(driver.id);
    setFormData({
      name: driver.name,
      phone: driver.phone,
      license_number: driver.license_number || '',
      license_expiry: driver.license_expiry ? new Date(driver.license_expiry).toISOString().split('T')[0] : '',
      status: driver.status as 'active' | 'inactive'
    });
    setAddModalOpen(true);
  };

  const statusConfig: Record<string, { color: string; bg: string }> = {
    active: { color: 'text-green-700', bg: 'bg-green-100' },
    inactive: { color: 'text-gray-700', bg: 'bg-gray-100' },
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Drivers</h1><p className="text-gray-500">Manage delivery and transportation staff</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchDrivers} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              {isManager && <IOSButton onClick={() => { resetForm(); setAddModalOpen(true); }} leftIcon={<Plus />}>Register Driver</IOSButton>}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : drivers.length === 0 ? (
            <IOSCard className="p-12 text-center"><User className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No drivers found</p></IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {drivers.map((driver) => {
                const status = statusConfig[driver.status] || statusConfig.active;
                return (
                  <IOSCard key={driver.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"><User className="h-5 w-5 text-[#007AFF]" /></div>
                        <div>
                          <p className="font-bold">{driver.name}</p>
                          <p className="text-xs text-gray-400">{driver.phone}</p>
                          {driver.position && <p className="text-xs text-gray-500">{driver.position}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <IOSBadge className={`${status.bg} ${status.color}`}>{driver.status}</IOSBadge>
                        {driver.source === 'staff' ? (
                          <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">Staff Registry</span>
                        ) : isManager && (
                          <div className="flex gap-1">
                            <button onClick={() => startEdit(driver)} className="p-1 hover:bg-stone-100 rounded text-stone-400 hover:text-[#007AFF] transition-colors"><Edit2 className="h-4 w-4" /></button>
                            <button onClick={() => handleDelete(driver.id)} className="p-1 hover:bg-red-50 rounded text-stone-400 hover:text-red-600 transition-colors"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {driver.employee_id && <p className="text-sm text-gray-500 flex items-center gap-2"><User className="h-3 w-3" /> EMP: {driver.employee_id}</p>}
                      {driver.license_number && <p className="text-sm text-gray-500 flex items-center gap-2"><Car className="h-3 w-3" /> License: {driver.license_number}</p>}
                      {driver.license_expiry && <p className="text-sm text-gray-500 flex items-center gap-2">Expiry: {new Date(driver.license_expiry).toLocaleDateString()}</p>}
                    </div>
                  </IOSCard>

                );
              })}
            </div>
          )}
        </div>

        <Dialog open={addModalOpen} onOpenChange={(open) => { if (!open) resetForm(); setAddModalOpen(open); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Driver' : 'Register Driver'}</DialogTitle>
              <DialogDescription>Manage logistics personnel.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Full Name *</label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Phone *</label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
              <div><label className="text-sm font-medium">License Number</label><Input value={formData.license_number} onChange={(e) => setFormData({ ...formData, license_number: e.target.value })} /></div>
              <div><label className="text-sm font-medium">License Expiry</label><Input type="date" value={formData.license_expiry} onChange={(e) => setFormData({ ...formData, license_expiry: e.target.value })} /></div>
              {editingId && (
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })} className="w-full p-2 border rounded-ios-lg bg-white">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleCreateOrUpdate} disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Processing...' : (editingId ? 'Save Changes' : 'Register Driver')}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
