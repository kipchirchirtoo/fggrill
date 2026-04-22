'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Users, MapPin, CreditCard, Check, X,
  ChevronLeft, ChevronRight, Star, Wifi, Car,
  Coffee, Utensils, Dumbbell, Waves
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { Input } from '@/components/ui/input';
import { bookingsAPI } from '@/lib/api';
import { useBranch } from '@/lib/branch-context';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: number;
}

interface RoomType {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  maxOccupancy: number;
  amenities: string[];
  images: string[];
  available: number;
}

interface GuestInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  idType: string;
  idNumber: string;
  nationality: string;
  address: string;
}

interface PricingBreakdown {
  roomRate: number;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discountAmount: number;
  totalAmount: number;
  nights: number;
}

const ROOM_TYPES: RoomType[] = [
  {
    id: '1',
    name: 'Standard Room',
    description: 'Comfortable room with modern amenities',
    basePrice: 8500,
    maxOccupancy: 2,
    amenities: ['Free WiFi', 'Air Conditioning', 'TV', 'Mini Fridge'],
    images: ['/images/standard-room.jpg'],
    available: 5
  },
  {
    id: '2',
    name: 'Deluxe Room',
    description: 'Spacious room with city view',
    basePrice: 12000,
    maxOccupancy: 3,
    amenities: ['Free WiFi', 'Air Conditioning', 'TV', 'Mini Bar', 'City View'],
    images: ['/images/deluxe-room.jpg'],
    available: 3
  },
  {
    id: '3',
    name: 'Executive Suite',
    description: 'Luxury suite with separate living area',
    basePrice: 18000,
    maxOccupancy: 4,
    amenities: ['Free WiFi', 'Air Conditioning', 'TV', 'Mini Bar', 'Living Area', 'Balcony'],
    images: ['/images/executive-suite.jpg'],
    available: 2
  }
];

const MEAL_PLANS = [
  { id: 'bed_breakfast', name: 'Bed & Breakfast', price: 0, description: 'Room with breakfast included' },
  { id: 'half_board', name: 'Half Board', price: 1500, description: 'Breakfast and dinner included' },
  { id: 'full_board', name: 'Full Board', price: 3000, description: 'All meals included' },
  { id: 'all_inclusive', name: 'All Inclusive', price: 5000, description: 'All meals and beverages included' }
];

