'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { User, Plus, Edit, Trash2, RefreshCw, Save, Phone, CreditCard, Truck, CheckCircle, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Driver {
  id: string;
  user_id?: string;
  name: string;
  phone: string;
  license_number?: string;
  license_expiry?: string;
  status: string;
  total_deliveries: number;
  created_at: string;
}

const STATUSES = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED'];

export default function DriversPage() {
  const { user } = useAuth();
  const canEdit = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER || user?.role === UserRole.CENTRAL_STOREKEEPER;
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    license_number: '',
    license_expiry: '',
    status: 'ACTIVE'
  });

  useEffect(() => { fetchDrivers(); }, []);

  const fetchDrivers = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/store/drivers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDrivers(data.data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.phone) {
      toast.error('Name and phone are required');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const url = selectedDriver 
        ? `${API_URL}/api/store/drivers/${selectedDriver.id}`
        : `${API_URL}/api/store/drivers`;
      const res = await fetch(url, {
        method: selectedDriver ? 'PUT' : 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        toast.success(selectedDriver ? 'Driver updated' : 'Driver added');
        setIsModalOpen(false);
        fetchDrivers();
      } else {
        toast.error('Failed to save driver');
      }
    } catch { toast.error('Error saving driver'); }
  };

  const handleDelete = async () => {
    if (!selectedDriver) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/store/drivers/${selectedDriver.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Driver deleted');
        setIsDeleteModalOpen(false);
        fetchDrivers();
      }
    } catch { toast.error('Error deleting driver'); }
  };

  const openAddModal = () => {
    setSelectedDriver(null);
    setForm({ name: '', phone: '', license_number: '', license_expiry: '', status: 'ACTIVE' });
    setIsModalOpen(true);
  };

  const openEditModal = (d: Driver) => {
    setSelectedDriver(d);
    setForm({
      name: d.name,
      phone: d.phone,
      license_number: d.license_number || '',
      license_expiry: d.license_expiry?.split('T')[0] || '',
      status: d.status
    });
    setIsModalOpen(true);
  };

  const getStatusColor = (s: string) => ({
    ACTIVE: 'bg-green-100 text-green-800',
    INACTIVE: 'bg-gray-100 text-gray-800',
    ON_LEAVE: 'bg-amber-100 text-amber-800',
    TERMINATED: 'bg-red-100 text-red-800'
  }[s] || 'bg-gray-100 text-gray-800');

  const getStatusIcon = (s: string) => {
    if (s === 'ACTIVE') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (s === 'ON_LEAVE') return <Clock className="h-4 w-4 text-amber-500" />;
    if (s === 'TERMINATED') return <XCircle className="h-4 w-4 text-red-500" />;
    return null;
  };

  const activeCount = drivers.filter(d => d.status === 'ACTIVE').length;
  const totalDeliveries = drivers.reduce((sum, d) => sum + d.total_deliveries, 0);

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Driver Management</h1>
              <p className="text-gray-600">Manage delivery drivers for dispatches</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={fetchDrivers}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
              {canEdit && <Button onClick={openAddModal}><Plus className="h-4 w-4 mr-2" />Add Driver</Button>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4"><div className="flex items-center gap-3"><User className="h-8 w-8 text-blue-500" /><div><p className="text-sm text-gray-500">Total Drivers</p><p className="text-2xl font-bold">{drivers.length}</p></div></div></Card>
            <Card className="p-4"><div className="flex items-center gap-3"><CheckCircle className="h-8 w-8 text-green-500" /><div><p className="text-sm text-gray-500">Active</p><p className="text-2xl font-bold text-green-600">{activeCount}</p></div></div></Card>
            <Card className="p-4"><div className="flex items-center gap-3"><Truck className="h-8 w-8 text-indigo-500" /><div><p className="text-sm text-gray-500">Total Deliveries</p><p className="text-2xl font-bold text-indigo-600">{totalDeliveries}</p></div></div></Card>
            <Card className="p-4"><div className="flex items-center gap-3"><Clock className="h-8 w-8 text-amber-500" /><div><p className="text-sm text-gray-500">On Leave</p><p className="text-2xl font-bold text-amber-600">{drivers.filter(d => d.status === 'ON_LEAVE').length}</p></div></div></Card>
          </div>

          <Card>
            {isLoading ? (
              <div className="p-12 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div></div>
            ) : drivers.length === 0 ? (
              <div className="p-12 text-center text-gray-500"><User className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No drivers registered</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">License</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deliveries</th>
                      {canEdit && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {drivers.map(d => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                              <User className="h-5 w-5 text-indigo-600" />
                            </div>
                            <p className="font-medium">{d.name}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-400" />
                            <span>{d.phone}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {d.license_number ? (
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="text-sm">{d.license_number}</p>
                                {d.license_expiry && <p className="text-xs text-gray-500">Exp: {new Date(d.license_expiry).toLocaleDateString()}</p>}
                              </div>
                            </div>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="px-4 py-4">
                          <Badge className={getStatusColor(d.status)}>
                            <span className="flex items-center gap-1">{getStatusIcon(d.status)} {d.status}</span>
                          </Badge>
                        </td>
                        <td className="px-4 py-4 font-bold text-indigo-600">{d.total_deliveries}</td>
                        {canEdit && (
                          <td className="px-4 py-4">
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => openEditModal(d)}><Edit className="h-4 w-4" /></Button>
                              <Button size="sm" variant="outline" className="text-red-600" onClick={() => { setSelectedDriver(d); setIsDeleteModalOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{selectedDriver ? 'Edit Driver' : 'Add Driver'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">Name *</label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Full name" /></div>
                <div><label className="text-sm font-medium">Phone *</label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+254712345678" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">License Number</label><Input value={form.license_number} onChange={e => setForm({...form, license_number: e.target.value})} placeholder="DL123456" /></div>
                <div><label className="text-sm font-medium">License Expiry</label><Input type="date" value={form.license_expiry} onChange={e => setForm({...form, license_expiry: e.target.value})} /></div>
              </div>
              <div><label className="text-sm font-medium">Status</label><select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full px-3 py-2 border rounded-lg">{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              <div className="flex justify-end gap-3 pt-4"><Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button><Button onClick={handleSave}><Save className="h-4 w-4 mr-2" />Save</Button></div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle className="text-red-600">Delete Driver</DialogTitle></DialogHeader>
            <p>Are you sure you want to delete <strong>{selectedDriver?.name}</strong>?</p>
            <div className="flex justify-end gap-3 pt-4"><Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancel</Button><Button className="bg-red-600 hover:bg-red-700" onClick={handleDelete}><Trash2 className="h-4 w-4 mr-2" />Delete</Button></div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
