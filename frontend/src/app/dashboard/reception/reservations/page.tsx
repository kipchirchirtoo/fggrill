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
import { bookingsAPI, roomsAPI, guestAPI, ratePlansAPI, pricingAPI } from '@/lib/api';
import { 
  Calendar, Plus, Search, RefreshCw, Edit2, Trash2, Eye, Clock,
  User, Bed, Phone, Mail, CheckCircle, XCircle, AlertTriangle,
  DollarSign, Users, Filter, ChevronDown, FileText, CreditCard,
  LogIn, LogOut, Receipt
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { CheckInModal } from '@/components/modals/CheckInModal';
import { CheckOutModal } from '@/components/modals/CheckOutModal';
import { FolioModal } from '@/components/modals/FinanceModals';

interface Booking {
  id: string;
  room_id: string;
  room_number: string;
  room_type: string;
  guest_id: string;
  guest_name: string;
  guest_phone: string;
  guest_email?: string;
  check_in: string; // or check_in_date
  check_out: string; // or check_out_date
  adults: number;
  children: number;
  infants: number;
  meal_plan: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  
  // Financials
  total_amount: number;
  amount_paid: number; // mapped to deposit_amount or separate?
  room_rate: number;
  subtotal: number;
  tax_amount: number;
  service_charge: number;
  discount_amount: number;
  deposit_amount: number;
  deposit_paid: boolean;
  payment_method: string;
  
  // Details
  booking_source: string;
  special_requests?: string;
  internal_notes?: string;
  
  // Timestamps
  created_at: string;
  checked_in_at?: string;
  checked_out_at?: string;
  cancelled_at?: string;
}

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  price_per_night: number;
  max_occupancy: number;
  status: string;
}

interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  confirmed: { label: 'Confirmed', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  checked_in: { label: 'Checked In', color: 'text-green-700', bgColor: 'bg-green-100' },
  checked_out: { label: 'Checked Out', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  cancelled: { label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-100' },
};

const mealPlanPrices: Record<string, number> = {
  bed_breakfast: 0,
  half_board: 1500,
  full_board: 3000,
};

// New Reservation Modal
function NewReservationModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<'dates' | 'room' | 'guest' | 'confirm'>('dates');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form data
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const [guestSearch, setGuestSearch] = useState('');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [isNewGuest, setIsNewGuest] = useState(false);
  const [newGuest, setNewGuest] = useState({ first_name: '', last_name: '', phone: '', email: '' });

  const [mealPlan, setMealPlan] = useState('bed_breakfast');
  const [specialRequests, setSpecialRequests] = useState('');
  const [depositAmount, setDepositAmount] = useState(0);
  const [ratePlans, setRatePlans] = useState<any[]>([]);
  const [selectedRatePlan, setSelectedRatePlan] = useState<any>(null);
  const [pricingQuote, setPricingQuote] = useState<any>(null);

  const nights = checkIn && checkOut 
    ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const getRoomPrice = () => {
    if (!selectedRoom) return 0;
    if (selectedRatePlan) {
      return selectedRatePlan.isPercentage 
        ? selectedRoom.price_per_night * selectedRatePlan.multiplier
        : selectedRatePlan.fixedAmount || selectedRoom.price_per_night;
    }
    return selectedRoom.price_per_night;
  };

  const totalAmount = selectedRoom 
    ? (getRoomPrice() + mealPlanPrices[mealPlan]) * nights
    : 0;

  const searchAvailableRooms = async () => {
    if (!checkIn || !checkOut) {
      toast.error('Please select dates');
      return;
    }
    setIsLoading(true);
    try {
      const response = await bookingsAPI.getAvailableRooms(checkIn, checkOut, adults + children);
      if (response.success) {
        setAvailableRooms(response.data || []);
        setStep('room');
      }
    } catch (error: any) {
      // Fallback: get all rooms and filter available
      const roomsResponse = await roomsAPI.getRooms();
      if (roomsResponse.success) {
        const available = (roomsResponse.data || []).filter((r: Room) => r.status === 'available');
        setAvailableRooms(available);
        setStep('room');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const searchGuests = async () => {
    if (!guestSearch.trim()) return;
    setIsLoading(true);
    try {
      const response = await guestAPI.getGuests(guestSearch);
      if (response.success) {
        setGuests(response.data || []);
      }
    } catch (error) {
      console.error('Error searching guests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGuest = async () => {
    if (!newGuest.first_name || !newGuest.last_name || !newGuest.phone) {
      toast.error('Please fill required fields');
      return;
    }
    setIsLoading(true);
    try {
      const response = await guestAPI.createGuest(newGuest);
      if (response.success) {
        setSelectedGuest(response.data);
        setIsNewGuest(false);
        setStep('confirm');
        toast.success('Guest created');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create guest');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedRoom || !selectedGuest) return;

    setIsSubmitting(true);
    try {
      const bookingData = {
        room_id: selectedRoom.id,
        guest_id: selectedGuest.id,
        rate_plan_id: selectedRatePlan?.id,
        check_in: checkIn,
        check_out: checkOut,
        adults,
        children,
        meal_plan: mealPlan,
        special_requests: specialRequests,
        total_amount: totalAmount,
        amount_paid: depositAmount,
        status: 'confirmed',
      };

      const response = await bookingsAPI.createBooking(bookingData);
      if (response.success) {
        await roomsAPI.updateRoomStatus(selectedRoom.id, 'reserved');
        toast.success('Reservation created successfully');
        onSuccess();
        onClose();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create reservation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetModal = () => {
    setStep('dates');
    setCheckIn('');
    setCheckOut('');
    setAdults(1);
    setChildren(0);
    setAvailableRooms([]);
    setSelectedRoom(null);
    setGuestSearch('');
    setGuests([]);
    setSelectedGuest(null);
    setIsNewGuest(false);
    setNewGuest({ first_name: '', last_name: '', phone: '', email: '' });
    setMealPlan('bed_breakfast');
    setSpecialRequests('');
    setDepositAmount(0);
    setSelectedRatePlan(null);
  };

  useEffect(() => {
    if (isOpen) {
      resetModal();
      ratePlansAPI.getRatePlans().then(res => {
        if (res.success) {
          setRatePlans(res.data || []);
          const standard = (res.data || []).find((r: any) => r.rateType === 'STANDARD');
          if (standard) setSelectedRatePlan(standard);
        }
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchQuote = async () => {
      if (checkIn && checkOut && selectedRoom) {
        try {
          const res = await pricingAPI.getQuote({
            checkIn,
            checkOut,
            roomTypeId: selectedRoom.room_type,
            guests: adults + children
          });
          if (res.success) {
            setPricingQuote(res.data);
          }
        } catch (error) {
          console.error('Failed to get pricing quote');
        }
      } else {
        setPricingQuote(null);
      }
    };
    const debounce = setTimeout(fetchQuote, 800);
    return () => clearTimeout(debounce);
  }, [checkIn, checkOut, selectedRoom, adults, children]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            New Reservation
          </DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {['dates', 'room', 'guest', 'confirm'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s ? 'bg-[#007AFF] text-white' : 
                ['dates', 'room', 'guest', 'confirm'].indexOf(step) > i ? 'bg-[#34C759] text-white' : 'bg-gray-200'
              }`}>
                {i + 1}
              </div>
              {i < 3 && <div className={`w-16 h-1 mx-2 ${['dates', 'room', 'guest', 'confirm'].indexOf(step) > i ? 'bg-[#34C759]' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Dates */}
        {step === 'dates' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Check-In Date *</label>
                <Input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Check-Out Date *</label>
                <Input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  min={checkIn || new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Adults</label>
                <Input
                  type="number"
                  min={1}
                  value={adults}
                  onChange={(e) => setAdults(parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Children</label>
                <Input
                  type="number"
                  min={0}
                  value={children}
                  onChange={(e) => setChildren(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            {nights > 0 && (
              <p className="text-sm text-gray-600">Duration: {nights} night{nights > 1 ? 's' : ''}</p>
            )}
            <IOSButton onClick={searchAvailableRooms} disabled={isLoading} className="w-full">
              {isLoading ? 'Searching...' : 'Search Available Rooms'}
            </IOSButton>
          </div>
        )}

        {/* Step 2: Room Selection */}
        {step === 'room' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{availableRooms.length} rooms available</p>
            <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
              {availableRooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => setSelectedRoom(room)}
                  className={`p-4 border-2 rounded-ios-lg cursor-pointer transition ${
                    selectedRoom?.id === room.id ? 'border-[#007AFF] bg-blue-50' : 'border-[#E5E5EA] hover:border-[#E5E5EA]'
                  }`}
                >
                  <p className="font-bold">Room {room.room_number}</p>
                  <p className="text-sm text-gray-500 capitalize">{room.room_type}</p>
                  <p className="text-sm">Max {room.max_occupancy} guests</p>
                  <p className="font-medium text-[#007AFF]">KES {room.price_per_night?.toLocaleString()}/night</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <IOSButton variant="outline" onClick={() => setStep('dates')} className="flex-1">
                Back
              </IOSButton>
              <IOSButton onClick={() => setStep('guest')} disabled={!selectedRoom} className="flex-1">
                Continue
              </IOSButton>
            </div>
          </div>
        )}

        {/* Step 3: Guest Selection */}
        {step === 'guest' && (
          <div className="space-y-4">
            {!isNewGuest ? (
              <>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search guest by name or phone..."
                    value={guestSearch}
                    onChange={(e) => setGuestSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchGuests()}
                  />
                  <IOSButton onClick={searchGuests} disabled={isLoading}>
                    <Search className="h-4 w-4" />
                  </IOSButton>
                </div>
                {guests.length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {guests.map((guest) => (
                      <div
                        key={guest.id}
                        onClick={() => {
                          setSelectedGuest(guest);
                          setStep('confirm');
                        }}
                        className="p-3 border rounded-ios-lg cursor-pointer hover:bg-gray-50"
                      >
                        <p className="font-medium">{guest.first_name} {guest.last_name}</p>
                        <p className="text-sm text-gray-500">{guest.phone}</p>
                      </div>
                    ))}
                  </div>
                )}
                <IOSButton variant="outline" onClick={() => setIsNewGuest(true)} className="w-full" leftIcon={<Plus />}>
                  New Guest
                </IOSButton>
              </>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">First Name *</label>
                    <Input
                      value={newGuest.first_name}
                      onChange={(e) => setNewGuest({ ...newGuest, first_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Last Name *</label>
                    <Input
                      value={newGuest.last_name}
                      onChange={(e) => setNewGuest({ ...newGuest, last_name: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Phone *</label>
                  <Input
                    value={newGuest.phone}
                    onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={newGuest.email}
                    onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })}
                  />
                </div>
                <div className="flex gap-3">
                  <IOSButton variant="outline" onClick={() => setIsNewGuest(false)} className="flex-1">
                    Back
                  </IOSButton>
                  <IOSButton onClick={handleCreateGuest} disabled={isLoading} className="flex-1">
                    Create & Continue
                  </IOSButton>
                </div>
              </div>
            )}
            {!isNewGuest && (
              <IOSButton variant="outline" onClick={() => setStep('room')} className="w-full">
                Back to Room Selection
              </IOSButton>
            )}
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 'confirm' && selectedRoom && selectedGuest && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="p-4 bg-blue-50 rounded-ios-lg">
              <div className="flex justify-between">
                <div>
                  <p className="font-bold">{selectedGuest.first_name} {selectedGuest.last_name}</p>
                  <p className="text-sm text-[#007AFF]">{selectedGuest.phone}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">Room {selectedRoom.room_number}</p>
                  <p className="text-sm text-[#007AFF] capitalize">{selectedRoom.room_type}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-blue-200 flex justify-between text-sm">
                <span>{new Date(checkIn).toLocaleDateString()} - {new Date(checkOut).toLocaleDateString()}</span>
                <span>{nights} night{nights > 1 ? 's' : ''}</span>
              </div>
            </div>

            {/* Rate Plan */}
            <div>
              <label className="text-sm font-medium">Rate Plan</label>
              <select
                value={selectedRatePlan?.id || ''}
                onChange={(e) => setSelectedRatePlan(ratePlans.find(r => r.id === e.target.value) || null)}
                className="w-full p-2 border rounded-ios-lg mt-1"
              >
                <option value="">Base Rate</option>
                {ratePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} ({plan.isPercentage ? `${plan.multiplier}x` : `KES ${plan.fixedAmount}`})
                  </option>
                ))}
              </select>
            </div>

            {/* Meal Plan */}
            <div>
              <label className="text-sm font-medium">Meal Plan</label>
              <select
                value={mealPlan}
                onChange={(e) => setMealPlan(e.target.value)}
                className="w-full p-2 border rounded-ios-lg mt-1"
              >
                <option value="bed_breakfast">Bed & Breakfast (Included)</option>
                <option value="half_board">Half Board (+KES 1,500/night)</option>
                <option value="full_board">Full Board (+KES 3,000/night)</option>
              </select>
            </div>

            {/* Special Requests */}
            <div>
              <label className="text-sm font-medium">Special Requests</label>
              <textarea
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                className="w-full p-2 border rounded-ios-lg mt-1"
                rows={2}
              />
            </div>

            {/* Pricing */}
            <div className="p-4 bg-gray-50 rounded-ios-lg space-y-2">
              {pricingQuote && (
                <div className="mb-3 p-3 bg-indigo-50 border border-indigo-100 rounded-ios-lg text-sm text-indigo-700">
                  <div className="font-bold flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    AI Recommendation: {pricingQuote.multiplier}x Base
                  </div>
                  <div className="text-xs mt-1 text-indigo-600">
                    Factors: {pricingQuote.factors.join(', ')}
                  </div>
                </div>
              )}
              <div className="flex justify-between">
                <span>
                  Room ({nights} nights × KES {getRoomPrice()?.toLocaleString()})
                  {selectedRatePlan && <span className="text-xs text-gray-500 block">{selectedRatePlan.name}</span>}
                </span>
                <span>KES {(getRoomPrice() * nights).toLocaleString()}</span>
              </div>
              {mealPlan !== 'bed_breakfast' && (
                <div className="flex justify-between">
                  <span>Meal Plan ({nights} nights)</span>
                  <span>KES {(mealPlanPrices[mealPlan] * nights).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total</span>
                <span>KES {totalAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Deposit */}
            <div>
              <label className="text-sm font-medium">Deposit Amount</label>
              <Input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
                placeholder="0"
              />
            </div>

            <div className="flex gap-3">
              <IOSButton variant="outline" onClick={() => setStep('guest')} className="flex-1">
                Back
              </IOSButton>
              <IOSButton onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
                {isSubmitting ? 'Creating...' : 'Confirm Reservation'}
              </IOSButton>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ReservationsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  // Modals
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [checkOutModalOpen, setCheckOutModalOpen] = useState(false);
  const [folioModalOpen, setFolioModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const response = await bookingsAPI.getBookings(params);
      if (response.success) {
        setBookings(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load reservations');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filteredBookings = bookings.filter((booking) => {
    const matchesSearch = 
      booking.guest_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.room_number?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (dateFilter === 'today') {
      const checkIn = new Date(booking.check_in);
      checkIn.setHours(0, 0, 0, 0);
      return checkIn.getTime() === today.getTime();
    }
    if (dateFilter === 'week') {
      const checkIn = new Date(booking.check_in);
      const weekFromNow = new Date(today);
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      return checkIn >= today && checkIn <= weekFromNow;
    }
    if (dateFilter === 'month') {
      const checkIn = new Date(booking.check_in);
      return checkIn.getMonth() === today.getMonth() && checkIn.getFullYear() === today.getFullYear();
    }

    return true;
  });

  // Stats
  const stats = {
    total: bookings.length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    pending: bookings.filter(b => b.status === 'pending').length,
    checkedIn: bookings.filter(b => b.status === 'checked_in').length,
  };

  const handleCancel = async (booking: Booking) => {
    if (!confirm(`Cancel reservation for ${booking.guest_name}?`)) return;
    try {
      await bookingsAPI.cancelBooking(booking.id);
      if (booking.room_id) {
        await roomsAPI.updateRoomStatus(booking.room_id, 'available');
      }
      toast.success('Reservation cancelled');
      fetchBookings();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel');
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reservations</h1>
              <p className="text-gray-500">Manage room bookings and reservations</p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="outline" onClick={fetchBookings} leftIcon={<RefreshCw />}>Refresh
              </IOSButton>
              <IOSButton onClick={() => setNewModalOpen(true)} leftIcon={<Plus />}>
                New Reservation
              </IOSButton>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Total Reservations</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Confirmed</p>
              <p className="text-2xl font-bold text-[#007AFF]">{stats.confirmed}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Checked In</p>
              <p className="text-2xl font-bold text-[#34C759]">{stats.checkedIn}</p>
            </IOSCard>
          </div>

          {/* Filters */}
          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by guest or room..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border rounded-ios-lg text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checked_in">Checked In</option>
                  <option value="checked_out">Checked Out</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-3 py-2 border rounded-ios-lg text-sm"
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
              </div>
            </div>
          </IOSCard>

          {/* Reservations List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredBookings.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No reservations found</p>
              <IOSButton onClick={() => setNewModalOpen(true)} className="mt-4" leftIcon={<Plus />}>
                Create Reservation
              </IOSButton>
            </IOSCard>
          ) : (
            <IOSCard className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-4 font-medium text-gray-700">Guest</th>
                      <th className="text-left p-4 font-medium text-gray-700">Room</th>
                      <th className="text-left p-4 font-medium text-gray-700">Dates</th>
                      <th className="text-left p-4 font-medium text-gray-700">Amount</th>
                      <th className="text-left p-4 font-medium text-gray-700">Status</th>
                      <th className="text-right p-4 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredBookings.map((booking) => {
                      const statusInfo = statusConfig[booking.status] || statusConfig.pending;
                      const nights = Math.ceil(
                        (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / (1000 * 60 * 60 * 24)
                      );

                      return (
                        <tr key={booking.id} className="hover:bg-gray-50">
                          <td className="p-4">
                            <p className="font-medium">{booking.guest_name}</p>
                            <p className="text-sm text-gray-500">{booking.guest_phone}</p>
                          </td>
                          <td className="p-4">
                            <p className="font-medium">Room {booking.room_number}</p>
                            <p className="text-sm text-gray-500 capitalize">{booking.room_type}</p>
                          </td>
                          <td className="p-4">
                            <p className="text-sm">{new Date(booking.check_in).toLocaleDateString()}</p>
                            <p className="text-sm text-gray-500">{nights} night{nights > 1 ? 's' : ''}</p>
                          </td>
                          <td className="p-4">
                            <p className="font-medium">KES {booking.total_amount?.toLocaleString()}</p>
                            <p className="text-sm text-[#34C759]">Paid: KES {booking.amount_paid?.toLocaleString()}</p>
                          </td>
                          <td className="p-4">
                            <IOSBadge className={`${statusInfo.bgColor} ${statusInfo.color}`}>
                              {statusInfo.label}
                            </IOSBadge>
                          </td>
                          <td className="p-4">
                            <div className="flex justify-end gap-2">
                              {booking.status === 'confirmed' && (
                                <IOSButton size="sm" variant="outline" className="text-green-600" onClick={() => {
                                  setSelectedBooking(booking);
                                  setCheckInModalOpen(true);
                                }}>
                                  Check In
                                </IOSButton>
                              )}
                              {booking.status === 'checked_in' && (
                                <IOSButton size="sm" variant="outline" className="text-orange-600" onClick={() => {
                                  setSelectedBooking(booking);
                                  setCheckOutModalOpen(true);
                                }}>
                                  Check Out
                                </IOSButton>
                              )}
                              <IOSButton size="sm" variant="ghost" onClick={() => {
                                setSelectedBooking(booking);
                                setFolioModalOpen(true);
                              }}>
                                <Receipt className="h-4 w-4" />
                              </IOSButton>
                              {booking.status === 'pending' && (
                                <IOSButton size="sm" variant="outline" className="text-[#FF3B30]" onClick={() => handleCancel(booking)}>
                                  <XCircle className="h-4 w-4" />
                                </IOSButton>
                              )}
                              {booking.status === 'confirmed' && (
                                <IOSButton size="sm" variant="outline" className="text-[#FF3B30]" onClick={() => handleCancel(booking)}>
                                  Cancel
                                </IOSButton>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </IOSCard>
          )}
        </div>

        {/* Modals */}
        <NewReservationModal
          isOpen={newModalOpen}
          onClose={() => setNewModalOpen(false)}
          onSuccess={fetchBookings}
        />
        <CheckInModal
          isOpen={checkInModalOpen}
          onClose={() => setCheckInModalOpen(false)}
          initialData={selectedBooking}
        />
        <CheckOutModal
          isOpen={checkOutModalOpen}
          onClose={() => setCheckOutModalOpen(false)}
          initialData={selectedBooking}
        />
        <FolioModal
          isOpen={folioModalOpen}
          onClose={() => setFolioModalOpen(false)}
          initialData={selectedBooking}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
