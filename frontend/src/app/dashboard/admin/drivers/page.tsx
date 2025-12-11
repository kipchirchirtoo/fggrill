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
import { User, RefreshCw, Plus, Phone, Car, Edit2, Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Driver { id: string; name: string; phone?: string; license_number?: string; status: 'available' | 'on_trip' | 'off_duty'; }

export default function AdminDriversPage() {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    id: '', 
    name: '', 
    phone: '', 
    license_number: '', 
    status: 'available' as 'available' | 'on_trip' | 'off_duty'
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchDrivers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getDrivers();
      
      if (response.success) {
        if (Array.isArray(response.data)) {
          setDrivers(response.data);
        } else {
          console.error('Invalid drivers data format: expected array');
          setDrivers([]);
        }
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  const resetForm = () => {
    setFormData({ 
      id: '', 
      name: '', 
      phone: '', 
      license_number: '', 
      status: 'available'
    });
    setFormErrors({});
  };
  
  const validateForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!formData.name || formData.name.trim() === '') {
      errors.name = 'Name is required';
    }
    
    if (formData.phone && !/^\+?[0-9\s-]{10,15}$/.test(formData.phone)) {
      errors.phone = 'Please enter a valid phone number';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const filteredDrivers = drivers.filter(driver => {
    const matchesQuery = searchQuery === '' || 
      driver.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      driver.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.license_number?.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesStatus = statusFilter === 'all' || driver.status === statusFilter;
    
    return matchesQuery && matchesStatus;
  });

  const handleAddDriver = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      await storeAPI.createDriver(formData);
      toast.success('Driver added successfully');
      setAddModalOpen(false);
      resetForm();
      fetchDrivers();
    } catch (error: any) { 
      toast.error(error.message || 'Failed to add driver'); 
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleEditDriver = (driver: Driver) => {
    setFormData({
      id: driver.id,
      name: driver.name,
      phone: driver.phone || '',
      license_number: driver.license_number || '',
      status: driver.status
    });
    setEditModalOpen(true);
  };
  
  const handleUpdateDriver = async () => {
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    try {
      await storeAPI.updateDriver(formData.id, formData);
      toast.success('Driver updated successfully');
      setEditModalOpen(false);
      resetForm();
      fetchDrivers();
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
      await storeAPI.deleteDriver(formData.id);
      toast.success('Driver deleted successfully');
      setConfirmDeleteOpen(false);
      resetForm();
      fetchDrivers();
    } catch (error: any) { 
      toast.error(error.message || 'Failed to delete driver'); 
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusConfig: Record<string, { color: string; bg: string }> = {
    available: { color: 'text-green-700', bg: 'bg-green-100' },
    on_trip: { color: 'text-blue-700', bg: 'bg-blue-100' },
    off_duty: { color: 'text-gray-700', bg: 'bg-gray-100' },
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Drivers</h1><p className="text-gray-500">Manage delivery staff</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchDrivers} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <IOSButton onClick={() => setAddModalOpen(true)} leftIcon={<Plus />}>Add Driver</IOSButton>
            </div>
          </div>

          <IOSCard className="p-4">
            <div className="grid md:grid-cols-4 gap-4">
              <div className="md:col-span-3 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  placeholder="Search drivers by name, phone, or license number..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="pl-10" 
                />
              </div>
              <div>
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full p-2 border rounded-ios-lg"
                >
                  <option value="all">All Statuses</option>
                  <option value="available">Available</option>
                  <option value="on_trip">On Trip</option>
                  <option value="off_duty">Off Duty</option>
                </select>
              </div>
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredDrivers.length === 0 ? (
            <IOSCard className="p-12 text-center"><User className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No drivers found</p></IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDrivers.map((driver) => {
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
                    {driver.license_number && <p className="text-sm text-gray-500 flex items-center gap-2"><Car className="h-3 w-3" /> {driver.license_number}</p>}
                    
                    <div className="flex justify-between gap-2 mt-4">
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
            <DialogHeader><DialogTitle>Add Driver</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Name <span className="text-red-500">*</span></label>
                <Input 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                  className={formErrors.name ? 'border-red-500' : ''}
                />
                {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
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
                <label className="text-sm font-medium">License Number</label>
                <Input 
                  value={formData.license_number} 
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })} 
                />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select 
                  value={formData.status} 
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'available' | 'on_trip' | 'off_duty' })} 
                  className="w-full p-2 border rounded-ios-lg"
                >
                  <option value="available">Available</option>
                  <option value="on_trip">On Trip</option>
                  <option value="off_duty">Off Duty</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1" disabled={isSubmitting}>Cancel</IOSButton>
                <IOSButton onClick={handleAddDriver} className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add Driver'}
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
            <DialogHeader><DialogTitle>Edit Driver</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Name <span className="text-red-500">*</span></label>
                <Input 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                  className={formErrors.name ? 'border-red-500' : ''}
                />
                {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
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
                <label className="text-sm font-medium">License Number</label>
                <Input 
                  value={formData.license_number} 
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })} 
                />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select 
                  value={formData.status} 
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'available' | 'on_trip' | 'off_duty' })} 
                  className="w-full p-2 border rounded-ios-lg"
                >
                  <option value="available">Available</option>
                  <option value="on_trip">On Trip</option>
                  <option value="off_duty">Off Duty</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
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
            <DialogHeader><DialogTitle>Delete Driver</DialogTitle></DialogHeader>
            <div className="py-4">
              <p className="text-gray-700">Are you sure you want to delete this driver? This action cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <IOSButton variant="secondary" onClick={() => setConfirmDeleteOpen(false)} className="flex-1" disabled={isSubmitting}>Cancel</IOSButton>
              <IOSButton onClick={handleConfirmDelete} className="flex-1 bg-red-500 hover:bg-red-600" disabled={isSubmitting}>
                {isSubmitting ? 'Deleting...' : 'Delete Driver'}
              </IOSButton>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
