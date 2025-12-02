'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, Filter, Plus, Edit, Eye, Trash2, Phone, Mail,
  MapPin, Calendar, Star, Crown, Clock, CreditCard, Bed, History,
  FileText, MessageSquare, Heart, Award, ChevronRight, X, Check,
  Loader2, Download, Upload, RefreshCw, UserPlus, Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { guestAPI, bookingsAPI } from '@/lib/api';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate } from '@/lib/date-utils';

interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  nationality?: string;
  id_type?: string;
  id_number?: string;
  address?: string;
  city?: string;
  country?: string;
  date_of_birth?: string;
  is_vip: boolean;
  loyalty_tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  loyalty_points?: number;
  total_stays?: number;
  total_spent?: number;
  preferences?: {
    room_type?: string;
    floor_preference?: string;
    pillow_type?: string;
    dietary?: string[];
    special_requests?: string;
  };
  notes?: string;
  created_at: string;
  last_stay?: string;
}

interface StayHistory {
  id: string;
  check_in: string;
  check_out: string;
  room_number: string;
  room_type: string;
  total_amount: number;
  status: string;
}

interface GuestManagementProps {
  branchId?: number;
  onGuestSelect?: (guest: Guest) => void;
  compact?: boolean;
}

const LOYALTY_TIERS = {
  bronze: { color: 'bg-amber-100 text-amber-700', icon: Award, minPoints: 0 },
  silver: { color: 'bg-gray-100 text-gray-700', icon: Award, minPoints: 500 },
  gold: { color: 'bg-yellow-100 text-yellow-700', icon: Crown, minPoints: 2000 },
  platinum: { color: 'bg-purple-100 text-purple-700', icon: Crown, minPoints: 5000 }
};

