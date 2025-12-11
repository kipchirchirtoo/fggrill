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
import { Truck, RefreshCw, Plus, Phone, Mail, MapPin, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Supplier { id: string; name: string; contact_person?: string; email?: string; phone?: string; address?: string; status: 'active' | 'inactive'; }

export default function AdminSuppliersPage() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
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

  const handleAddSupplier = async () => {
    if (!formData.name) { toast.error('Name is required'); return; }
    try {
      await storeAPI.createSupplier(formData);
      toast.success('Supplier added');
      setAddModalOpen(false);
      fetchSuppliers();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
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
                    <IOSBadge variant={supplier.status === 'active' ? 'success' : 'neutral'}>{supplier.status}</IOSBadge>
                  </div>
                  <div className="space-y-1 text-sm text-gray-500">
                    {supplier.phone && <p className="flex items-center gap-2"><Phone className="h-3 w-3" /> {supplier.phone}</p>}
                    {supplier.email && <p className="flex items-center gap-2"><Mail className="h-3 w-3" /> {supplier.email}</p>}
                    {supplier.address && <p className="flex items-center gap-2"><MapPin className="h-3 w-3" /> {supplier.address}</p>}
                  </div>
                  <IOSButton variant="secondary" size="sm" className="w-full mt-4" leftIcon={<Edit2 />}>Edit</IOSButton>
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
                <IOSButton onClick={handleAddSupplier} className="flex-1">Add</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
