'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { Input } from '@/components/ui/input';
import { guestAPI } from '@/lib/api';
import { Users, RefreshCw, Search, User, Mail, Phone, Edit2, Trash2, Plus, Bed, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  room_number?: string;
  total_bookings?: number;
  last_visit?: string;
  loyalty_points?: number;
  vip?: boolean;
}

export default function BranchGuestsPage() {
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
      const response = await guestAPI.getGuests(searchQuery);
      if (response.success && Array.isArray(response.data)) {
        setGuests(response.data);
      } else {
        setGuests([]);
      }
    } catch (error) {
      console.error('Error fetching guests:', error);
      toast.error('Failed to load guests');
      setGuests([]);
    }
    finally { setIsLoading(false); }
  }, [searchQuery]);

  useEffect(() => { fetchGuests(); }, [fetchGuests]);

  const resetForm = () => setFormData({ first_name: '', last_name: '', email: '', phone: '' });

  const handleAddGuest = async () => {
    if (!formData.first_name || !formData.last_name) {
      toast.error('First name and last name are required');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await guestAPI.createGuest(formData);
      if (response.success) {
        toast.success('Guest added successfully');
        setAddModalOpen(false);
        resetForm();
        fetchGuests();
      } else {
        toast.error(response.message || 'Failed to add guest');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to add guest');
    }
    finally { setIsSubmitting(false); }
  };

  const openEditModal = (guest: Guest) => {
    setSelectedGuest(guest);
    setFormData({ first_name: guest.first_name, last_name: guest.last_name, email: guest.email || '', phone: guest.phone || '' });
    setEditModalOpen(true);
  };

  const handleUpdateGuest = async () => {
    if (!selectedGuest || !formData.first_name || !formData.last_name) {
      toast.error('First name and last name are required');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await guestAPI.updateGuest(selectedGuest.id, formData);
      if (response.success) {
        toast.success('Guest updated successfully');
        setEditModalOpen(false);
        setSelectedGuest(null);
        resetForm();
        fetchGuests();
      } else {
        toast.error(response.message || 'Failed to update guest');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update guest');
    }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteGuest = async () => {
    if (!selectedGuest) return;
    setIsSubmitting(true);
    try {
      const response = await guestAPI.deleteGuest(selectedGuest.id);
      if (response.success) {
        toast.success('Guest deleted successfully');
        setDeleteConfirmOpen(false);
        setSelectedGuest(null);
        fetchGuests();
      } else {
        toast.error(response.message || 'Failed to delete guest');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete guest');
    }
    finally { setIsSubmitting(false); }
  };

  const filteredGuests = guests.filter((g) => `${g.first_name} ${g.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) || g.email?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Guests</h1><p className="text-gray-500">Current and past guests</p></div>
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
          ) : filteredGuests.length === 0 ? (
            <IOSCard className="p-12 text-center"><Users className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No guests found</p></IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGuests.map((guest) => (
                <IOSCard key={guest.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${guest.vip ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                        }`}>
                        {(guest.first_name || 'G')[0]}{(guest.last_name || '')[0]}
                      </div>
                      {guest.vip && (
                        <div className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold px-1 rounded">VIP</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900">{guest.first_name} {guest.last_name}</p>
                      </div>
                      {guest.room_number && (
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Bed className="h-3 w-3" /> Currently in Room {guest.room_number}
                        </p>
                      )}
                      {guest.email && <p className="text-xs text-gray-400 flex items-center gap-1 truncate"><Mail className="h-3 w-3" /> {guest.email}</p>}
                      {guest.phone && <p className="text-xs text-gray-400 flex items-center gap-1"><Phone className="h-3 w-3" /> {guest.phone}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        {guest.total_bookings !== undefined && (
                          <span>{guest.total_bookings} {guest.total_bookings === 1 ? 'booking' : 'bookings'}</span>
                        )}
                        {guest.last_visit && (
                          <span>Last visit: {new Date(guest.last_visit).toLocaleDateString()}</span>
                        )}
                        {guest.loyalty_points !== undefined && guest.loyalty_points > 0 && (
                          <span className="text-green-600 font-semibold">{guest.loyalty_points} pts</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <IOSButton size="sm" variant="secondary" className="flex-1" onClick={() => openEditModal(guest)} leftIcon={<Edit2 className="h-3 w-3" />}>Edit</IOSButton>
                    <IOSButton size="sm" variant="destructive" onClick={() => { setSelectedGuest(guest); setDeleteConfirmOpen(true); }}><Trash2 className="h-3 w-3" /></IOSButton>
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>

        {/* Add Modal */}
        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-2xl flex flex-col overflow-hidden p-0 max-h-[90vh]">
            <DialogHeader className="px-6 py-4 border-b border-stone-100 bg-white">
              <DialogTitle className="flex items-center gap-2 text-xl font-sf-pro-display">
                <UserPlus className="h-5 w-5 text-indigo-600" />
                Register New Guest
              </DialogTitle>
            </DialogHeader>

            <DialogBody>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">First Name *</label>
                    <Input
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      placeholder="e.g. John"
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Last Name *</label>
                    <Input
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      placeholder="e.g. Doe"
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Email Address</label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="guest@example.com"
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Phone Number</label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+254..."
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            </DialogBody>

            <DialogFooter className="p-4 bg-stone-50 border-t border-stone-100 flex gap-4">
              <IOSButton
                variant="secondary"
                onClick={() => setAddModalOpen(false)}
                className="flex-1 h-12 text-base font-semibold"
              >
                Cancel
              </IOSButton>
              <IOSButton
                onClick={handleAddGuest}
                disabled={isSubmitting}
                className="flex-1 h-12 text-base font-semibold"
              >
                {isSubmitting ? 'Registering Guest...' : 'Register Guest'}
              </IOSButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={editModalOpen} onOpenChange={(open) => { setEditModalOpen(open); if (!open) setSelectedGuest(null); }}>
          <DialogContent className="max-w-2xl flex flex-col overflow-hidden p-0 max-h-[90vh]">
            <DialogHeader className="px-6 py-4 border-b border-stone-100 bg-white">
              <DialogTitle className="flex items-center gap-2 text-xl font-sf-pro-display">
                <Edit2 className="h-5 w-5 text-stone-600" />
                Edit Guest Profile
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">First Name *</label>
                  <Input
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="First name"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Last Name *</label>
                  <Input
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="Last name"
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Email Address</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Email"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Phone Number</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Phone"
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-100 flex gap-4">
              <IOSButton
                variant="secondary"
                onClick={() => setEditModalOpen(false)}
                className="flex-1 h-12 text-base font-semibold"
              >
                Discard Changes
              </IOSButton>
              <IOSButton
                onClick={handleUpdateGuest}
                disabled={isSubmitting}
                className="flex-1 h-12 text-base font-semibold"
              >
                {isSubmitting ? 'Saving Changes...' : 'Save Profile Changes'}
              </IOSButton>
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
