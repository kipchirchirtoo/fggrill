'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Search, Plus, Edit, Eye, Trash2, Clock, CheckCircle,
  XCircle, AlertCircle, Loader2, Filter, RefreshCw, ChevronLeft,
  ChevronRight, Users, Bed, DollarSign, Phone, Mail, Star, Crown,
  X, Check, Download, Send, CreditCard, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { bookingsAPI, roomsAPI, guestAPI } from '@/lib/api';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate } from '@/lib/date-utils';

interface Reservation {
  id: string;
  booking_number?: string;
  guest: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    is_vip?: boolean;
  };
  room?: {
    id: string;
    room_number: string;
    type: string;
  };
  room_type?: {
    id: string;
    name: string;
    base_price: number;
  };
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  total_amount: number;
  amount_paid: number;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
  source?: string;
  special_requests?: string;
  created_at: string;
}

interface RoomType {
  id: string;
  name: string;
  base_price: number;
  max_occupancy: number;
  description?: string;
}

interface AvailableRoom {
  id: string;
  room_number: string;
  type: string;
  floor: number;
}

interface ReservationManagementProps {
  branchId?: number;
  compact?: boolean;
  onReservationSelect?: (reservation: Reservation) => void;
}

const STATUS_CONFIG = {
  pending: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'Pending' },
  confirmed: { color: 'bg-blue-100 text-blue-700', icon: CheckCircle, label: 'Confirmed' },
  checked_in: { color: 'bg-green-100 text-green-700', icon: Users, label: 'Checked In' },
  checked_out: { color: 'bg-gray-100 text-gray-700', icon: CheckCircle, label: 'Checked Out' },
  cancelled: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Cancelled' },
  no_show: { color: 'bg-orange-100 text-orange-700', icon: AlertCircle, label: 'No Show' }
};

const BOOKING_SOURCES = ['Direct', 'Website', 'Phone', 'Walk-in', 'OTA', 'Corporate', 'Travel Agent'];

