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
import { Car, RefreshCw, Plus, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Vehicle { id: string; registration: string; make?: string; model?: string; capacity?: number; status: 'available' | 'in_use' | 'maintenance'; }

export default function AdminVehiclesPage() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ registration: '', make: '', model: '', capacity: 0 });

  const fetchVehicles = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getVehicles();
      if (response.success) setVehicles(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  const resetForm = () => setFormData({ registration: '', make: '', model: '', capacity: 0 });

  const handleAddVehicle = async () => {
    if (!formData.registration) { toast.error('Registration is required'); return; }
    setIsSubmitting(true);
    try {
      await storeAPI.createVehicle(formData);
      toast.success('Vehicle added');
      setAddModalOpen(false);
      resetForm();
      fetchVehicles();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  const openEditModal = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setFormData({ registration: vehicle.registration, make: vehicle.make || '', model: vehicle.model || '', capacity: vehicle.capacity || 0 });
    setEditModalOpen(true);
  };

  const handleUpdateVehicle = async () => {
    if (!selectedVehicle || !formData.registration) { toast.error('Registration is required'); return; }
    setIsSubmitting(true);
    try {
      await storeAPI.updateVehicle(selectedVehicle.id, formData);
      toast.success('Vehicle updated');
      setEditModalOpen(false);
      setSelectedVehicle(null);
      resetForm();
      fetchVehicles();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteVehicle = async () => {
    if (!selectedVehicle) return;
    setIsSubmitting(true);
    try {
      await storeAPI.deleteVehicle(selectedVehicle.id);
      toast.success('Vehicle deleted');
      setDeleteConfirmOpen(false);
      setSelectedVehicle(null);
      fetchVehicles();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  const statusConfig: Record<string, { color: string; bg: string }> = {
    available: { color: 'text-green-700', bg: 'bg-green-100' },
    in_use: { color: 'text-blue-700', bg: 'bg-blue-100' },
    maintenance: { color: 'text-yellow-700', bg: 'bg-yellow-100' },
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Vehicles</h1><p className="text-gray-500">Manage fleet</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchVehicles} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <IOSButton onClick={() => setAddModalOpen(true)} leftIcon={<Plus />}>Add Vehicle</IOSButton>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : vehicles.length === 0 ? (
            <IOSCard className="p-12 text-center"><Car className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No vehicles</p></IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehicles.map((vehicle) => {
                const status = statusConfig[vehicle.status] || statusConfig.available;
                return (
                  <IOSCard key={vehicle.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-ios-lg bg-purple-100 flex items-center justify-center"><Car className="h-5 w-5 text-purple-600" /></div>
                        <div><p className="font-bold">{vehicle.registration}</p><p className="text-sm text-gray-500">{vehicle.make} {vehicle.model}</p></div>
                      </div>
                      <IOSBadge className={`${status.bg} ${status.color}`}>{vehicle.status?.replace('_', ' ')}</IOSBadge>
                    </div>
                    {vehicle.capacity && <p className="text-sm text-gray-500">Capacity: {vehicle.capacity} kg</p>}
                    <div className="flex gap-2 mt-4">
                      <IOSButton variant="secondary" size="sm" className="flex-1" onClick={() => openEditModal(vehicle)} leftIcon={<Edit2 className="h-3 w-3" />}>Edit</IOSButton>
                      <IOSButton variant="destructive" size="sm" onClick={() => { setSelectedVehicle(vehicle); setDeleteConfirmOpen(true); }}><Trash2 className="h-3 w-3" /></IOSButton>
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>

        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Vehicle</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Registration *</label><Input value={formData.registration} onChange={(e) => setFormData({ ...formData, registration: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Make</label><Input value={formData.make} onChange={(e) => setFormData({ ...formData, make: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Model</label><Input value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Capacity (kg)</label><Input type="number" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })} /></div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleAddVehicle} disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Adding...' : 'Add'}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={editModalOpen} onOpenChange={(open) => { setEditModalOpen(open); if (!open) setSelectedVehicle(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit Vehicle</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Registration *</label><Input value={formData.registration} onChange={(e) => setFormData({ ...formData, registration: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Make</label><Input value={formData.make} onChange={(e) => setFormData({ ...formData, make: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Model</label><Input value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Capacity (kg)</label><Input type="number" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })} /></div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setEditModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleUpdateVehicle} disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Updating...' : 'Update'}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="text-red-600">Delete Vehicle</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-stone-600">Are you sure you want to delete this vehicle?</p>
              {selectedVehicle && <div className="p-3 bg-stone-50 rounded-lg"><p className="font-medium">{selectedVehicle.registration}</p><p className="text-sm text-stone-500">{selectedVehicle.make} {selectedVehicle.model}</p></div>}
              <div className="flex gap-2">
                <IOSButton variant="secondary" className="flex-1" onClick={() => setDeleteConfirmOpen(false)}>Cancel</IOSButton>
                <IOSButton variant="destructive" className="flex-1" onClick={handleDeleteVehicle} disabled={isSubmitting}>{isSubmitting ? 'Deleting...' : 'Delete'}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
