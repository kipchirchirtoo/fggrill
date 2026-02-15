'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from "@/components/ui/minimal/button";
import { Input } from '@/components/ui/input';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Truck, Plus, Edit, Trash2, RefreshCw, Save, Car, Bike, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Vehicle {
  id: string;
  registration_number: string;
  make?: string;
  model?: string;
  type?: string;
  capacity_kg?: number;
  status: string;
  insurance_expiry?: string;
  total_trips: number;
  notes?: string;
  created_at: string;
}

const VEHICLE_TYPES = ['VAN', 'TRUCK', 'MOTORCYCLE', 'CAR', 'PICKUP'];
const STATUSES = ['AVAILABLE', 'IN_USE', 'MAINTENANCE', 'RETIRED'];

export default function VehiclesPage() {
  const { user } = useAuth();
  const canEdit = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER || user?.role === UserRole.CENTRAL_STOREKEEPER;
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState({
    registration_number: '',
    make: '',
    model: '',
    type: 'VAN',
    capacity_kg: 0,
    status: 'AVAILABLE',
    insurance_expiry: '',
    notes: ''
  });

  useEffect(() => { fetchVehicles(); }, []);

  const fetchVehicles = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/store/vehicles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setVehicles(data.data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = selectedVehicle
        ? `${API_URL}/api/store/vehicles/${selectedVehicle.id}`
        : `${API_URL}/api/store/vehicles`;
      const res = await fetch(url, {
        method: selectedVehicle ? 'PUT' : 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        toast.success(selectedVehicle ? 'Vehicle updated' : 'Vehicle added');
        setIsModalOpen(false);
        fetchVehicles();
      } else {
        toast.error('Failed to save vehicle');
      }
    } catch { toast.error('Error saving vehicle'); }
  };

  const handleDelete = async () => {
    if (!selectedVehicle) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/store/vehicles/${selectedVehicle.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Vehicle deleted');
        setIsDeleteModalOpen(false);
        fetchVehicles();
      }
    } catch { toast.error('Error deleting vehicle'); }
  };

  const openAddModal = () => {
    setSelectedVehicle(null);
    setForm({ registration_number: '', make: '', model: '', type: 'VAN', capacity_kg: 0, status: 'AVAILABLE', insurance_expiry: '', notes: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (v: Vehicle) => {
    setSelectedVehicle(v);
    setForm({
      registration_number: v.registration_number,
      make: v.make || '',
      model: v.model || '',
      type: v.type || 'VAN',
      capacity_kg: v.capacity_kg || 0,
      status: v.status,
      insurance_expiry: v.insurance_expiry?.split('T')[0] || '',
      notes: v.notes || ''
    });
    setIsModalOpen(true);
  };

  const getStatusColor = (s: string) => ({
    AVAILABLE: 'bg-[#F2F2F7] text-[#000000]',
    IN_USE: 'bg-[#F2F2F7] text-[#000000]',
    MAINTENANCE: 'bg-[#F2F2F7] text-[#3C3C43]',
    RETIRED: 'bg-gray-100 text-gray-800'
  }[s] || 'bg-gray-100 text-gray-800');

  const getTypeIcon = (t?: string) => {
    if (t === 'MOTORCYCLE') return <Bike className="h-5 w-5" />;
    if (t === 'TRUCK') return <Truck className="h-5 w-5" />;
    return <Car className="h-5 w-5" />;
  };

  const availableCount = vehicles.filter(v => v.status === 'AVAILABLE').length;

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Vehicle Management</h1>
              <p className="text-gray-600">Manage delivery vehicles for dispatches</p>
            </div>
            <div className="flex gap-3">
              <IOSButton variant="outline" onClick={fetchVehicles} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              {canEdit && <IOSButton onClick={openAddModal} leftIcon={<Plus />}>Add Vehicle</IOSButton>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <IOSCard className="p-4"><div className="flex items-center gap-3"><Truck className="h-8 w-8 text-[#8E8E93]0" /><div><p className="text-sm text-gray-500">Total Vehicles</p><p className="text-2xl font-bold">{vehicles.length}</p></div></div></IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-3"><CheckCircle className="h-8 w-8 text-[#8E8E93]0" /><div><p className="text-sm text-gray-500">Available</p><p className="text-2xl font-bold text-[#3C3C43]">{availableCount}</p></div></div></IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-3"><Car className="h-8 w-8 text-[#8E8E93]0" /><div><p className="text-sm text-gray-500">In Use</p><p className="text-2xl font-bold text-[#3C3C43]">{vehicles.filter(v => v.status === 'IN_USE').length}</p></div></div></IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-[#3C3C43]" /><div><p className="text-sm text-gray-500">Maintenance</p><p className="text-2xl font-bold text-[#3C3C43]">{vehicles.filter(v => v.status === 'MAINTENANCE').length}</p></div></div></IOSCard>
          </div>

          <IOSCard>
            {isLoading ? (
              <div className="p-12 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[rgba(60,60,67,0.12)] mx-auto"></div></div>
            ) : vehicles.length === 0 ? (
              <div className="p-12 text-center text-gray-500"><Truck className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No vehicles registered</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vehicle</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trips</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Insurance</th>
                      {canEdit && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {vehicles.map(v => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 rounded-ios-lg">{getTypeIcon(v.type)}</div>
                            <div>
                              <p className="font-bold">{v.registration_number}</p>
                              <p className="text-sm text-gray-500">{v.make} {v.model}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4"><IOSBadge variant="light" color="secondary">{v.type || 'N/A'}</IOSBadge></td>
                        <td className="px-4 py-4">{v.capacity_kg ? `${v.capacity_kg} kg` : '-'}</td>
                        <td className="px-4 py-4"><IOSBadge className={getStatusColor(v.status)}>{v.status}</IOSBadge></td>
                        <td className="px-4 py-4 font-medium">{v.total_trips}</td>
                        <td className="px-4 py-4 text-sm">{v.insurance_expiry ? formatDate(v.insurance_expiry) : '-'}</td>
                        {canEdit && (
                          <td className="px-4 py-4">
                            <div className="flex gap-2">
                              <IOSButton size="sm" variant="outline" onClick={() => openEditModal(v)}><Edit className="h-4 w-4" /></IOSButton>
                              <IOSButton size="sm" variant="outline" className="text-[#3C3C43]" onClick={() => { setSelectedVehicle(v); setIsDeleteModalOpen(true); }}><Trash2 className="h-4 w-4" /></IOSButton>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </IOSCard>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{selectedVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">Registration *</label><Input value={form.registration_number} onChange={e => setForm({ ...form, registration_number: e.target.value })} placeholder="KCN 123A" /></div>
                <div><label className="text-sm font-medium">Type</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border rounded-ios-lg">{VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">Make</label><Input value={form.make} onChange={e => setForm({ ...form, make: e.target.value })} placeholder="Toyota" /></div>
                <div><label className="text-sm font-medium">Model</label><Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="Hiace" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">Capacity (kg)</label><Input type="number" value={form.capacity_kg} onChange={e => setForm({ ...form, capacity_kg: parseFloat(e.target.value) || 0 })} /></div>
                <div><label className="text-sm font-medium">Status</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border rounded-ios-lg">{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              </div>
              <div><label className="text-sm font-medium">Insurance Expiry</label><Input type="date" value={form.insurance_expiry} onChange={e => setForm({ ...form, insurance_expiry: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Notes</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full px-3 py-2 border rounded-ios-lg" rows={2} /></div>
              <div className="flex justify-end gap-3 pt-4"><IOSButton variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</IOSButton><IOSButton onClick={handleSave} leftIcon={<Save />}>Save</IOSButton></div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle className="text-[#3C3C43]">Delete Vehicle</DialogTitle></DialogHeader>
            <p>Are you sure you want to delete <strong>{selectedVehicle?.registration_number}</strong>?</p>
            <div className="flex justify-end gap-3 pt-4"><IOSButton variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</IOSButton><IOSButton className="bg-[#3C3C43] hover:bg-[#3C3C43]" onClick={handleDelete} leftIcon={<Trash2 />}>Delete</IOSButton></div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