export function ReservationManagement({ branchId, compact = false, onReservationSelect }: ReservationManagementProps) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'today' | 'tomorrow' | 'week' | 'month' | 'all'>('all');
  
  // Calendar view
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  
  // New reservation form
  const [formData, setFormData] = useState({
    guest_first_name: '',
    guest_last_name: '',
    guest_email: '',
    guest_phone: '',
    room_type_id: '',
    room_id: '',
    check_in_date: '',
    check_out_date: '',
    adults: 1,
    children: 0,
    source: 'Direct',
    special_requests: '',
    total_amount: 0,
    deposit_amount: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
    arrivals_today: 0,
    departures_today: 0
  });

  useEffect(() => {
    fetchReservations();
    fetchRoomTypes();
  }, [branchId]);

  const fetchReservations = async () => {
    setIsLoading(true);
    try {
      const response = await bookingsAPI.getBookings();
      const bookingsData = response.data || response.bookings || response || [];
      
      const processed: Reservation[] = bookingsData.map((b: any) => ({
        id: b.id,
        booking_number: b.booking_number || `BK-${b.id.slice(0, 8)}`,
        guest: {
          id: b.guest?.id || b.guest_id,
          first_name: b.guest?.first_name || 'Guest',
          last_name: b.guest?.last_name || '',
          email: b.guest?.email || '',
          phone: b.guest?.phone || '',
          is_vip: b.guest?.is_vip || false
        },
        room: b.room ? {
          id: b.room.id,
          room_number: b.room.room_number,
          type: b.room.type?.name || b.room.type || 'Standard'
        } : undefined,
        room_type: b.room_type,
        check_in_date: b.check_in_date || b.check_in,
        check_out_date: b.check_out_date || b.check_out,
        adults: b.adults || 1,
        children: b.children || 0,
        total_amount: b.total_amount || 0,
        amount_paid: b.amount_paid || 0,
        status: b.status || 'pending',
        source: b.source || 'Direct',
        special_requests: b.special_requests,
        created_at: b.created_at
      }));

      setReservations(processed);

      // Calculate stats
      const today = new Date().toISOString().split('T')[0];
      setStats({
        total: processed.length,
        pending: processed.filter(r => r.status === 'pending').length,
        confirmed: processed.filter(r => r.status === 'confirmed').length,
        arrivals_today: processed.filter(r => r.check_in_date?.startsWith(today) && r.status === 'confirmed').length,
        departures_today: processed.filter(r => r.check_out_date?.startsWith(today) && r.status === 'checked_in').length
      });
    } catch (error) {
      console.error('Error fetching reservations:', error);
      toast.error('Failed to load reservations');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRoomTypes = async () => {
    try {
      const response = await roomsAPI.getRoomTypes();
      const types = response.data || response.room_types || response || [];
      setRoomTypes(Array.isArray(types) ? types : []);
    } catch (error) {
      console.error('Error fetching room types:', error);
    }
  };

  const fetchAvailableRooms = async (checkIn: string, checkOut: string, roomTypeId?: string) => {
    try {
      const response = await bookingsAPI.getAvailableRooms(checkIn, checkOut);
      let rooms = response.data || response.rooms || response || [];
      
      if (roomTypeId) {
        rooms = rooms.filter((r: any) => r.room_type_id === roomTypeId || r.type?.id === roomTypeId);
      }
      
      setAvailableRooms(rooms);
    } catch (error) {
      console.error('Error fetching available rooms:', error);
    }
  };

  const filteredReservations = useMemo(() => {
    let result = [...reservations];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r =>
        r.guest.first_name?.toLowerCase().includes(term) ||
        r.guest.last_name?.toLowerCase().includes(term) ||
        r.booking_number?.toLowerCase().includes(term) ||
        r.guest.phone?.includes(term) ||
        r.room?.room_number?.includes(term)
      );
    }

    // Status filter
    if (statusFilter) {
      result = result.filter(r => r.status === statusFilter);
    }

    // Date filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const monthEnd = new Date(today);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    switch (dateFilter) {
      case 'today':
        result = result.filter(r => {
          const checkIn = new Date(r.check_in_date);
          return checkIn.toDateString() === today.toDateString();
        });
        break;
      case 'tomorrow':
        result = result.filter(r => {
          const checkIn = new Date(r.check_in_date);
          return checkIn.toDateString() === tomorrow.toDateString();
        });
        break;
      case 'week':
        result = result.filter(r => {
          const checkIn = new Date(r.check_in_date);
          return checkIn >= today && checkIn <= weekEnd;
        });
        break;
      case 'month':
        result = result.filter(r => {
          const checkIn = new Date(r.check_in_date);
          return checkIn >= today && checkIn <= monthEnd;
        });
        break;
    }

    return result.sort((a, b) => new Date(a.check_in_date).getTime() - new Date(b.check_in_date).getTime());
  }, [reservations, searchTerm, statusFilter, dateFilter]);

  const handleNewReservation = () => {
    setFormData({
      guest_first_name: '',
      guest_last_name: '',
      guest_email: '',
      guest_phone: '',
      room_type_id: '',
      room_id: '',
      check_in_date: '',
      check_out_date: '',
      adults: 1,
      children: 0,
      source: 'Direct',
      special_requests: '',
      total_amount: 0,
      deposit_amount: 0
    });
    setIsNewModalOpen(true);
  };

  const handleViewReservation = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    if (onReservationSelect) {
      onReservationSelect(reservation);
    } else {
      setIsViewModalOpen(true);
    }
  };

  const handleEditReservation = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setFormData({
      guest_first_name: reservation.guest.first_name,
      guest_last_name: reservation.guest.last_name,
      guest_email: reservation.guest.email,
      guest_phone: reservation.guest.phone,
      room_type_id: reservation.room_type?.id || '',
      room_id: reservation.room?.id || '',
      check_in_date: reservation.check_in_date?.split('T')[0] || '',
      check_out_date: reservation.check_out_date?.split('T')[0] || '',
      adults: reservation.adults,
      children: reservation.children,
      source: reservation.source || 'Direct',
      special_requests: reservation.special_requests || '',
      total_amount: reservation.total_amount,
      deposit_amount: reservation.amount_paid
    });
    setIsEditModalOpen(true);
  };

  const handleSubmitReservation = async () => {
    if (!formData.guest_first_name || !formData.guest_last_name || !formData.check_in_date || !formData.check_out_date) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const bookingData = {
        guest: {
          first_name: formData.guest_first_name,
          last_name: formData.guest_last_name,
          email: formData.guest_email,
          phone: formData.guest_phone
        },
        room_type_id: formData.room_type_id || undefined,
        room_id: formData.room_id || undefined,
        check_in_date: formData.check_in_date,
        check_out_date: formData.check_out_date,
        adults: formData.adults,
        children: formData.children,
        source: formData.source,
        special_requests: formData.special_requests,
        total_amount: formData.total_amount,
        amount_paid: formData.deposit_amount
      };

      if (selectedReservation) {
        await bookingsAPI.updateBooking(selectedReservation.id, bookingData);
        toast.success('Reservation updated successfully');
      } else {
        await bookingsAPI.createBooking(bookingData);
        toast.success('Reservation created successfully');
      }

      setIsNewModalOpen(false);
      setIsEditModalOpen(false);
      fetchReservations();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save reservation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelReservation = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this reservation?')) return;

    try {
      await bookingsAPI.cancelBooking(id, 'Cancelled by staff');
      toast.success('Reservation cancelled');
      fetchReservations();
    } catch (error) {
      toast.error('Failed to cancel reservation');
    }
  };

  const handleConfirmReservation = async (id: string) => {
    try {
      await bookingsAPI.updateBooking(id, { status: 'confirmed' });
      toast.success('Reservation confirmed');
      fetchReservations();
    } catch (error) {
      toast.error('Failed to confirm reservation');
    }
  };

  const calculateNights = (checkIn: string, checkOut: string) => {
    if (!checkIn || !checkOut) return 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  const calculateTotal = () => {
    const nights = calculateNights(formData.check_in_date, formData.check_out_date);
    const roomType = roomTypes.find(rt => rt.id === formData.room_type_id);
    if (roomType && nights > 0) {
      const total = roomType.base_price * nights;
      setFormData(prev => ({ ...prev, total_amount: total }));
    }
  };

  useEffect(() => {
    if (formData.check_in_date && formData.check_out_date && formData.room_type_id) {
      calculateTotal();
      fetchAvailableRooms(formData.check_in_date, formData.check_out_date, formData.room_type_id);
    }
  }, [formData.check_in_date, formData.check_out_date, formData.room_type_id]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Reservations
          </h2>
          <p className="text-sm text-gray-500">{stats.total} total • {stats.arrivals_today} arrivals today</p>
        </div>
        <div className="flex items-center gap-3">
          <IOSButton variant="outline" onClick={fetchReservations}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </IOSButton>
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm ${viewMode === 'list' ? 'bg-[#3C3C43] text-white' : 'bg-white'}`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-sm ${viewMode === 'calendar' ? 'bg-[#3C3C43] text-white' : 'bg-white'}`}
            >
              Calendar
            </button>
          </div>
          <IOSButton onClick={handleNewReservation} className="bg-[#3C3C43] hover:bg-[#000000] text-white">
            <Plus className="h-4 w-4 mr-2" />
            New Reservation
          </IOSButton>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <IOSCard className="p-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#3C3C43]" />
            <div>
              <p className="text-xl font-bold">{stats.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>
        </IOSCard>
        <IOSCard className="p-3 bg-yellow-50">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-600" />
            <div>
              <p className="text-xl font-bold text-yellow-700">{stats.pending}</p>
              <p className="text-xs text-yellow-600">Pending</p>
            </div>
          </div>
        </IOSCard>
        <IOSCard className="p-3 bg-blue-50">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-xl font-bold text-blue-700">{stats.confirmed}</p>
              <p className="text-xs text-blue-600">Confirmed</p>
            </div>
          </div>
        </IOSCard>
        <IOSCard className="p-3 bg-green-50">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-xl font-bold text-green-700">{stats.arrivals_today}</p>
              <p className="text-xs text-green-600">Arrivals Today</p>
            </div>
          </div>
        </IOSCard>
        <IOSCard className="p-3 bg-orange-50">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <div>
              <p className="text-xl font-bold text-orange-700">{stats.departures_today}</p>
              <p className="text-xs text-orange-600">Departures Today</p>
            </div>
          </div>
        </IOSCard>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, booking #, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as any)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="all">All Dates</option>
          <option value="today">Today</option>
          <option value="tomorrow">Tomorrow</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </div>

      {/* Reservations List */}
      <IOSCard className="divide-y">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filteredReservations.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No reservations found</p>
          </div>
        ) : (
          filteredReservations.map(reservation => {
            const statusConfig = STATUS_CONFIG[reservation.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;
            const nights = calculateNights(reservation.check_in_date, reservation.check_out_date);

            return (
              <motion.div
                key={reservation.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleViewReservation(reservation)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#F2F2F7] flex items-center justify-center">
                      {reservation.guest.is_vip ? (
                        <Crown className="h-6 w-6 text-amber-500" />
                      ) : (
                        <span className="font-semibold text-[#3C3C43]">
                          {reservation.guest.first_name?.[0]}{reservation.guest.last_name?.[0]}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          {reservation.guest.first_name} {reservation.guest.last_name}
                        </h3>
                        {reservation.guest.is_vip && (
                          <IOSBadge className="bg-amber-100 text-amber-700">VIP</IOSBadge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {reservation.booking_number} • {reservation.room_type?.name || 'Standard'}
                        {reservation.room && ` • Room ${reservation.room.room_number}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden md:block">
                      <p className="text-sm font-medium">
                        {formatDate(reservation.check_in_date)} - {formatDate(reservation.check_out_date)}
                      </p>
                      <p className="text-xs text-gray-500">{nights} night{nights !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right hidden md:block">
                      <p className="font-semibold">KES {reservation.total_amount?.toLocaleString()}</p>
                      {reservation.amount_paid > 0 && (
                        <p className="text-xs text-green-600">Paid: KES {reservation.amount_paid.toLocaleString()}</p>
                      )}
                    </div>
                    <IOSBadge className={statusConfig.color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig.label}
                    </IOSBadge>
                    <div className="flex items-center gap-1">
                      {reservation.status === 'pending' && (
                        <IOSButton
                          size="sm"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); handleConfirmReservation(reservation.id); }}
                          title="Confirm"
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </IOSButton>
                      )}
                      <IOSButton
                        size="sm"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); handleEditReservation(reservation); }}
                      >
                        <Edit className="h-4 w-4" />
                      </IOSButton>
                      {reservation.status !== 'cancelled' && reservation.status !== 'checked_out' && (
                        <IOSButton
                          size="sm"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); handleCancelReservation(reservation.id); }}
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </IOSButton>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </IOSCard>

      {/* New/Edit Reservation Modal */}
      <Dialog open={isNewModalOpen || isEditModalOpen} onOpenChange={() => { setIsNewModalOpen(false); setIsEditModalOpen(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedReservation ? 'Edit Reservation' : 'New Reservation'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Guest Information */}
            <div>
              <h3 className="font-semibold mb-3">Guest Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">First Name *</label>
                  <Input
                    value={formData.guest_first_name}
                    onChange={(e) => setFormData({ ...formData, guest_first_name: e.target.value })}
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Last Name *</label>
                  <Input
                    value={formData.guest_last_name}
                    onChange={(e) => setFormData({ ...formData, guest_last_name: e.target.value })}
                    placeholder="Doe"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Email</label>
                  <Input
                    type="email"
                    value={formData.guest_email}
                    onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Phone</label>
                  <Input
                    value={formData.guest_phone}
                    onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
                    placeholder="+254 700 000 000"
                  />
                </div>
              </div>
            </div>

            {/* Stay Details */}
            <div>
              <h3 className="font-semibold mb-3">Stay Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Check-in Date *</label>
                  <Input
                    type="date"
                    value={formData.check_in_date}
                    onChange={(e) => setFormData({ ...formData, check_in_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Check-out Date *</label>
                  <Input
                    type="date"
                    value={formData.check_out_date}
                    onChange={(e) => setFormData({ ...formData, check_out_date: e.target.value })}
                    min={formData.check_in_date || new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Room Type</label>
                  <select
                    value={formData.room_type_id}
                    onChange={(e) => setFormData({ ...formData, room_type_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Select room type...</option>
                    {roomTypes.map(rt => (
                      <option key={rt.id} value={rt.id}>
                        {rt.name} - KES {rt.base_price}/night
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Assign Room</label>
                  <select
                    value={formData.room_id}
                    onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    disabled={!formData.check_in_date || !formData.check_out_date}
                  >
                    <option value="">Select room (optional)...</option>
                    {availableRooms.map(room => (
                      <option key={room.id} value={room.id}>
                        Room {room.room_number} - Floor {room.floor}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Adults</label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.adults}
                    onChange={(e) => setFormData({ ...formData, adults: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Children</label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.children}
                    onChange={(e) => setFormData({ ...formData, children: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            {/* Booking Details */}
            <div>
              <h3 className="font-semibold mb-3">Booking Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Source</label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {BOOKING_SOURCES.map(source => (
                      <option key={source} value={source}>{source}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Total Amount (KES)</label>
                  <Input
                    type="number"
                    value={formData.total_amount}
                    onChange={(e) => setFormData({ ...formData, total_amount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Special Requests</label>
                  <textarea
                    value={formData.special_requests}
                    onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
                    placeholder="Any special requests or notes..."
                    className="w-full px-3 py-2 border rounded-lg resize-none"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Summary */}
            {formData.check_in_date && formData.check_out_date && (
              <div className="p-4 bg-[#F2F2F7] rounded-xl">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">
                    {calculateNights(formData.check_in_date, formData.check_out_date)} night(s)
                  </span>
                  <span className="text-xl font-bold">
                    KES {formData.total_amount.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <IOSButton variant="outline" className="flex-1" onClick={() => { setIsNewModalOpen(false); setIsEditModalOpen(false); }}>
                Cancel
              </IOSButton>
              <IOSButton 
                className="flex-1 bg-[#3C3C43] hover:bg-[#000000]"
                onClick={handleSubmitReservation}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                {selectedReservation ? 'Update Reservation' : 'Create Reservation'}
              </IOSButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Reservation Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reservation Details</DialogTitle>
          </DialogHeader>
          {selectedReservation && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-[#F2F2F7] rounded-xl">
                <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center">
                  {selectedReservation.guest.is_vip ? (
                    <Crown className="h-7 w-7 text-amber-500" />
                  ) : (
                    <span className="text-xl font-bold text-[#3C3C43]">
                      {selectedReservation.guest.first_name?.[0]}{selectedReservation.guest.last_name?.[0]}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">
                    {selectedReservation.guest.first_name} {selectedReservation.guest.last_name}
                  </h3>
                  <p className="text-sm text-gray-600">{selectedReservation.booking_number}</p>
                </div>
                <IOSBadge className={STATUS_CONFIG[selectedReservation.status]?.color}>
                  {STATUS_CONFIG[selectedReservation.status]?.label}
                </IOSBadge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Check-in</p>
                  <p className="font-medium">{formatDate(selectedReservation.check_in_date)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Check-out</p>
                  <p className="font-medium">{formatDate(selectedReservation.check_out_date)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Room Type</p>
                  <p className="font-medium">{selectedReservation.room_type?.name || 'Standard'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Room</p>
                  <p className="font-medium">{selectedReservation.room?.room_number || 'Not assigned'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Guests</p>
                  <p className="font-medium">{selectedReservation.adults} Adults, {selectedReservation.children} Children</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Source</p>
                  <p className="font-medium">{selectedReservation.source || 'Direct'}</p>
                </div>
              </div>

              <div className="p-4 bg-green-50 rounded-xl">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-green-600">Total Amount</p>
                    <p className="text-xl font-bold text-green-700">KES {selectedReservation.total_amount?.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-green-600">Paid</p>
                    <p className="text-lg font-bold text-green-700">KES {selectedReservation.amount_paid?.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {selectedReservation.special_requests && (
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <p className="text-xs text-yellow-600 mb-1">Special Requests</p>
                  <p className="text-sm">{selectedReservation.special_requests}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <IOSButton variant="outline" className="flex-1" onClick={() => setIsViewModalOpen(false)}>
                  Close
                </IOSButton>
                <IOSButton 
                  className="flex-1 bg-[#3C3C43]"
                  onClick={() => { setIsViewModalOpen(false); handleEditReservation(selectedReservation); }}
                >
                  <Edit className="h-4 w-4 mr-2" /> Edit
                </IOSButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
