'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { Input } from '@/components/ui/input';
import { guestAPI } from '@/lib/api';
import { Users, RefreshCw, Search, User, Mail, Phone, Edit2, Trash2, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Guest { id: string; first_name: string; last_name: string; email?: string; phone?: string; visits: number; }

export default function AdminGuestsPage() {
  const { user } = useAuth();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ first_name: '', last_name: '', email: '', phone: '' });

  const fetchGuests = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await guestAPI.getGuests(searchQuery || undefined);
      if (response.success) setGuests(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [searchQuery]);

  useEffect(() => { fetchGuests(); }, [fetchGuests]);

  const resetForm = () => setFormData({ first_name: '', last_name: '', email: '', phone: '' });

  const handleCreateGuest = async () => {
    if (!formData.first_name || !formData.last_name) { toast.error('Name is required'); return; }
    setIsSubmitting(true);
    try {
      await guestAPI.createGuest(formData);
      toast.success('Guest created');
      setAddModalOpen(false);
      resetForm();
      fetchGuests();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  const openEditModal = (guest: Guest) => {
    setSelectedGuest(guest);
    setFormData({ first_name: guest.first_name, last_name: guest.last_name, email: guest.email || '', phone: guest.phone || '' });
    setEditModalOpen(true);
  };

  const handleUpdateGuest = async () => {
    if (!selectedGuest || !formData.first_name || !formData.last_name) { toast.error('Name is required'); return; }
    setIsSubmitting(true);
    try {
      await guestAPI.updateGuest(selectedGuest.id, formData);
      toast.success('Guest updated');
      setEditModalOpen(false);
      setSelectedGuest(null);
      resetForm();
      fetchGuests();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteGuest = async () => {
    if (!selectedGuest) return;
    setIsSubmitting(true);
    try {
      await guestAPI.deleteGuest(selectedGuest.id);
      toast.success('Guest deleted');
      setDeleteConfirmOpen(false);
      setSelectedGuest(null);
      fetchGuests();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Guests</h1><p className="text-gray-500">Guest profiles</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchGuests} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <IOSButton onClick={() => setAddModalOpen(true)} leftIcon={<Plus />}>Add Guest</IOSButton>
            </div>
          </div>

          <IOSCard className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
              <Input placeholder="Search guests..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : guests.length === 0 ? (
            <IOSCard className="p-12 text-center"><Users className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No guests found</p></IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {guests.map((guest) => (
                <IOSCard key={guest.id} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                      {guest.first_name?.[0]}{guest.last_name?.[0]}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold">{guest.first_name} {guest.last_name}</p>
                      {guest.email && <p className="text-sm text-gray-500 flex items-center gap-1"><Mail className="h-3 w-3" /> {guest.email}</p>}
                      {guest.phone && <p className="text-sm text-gray-500 flex items-center gap-1"><Phone className="h-3 w-3" /> {guest.phone}</p>}
                      <p className="text-xs text-gray-400 mt-2">{guest.visits || 0} visits</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t">
                    <IOSButton size="sm" variant="outline" className="flex-1" onClick={() => openEditModal(guest)} leftIcon={<Edit2 className="h-3 w-3" />}>Edit</IOSButton>
                    <IOSButton size="sm" variant="destructive" onClick={() => { setSelectedGuest(guest); setDeleteConfirmOpen(true); }}><Trash2 className="h-3 w-3" /></IOSButton>
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>

        {/* Add Guest Modal */}
        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Guest</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium">First Name *</label><Input value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} /></div>
                <div><label className="text-sm font-medium">Last Name *</label><Input value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} /></div>
              </div>
              <div><label className="text-sm font-medium">Email</label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Phone</label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleCreateGuest} disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Creating...' : 'Create'}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Guest Modal */}
        <Dialog open={editModalOpen} onOpenChange={(open) => { setEditModalOpen(open); if (!open) setSelectedGuest(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit Guest</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium">First Name *</label><Input value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} /></div>
                <div><label className="text-sm font-medium">Last Name *</label><Input value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} /></div>
              </div>
              <div><label className="text-sm font-medium">Email</label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Phone</label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} /></div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setEditModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleUpdateGuest} disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Updating...' : 'Update'}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="text-red-600">Delete Guest</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-stone-600">Are you sure you want to delete this guest?</p>
              {selectedGuest && <div className="p-3 bg-stone-50 rounded-lg"><p className="font-medium">{selectedGuest.first_name} {selectedGuest.last_name}</p></div>}
              <div className="flex gap-2">
                <IOSButton variant="secondary" className="flex-1" onClick={() => setDeleteConfirmOpen(false)}>Cancel</IOSButton>
                <IOSButton variant="destructive" className="flex-1" onClick={handleDeleteGuest} disabled={isSubmitting}>{isSubmitting ? 'Deleting...' : 'Delete'}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
