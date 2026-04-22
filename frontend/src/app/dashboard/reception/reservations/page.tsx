'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { bookingsAPI, roomsAPI, guestAPI, ratePlansAPI, pricingAPI } from '@/lib/api';
import {
  Calendar, Plus, Search, RefreshCw, Edit2, Trash2, Eye, Clock,
  User, Bed, Phone, Mail, CheckCircle, XCircle, AlertTriangle,
  DollarSign, Users, Filter, ChevronDown, FileText, CreditCard,
  LogIn, LogOut, Receipt, TrendingUp, Check, ChevronRight, Home, Printer
} from 'lucide-react';
import { printReservationInvoice } from '@/lib/print-utils';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { CheckInModal } from '@/components/modals/CheckInModal';
import { CheckOutModal } from '@/components/modals/CheckOutModal';
import { FolioModal } from '@/components/modals/FinanceModals';

interface Booking {
  id: string;
  confirmation_number: string;
  booking_number?: string;
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
  room_type_id?: string;
  type?: {
    id: string;
    name: string;
    base_price: number;
    max_occupancy: number;
  };
  price_per_night: number;
  price_override?: number;
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

const statusConfig: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  pending: { label: 'Pending', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  confirmed: { label: 'Confirmed', color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  checked_in: { label: 'Checked In', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  checked_out: { label: 'Checked Out', color: 'text-gray-700', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' },
  cancelled: { label: 'Cancelled', color: 'text-rose-700', bgColor: 'bg-rose-50', borderColor: 'border-rose-200' },
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
  const { user } = useAuth();
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

  const nights = checkIn && checkOut
    ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const renderFooterActions = () => {
    switch (step) {
      case 'dates':
        return (
          <IOSButton onClick={searchAvailableRooms} disabled={isLoading} className="w-full h-12 text-lg">
            {isLoading ? 'Searching...' : 'Search Available Rooms'}
          </IOSButton>
        );
      case 'room':
        return (
          <div className="flex gap-3 w-full">
            <IOSButton variant="outline" onClick={() => setStep('dates')} className="flex-1">
              Back
            </IOSButton>
            <IOSButton onClick={() => setStep('guest')} disabled={!selectedRoom} className="flex-1">
              Continue
            </IOSButton>
          </div>
        );
      case 'guest':
        if (isNewGuest) {
          return (
            <div className="flex gap-3 w-full">
              <IOSButton variant="outline" onClick={() => setIsNewGuest(false)} className="flex-1">
                Back
              </IOSButton>
              <IOSButton onClick={handleCreateGuest} disabled={isLoading} className="flex-1">
                Create & Continue
              </IOSButton>
            </div>
          );
        }
        return (
          <div className="flex flex-col gap-2 w-full">
            <IOSButton variant="outline" onClick={() => setIsNewGuest(true)} className="w-full" leftIcon={<Plus className="h-4 w-4" />}>
              Add New Guest
            </IOSButton>
            <IOSButton variant="ghost" onClick={() => setStep('room')} className="w-full text-gray-500">
              Back to Room Selection
            </IOSButton>
          </div>
        );
      case 'confirm':
        return (
          <div className="flex gap-3 w-full">
            <IOSButton variant="outline" onClick={() => setStep('guest')} className="flex-1">
              Back
            </IOSButton>
            <IOSButton onClick={handleSubmit} disabled={isSubmitting} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              {isSubmitting ? 'Creating...' : 'Confirm Reservation'}
            </IOSButton>
          </div>
        );
    }
  };

  const getRoomPrice = () => {
    if (!selectedRoom) return 0;

    // Use mapped price_per_night which already handles overrides and base prices
    let basePrice = selectedRoom.price_per_night || 0;

    if (selectedRatePlan) {
      return selectedRatePlan.isPercentage
        ? basePrice * selectedRatePlan.multiplier
        : selectedRatePlan.fixedAmount || basePrice;
    }
    return basePrice;
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
      const response = await bookingsAPI.getAvailableRooms({
        checkIn,
        checkOut,
        adults: adults + children,
        branch_id: activeBranchId || undefined
      });
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
      const response = await guestAPI.getGuests(guestSearch, user?.branch_id || undefined);
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
        room_type_id: selectedRoom.room_type_id || selectedRoom.type?.id,
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

  // AI Pricing Quote removed as per user request

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="px-6 py-4 border-b bg-white z-10">
          <DialogTitle className="flex items-center gap-2 text-xl font-sf-pro-display">
            <Calendar className="h-5 w-5 text-[#3C3C43]" />
            New Reservation
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="p-0 overflow-y-auto">
          <div className="p-6">
            {/* Progress Steps */}
            <div className="flex items-center justify-between mb-8 px-4">
              {['dates', 'room', 'guest', 'confirm'].map((s, i) => {
                const stepIdx = ['dates', 'room', 'guest', 'confirm'].indexOf(step);
                const isActive = step === s;
                const isCompleted = stepIdx > i;
                return (
                  <React.Fragment key={s}>
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${isActive ? 'bg-[#3C3C43] text-white ring-4 ring-gray-100 scale-110 shadow-lg' :
                        isCompleted ? 'bg-emerald-500 text-white shadow-md' : 'bg-gray-100 text-gray-400'
                        }`}>
                        {isCompleted ? <Check className="h-5 w-5" /> : i + 1}
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-[#3C3C43]' : 'text-gray-400'}`}>
                        {s}
                      </span>
                    </div>
                    {i < 3 && (
                      <div className="flex-1 h-[2px] mx-2 mb-6 bg-gray-100 relative overflow-hidden">
                        <div className={`absolute inset-0 bg-emerald-500 transition-all duration-500 ${isCompleted ? 'translate-x-0' : '-translate-x-full'}`} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Step 1: Dates */}
            {step === 'dates' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-tight">Check-In Date *</label>
                    <Input
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="h-12 bg-gray-50 border-gray-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-tight">Check-Out Date *</label>
                    <Input
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      min={checkIn || new Date().toISOString().split('T')[0]}
                      className="h-12 bg-gray-50 border-gray-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-tight">Adults</label>
                    <Input
                      type="number"
                      min={1}
                      value={adults}
                      onChange={(e) => setAdults(parseInt(e.target.value) || 1)}
                      className="h-12 bg-gray-50 border-gray-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-tight">Children</label>
                    <Input
                      type="number"
                      min={0}
                      value={children}
                      onChange={(e) => setChildren(parseInt(e.target.value) || 0)}
                      className="h-12 bg-gray-50 border-gray-200"
                    />
                  </div>
                </div>

                {nights > 0 && (
                  <div className="mt-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex justify-between items-center shadow-inner">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Stay Duration</p>
                        <p className="text-sm font-medium text-emerald-600">{nights} night{nights > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <span className="bg-white px-4 py-2 rounded-xl text-lg font-bold text-emerald-700 shadow-sm">{nights} Nights</span>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Room Selection */}
            {step === 'room' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                  <h3 className="font-bold text-gray-900">Select Available Room</h3>
                  <p className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{availableRooms.length} rooms found</p>
                </div>
                <div className="grid grid-cols-2 gap-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                  {availableRooms.map((room) => (
                    <div
                      key={room.id}
                      onClick={() => setSelectedRoom(room)}
                      className={`p-5 border-2 rounded-2xl cursor-pointer transition-all duration-200 group relative ${selectedRoom?.id === room.id
                        ? 'border-[#3C3C43] bg-gray-50 shadow-md ring-4 ring-gray-100'
                        : 'border-gray-100 hover:border-gray-300 hover:shadow-sm bg-white'
                        }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-black text-lg">Room {room.room_number}</p>
                        {selectedRoom?.id === room.id && <Check className="h-5 w-5 text-[#3C3C43]" />}
                      </div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{room.room_type}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-4">
                        <Users className="h-3 w-3" />
                        <span>Up to {room.max_occupancy} guests</span>
                      </div>
                      <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Price/Night</span>
                        <p className="font-bold text-[#3C3C43]">KES {room.price_per_night?.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Guest Selection */}
            {step === 'guest' && (
              <div className="space-y-6">
                {!isNewGuest ? (
                  <>
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-tight ml-1">Find Existing Guest</label>
                      <div className="flex gap-2 relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                          <Search className="h-5 w-5" />
                        </div>
                        <Input
                          placeholder="Search by name, email or phone..."
                          value={guestSearch}
                          onChange={(e) => setGuestSearch(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && searchGuests()}
                          className="h-14 pl-12 bg-gray-50 border-none shadow-inner"
                        />
                        <IOSButton onClick={searchGuests} disabled={isLoading} className="h-14 px-6">
                          Search
                        </IOSButton>
                      </div>
                    </div>
                    {guests.length > 0 && (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                        {guests.map((guest) => (
                          <div
                            key={guest.id}
                            onClick={() => {
                              setSelectedGuest(guest);
                              setStep('confirm');
                            }}
                            className="p-5 border-2 border-gray-50 rounded-2xl cursor-pointer hover:border-gray-200 hover:bg-gray-50 transition-all flex justify-between items-center group"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-[#F2F2F7] flex items-center justify-center text-[#3C3C43] font-black text-lg">
                                {guest.first_name?.[0].toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-gray-900 group-hover:text-[#3C3C43] transition-colors">{guest.first_name} {guest.last_name}</p>
                                <p className="text-sm text-gray-500">{guest.phone}</p>
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-gray-500" />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-5">
                    <p className="text-sm text-gray-500">
                      Reservation: {initialData?.confirmation_number || initialData?.id?.slice(0, 8)} • Guest: {initialData?.guest_name}
                    </p>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-gray-900">New Guest Details</h3>
                      <button onClick={() => setIsNewGuest(false)} className="text-xs font-bold text-gray-400 hover:text-gray-600">Cancel</button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase ml-1">First Name *</label>
                        <Input
                          value={newGuest.first_name}
                          onChange={(e) => setNewGuest({ ...newGuest, first_name: e.target.value })}
                          placeholder="e.g. John"
                          className="h-12 bg-gray-50 border-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-400 uppercase ml-1">Last Name *</label>
                        <Input
                          value={newGuest.last_name}
                          onChange={(e) => setNewGuest({ ...newGuest, last_name: e.target.value })}
                          placeholder="e.g. Doe"
                          className="h-12 bg-gray-50 border-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase ml-1">Phone Number *</label>
                      <Input
                        value={newGuest.phone}
                        onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })}
                        placeholder="+254..."
                        className="h-12 bg-gray-50 border-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase ml-1">Email Address</label>
                      <Input
                        type="email"
                        value={newGuest.email}
                        onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })}
                        placeholder="guest@example.com"
                        className="h-12 bg-gray-50 border-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Confirmation */}
            {step === 'confirm' && selectedRoom && selectedGuest && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-[#3C3C43] text-white rounded-3xl shadow-xl relative overflow-hidden">
                    <Users className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5 rotate-12" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-4">Guest Information</p>
                    <p className="text-xl font-bold mb-1">{selectedGuest.first_name} {selectedGuest.last_name}</p>
                    <p className="text-white/70 text-sm flex items-center gap-2">
                      <Phone className="h-3 w-3" /> {selectedGuest.phone}
                    </p>
                  </div>
                  <div className="p-5 bg-emerald-600 text-white rounded-3xl shadow-xl relative overflow-hidden">
                    <Home className="absolute -right-4 -bottom-4 w-24 h-24 text-white/5 rotate-12" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50 mb-4">Room Details</p>
                    <p className="text-xl font-bold mb-1">Room {selectedRoom.room_number}</p>
                    <p className="text-white/70 text-sm capitalize">{selectedRoom.room_type} Room</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 py-4 border-y border-gray-100">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-tight">Stay Period</label>
                    <p className="font-bold text-gray-900 text-sm">
                      {new Date(checkIn).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(checkOut).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                    <span className="text-xs text-gray-500 font-medium">{nights} nights total</span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-tight">Rate Plan</label>
                    <select
                      value={selectedRatePlan?.id || ''}
                      onChange={(e) => setSelectedRatePlan(ratePlans.find((r: any) => r.id === e.target.value) || null)}
                      className="w-full h-10 bg-gray-50 border-none rounded-xl px-3 font-bold text-sm focus:ring-2 ring-[#3C3C43]"
                    >
                      <option value="">Base Rate</option>
                      {ratePlans.map((plan: any) => (
                        <option key={plan.id} value={plan.id}>{plan.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-tight">Meal Plan</label>
                    <select
                      value={mealPlan}
                      onChange={(e) => setMealPlan(e.target.value)}
                      className="w-full h-10 bg-gray-50 border-none rounded-xl px-3 font-bold text-sm"
                    >
                      <option value="bed_breakfast">Bed & Breakfast</option>
                      <option value="half_board">Half Board</option>
                      <option value="full_board">Full Board</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-tight">Special Requests</label>
                    <textarea
                      value={specialRequests}
                      onChange={(e) => setSpecialRequests(e.target.value)}
                      className="w-full p-4 bg-gray-50 border-none rounded-2xl text-sm min-h-[80px]"
                      placeholder="e.g. Early check-in, extra towels..."
                    />
                  </div>
                  <div className="p-6 bg-gray-900 rounded-[32px] text-white space-y-3 shadow-2xl">
                    <div className="flex justify-between items-center opacity-70">
                      <span className="text-xs font-bold uppercase tracking-wider">Base Fare ({nights} nights)</span>
                      <span className="font-bold">KES {(getRoomPrice() * nights).toLocaleString()}</span>
                    </div>
                    {mealPlan !== 'bed_breakfast' && (
                      <div className="flex justify-between items-center opacity-70">
                        <span className="text-xs font-bold uppercase tracking-wider">Meal Add-ons</span>
                        <span className="font-bold">KES {(mealPlanPrices[mealPlan] * nights).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                      <span className="text-sm font-black uppercase tracking-[0.2em] text-emerald-400">Total Payable</span>
                      <span className="text-2xl font-black">KES {totalAmount.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="space-y-2 pb-4">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-tight ml-1">Deposit Paid Now</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">KES</span>
                      <Input
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(Number(e.target.value))}
                        placeholder="0.00"
                        className="h-14 pl-14 bg-gray-50 border-none shadow-inner text-xl font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter className="px-6 py-5 border-t bg-gray-50/80 backdrop-blur-md z-10">
          {renderFooterActions()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Edit Reservation Modal
function EditReservationModal({
  isOpen,
  onClose,
  onSuccess,
  booking
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  booking: Booking | null;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    check_in: '',
    check_out: '',
    adults: 1,
    children: 0,
    meal_plan: 'bed_breakfast',
    special_requests: '',
    internal_notes: ''
  });

  useEffect(() => {
    if (isOpen && booking) {
      setFormData({
        check_in: booking.check_in?.split('T')[0] || '',
        check_out: booking.check_out?.split('T')[0] || '',
        adults: booking.adults || 1,
        children: booking.children || 0,
        meal_plan: booking.meal_plan || 'bed_breakfast',
        special_requests: booking.special_requests || '',
        internal_notes: booking.internal_notes || ''
      });
    }
  }, [isOpen, booking]);

  const handleSubmit = async () => {
    if (!booking) return;
    setIsSubmitting(true);
    try {
      const response = await bookingsAPI.updateBooking(booking.id, formData);
      if (response.success) {
        toast.success('Reservation updated successfully');
        onSuccess();
        onClose();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update reservation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="h-5 w-5" />
            Edit Reservation
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Check-In</label>
                <Input
                  type="date"
                  value={formData.check_in}
                  onChange={(e) => setFormData({ ...formData, check_in: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Check-Out</label>
                <Input
                  type="date"
                  value={formData.check_out}
                  onChange={(e) => setFormData({ ...formData, check_out: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Adults</label>
                <Input
                  type="number"
                  value={formData.adults}
                  onChange={(e) => setFormData({ ...formData, adults: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Children</label>
                <Input
                  type="number"
                  value={formData.children}
                  onChange={(e) => setFormData({ ...formData, children: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Meal Plan</label>
              <select
                value={formData.meal_plan}
                onChange={(e) => setFormData({ ...formData, meal_plan: e.target.value })}
                className="w-full p-2 border rounded-ios-lg mt-1"
              >
                <option value="bed_breakfast">Bed & Breakfast</option>
                <option value="half_board">Half Board</option>
                <option value="full_board">Full Board</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Special Requests</label>
              <textarea
                value={formData.special_requests}
                onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
                className="w-full p-2 border rounded-ios-lg mt-1"
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <IOSButton variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </IOSButton>
              <IOSButton onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </IOSButton>
            </div>
          </div>
        </DialogBody>
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
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [checkOutModalOpen, setCheckOutModalOpen] = useState(false);
  const [folioModalOpen, setFolioModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (user?.branch_id) params.branch_id = user.branch_id;

      // console.log('Fetching bookings with params:', params);
      const response = await bookingsAPI.getBookings(params);

      if (response.success) {
        // console.log('Bookings API response:', response);
        // Handle both array formats - the one returned directly from the API and the one transformed by the API wrapper
        if (Array.isArray(response.data)) {
          setBookings(response.data);
        } else if (response.data && Array.isArray(response.data.data)) {
          // Handle nested data structure from backend
          setBookings(response.data.data);
        } else {
          setBookings([]);
        }
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load reservations');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, user?.branch_id]);

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
              <IOSButton variant="outline" onClick={fetchBookings} leftIcon={<RefreshCw />} className="border-[rgba(60,60,67,0.12)] text-[#3C3C43] hover:bg-[#F2F2F7]">Refresh
              </IOSButton>
              <IOSButton onClick={() => setNewModalOpen(true)} leftIcon={<Plus />} className="bg-[#3C3C43] hover:bg-[#000000] text-white">
                New Reservation
              </IOSButton>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Reservations', value: stats.total, icon: Calendar, color: 'text-gray-600', bg: 'bg-gray-50' },
              { label: 'Confirmed', value: stats.confirmed, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Checked In', value: stats.checkedIn, icon: LogIn, color: 'text-blue-600', bg: 'bg-blue-50' },
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

          {/* Filters */}
          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                  <Input
                    placeholder="Search by guest or room..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
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
              <IOSButton onClick={() => setNewModalOpen(true)} className="mt-4 bg-[#3C3C43] hover:bg-[#000000] text-white" leftIcon={<Plus />}>
                Create Reservation
              </IOSButton>
            </IOSCard>
          ) : (
            <IOSCard className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Guest</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Room</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Dates</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
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
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusInfo.borderColor} ${statusInfo.bgColor} ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
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
                              <IOSButton size="sm" variant="ghost" onClick={() => {
                                printReservationInvoice({ reservation: booking, user });
                              }}>
                                <Printer className="h-4 w-4" />
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
                              {(booking.status === 'pending' || booking.status === 'confirmed') && (
                                <IOSButton size="sm" variant="outline" onClick={() => {
                                  setSelectedBooking(booking);
                                  setEditModalOpen(true);
                                }}>
                                  <Edit2 className="h-4 w-4" />
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
        <EditReservationModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSuccess={fetchBookings}
          booking={selectedBooking}
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