export function BookingModal({ isOpen, onClose, initialCheckIn, initialCheckOut, initialGuests }: BookingModalProps) {
  const { activeBranchId } = useBranch();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Dates and Guests
  const [checkIn, setCheckIn] = useState(initialCheckIn || '');
  const [checkOut, setCheckOut] = useState(initialCheckOut || '');
  const [adults, setAdults] = useState(initialGuests || 1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);

  // Step 2: Room Selection
  const [availableRooms, setAvailableRooms] = useState<RoomType[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<RoomType | null>(null);
  const [mealPlan, setMealPlan] = useState('bed_breakfast');

  // Step 3: Guest Information
  const [guestInfo, setGuestInfo] = useState<GuestInfo>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    idType: 'passport',
    idNumber: '',
    nationality: '',
    address: ''
  });

  // Step 4: Payment & Confirmation
  const [pricing, setPricing] = useState<PricingBreakdown | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [specialRequests, setSpecialRequests] = useState('');

  useEffect(() => {
    if (isOpen) {
      resetModal();
    }
  }, [isOpen]);

  const resetModal = () => {
    setStep(1);
    setCheckIn(initialCheckIn || '');
    setCheckOut(initialCheckOut || '');
    setAdults(initialGuests || 1);
    setChildren(0);
    setInfants(0);
    setSelectedRoom(null);
    setMealPlan('bed_breakfast');
    setGuestInfo({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      idType: 'passport',
      idNumber: '',
      nationality: '',
      address: ''
    });
    setPricing(null);
    setPaymentMethod('card');
    setSpecialRequests('');
  };

  const checkAvailability = async () => {
    if (!checkIn || !checkOut) {
      toast.error('Please select check-in and check-out dates');
      return;
    }

    if (new Date(checkIn) >= new Date(checkOut)) {
      toast.error('Check-out date must be after check-in date');
      return;
    }

    setIsLoading(true);
    try {
      const totalGuests = adults + children;
      const response = await bookingsAPI.getAvailableRooms({
        checkIn,
        checkOut,
        branch_id: activeBranchId || undefined,
        adults: totalGuests,
      });

      if (response.success && response.data) {
        const availableRooms = response.data
          .map((room: any) => ({
            id: room.type?.id || room.type_id || room.id,
            name: room.type?.name || room.room_type || 'Standard Room',
            description: `Room ${room.room_number} on Floor ${room.floor}`,
            basePrice: room.type?.base_price || room.price_override || room.rate_per_night || room.price || 5000,
            maxOccupancy: room.type?.max_occupancy || room.max_occupancy || 2,
            amenities: room.type?.amenities || ['Wifi', 'TV', 'AC'],
            images: ['/fggallery/room1.jpeg'],
            available: 1
          }))
          .filter((room: RoomType) => room.maxOccupancy >= totalGuests);

        const roomTypeGroups = availableRooms.reduce((acc: any, room: any) => {
          const key = room.name;
          if (!acc[key]) {
            acc[key] = {
              ...room,
              available: 0
            };
          }
          acc[key].available += 1;
          return acc;
        }, {});

        const filtered = Object.values(roomTypeGroups) as RoomType[];
        setAvailableRooms(filtered);
        setStep(2);
      } else {
        throw new Error('Failed to fetch rooms');
      }
    } catch (error) {
      console.error('Availability check error:', error);
      toast.error('Failed to check availability');
    } finally {
      setIsLoading(false);
    }
  };

  const selectRoom = async (room: RoomType) => {
    setSelectedRoom(room);
    setIsLoading(true);

    try {
      const response = await bookingsAPI.getPricingQuote({
        checkInDate: checkIn,
        checkOutDate: checkOut,
        roomTypeId: room.id,
        adults,
        children,
        mealPlan
      });

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Failed to calculate pricing');
      }

      setPricing(response.data);

      setStep(3);
    } catch (error) {
      toast.error('Failed to calculate pricing');
    } finally {
      setIsLoading(false);
    }
  };

  const submitBooking = async () => {
    if (!selectedRoom || !pricing) return;

    // Validate guest information
    if (!guestInfo.firstName || !guestInfo.lastName || !guestInfo.email || !guestInfo.phone) {
      toast.error('Please fill in all required guest information');
      return;
    }

    setIsSubmitting(true);
    try {
      const bookingData = {
        guestInfo,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        roomTypeId: selectedRoom.id,
        adults,
        children,
        infants,
        mealPlan,
        specialRequests,
        paymentMethod,
        bookingSource: 'WEBSITE',
        depositAmount: pricing.totalAmount,
        branchId: activeBranchId || undefined
      };

      const result = await bookingsAPI.createBooking(bookingData);

      if (!result.success || !result.data) {
        throw new Error(result.message || 'Failed to create booking');
      }

      const confirmationNumber = result.data.confirmationNumber || result.data.booking?.confirmation_number;
      toast.success(`Booking confirmed! Confirmation number: ${confirmationNumber || 'Generated successfully'}`);
      setStep(5); // Success step

    } catch (error: any) {
      toast.error(error.message || 'Failed to create booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8 pb-4"
    >
      <div className="space-y-4">
        <h3 className="text-[15px] font-bold text-stone-900 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-stone-400" />
          Select Your Dates
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Check-in Date</label>
            <Input
              type="date"
              className="rounded-xl border-stone-200 focus:ring-stone-900/10 h-11"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Check-out Date</label>
            <Input
              type="date"
              className="rounded-xl border-stone-200 focus:ring-stone-900/10 h-11"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              min={checkIn || new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-[15px] font-bold text-stone-900 flex items-center gap-2">
          <Users className="h-4 w-4 text-stone-400" />
          Number of Guests
        </h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Adults</label>
            <div className="flex items-center justify-between bg-stone-50 p-1.5 rounded-xl border border-stone-100">
              <button
                onClick={() => setAdults(Math.max(1, adults - 1))}
                disabled={adults <= 1}
                className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-stone-600 disabled:opacity-30"
              >
                -
              </button>
              <span className="font-bold text-stone-900">{adults}</span>
              <button
                onClick={() => setAdults(adults + 1)}
                className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-stone-600"
              >
                +
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Children</label>
            <div className="flex items-center justify-between bg-stone-50 p-1.5 rounded-xl border border-stone-100">
              <button
                onClick={() => setChildren(Math.max(0, children - 1))}
                disabled={children <= 0}
                className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-stone-600 disabled:opacity-30"
              >
                -
              </button>
              <span className="font-bold text-stone-900">{children}</span>
              <button
                onClick={() => setChildren(children + 1)}
                className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-stone-600"
              >
                +
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Infants</label>
            <div className="flex items-center justify-between bg-stone-50 p-1.5 rounded-xl border border-stone-100">
              <button
                onClick={() => setInfants(Math.max(0, infants - 1))}
                disabled={infants <= 0}
                className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-stone-600 disabled:opacity-30"
              >
                -
              </button>
              <span className="font-bold text-stone-900">{infants}</span>
              <button
                onClick={() => setInfants(infants + 1)}
                className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-stone-600"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderStep2 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8 pb-4"
    >
      <div className="space-y-4">
        <h3 className="text-[15px] font-bold text-stone-900">Select Your Room</h3>
        <div className="space-y-4">
          {availableRooms.map((room) => (
            <div
              key={room.id}
              className="p-4 rounded-2xl border border-stone-200 cursor-pointer hover:border-stone-900 transition-all bg-white shadow-sm hover:shadow-md relative overflow-hidden group"
              onClick={() => selectRoom(room)}
            >
              <div className="flex justify-between items-start relative z-10">
                <div className="flex-1">
                  <h4 className="font-bold text-stone-900">{room.name}</h4>
                  <p className="text-stone-500 text-xs mb-3">{room.description}</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {room.amenities.slice(0, 3).map((amenity) => (
                      <span key={amenity} className="text-[10px] font-bold bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full uppercase">
                        {amenity}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-stone-400 font-medium">
                    Max {room.maxOccupancy} guests • {room.available} available
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-stone-900 leading-none">KES {room.basePrice.toLocaleString()}</p>
                  <p className="text-[11px] text-stone-400 font-medium mt-1">per night</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-[15px] font-bold text-stone-900">Meal Plan</h3>
        <div className="grid grid-cols-2 gap-3">
          {MEAL_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`p-4 rounded-2xl cursor-pointer transition-all border-2 ${mealPlan === plan.id
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-stone-100 bg-stone-50 hover:border-stone-200'
                }`}
              onClick={() => setMealPlan(plan.id)}
            >
              <h4 className="font-bold text-sm">{plan.name}</h4>
              <p className={`text-[10px] uppercase font-bold tracking-wider mt-2 ${mealPlan === plan.id ? 'text-white/60' : 'text-stone-400'}`}>
                {plan.price === 0 ? 'Included' : `+KES ${plan.price.toLocaleString()}`}
              </p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );

  const renderStep3 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8 pb-4"
    >
      <div className="space-y-4">
        <h3 className="text-[15px] font-bold text-stone-900">Guest Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">First Name *</label>
            <Input
              value={guestInfo.firstName}
              onChange={(e) => setGuestInfo({ ...guestInfo, firstName: e.target.value })}
              placeholder="Enter first name"
              className="rounded-xl border-stone-200 h-11"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Last Name *</label>
            <Input
              value={guestInfo.lastName}
              onChange={(e) => setGuestInfo({ ...guestInfo, lastName: e.target.value })}
              placeholder="Enter last name"
              className="rounded-xl border-stone-200 h-11"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Email *</label>
            <Input
              type="email"
              value={guestInfo.email}
              onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })}
              placeholder="Enter email address"
              className="rounded-xl border-stone-200 h-11"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Phone *</label>
            <Input
              value={guestInfo.phone}
              onChange={(e) => setGuestInfo({ ...guestInfo, phone: e.target.value })}
              placeholder="Enter phone number"
              className="rounded-xl border-stone-200 h-11"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">ID Type</label>
            <select
              value={guestInfo.idType}
              onChange={(e) => setGuestInfo({ ...guestInfo, idType: e.target.value })}
              className="w-full px-4 h-11 border border-stone-200 rounded-xl bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
            >
              <option value="passport">Passport</option>
              <option value="national_id">National ID</option>
              <option value="driving_license">Driving License</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">ID Number</label>
            <Input
              value={guestInfo.idNumber}
              onChange={(e) => setGuestInfo({ ...guestInfo, idNumber: e.target.value })}
              placeholder="Enter ID number"
              className="rounded-xl border-stone-200 h-11"
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Special Requests</label>
        <textarea
          value={specialRequests}
          onChange={(e) => setSpecialRequests(e.target.value)}
          placeholder="Any special requests or preferences..."
          className="w-full px-4 py-3 border border-stone-200 rounded-xl resize-none bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
          rows={3}
        />
      </div>
    </motion.div>
  );

  const renderStep4 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8 pb-4"
    >
      <div className="space-y-4">
        <h3 className="text-[15px] font-bold text-stone-900">Booking Summary</h3>
        {selectedRoom && pricing && (
          <div className="bg-stone-50 rounded-2xl p-5 border border-stone-100 space-y-4 shadow-inner">
            <div className="space-y-2 pb-4 border-b border-stone-200/50">
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-400 font-bold uppercase tracking-wider">Room Type</span>
                <span className="font-bold text-stone-900">{selectedRoom.name}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-400 font-bold uppercase tracking-wider">Check-in</span>
                <span className="font-bold text-stone-900">{new Date(checkIn).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-400 font-bold uppercase tracking-wider">Check-out</span>
                <span className="font-bold text-stone-900">{new Date(checkOut).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-400 font-bold uppercase tracking-wider">Nights</span>
                <span className="font-bold text-stone-900">{pricing.nights}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-stone-500 font-medium">Room Rate</span>
                <span className="font-bold text-stone-900">KES {pricing.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-stone-500 font-medium">Taxes (16%)</span>
                <span className="font-bold text-stone-900">KES {pricing.taxAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-stone-500 font-medium">Service Charge (10%)</span>
                <span className="font-bold text-stone-900">KES {pricing.serviceCharge.toLocaleString()}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-stone-200 flex justify-between items-center">
              <span className="text-sm font-bold text-stone-900">Total Amount</span>
              <span className="text-xl font-black text-stone-900 underline decoration-stone-200 underline-offset-4">
                KES {pricing.totalAmount.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-[15px] font-bold text-stone-900">Payment Method</h3>
        <div className="grid grid-cols-2 gap-3">
          <div
            className={`p-4 rounded-2xl cursor-pointer transition-all border-2 flex flex-col items-center text-center gap-2 ${paymentMethod === 'card'
              ? 'border-stone-900 bg-stone-900 text-white'
              : 'border-stone-100 bg-stone-50 hover:border-stone-200'
              }`}
            onClick={() => setPaymentMethod('card')}
          >
            <CreditCard className="h-5 w-5" />
            <p className="font-bold text-xs uppercase tracking-wider">Credit Card</p>
          </div>
          <div
            className={`p-4 rounded-2xl cursor-pointer transition-all border-2 flex flex-col items-center text-center gap-2 ${paymentMethod === 'mpesa'
              ? 'border-stone-900 bg-stone-900 text-white shadow-lg shadow-stone-900/10'
              : 'border-stone-100 bg-stone-50 hover:border-stone-200'
              }`}
            onClick={() => setPaymentMethod('mpesa')}
          >
            <div className="h-5 w-5 bg-green-500 rounded-lg flex items-center justify-center text-[8px] font-black italic text-white shadow-[0_4px_10px_rgba(34,197,94,0.3)]">M</div>
            <p className="font-bold text-xs uppercase tracking-wider">M-Pesa</p>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderStep5 = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-12 space-y-8"
    >
      <div className="relative inline-block">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto relative z-10 transition-transform hover:scale-110">
          <Check className="h-10 w-10 text-green-600" />
        </div>
        <div className="absolute inset-0 bg-green-500/10 blur-2xl rounded-full scale-150 animate-pulse" />
      </div>
      <div>
        <h3 className="text-2xl font-black text-stone-900 mb-3 tracking-tight">Booking Confirmed!</h3>
        <p className="text-stone-500 text-sm max-w-[240px] mx-auto leading-relaxed">
          Your stay at Famous Gates Hotels is booked. We've sent the confirmation details to your email.
        </p>
      </div>
    </motion.div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 overflow-hidden flex flex-col border-none shadow-2xl rounded-2xl">
        <DialogHeader className="p-4 border-b border-stone-100 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-stone-900">
            <Calendar className="h-5 w-5 text-stone-500" />
            Book Your Stay
          </DialogTitle>
          <p className="text-xs text-stone-500 mt-0.5">Complete the steps below to confirm your reservation</p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Progress Indicator */}
          {step < 5 && (
            <div className="px-6 py-4 bg-stone-50/50 border-b border-stone-100">
              <div className="flex items-center justify-between max-w-xs mx-auto">
                {[1, 2, 3, 4].map((stepNum) => (
                  <div key={stepNum} className="flex items-center flex-1 last:flex-none">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= stepNum
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-200 text-stone-500'
                        }`}
                    >
                      {stepNum}
                    </div>
                    {stepNum < 4 && (
                      <div
                        className={`flex-1 h-[2px] mx-2 transition-all ${step > stepNum ? 'bg-stone-900' : 'bg-stone-200'
                          }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
            <AnimatePresence mode="wait">
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
              {step === 4 && renderStep4()}
              {step === 5 && renderStep5()}
            </AnimatePresence>
          </div>

          {step < 5 && (
            <div className="p-4 border-t border-stone-100 bg-white">
              {step === 1 && (
                <div className="flex gap-3">
                  <IOSButton variant="outline" onClick={onClose} className="flex-1 rounded-xl">
                    Cancel
                  </IOSButton>
                  <IOSButton
                    onClick={checkAvailability}
                    disabled={isLoading}
                    className="flex-1 bg-stone-900 hover:bg-stone-800 text-white rounded-xl shadow-lg"
                  >
                    {isLoading ? 'Checking...' : 'Check Availability'}
                  </IOSButton>
                </div>
              )}
              {step === 2 && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-sm border border-stone-200 text-stone-600 hover:bg-stone-50 transition-all"
                  >
                    Back
                  </button>
                </div>
              )}
              {step === 3 && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(2)}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-sm border border-stone-200 text-stone-600 hover:bg-stone-50 transition-all"
                  >
                    Back
                  </button>
                  <IOSButton
                    onClick={() => setStep(4)}
                    className="flex-1 bg-stone-900 hover:bg-stone-800 text-white rounded-xl shadow-lg"
                  >
                    Continue to Payment
                  </IOSButton>
                </div>
              )}
              {step === 4 && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(3)}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-sm border border-stone-200 text-stone-600 hover:bg-stone-50 transition-all"
                  >
                    Back
                  </button>
                  <IOSButton
                    onClick={submitBooking}
                    disabled={isSubmitting}
                    className="flex-1 bg-stone-900 hover:bg-stone-800 text-white rounded-xl shadow-lg"
                  >
                    {isSubmitting ? 'Processing...' : 'Confirm Booking'}
                  </IOSButton>
                </div>
              )}
            </div>
          )}
          {step === 5 && (
            <div className="p-4 border-t border-stone-100 bg-white space-y-4">
              <button
                onClick={onClose}
                className="w-full bg-stone-900 hover:bg-stone-800 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-stone-900/10 active:scale-[0.98] transition-all"
              >
                Finish
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
