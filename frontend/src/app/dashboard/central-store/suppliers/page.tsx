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
import { Building2, RefreshCw, Search, Phone, Mail, MapPin, Plus, Trash2, Edit2, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Supplier { id: string; name: string; code?: string; contact_person?: string; email?: string; phone?: string; address?: string; status: 'active' | 'inactive'; }

export default function CentralSuppliersPage() {
  const { user } = useAuth();
  const isManager = user?.role === UserRole.AUDITOR || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.CENTRAL_STOREKEEPER;
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', code: '', contact_person: '', email: '', phone: '', address: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');


  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getSuppliers();
      if (response.success) setSuppliers(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const filteredSuppliers = suppliers.filter((s) =>
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateOrUpdate = async () => {
    if (!formData.name) { toast.error('Name is required'); return; }
    setIsSubmitting(true);
    try {
      if (editingId) {
        await storeAPI.updateSupplier(editingId, formData);
        toast.success('Supplier updated');
      } else {
        await storeAPI.createSupplier(formData);
        toast.success('Supplier added');
      }
      setAddModalOpen(false);
      setEditingId(null);
      resetForm();
      fetchSuppliers();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  const resetForm = () => {
    setFormData({ name: '', code: '', contact_person: '', email: '', phone: '', address: '' });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return;
    try {
      await storeAPI.deleteSupplier(id);
      toast.success('Supplier deleted');
      fetchSuppliers();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const startEdit = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setFormData({
      name: supplier.name,
      code: supplier.code || '',
      contact_person: supplier.contact_person || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
    });
    setAddModalOpen(true);
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Suppliers</h1><p className="text-gray-500">Manage vendors and product suppliers</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchSuppliers} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              {isManager && <IOSButton onClick={() => { resetForm(); setAddModalOpen(true); }} leftIcon={<Plus />}>Add Supplier</IOSButton>}
            </div>
          </div>

          <IOSCard className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
              <Input placeholder="Search suppliers by name or code..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredSuppliers.length === 0 ? (
            <IOSCard className="p-12 text-center"><Building2 className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No suppliers found</p></IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSuppliers.map((supplier) => (
                <IOSCard key={supplier.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-ios-lg bg-stone-100 flex items-center justify-center"><Building2 className="h-5 w-5 text-stone-600" /></div>
                      <div>
                        <p className="font-bold">{supplier.name}</p>
                        {supplier.code && <p className="text-xs text-gray-400">{supplier.code}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <IOSBadge variant="light" color={supplier.status === 'active' ? 'success' : 'secondary'}>{supplier.status}</IOSBadge>
                      {isManager && (
                        <div className="flex gap-1">
                          <button onClick={() => startEdit(supplier)} className="p-1 hover:bg-stone-100 rounded text-stone-400 hover:text-[#007AFF] transition-colors"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => handleDelete(supplier.id)} className="p-1 hover:bg-red-50 rounded text-stone-400 hover:text-red-600 transition-colors"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-gray-500 pt-2 border-t border-stone-50 mt-2">
                    {supplier.contact_person && <p className="flex items-center gap-2 text-stone-700 font-medium">{supplier.contact_person}</p>}
                    {supplier.phone && <p className="flex items-center gap-2"><Phone className="h-3 w-3" /> {supplier.phone}</p>}
                    {supplier.email && <p className="flex items-center gap-2"><Mail className="h-3 w-3" /> {supplier.email}</p>}
                    {supplier.address && <p className="flex items-center gap-2"><MapPin className="h-3 w-3" /> {supplier.address}</p>}
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>


        <Dialog open={addModalOpen} onOpenChange={(open) => { if (!open) resetForm(); setAddModalOpen(open); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
              <DialogDescription>Add or update vendor information for procurement.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2"><label className="text-sm font-medium">Name *</label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
                <div><label className="text-sm font-medium">Code</label><Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} /></div>
              </div>
              <div><label className="text-sm font-medium">Contact Person</label><Input value={formData.contact_person} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">Phone</label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
                <div><label className="text-sm font-medium">Email</label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
              </div>
              <div><label className="text-sm font-medium">Address</label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} /></div>
              <div className="flex gap-3 pt-2">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleCreateOrUpdate} disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Saving...' : (editingId ? 'Save Changes' : 'Add Supplier')}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
