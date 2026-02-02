'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { staffAPI } from '@/lib/api';
import { User, RefreshCw, Plus, Phone, Edit2, Trash2, Mail, Car } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Driver {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  license_number?: string;
  status: 'active' | 'inactive';
  employeeId?: string;
}

export default function CentralDriversPage() {
  const { user } = useAuth();
  const isManager = user?.role === UserRole.AUDITOR || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.CENTRAL_STOREKEEPER;
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    license_number: '',
    status: 'active' as 'active' | 'inactive'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchDrivers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await staffAPI.getStaff({ role: 'driver' });
      if (response.success && Array.isArray(response.data)) {
        const mappedDrivers = response.data.map((s: any) => ({
          id: s.id,
          firstName: s.user?.first_name || '',
          lastName: s.user?.last_name || '',
          name: `${s.user?.first_name || ''} ${s.user?.last_name || ''}`.trim(),
          email: s.user?.email || '',
          phone: s.user?.phone_number || s.phone || '',
          license_number: s.license_number || s.id_number || '',
          status: s.status === 'active' ? 'active' : 'inactive',
          employeeId: s.id_number
        }));
        setDrivers(mappedDrivers);
      }
    } catch (error) { console.error('Error fetching drivers:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  const handleCreateOrUpdate = async () => {
    if (!formData.firstName || !formData.lastName || !formData.email) {
      toast.error('First name, last name and email are required');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        await staffAPI.updateStaffMember(editingId, {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          status: formData.status,
          nationalId: formData.license_number
        });
        toast.success('Driver updated');
      } else {
        const response = await staffAPI.createStaffMember({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          role: 'driver',
          department: 'maintenance',
          status: formData.status,
          idNumber: formData.license_number
        });
        toast.success(`Driver added. Pass: ${response.data?.generatedPassword || 'Set by admin'}`);
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
      id: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      license_number: '',
      status: 'active'
    });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this driver? Their staff record will be deactivated.')) return;
    try {
      await staffAPI.deleteStaffMember(id);
      toast.success('Driver removed');
      fetchDrivers();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const startEdit = (driver: Driver) => {
    setEditingId(driver.id);
    setFormData({
      id: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      email: driver.email,
      phone: driver.phone || '',
      license_number: driver.license_number || '',
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
            <IOSCard className="p-12 text-center"><User className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No driver staff found</p></IOSCard>
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
                          <p className="text-xs text-gray-400">{driver.employeeId || 'No ID'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <IOSBadge className={`${status.bg} ${status.color}`}>{driver.status}</IOSBadge>
                        {isManager && (
                          <div className="flex gap-1">
                            <button onClick={() => startEdit(driver)} className="p-1 hover:bg-stone-100 rounded text-stone-400 hover:text-[#007AFF] transition-colors"><Edit2 className="h-4 w-4" /></button>
                            <button onClick={() => handleDelete(driver.id)} className="p-1 hover:bg-red-50 rounded text-stone-400 hover:text-red-600 transition-colors"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500 flex items-center gap-2"><Mail className="h-3 w-3" /> {driver.email}</p>
                      {driver.phone && <p className="text-sm text-gray-500 flex items-center gap-2"><Phone className="h-3 w-3" /> {driver.phone}</p>}
                      {driver.license_number && <p className="text-sm text-gray-500 flex items-center gap-2"><Car className="h-3 w-3" /> {driver.license_number}</p>}
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
              <DialogDescription>Drivers are managed as staff members.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">First Name *</label><Input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} /></div>
                <div><label className="text-sm font-medium">Last Name *</label><Input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} /></div>
              </div>
              <div><label className="text-sm font-medium">Email *</label><Input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} readOnly={!!editingId} className={editingId ? 'bg-gray-50' : ''} /></div>
              <div><label className="text-sm font-medium">Phone</label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
              <div><label className="text-sm font-medium">License / ID Number</label><Input value={formData.license_number} onChange={(e) => setFormData({ ...formData, license_number: e.target.value })} /></div>
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
