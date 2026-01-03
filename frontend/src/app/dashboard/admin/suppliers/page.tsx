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
import { Truck, RefreshCw, Plus, Phone, Mail, MapPin, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Supplier { id: string; name: string; contact_person?: string; email?: string; phone?: string; address?: string; status: 'active' | 'inactive'; }

export default function AdminSuppliersPage() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', contact_person: '', email: '', phone: '', address: '' });

  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getSuppliers();
      if (response.success) setSuppliers(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const resetForm = () => setFormData({ name: '', contact_person: '', email: '', phone: '', address: '' });

  const handleAddSupplier = async () => {
    if (!formData.name) { toast.error('Name is required'); return; }
    setIsSubmitting(true);
    try {
      await storeAPI.createSupplier(formData);
      toast.success('Supplier added');
      setAddModalOpen(false);
      resetForm();
      fetchSuppliers();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  const openEditModal = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setFormData({ name: supplier.name, contact_person: supplier.contact_person || '', email: supplier.email || '', phone: supplier.phone || '', address: supplier.address || '' });
    setEditModalOpen(true);
  };

  const handleUpdateSupplier = async () => {
    if (!selectedSupplier || !formData.name) { toast.error('Name is required'); return; }
    setIsSubmitting(true);
    try {
      await storeAPI.updateSupplier(selectedSupplier.id, formData);
      toast.success('Supplier updated');
      setEditModalOpen(false);
      setSelectedSupplier(null);
      resetForm();
      fetchSuppliers();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteSupplier = async () => {
    if (!selectedSupplier) return;
    setIsSubmitting(true);
    try {
      await storeAPI.deleteSupplier(selectedSupplier.id);
      toast.success('Supplier deleted');
      setDeleteConfirmOpen(false);
      setSelectedSupplier(null);
      fetchSuppliers();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Suppliers</h1><p className="text-gray-500">Manage vendors</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchSuppliers} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <IOSButton onClick={() => setAddModalOpen(true)} leftIcon={<Plus />}>Add Supplier</IOSButton>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : suppliers.length === 0 ? (
            <IOSCard className="p-12 text-center"><Truck className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No suppliers</p></IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suppliers.map((supplier) => (
                <IOSCard key={supplier.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div><p className="font-bold">{supplier.name}</p>{supplier.contact_person && <p className="text-sm text-gray-500">{supplier.contact_person}</p>}</div>
                    <IOSBadge className={supplier.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>{supplier.status}</IOSBadge>
                  </div>
                  <div className="space-y-1 text-sm text-gray-500">
                    {supplier.phone && <p className="flex items-center gap-2"><Phone className="h-3 w-3" /> {supplier.phone}</p>}
                    {supplier.email && <p className="flex items-center gap-2"><Mail className="h-3 w-3" /> {supplier.email}</p>}
                    {supplier.address && <p className="flex items-center gap-2"><MapPin className="h-3 w-3" /> {supplier.address}</p>}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <IOSButton variant="secondary" size="sm" className="flex-1" onClick={() => openEditModal(supplier)} leftIcon={<Edit2 className="h-3 w-3" />}>Edit</IOSButton>
                    <IOSButton variant="destructive" size="sm" onClick={() => { setSelectedSupplier(supplier); setDeleteConfirmOpen(true); }}><Trash2 className="h-3 w-3" /></IOSButton>
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>

        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Supplier</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Name *</label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Contact Person</label><Input value={formData.contact_person} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Email</label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Phone</label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Address</label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleAddSupplier} disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Adding...' : 'Add'}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={editModalOpen} onOpenChange={(open) => { setEditModalOpen(open); if (!open) setSelectedSupplier(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit Supplier</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Name *</label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Contact Person</label><Input value={formData.contact_person} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Email</label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Phone</label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Address</label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setEditModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleUpdateSupplier} disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Updating...' : 'Update'}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="text-red-600">Delete Supplier</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-stone-600">Are you sure you want to delete this supplier?</p>
              {selectedSupplier && <div className="p-3 bg-stone-50 rounded-lg"><p className="font-medium">{selectedSupplier.name}</p></div>}
              <div className="flex gap-2">
                <IOSButton variant="secondary" className="flex-1" onClick={() => setDeleteConfirmOpen(false)}>Cancel</IOSButton>
                <IOSButton variant="destructive" className="flex-1" onClick={handleDeleteSupplier} disabled={isSubmitting}>{isSubmitting ? 'Deleting...' : 'Delete'}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