export function GuestManagement({ branchId, onGuestSelect, compact = false }: GuestManagementProps) {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVIP, setFilterVIP] = useState<boolean | null>(null);
  const [filterLoyalty, setFilterLoyalty] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name' | 'recent' | 'stays' | 'spent'>('recent');
  
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [stayHistory, setStayHistory] = useState<StayHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [formData, setFormData] = useState<Partial<Guest>>({});

  useEffect(() => {
    fetchGuests();
  }, [branchId]);

  const fetchGuests = async () => {
    setIsLoading(true);
    try {
      const response = await guestAPI.getGuests();
      const guestsData = response.data || response.guests || response || [];
      setGuests(Array.isArray(guestsData) ? guestsData : []);
    } catch (error) {
      console.error('Error fetching guests:', error);
      toast.error('Failed to load guests');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGuestHistory = async (guestId: string) => {
    setIsLoadingHistory(true);
    try {
      // Fetch bookings for this guest
      const response = await bookingsAPI.getBookings();
      const bookings = response.data || response.bookings || response || [];
      const guestBookings = bookings
        .filter((b: any) => b.guest_id === guestId || b.guest?.id === guestId)
        .map((b: any) => ({
          id: b.id,
          check_in: b.check_in_date || b.check_in,
          check_out: b.check_out_date || b.check_out,
          room_number: b.room?.room_number || b.room_number || '-',
          room_type: b.room_type?.name || b.room?.type || 'Standard',
          total_amount: b.total_amount || 0,
          status: b.status
        }));
      setStayHistory(guestBookings);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleViewGuest = async (guest: Guest) => {
    setSelectedGuest(guest);
    setIsViewModalOpen(true);
    await fetchGuestHistory(guest.id);
  };

  const handleEditGuest = (guest: Guest) => {
    setSelectedGuest(guest);
    setFormData(guest);
    setIsEditModalOpen(true);
  };

  const handleNewGuest = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      is_vip: false
    });
    setIsNewModalOpen(true);
  };

  const handleSaveGuest = async () => {
    try {
      if (selectedGuest) {
        await guestAPI.updateGuest(selectedGuest.id, formData);
        toast.success('Guest updated successfully');
      } else {
        await guestAPI.createGuest(formData);
        toast.success('Guest created successfully');
      }
      setIsEditModalOpen(false);
      setIsNewModalOpen(false);
      fetchGuests();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save guest');
    }
  };

  const handleDeleteGuest = async (guestId: string) => {
    if (!confirm('Are you sure you want to delete this guest?')) return;
    try {
      await guestAPI.deleteGuest(guestId);
      toast.success('Guest deleted');
      fetchGuests();
    } catch (error) {
      toast.error('Failed to delete guest');
    }
  };

  const handleToggleVIP = async (guest: Guest) => {
    try {
      await guestAPI.updateGuest(guest.id, { is_vip: !guest.is_vip });
      toast.success(guest.is_vip ? 'VIP status removed' : 'Guest marked as VIP');
      fetchGuests();
    } catch (error) {
      toast.error('Failed to update VIP status');
    }
  };

  // Filter and sort guests
  const filteredGuests = useMemo(() => {
    let result = [...guests];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(g =>
        g.first_name?.toLowerCase().includes(term) ||
        g.last_name?.toLowerCase().includes(term) ||
        g.email?.toLowerCase().includes(term) ||
        g.phone?.includes(term)
      );
    }

    // VIP filter
    if (filterVIP !== null) {
      result = result.filter(g => g.is_vip === filterVIP);
    }

    // Loyalty filter
    if (filterLoyalty) {
      result = result.filter(g => g.loyalty_tier === filterLoyalty);
    }

    // Sort
    switch (sortBy) {
      case 'name':
        result.sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));
        break;
      case 'recent':
        result.sort((a, b) => new Date(b.last_stay || b.created_at).getTime() - new Date(a.last_stay || a.created_at).getTime());
        break;
      case 'stays':
        result.sort((a, b) => (b.total_stays || 0) - (a.total_stays || 0));
        break;
      case 'spent':
        result.sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0));
        break;
    }

    return result;
  }, [guests, searchTerm, filterVIP, filterLoyalty, sortBy]);

  const getLoyaltyBadge = (tier?: string) => {
    if (!tier) return null;
    const config = LOYALTY_TIERS[tier as keyof typeof LOYALTY_TIERS];
    if (!config) return null;
    const Icon = config.icon;
    return (
      <IOSBadge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {tier.charAt(0).toUpperCase() + tier.slice(1)}
      </IOSBadge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Guest Management</h2>
          <p className="text-sm text-gray-500">{filteredGuests.length} guests found</p>
        </div>
        <div className="flex items-center gap-3">
          <IOSButton variant="outline" onClick={fetchGuests}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </IOSButton>
          <IOSButton onClick={handleNewGuest} className="bg-[#3C3C43] hover:bg-[#000000] text-white">
            <UserPlus className="h-4 w-4 mr-2" />
            New Guest
          </IOSButton>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={filterVIP === null ? '' : filterVIP ? 'vip' : 'regular'}
          onChange={(e) => setFilterVIP(e.target.value === '' ? null : e.target.value === 'vip')}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All Guests</option>
          <option value="vip">VIP Only</option>
          <option value="regular">Regular Only</option>
        </select>
        <select
          value={filterLoyalty}
          onChange={(e) => setFilterLoyalty(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All Tiers</option>
          <option value="platinum">Platinum</option>
          <option value="gold">Gold</option>
          <option value="silver">Silver</option>
          <option value="bronze">Bronze</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="recent">Most Recent</option>
          <option value="name">Name A-Z</option>
          <option value="stays">Most Stays</option>
          <option value="spent">Highest Spent</option>
        </select>
      </div>

      {/* Guest List */}
      <IOSCard className="divide-y">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filteredGuests.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No guests found</p>
            <p className="text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          filteredGuests.map(guest => (
            <motion.div
              key={guest.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => onGuestSelect ? onGuestSelect(guest) : handleViewGuest(guest)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#F2F2F7] flex items-center justify-center">
                    {guest.is_vip ? (
                      <Crown className="h-6 w-6 text-[#3C3C43]" />
                    ) : (
                      <span className="text-lg font-semibold text-[#3C3C43]">
                        {guest.first_name?.[0]}{guest.last_name?.[0]}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">
                        {guest.first_name} {guest.last_name}
                      </h3>
                      {guest.is_vip && (
                        <IOSBadge className="bg-purple-100 text-purple-700">
                          <Star className="h-3 w-3 mr-1" /> VIP
                        </IOSBadge>
                      )}
                      {getLoyaltyBadge(guest.loyalty_tier)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                      {guest.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {guest.email}
                        </span>
                      )}
                      {guest.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {guest.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden md:block">
                    <p className="text-sm font-medium">{guest.total_stays || 0} stays</p>
                    <p className="text-xs text-gray-500">
                      {guest.last_stay ? `Last: ${formatDate(guest.last_stay)}` : 'New guest'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <IOSButton
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); handleViewGuest(guest); }}
                    >
                      <Eye className="h-4 w-4" />
                    </IOSButton>
                    <IOSButton
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); handleEditGuest(guest); }}
                    >
                      <Edit className="h-4 w-4" />
                    </IOSButton>
                    <IOSButton
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); handleToggleVIP(guest); }}
                    >
                      <Star className={`h-4 w-4 ${guest.is_vip ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                    </IOSButton>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </IOSCard>

      {/* View Guest Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Guest Profile
            </DialogTitle>
          </DialogHeader>
          {selectedGuest && (
            <div className="space-y-6">
              {/* Guest Header */}
              <div className="flex items-center gap-4 p-4 bg-[#F2F2F7] rounded-xl">
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center">
                  {selectedGuest.is_vip ? (
                    <Crown className="h-8 w-8 text-[#3C3C43]" />
                  ) : (
                    <span className="text-2xl font-bold text-[#3C3C43]">
                      {selectedGuest.first_name?.[0]}{selectedGuest.last_name?.[0]}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">
                      {selectedGuest.first_name} {selectedGuest.last_name}
                    </h2>
                    {selectedGuest.is_vip && (
                      <IOSBadge className="bg-purple-100 text-purple-700">VIP</IOSBadge>
                    )}
                    {getLoyaltyBadge(selectedGuest.loyalty_tier)}
                  </div>
                  <p className="text-gray-600">{selectedGuest.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{selectedGuest.total_stays || 0}</p>
                  <p className="text-sm text-gray-500">Total Stays</p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Phone</p>
                  <p className="font-medium">{selectedGuest.phone || '-'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Nationality</p>
                  <p className="font-medium">{selectedGuest.nationality || '-'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">ID Type</p>
                  <p className="font-medium">{selectedGuest.id_type || '-'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">ID Number</p>
                  <p className="font-medium">{selectedGuest.id_number || '-'}</p>
                </div>
              </div>

              {/* Preferences */}
              {selectedGuest.preferences && (
                <div>
                  <h3 className="font-semibold mb-2">Preferences</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedGuest.preferences.room_type && (
                      <IOSBadge className="bg-blue-100 text-blue-700">
                        <Bed className="h-3 w-3 mr-1" /> {selectedGuest.preferences.room_type}
                      </IOSBadge>
                    )}
                    {selectedGuest.preferences.floor_preference && (
                      <IOSBadge className="bg-green-100 text-green-700">
                        Floor: {selectedGuest.preferences.floor_preference}
                      </IOSBadge>
                    )}
                    {selectedGuest.preferences.dietary?.map(d => (
                      <IOSBadge key={d} className="bg-orange-100 text-orange-700">{d}</IOSBadge>
                    ))}
                  </div>
                </div>
              )}

              {/* Stay History */}
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <History className="h-4 w-4" /> Stay History
                </h3>
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : stayHistory.length === 0 ? (
                  <p className="text-gray-500 text-sm py-4">No previous stays</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {stayHistory.map(stay => (
                      <div key={stay.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">Room {stay.room_number}</p>
                          <p className="text-xs text-gray-500">
                            {formatDate(stay.check_in)} - {formatDate(stay.check_out)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">KES {stay.total_amount?.toLocaleString()}</p>
                          <IOSBadge className={
                            stay.status === 'completed' ? 'bg-green-100 text-green-700' :
                            stay.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }>
                            {stay.status}
                          </IOSBadge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <IOSButton variant="outline" className="flex-1" onClick={() => setIsViewModalOpen(false)}>
                  Close
                </IOSButton>
                <IOSButton 
                  className="flex-1 bg-[#3C3C43] hover:bg-[#000000]"
                  onClick={() => { setIsViewModalOpen(false); handleEditGuest(selectedGuest); }}
                >
                  <Edit className="h-4 w-4 mr-2" /> Edit Profile
                </IOSButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit/New Guest Modal */}
      <Dialog open={isEditModalOpen || isNewModalOpen} onOpenChange={(open) => { setIsEditModalOpen(false); setIsNewModalOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedGuest ? 'Edit Guest' : 'New Guest'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">First Name *</label>
                <Input
                  value={formData.first_name || ''}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Last Name *</label>
                <Input
                  value={formData.last_name || ''}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Email *</label>
              <Input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Phone *</label>
              <Input
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+254 700 000 000"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">ID Type</label>
                <select
                  value={formData.id_type || ''}
                  onChange={(e) => setFormData({ ...formData, id_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select...</option>
                  <option value="passport">Passport</option>
                  <option value="national_id">National ID</option>
                  <option value="drivers_license">Driver's License</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">ID Number</label>
                <Input
                  value={formData.id_number || ''}
                  onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                  placeholder="ID Number"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nationality</label>
              <Input
                value={formData.nationality || ''}
                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                placeholder="Kenyan"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_vip || false}
                  onChange={(e) => setFormData({ ...formData, is_vip: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm font-medium">VIP Guest</span>
              </label>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Notes</label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Special notes about this guest..."
                className="w-full px-3 py-2 border rounded-lg resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <IOSButton variant="outline" className="flex-1" onClick={() => { setIsEditModalOpen(false); setIsNewModalOpen(false); }}>
                Cancel
              </IOSButton>
              <IOSButton className="flex-1 bg-[#3C3C43] hover:bg-[#000000]" onClick={handleSaveGuest}>
                <Check className="h-4 w-4 mr-2" /> Save Guest
              </IOSButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
