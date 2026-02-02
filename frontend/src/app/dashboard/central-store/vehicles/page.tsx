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
import { storeAPI } from '@/lib/api';
import { Car, RefreshCw, Plus, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Vehicle {
  id: string;
  registration_number: string;
  make?: string;
  model?: string;
  capacity_kg?: number;
  status: 'available' | 'in_use' | 'maintenance' | 'out_of_service';
}

export default function CentralVehiclesPage() {
  const { user } = useAuth();
  const isManager = user?.role === UserRole.AUDITOR || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.CENTRAL_STOREKEEPER;
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    registration_number: '',
    make: '',
    model: '',
    capacity_kg: 0,
    status: 'available' as any
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchVehicles = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getVehicles();
      if (response.success) setVehicles(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  const handleCreateOrUpdate = async () => {
    if (!formData.registration_number) { toast.error('Registration is required'); return; }
    setIsSubmitting(true);
    try {
      if (editingId) {
        await storeAPI.updateVehicle(editingId, formData);
        toast.success('Vehicle updated');
      } else {
        await storeAPI.createVehicle(formData);
        toast.success('Vehicle added');
      }
      setAddModalOpen(false);
      setEditingId(null);
      resetForm();
      fetchVehicles();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  const resetForm = () => {
    setFormData({ registration_number: '', make: '', model: '', capacity_kg: 0, status: 'available' });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;
    try {
      await storeAPI.deleteVehicle(id);
      toast.success('Vehicle deleted');
      fetchVehicles();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const startEdit = (vehicle: Vehicle) => {
    setEditingId(vehicle.id);
    setFormData({
      registration_number: vehicle.registration_number,
      make: vehicle.make || '',
      model: vehicle.model || '',
      capacity_kg: vehicle.capacity_kg || 0,
      status: vehicle.status
    });
    setAddModalOpen(true);
  };

  const statusConfig: Record<string, { color: string; bg: string }> = {
    available: { color: 'text-green-700', bg: 'bg-green-100' },
    in_use: { color: 'text-blue-700', bg: 'bg-blue-100' },
    maintenance: { color: 'text-yellow-700', bg: 'bg-yellow-100' },
    out_of_service: { color: 'text-red-700', bg: 'bg-red-100' },
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Vehicles</h1><p className="text-gray-500">Manage delivery fleet and transport assets</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchVehicles} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              {isManager && <IOSButton onClick={() => { resetForm(); setAddModalOpen(true); }} leftIcon={<Plus />}>Add Vehicle</IOSButton>}
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : vehicles.length === 0 ? (
            <IOSCard className="p-12 text-center"><Car className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No vehicles found</p></IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehicles.map((vehicle) => {
                const status = statusConfig[vehicle.status] || statusConfig.available;
                return (
                  <IOSCard key={vehicle.id} className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-ios-lg bg-stone-100 flex items-center justify-center"><Car className="h-5 w-5 text-stone-600" /></div>
                        <div><p className="font-bold">{vehicle.registration_number}</p><p className="text-sm text-gray-500">{vehicle.make} {vehicle.model}</p></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <IOSBadge className={`${status.bg} ${status.color}`}>{vehicle.status?.replace('_', ' ')}</IOSBadge>
                        {isManager && (
                          <div className="flex gap-1">
                            <button onClick={() => startEdit(vehicle)} className="p-1 hover:bg-stone-100 rounded text-stone-400 hover:text-[#007AFF] transition-colors"><Edit2 className="h-4 w-4" /></button>
                            <button onClick={() => handleDelete(vehicle.id)} className="p-1 hover:bg-red-50 rounded text-stone-400 hover:text-red-600 transition-colors"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                    {vehicle.capacity_kg && <p className="text-sm text-gray-500">Capacity: {vehicle.capacity_kg} kg</p>}
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>

        <Dialog open={addModalOpen} onOpenChange={(open) => { if (!open) resetForm(); setAddModalOpen(open); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle>
              <DialogDescription>Fleet assets for transportation and delivery.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Registration Number *</label><Input value={formData.registration_number} onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">Make</label><Input value={formData.make} onChange={(e) => setFormData({ ...formData, make: e.target.value })} /></div>
                <div><label className="text-sm font-medium">Model</label><Input value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} /></div>
              </div>
              <div><label className="text-sm font-medium">Capacity (kg)</label><Input type="number" value={formData.capacity_kg} onChange={(e) => setFormData({ ...formData, capacity_kg: parseInt(e.target.value) || 0 })} /></div>
              {editingId && (
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full p-2 border rounded-ios-lg bg-white">
                    <option value="available">Available</option>
                    <option value="in_use">In Use</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="out_of_service">Out of Service</option>
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleCreateOrUpdate} disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Saving...' : (editingId ? 'Save Changes' : 'Add Vehicle')}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
