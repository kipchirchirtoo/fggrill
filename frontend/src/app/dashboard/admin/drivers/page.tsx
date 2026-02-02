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
import { User, RefreshCw, Plus, Phone, Car, Edit2, Trash2, Search, Mail } from 'lucide-react';
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

export default function AdminDriversPage() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    license_number: '',
    status: 'active' as 'active' | 'inactive'
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchDrivers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await staffAPI.getStaff({ role: 'driver' });

      if (response.success) {
        if (Array.isArray(response.data)) {
          const mappedDrivers = response.data.map((s: any) => ({
            id: s.id,
            firstName: s.user?.first_name || '',
            lastName: s.user?.last_name || '',
            name: `${s.user?.first_name || ''} ${s.user?.last_name || ''}`.trim(),
            email: s.user?.email || '',
            phone: s.user?.phone_number || s.phone || '',
            license_number: s.license_number || s.id_number || '', // Fallback to staff ID number if license not separate
            status: s.status === 'active' ? 'active' : 'inactive',
            employeeId: s.id_number
          }));
          setDrivers(mappedDrivers);
        } else {
          setDrivers([]);
        }
      }
    } catch (error) {
      console.error('Error fetching drivers:', error);
      toast.error('Failed to load drivers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

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
    setFormErrors({});
  };

  const validateForm = (isEdit: boolean = false) => {
    const errors: { [key: string]: string } = {};

    if (!formData.firstName || formData.firstName.trim() === '') {
      errors.firstName = 'First Name is required';
    }
    if (!formData.lastName || formData.lastName.trim() === '') {
      errors.lastName = 'Last Name is required';
    }
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Valid email is required';
    }

    if (formData.phone && !/^\+?[0-9\s-]{8,15}$/.test(formData.phone)) {
      errors.phone = 'Please enter a valid phone number';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const filteredDrivers = drivers.filter(driver => {
    const matchesQuery = searchQuery === '' ||
      driver.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.phone?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || driver.status === statusFilter;

    return matchesQuery && matchesStatus;
  });

  const handleAddDriver = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const response = await staffAPI.createStaffMember({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        role: 'driver',
        department: 'maintenance',
        status: formData.status,
        // We can store license number in idNumber if no separate field exists on backend yet
        idNumber: formData.license_number
      });

      if (response.success) {
        toast.success(`Driver added successfully. Temp password: ${response.data.generatedPassword || 'Set by admin'}`);
        setAddModalOpen(false);
        resetForm();
        fetchDrivers();
      } else {
        throw new Error(response.message || 'Failed to add driver');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to add driver');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditDriver = (driver: Driver) => {
    setFormData({
      id: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      email: driver.email,
      phone: driver.phone || '',
      license_number: driver.license_number || '',
      status: driver.status as 'active' | 'inactive'
    });
    setEditModalOpen(true);
  };

  const handleUpdateDriver = async () => {
    if (!validateForm(true)) return;

    setIsSubmitting(true);
    try {
      const response = await staffAPI.updateStaffMember(formData.id, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        status: formData.status,
        nationalId: formData.license_number
      });

      if (response.success) {
        toast.success('Driver updated successfully');
        setEditModalOpen(false);
        resetForm();
        fetchDrivers();
      } else {
        throw new Error(response.message || 'Failed to update driver');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update driver');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDriver = (driver: Driver) => {
    setFormData({ ...formData, id: driver.id });
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    setIsSubmitting(true);
    try {
      const response = await staffAPI.deleteStaffMember(formData.id);
      if (response.success) {
        toast.success('Driver removed successfully');
        setConfirmDeleteOpen(false);
        resetForm();
        fetchDrivers();
      } else {
        throw new Error(response.message || 'Failed to delete driver');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove driver');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusConfig: Record<string, { color: string; bg: string }> = {
    active: { color: 'text-green-700', bg: 'bg-green-100' },
    inactive: { color: 'text-gray-700', bg: 'bg-gray-100' },
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
              <p className="text-gray-500">Manage delivery and transportation staff</p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchDrivers} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <IOSButton onClick={() => setAddModalOpen(true)} leftIcon={<Plus />}>Register Driver</IOSButton>
            </div>
          </div>

          <IOSCard className="p-4">
            <div className="grid md:grid-cols-4 gap-4">
              <div className="md:col-span-3 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <Input
                  placeholder="Search drivers by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full p-2 border rounded-ios-lg text-sm bg-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredDrivers.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <User className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No driver staff found</p>
              <Button variant="outline" className="mt-4" onClick={() => setAddModalOpen(true)}>Register First Driver</Button>
            </IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDrivers.map((driver) => {
                const status = statusConfig[driver.status] || statusConfig.active;
                return (
                  <IOSCard key={driver.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="h-5 w-5 text-[#007AFF]" />
                        </div>
                        <div>
                          <p className="font-bold">{driver.name}</p>
                          <p className="text-xs text-gray-400">{driver.employeeId || 'No ID'}</p>
                        </div>
                      </div>
                      <IOSBadge className={`${status.bg} ${status.color}`}>{driver.status}</IOSBadge>
                    </div>

                    <div className="space-y-2 py-2">
                      <p className="text-sm text-gray-600 flex items-center gap-2">
                        <Mail className="h-3 w-3" /> {driver.email}
                      </p>
                      {driver.phone && (
                        <p className="text-sm text-gray-600 flex items-center gap-2">
                          <Phone className="h-3 w-3" /> {driver.phone}
                        </p>
                      )}
                      {driver.license_number && (
                        <p className="text-sm text-gray-600 flex items-center gap-2">
                          <Car className="h-3 w-3" /> {driver.license_number}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-between gap-2 mt-4 pt-4 border-t border-gray-50">
                      <IOSButton
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        leftIcon={<Edit2 />}
                        onClick={() => handleEditDriver(driver)}
                      >
                        Edit
                      </IOSButton>
                      <IOSButton
                        variant="secondary"
                        size="sm"
                        className="flex-none bg-red-50 hover:bg-red-100 text-red-600"
                        onClick={() => handleDeleteDriver(driver)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IOSButton>
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>

        {/* Add Driver Modal */}
        <Dialog open={addModalOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setAddModalOpen(open);
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Register New Driver</DialogTitle><DialogDescription>Drivers will be added to the system as staff members.</DialogDescription></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">First Name *</label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className={formErrors.firstName ? 'border-red-500' : ''}
                  />
                  {formErrors.firstName && <p className="text-red-500 text-xs mt-1">{formErrors.firstName}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium">Last Name *</label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className={formErrors.lastName ? 'border-red-500' : ''}
                  />
                  {formErrors.lastName && <p className="text-red-500 text-xs mt-1">{formErrors.lastName}</p>}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Email *</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={formErrors.email ? 'border-red-500' : ''}
                  placeholder="driver@example.com"
                />
                {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={formErrors.phone ? 'border-red-500' : ''}
                  placeholder="+1234567890"
                />
                {formErrors.phone && <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">License / ID Number</label>
                <Input
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-4 border-t">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1" disabled={isSubmitting}>Cancel</IOSButton>
                <IOSButton onClick={handleAddDriver} className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? 'Registering...' : 'Register Driver'}
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Driver Modal */}
        <Dialog open={editModalOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setEditModalOpen(open);
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit Driver Profile</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">First Name *</label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Last Name *</label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Email *</label>
                <Input
                  value={formData.email}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">License / ID Number</label>
                <Input
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                  className="w-full p-2 border rounded-ios-lg bg-white"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4 border-t">
                <IOSButton variant="secondary" onClick={() => setEditModalOpen(false)} className="flex-1" disabled={isSubmitting}>Cancel</IOSButton>
                <IOSButton onClick={handleUpdateDriver} className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? 'Updating...' : 'Update Driver'}
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Remove Driver</DialogTitle></DialogHeader>
            <div className="py-4">
              <p className="text-gray-700">Are you sure you want to remove this driver from the system? Their staff record will be deactivated.</p>
            </div>
            <div className="flex gap-3">
              <IOSButton variant="secondary" onClick={() => setConfirmDeleteOpen(false)} className="flex-1" disabled={isSubmitting}>Cancel</IOSButton>
              <IOSButton onClick={handleConfirmDelete} className="flex-1 bg-red-500 hover:bg-red-600" disabled={isSubmitting}>
                {isSubmitting ? 'Removing...' : 'Remove Driver'}
              </IOSButton>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
