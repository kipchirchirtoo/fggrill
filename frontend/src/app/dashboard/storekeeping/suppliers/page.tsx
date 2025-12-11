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
import { Building2, Plus, Edit, Trash2, RefreshCw, Save, Phone, Mail, MapPin, CheckCircle, XCircle, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Supplier {
  id: string;
  name: string;
  code?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  payment_terms?: string;
  status: string;
  created_at: string;
}

const STATUSES = ['ACTIVE', 'INACTIVE', 'BLOCKED'];
const PAYMENT_TERMS = ['COD', 'NET7', 'NET15', 'NET30', 'NET60', 'NET90'];

export default function SuppliersPage() {
  const { user } = useAuth();
  const canEdit = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER || user?.role === UserRole.CENTRAL_STOREKEEPER;
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState({
    name: '',
    code: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    payment_terms: 'NET30',
    status: 'ACTIVE'
  });

  useEffect(() => { fetchSuppliers(); }, []);

  const fetchSuppliers = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/store/suppliers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name) {
      toast.error('Supplier name is required');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const url = selectedSupplier 
        ? `${API_URL}/api/store/suppliers/${selectedSupplier.id}`
        : `${API_URL}/api/store/suppliers`;
      const res = await fetch(url, {
        method: selectedSupplier ? 'PUT' : 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        toast.success(selectedSupplier ? 'Supplier updated' : 'Supplier added');
        setIsModalOpen(false);
        fetchSuppliers();
      } else {
        toast.error('Failed to save supplier');
      }
    } catch { toast.error('Error saving supplier'); }
  };

  const handleDelete = async () => {
    if (!selectedSupplier) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/store/suppliers/${selectedSupplier.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Supplier deleted');
        setIsDeleteModalOpen(false);
        fetchSuppliers();
      }
    } catch { toast.error('Error deleting supplier'); }
  };

  const openAddModal = () => {
    setSelectedSupplier(null);
    setForm({ name: '', code: '', contact_person: '', email: '', phone: '', address: '', city: '', payment_terms: 'NET30', status: 'ACTIVE' });
    setIsModalOpen(true);
  };

  const openEditModal = (s: Supplier) => {
    setSelectedSupplier(s);
    setForm({
      name: s.name,
      code: s.code || '',
      contact_person: s.contact_person || '',
      email: s.email || '',
      phone: s.phone || '',
      address: s.address || '',
      city: s.city || '',
      payment_terms: s.payment_terms || 'NET30',
      status: s.status
    });
    setIsModalOpen(true);
  };

  const getStatusColor = (s: string) => ({
    ACTIVE: 'bg-[#F2F2F7] text-[#000000]',
    INACTIVE: 'bg-gray-100 text-gray-800',
    BLOCKED: 'bg-[#F2F2F7] text-[#000000]'
  }[s] || 'bg-gray-100 text-gray-800');

  const getStatusIcon = (s: string) => {
    if (s === 'ACTIVE') return <CheckCircle className="h-4 w-4" />;
    if (s === 'INACTIVE') return <XCircle className="h-4 w-4" />;
    if (s === 'BLOCKED') return <Ban className="h-4 w-4" />;
    return null;
  };

  const filteredSuppliers = suppliers.filter(s => 
    !searchTerm || 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = suppliers.filter(s => s.status === 'ACTIVE').length;

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Supplier Management</h1>
              <p className="text-gray-600">Manage vendors and suppliers</p>
            </div>
            <div className="flex gap-3">
              <IOSButton variant="outline" onClick={fetchSuppliers} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              {canEdit && <IOSButton onClick={openAddModal} leftIcon={<Plus />}>Add Supplier</IOSButton>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <IOSCard className="p-4"><div className="flex items-center gap-3"><Building2 className="h-8 w-8 text-[#8E8E93]0" /><div><p className="text-sm text-gray-500">Total Suppliers</p><p className="text-2xl font-bold">{suppliers.length}</p></div></div></IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-3"><CheckCircle className="h-8 w-8 text-[#8E8E93]0" /><div><p className="text-sm text-gray-500">Active</p><p className="text-2xl font-bold text-[#3C3C43]">{activeCount}</p></div></div></IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-3"><Ban className="h-8 w-8 text-[#8E8E93]0" /><div><p className="text-sm text-gray-500">Blocked</p><p className="text-2xl font-bold text-[#3C3C43]">{suppliers.filter(s => s.status === 'BLOCKED').length}</p></div></div></IOSCard>
          </div>

          <div className="flex gap-4">
            <Input placeholder="Search suppliers..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="max-w-md" />
          </div>

          <IOSCard>
            {isLoading ? (
              <div className="p-12 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[rgba(60,60,67,0.12)] mx-auto"></div></div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="p-12 text-center text-gray-500"><Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No suppliers found</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Terms</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      {canEdit && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredSuppliers.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium">{s.name}</p>
                            {s.code && <p className="text-xs text-gray-500 font-mono">{s.code}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            {s.contact_person && <p className="text-sm">{s.contact_person}</p>}
                            {s.phone && <p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone}</p>}
                            {s.email && <p className="text-xs text-gray-500 flex items-center gap-1"><Mail className="h-3 w-3" />{s.email}</p>}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {s.city ? (
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="h-4 w-4 text-gray-400" />
                              {s.city}
                            </div>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="px-4 py-4"><IOSBadge variant="light" color="secondary">{s.payment_terms || 'NET30'}</IOSBadge></td>
                        <td className="px-4 py-4">
                          <IOSBadge className={getStatusColor(s.status)}>
                            <span className="flex items-center gap-1">{getStatusIcon(s.status)} {s.status}</span>
                          </IOSBadge>
                        </td>
                        {canEdit && (
                          <td className="px-4 py-4">
                            <div className="flex gap-2">
                              <IOSButton size="sm" variant="outline" onClick={() => openEditModal(s)}><Edit className="h-4 w-4" /></IOSButton>
                              <IOSButton size="sm" variant="outline" className="text-[#3C3C43]" onClick={() => { setSelectedSupplier(s); setIsDeleteModalOpen(true); }}><Trash2 className="h-4 w-4" /></IOSButton>
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
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{selectedSupplier ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">Name *</label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Company name" /></div>
                <div><label className="text-sm font-medium">Code</label><Input value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} placeholder="KBL" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">Contact Person</label><Input value={form.contact_person} onChange={e => setForm({...form, contact_person: e.target.value})} placeholder="Sales Rep" /></div>
                <div><label className="text-sm font-medium">Phone</label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+254..." /></div>
              </div>
              <div><label className="text-sm font-medium">Email</label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="supplier@company.com" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">City</label><Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="Nairobi" /></div>
                <div><label className="text-sm font-medium">Address</label><Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Street address" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">Payment Terms</label><select value={form.payment_terms} onChange={e => setForm({...form, payment_terms: e.target.value})} className="w-full px-3 py-2 border rounded-ios-lg">{PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                <div><label className="text-sm font-medium">Status</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full px-3 py-2 border rounded-ios-lg">{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              </div>
              <div className="flex justify-end gap-3 pt-4"><IOSButton variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</IOSButton><IOSButton onClick={handleSave} leftIcon={<Save />}>Save</IOSButton></div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle className="text-[#3C3C43]">Delete Supplier</DialogTitle></DialogHeader>
            <p>Are you sure you want to delete <strong>{selectedSupplier?.name}</strong>?</p>
            <div className="flex justify-end gap-3 pt-4"><IOSButton variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</IOSButton><IOSButton className="bg-[#3C3C43] hover:bg-[#3C3C43]" onClick={handleDelete} leftIcon={<Trash2 />}>Delete</IOSButton></div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
