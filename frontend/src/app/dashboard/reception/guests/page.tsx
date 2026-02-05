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
import { guestAPI, bookingsAPI, fetchAPI } from '@/lib/api';
import {
  Users, Search, Plus, RefreshCw, Edit2, Trash2, Eye, Phone, Mail,
  User, Calendar, MapPin, CreditCard, Star, History, MoreVertical,
  CheckCircle, XCircle, Clock, FileText, Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  idType?: string;
  idNumber?: string;
  nationality?: string;
  address?: string;
  city?: string;
  country?: string;
  dateOfBirth?: string;
  isVip?: boolean;
  notes?: string;
  totalStays?: number;
  totalSpent?: number;
  createdAt: string;
  lastStay?: string;
}

interface GuestFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  id_type: string;
  id_number: string;
  nationality: string;
  address: string;
  city: string;
  country: string;
  date_of_birth: string;
  vip_status: boolean;
  notes: string;
}

const initialFormData: GuestFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  id_type: 'national_id',
  id_number: '',
  nationality: 'Kenyan',
  address: '',
  city: '',
  country: 'Kenya',
  date_of_birth: '',
  vip_status: false,
  notes: '',
};

// Guest Form Modal
function GuestFormModal({
  isOpen,
  onClose,
  guest,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  guest: Guest | null;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState<GuestFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (guest) {
      setFormData({
        first_name: guest.firstName || '',
        last_name: guest.lastName || '',
        email: guest.email || '',
        phone: guest.phone || '',
        id_type: guest.idType || 'national_id',
        id_number: guest.idNumber || '',
        nationality: guest.nationality || 'Kenyan',
        address: guest.address || '',
        city: guest.city || '',
        country: guest.country || 'Kenya',
        date_of_birth: guest.dateOfBirth || '',
        vip_status: guest.isVip || false,
        notes: guest.notes || '',
      });
    } else {
      setFormData(initialFormData);
    }
  }, [guest, isOpen]);

  const handleSubmit = async () => {
    if (!formData.first_name || !formData.last_name || !formData.phone) {
      toast.error('Please fill in required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      if (guest) {
        await guestAPI.updateGuest(guest.id, formData);
        toast.success('Guest updated successfully');
      } else {
        await guestAPI.createGuest(formData);
        toast.success('Guest created successfully');
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save guest');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {guest ? 'Edit Guest' : 'New Guest Registration'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="text-sm font-medium">First Name *</label>
            <Input
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              placeholder="John"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Last Name *</label>
            <Input
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              placeholder="Doe"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Phone *</label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="0706 782 828"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="john@example.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium">ID Type</label>
            <select
              value={formData.id_type}
              onChange={(e) => setFormData({ ...formData, id_type: e.target.value })}
              className="w-full p-2 border rounded-ios-lg"
            >
              <option value="national_id">National ID</option>
              <option value="passport">Passport</option>
              <option value="driving_license">Driving License</option>
              <option value="military_id">Military ID</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">ID Number</label>
            <Input
              value={formData.id_number}
              onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
              placeholder="12345678"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Nationality</label>
            <Input
              value={formData.nationality}
              onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
              placeholder="Kenyan"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Date of Birth</label>
            <Input
              type="date"
              value={formData.date_of_birth}
              onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium">Address</label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="123 Main Street"
            />
          </div>
          <div>
            <label className="text-sm font-medium">City</label>
            <Input
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Bomet"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Country</label>
            <Input
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              placeholder="Kenya"
            />
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full p-2 border rounded-ios-lg"
              rows={2}
              placeholder="Special preferences, allergies, etc."
            />
          </div>
          <div className="col-span-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.vip_status}
                onChange={(e) => setFormData({ ...formData, vip_status: e.target.checked })}
                className="w-4 h-4"
              />
              <Star className="h-4 w-4 text-[#3C3C43]" />
              <span className="text-sm font-medium">VIP Guest</span>
            </label>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <IOSButton variant="outline" onClick={onClose} className="flex-1 border-[rgba(60,60,67,0.12)] text-[#3C3C43] hover:bg-[#F2F2F7]">
            Cancel
          </IOSButton>
          <IOSButton onClick={handleSubmit} disabled={isSubmitting} className="flex-1 bg-[#3C3C43] hover:bg-[#000000] text-white">
            {isSubmitting ? 'Saving...' : guest ? 'Update Guest' : 'Register Guest'}
          </IOSButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Guest Details Modal
function GuestDetailsModal({
  isOpen,
  onClose,
  guest,
}: {
  isOpen: boolean;
  onClose: () => void;
  guest: Guest | null;
}) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (guest && isOpen) {
      fetchGuestBookings();
    }
  }, [guest, isOpen]);

  const fetchGuestBookings = async () => {
    if (!guest) return;
    setIsLoading(true);
    try {
      // Use bookingsAPI to get all bookings and filter by guest_id
      const allBookingsResponse = await bookingsAPI.getBookings();
      if (allBookingsResponse.success) {
        const guestBookings = (allBookingsResponse.data || []).filter(
          (b: any) => b.guest_id === guest.id || b.guestId === guest.id
        );
        setBookings(guestBookings);
      } else {
        setBookings([]);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!guest) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Guest Profile
            {guest.isVip && (
              <IOSBadge variant="light" color="warning" className="ml-2">
                <Star className="h-3 w-3 mr-1" /> VIP
              </IOSBadge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 p-4 bg-[#F2F2F7] rounded-xl border border-[rgba(60,60,67,0.12)]">
              <h3 className="text-xl font-bold text-[#000000]">{guest.firstName} {guest.lastName}</h3>
              <div className="flex gap-4 mt-2 text-sm text-[#3C3C43]">
                {guest.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-4 w-4" /> {guest.phone}
                  </span>
                )}
                {guest.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" /> {guest.email}
                  </span>
                )}
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-ios-lg">
              <p className="text-xs text-gray-500">ID Type</p>
              <p className="font-medium capitalize">{guest.idType?.replace('_', ' ') || '-'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-ios-lg">
              <p className="text-xs text-gray-500">ID Number</p>
              <p className="font-medium">{guest.idNumber || '-'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-ios-lg">
              <p className="text-xs text-gray-500">Nationality</p>
              <p className="font-medium">{guest.nationality || '-'}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-ios-lg">
              <p className="text-xs text-gray-500">Total Stays</p>
              <p className="font-medium">{guest.totalStays || 0}</p>
            </div>
          </div>

          {/* Address */}
          {(guest.address || guest.city) && (
            <div className="p-4 bg-gray-50 rounded-ios-lg">
              <p className="text-sm font-medium text-gray-700 mb-1">Address</p>
              <p className="text-gray-600">
                {[guest.address, guest.city, guest.country].filter(Boolean).join(', ')}
              </p>
            </div>
          )}

          {/* Notes */}
          {guest.notes && (
            <div className="p-4 bg-[#F2F2F7] rounded-ios-lg border border-[rgba(60,60,67,0.12)]">
              <p className="text-sm font-medium text-[#3C3C43] mb-1">Notes</p>
              <p className="text-[#3C3C43]">{guest.notes}</p>
            </div>
          )}

          {/* Booking History */}
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <History className="h-4 w-4" /> Booking History
            </h4>
            {isLoading ? (
              <p className="text-gray-500 text-sm">Loading...</p>
            ) : bookings.length === 0 ? (
              <p className="text-gray-500 text-sm">No bookings found</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {bookings.map((booking) => (
                  <div key={booking.id} className="p-3 border rounded-ios-lg flex justify-between items-center">
                    <div>
                      <p className="font-medium">Room {booking.room_number}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(booking.check_in).toLocaleDateString()} - {new Date(booking.check_out).toLocaleDateString()}
                      </p>
                    </div>
                    <IOSBadge color={booking.status === 'completed' ? 'success' : 'secondary'}>
                      {booking.status}
                    </IOSBadge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function GuestsPage() {
  const { user } = useAuth();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVIP, setFilterVIP] = useState<boolean | null>(null);

  // Modals
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);

  const fetchGuests = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await guestAPI.getGuests(searchQuery || undefined, user?.branch_id || undefined);
      if (response.success) {
        setGuests(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching guests:', error);
      toast.error('Failed to load guests');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchGuests();
  }, []);

  const handleSearch = () => {
    fetchGuests();
  };

  const filteredGuests = guests.filter((guest) => {
    if (filterVIP !== null && guest.isVip !== filterVIP) return false;
    return true;
  });

  const handleDelete = async (guest: Guest) => {
    if (!confirm(`Delete guest ${guest.firstName} ${guest.lastName}?`)) return;
    try {
      await guestAPI.deleteGuest(guest.id);
      toast.success('Guest deleted');
      fetchGuests();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete guest');
    }
  };

  const openEdit = (guest: Guest) => {
    setSelectedGuest(guest);
    setFormModalOpen(true);
  };

  const openDetails = (guest: Guest) => {
    setSelectedGuest(guest);
    setDetailsModalOpen(true);
  };

  const openNew = () => {
    setSelectedGuest(null);
    setFormModalOpen(true);
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Guest Management</h1>
              <p className="text-gray-500">Manage guest profiles and history</p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="outline" onClick={fetchGuests} leftIcon={<RefreshCw />} className="border-[rgba(60,60,67,0.12)] text-[#3C3C43] hover:bg-[#F2F2F7]">Refresh
              </IOSButton>
              <IOSButton onClick={openNew} leftIcon={<Plus />} className="bg-[#3C3C43] hover:bg-[#000000] text-white">New Guest
              </IOSButton>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Guests', value: guests.length, icon: Users, color: 'text-gray-600', bg: 'bg-gray-50' },
              { label: 'VIP Guests', value: guests.filter(g => g.isVip).length, icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
              {
                label: 'New This Month', value: guests.filter(g => {
                  const created = new Date(g.createdAt);
                  const now = new Date();
                  return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
                }).length, icon: User, color: 'text-blue-600', bg: 'bg-blue-50'
              },
              { label: 'Returning Guests', value: guests.filter(g => (g.totalStays || 0) > 1).length, icon: History, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            ].map((stat) => (
              <IOSCard key={stat.label} className="p-4 border-none shadow-sm bg-white">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${stat.bg}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              </IOSCard>
            ))}
          </div>

          {/* Search & Filters */}
          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                  <Input
                    placeholder="Search by name, phone, email, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="pl-9"
                  />
                </div>
                <IOSButton onClick={handleSearch} className="bg-[#3C3C43] hover:bg-[#000000] text-white">Search</IOSButton>
              </div>
              <div className="flex gap-2">
                <IOSButton
                  className={filterVIP === null ? 'bg-[#3C3C43] text-white' : 'border-[rgba(60,60,67,0.12)] text-[#3C3C43] hover:bg-[#F2F2F7]'}
                  size="sm"
                  onClick={() => setFilterVIP(null)}
                >
                  All
                </IOSButton>
                <IOSButton
                  className={filterVIP === true ? 'bg-[#3C3C43] text-white' : 'border-[rgba(60,60,67,0.12)] text-[#3C3C43] hover:bg-[#F2F2F7]'}
                  size="sm"
                  onClick={() => setFilterVIP(true)}
                  leftIcon={<Star className="h-3 w-3" />}
                >
                  VIP
                </IOSButton>
                <IOSButton
                  className={filterVIP === false ? 'bg-[#3C3C43] text-white' : 'border-[rgba(60,60,67,0.12)] text-[#3C3C43] hover:bg-[#F2F2F7]'}
                  size="sm"
                  onClick={() => setFilterVIP(false)}
                >
                  Regular
                </IOSButton>
              </div>
            </div>
          </IOSCard>

          {/* Guests Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredGuests.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No guests found</p>
              <IOSButton onClick={openNew} className="mt-4 bg-[#3C3C43] hover:bg-[#000000] text-white" leftIcon={<Plus />}>Register New Guest
              </IOSButton>
            </IOSCard>
          ) : (
            <IOSCard className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Guest</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Contact</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">ID</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stays</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredGuests.map((guest) => (
                      <tr key={guest.id} className="hover:bg-gray-50">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#3C3C43] flex items-center justify-center text-white font-medium">
                              {(guest.firstName || 'G')[0]}{(guest.lastName || 'U')[0]}
                            </div>
                            <div>
                              <p className="font-medium">{guest.firstName} {guest.lastName}</p>
                              <p className="text-sm text-gray-500">{guest.nationality || 'N/A'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-sm">{guest.phone || '-'}</p>
                          <p className="text-sm text-gray-500">{guest.email || '-'}</p>
                        </td>
                        <td className="p-4">
                          <p className="text-sm capitalize">{guest.idType?.replace('_', ' ') || '-'}</p>
                          <p className="text-sm text-gray-500">{guest.idNumber || '-'}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-medium">{guest.totalStays || 0}</p>
                        </td>
                        <td className="p-4">
                          {guest.isVip && (
                            <IOSBadge variant="light" color="warning">
                              <Star className="h-3 w-3 mr-1" /> VIP
                            </IOSBadge>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            <IOSButton size="sm" variant="outline" onClick={() => openDetails(guest)} className="border-[rgba(60,60,67,0.12)] text-[#3C3C43] hover:bg-[#F2F2F7]">
                              <Eye className="h-4 w-4" />
                            </IOSButton>
                            <IOSButton size="sm" variant="outline" onClick={() => openEdit(guest)} className="border-[rgba(60,60,67,0.12)] text-[#3C3C43] hover:bg-[#F2F2F7]">
                              <Edit2 className="h-4 w-4" />
                            </IOSButton>
                            <IOSButton size="sm" variant="outline" className="text-[#3C3C43] border-[rgba(60,60,67,0.12)] hover:bg-[#F2F2F7]" onClick={() => handleDelete(guest)}>
                              <Trash2 className="h-4 w-4" />
                            </IOSButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </IOSCard>
          )}
        </div>

        {/* Modals */}
        <GuestFormModal
          isOpen={formModalOpen}
          onClose={() => setFormModalOpen(false)}
          guest={selectedGuest}
          onSuccess={fetchGuests}
        />
        <GuestDetailsModal
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          guest={selectedGuest}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
