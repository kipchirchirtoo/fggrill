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
import { roomsAPI } from '@/lib/api';
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
      // Get available rooms from API
      const totalGuests = adults + children;
      const response = await roomsAPI.getRooms({ branch_id: activeBranchId || undefined, status: 'available' });

      if (response.success && response.data) {
        // Convert API rooms to RoomType format and filter by occupancy
        const availableRooms = response.data
          .filter((room: any) => room.status === 'available')
          .map((room: any) => ({
            id: room.id,
            name: room.room_type || 'Standard Room',
            description: `Room ${room.room_number} on Floor ${room.floor}`,
            basePrice: room.price || 5000,
            maxOccupancy: 2, // Default occupancy
            amenities: ['Wifi', 'TV', 'AC'],
            images: ['/fggallery/room1.jpeg'],
            available: 1
          }))
          .filter((room: RoomType) => room.maxOccupancy >= totalGuests);

        // Group by room type to show available room types
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
      // Calculate pricing
      const nights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24));
      const mealPlanPrice = MEAL_PLANS.find(plan => plan.id === mealPlan)?.price || 0;
      const subtotal = (room.basePrice + mealPlanPrice) * nights;
      const taxAmount = subtotal * 0.16; // 16% VAT
      const serviceCharge = subtotal * 0.10; // 10% service charge
      const totalAmount = subtotal + taxAmount + serviceCharge;

      setPricing({
        roomRate: room.basePrice,
        subtotal,
        taxAmount,
        serviceCharge,
        discountAmount: 0,
        totalAmount,
        nights
      });

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
        depositAmount: pricing.totalAmount
      };

      // Simulate API call - replace with actual booking API
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bookingData)
      });

      if (!response.ok) {
        throw new Error('Failed to create booking');
      }

      const result = await response.json();

      toast.success(`Booking confirmed! Confirmation number: ${result.data.confirmationNumber}`);
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
      className="space-y-6"
    >
      <div>
        <h3 className="text-lg font-semibold mb-4">Select Your Dates</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Check-in Date</label>
            <Input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Check-out Date</label>
            <Input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              min={checkIn || new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Number of Guests</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Adults</label>
            <div className="flex items-center gap-2">
              <IOSButton
                variant="outline"
                size="sm"
                onClick={() => setAdults(Math.max(1, adults - 1))}
                disabled={adults <= 1}
              >
                -
              </IOSButton>
              <span className="w-8 text-center">{adults}</span>
              <IOSButton
                variant="outline"
                size="sm"
                onClick={() => setAdults(adults + 1)}
              >
                +
              </IOSButton>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Children</label>
            <div className="flex items-center gap-2">
              <IOSButton
                variant="outline"
                size="sm"
                onClick={() => setChildren(Math.max(0, children - 1))}
                disabled={children <= 0}
              >
                -
              </IOSButton>
              <span className="w-8 text-center">{children}</span>
              <IOSButton
                variant="outline"
                size="sm"
                onClick={() => setChildren(children + 1)}
              >
                +
              </IOSButton>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Infants</label>
            <div className="flex items-center gap-2">
              <IOSButton
                variant="outline"
                size="sm"
                onClick={() => setInfants(Math.max(0, infants - 1))}
                disabled={infants <= 0}
              >
                -
              </IOSButton>
              <span className="w-8 text-center">{infants}</span>
              <IOSButton
                variant="outline"
                size="sm"
                onClick={() => setInfants(infants + 1)}
              >
                +
              </IOSButton>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <IOSButton variant="outline" onClick={onClose} className="flex-1">
          Cancel
        </IOSButton>
        <IOSButton
          onClick={checkAvailability}
          disabled={isLoading}
          className="flex-1 bg-[#3C3C43] hover:bg-[#000000] text-white"
        >
          {isLoading ? 'Checking...' : 'Check Availability'}
        </IOSButton>
      </div>
    </motion.div>
  );

  const renderStep2 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div>
        <h3 className="text-lg font-semibold mb-4">Select Your Room</h3>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {availableRooms.map((room) => (
            <IOSCard
              key={room.id}
              className="p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => selectRoom(room)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-semibold text-lg">{room.name}</h4>
                  <p className="text-gray-600 text-sm mb-2">{room.description}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {room.amenities.slice(0, 4).map((amenity) => (
                      <span key={amenity} className="text-xs bg-[#F2F2F7] text-[#3C3C43] px-2 py-1 rounded">
                        {amenity}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500">
                    Max {room.maxOccupancy} guests • {room.available} available
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">KES {room.basePrice.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">per night</p>
                </div>
              </div>
            </IOSCard>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Meal Plan</h3>
        <div className="grid grid-cols-2 gap-3">
          {MEAL_PLANS.map((plan) => (
            <IOSCard
              key={plan.id}
              className={`p-3 cursor-pointer transition-all ${mealPlan === plan.id
                ? 'bg-[#3C3C43] text-white'
                : 'hover:bg-[#F2F2F7]'
                }`}
              onClick={() => setMealPlan(plan.id)}
            >
              <h4 className="font-medium">{plan.name}</h4>
              <p className="text-sm opacity-80">{plan.description}</p>
              <p className="font-semibold mt-1">
                {plan.price === 0 ? 'Included' : `+KES ${plan.price.toLocaleString()}`}
              </p>
            </IOSCard>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <IOSButton variant="outline" onClick={() => setStep(1)} className="flex-1">
          Back
        </IOSButton>
      </div>
    </motion.div>
  );

  const renderStep3 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div>
        <h3 className="text-lg font-semibold mb-4">Guest Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">First Name *</label>
            <Input
              value={guestInfo.firstName}
              onChange={(e) => setGuestInfo({ ...guestInfo, firstName: e.target.value })}
              placeholder="Enter first name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Last Name *</label>
            <Input
              value={guestInfo.lastName}
              onChange={(e) => setGuestInfo({ ...guestInfo, lastName: e.target.value })}
              placeholder="Enter last name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Email *</label>
            <Input
              type="email"
              value={guestInfo.email}
              onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })}
              placeholder="Enter email address"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Phone *</label>
            <Input
              value={guestInfo.phone}
              onChange={(e) => setGuestInfo({ ...guestInfo, phone: e.target.value })}
              placeholder="Enter phone number"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">ID Type</label>
            <select
              value={guestInfo.idType}
              onChange={(e) => setGuestInfo({ ...guestInfo, idType: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="passport">Passport</option>
              <option value="national_id">National ID</option>
              <option value="driving_license">Driving License</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">ID Number</label>
            <Input
              value={guestInfo.idNumber}
              onChange={(e) => setGuestInfo({ ...guestInfo, idNumber: e.target.value })}
              placeholder="Enter ID number"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Special Requests</label>
        <textarea
          value={specialRequests}
          onChange={(e) => setSpecialRequests(e.target.value)}
          placeholder="Any special requests or preferences..."
          className="w-full px-3 py-2 border rounded-lg resize-none"
          rows={3}
        />
      </div>

      <div className="flex gap-3 pt-4">
        <IOSButton variant="outline" onClick={() => setStep(2)} className="flex-1">
          Back
        </IOSButton>
        <IOSButton
          onClick={() => setStep(4)}
          className="flex-1 bg-[#3C3C43] hover:bg-[#000000] text-white"
        >
          Continue to Payment
        </IOSButton>
      </div>
    </motion.div>
  );

  const renderStep4 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div>
        <h3 className="text-lg font-semibold mb-4">Booking Summary</h3>
        {selectedRoom && pricing && (
          <IOSCard className="p-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Room:</span>
                <span className="font-medium">{selectedRoom.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Dates:</span>
                <span>{new Date(checkIn).toLocaleDateString()} - {new Date(checkOut).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Nights:</span>
                <span>{pricing.nights}</span>
              </div>
              <div className="flex justify-between">
                <span>Guests:</span>
                <span>{adults} Adults{children > 0 && `, ${children} Children`}</span>
              </div>
              <hr />
              <div className="flex justify-between">
                <span>Room Rate:</span>
                <span>KES {pricing.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxes (16%):</span>
                <span>KES {pricing.taxAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Service Charge (10%):</span>
                <span>KES {pricing.serviceCharge.toLocaleString()}</span>
              </div>
              <hr />
              <div className="flex justify-between font-bold text-lg">
                <span>Total:</span>
                <span>KES {pricing.totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </IOSCard>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Payment Method</h3>
        <div className="grid grid-cols-2 gap-3">
          <IOSCard
            className={`p-3 cursor-pointer transition-all ${paymentMethod === 'card'
              ? 'bg-[#3C3C43] text-white'
              : 'hover:bg-[#F2F2F7]'
              }`}
            onClick={() => setPaymentMethod('card')}
          >
            <CreditCard className="h-5 w-5 mb-2" />
            <p className="font-medium">Credit/Debit Card</p>
          </IOSCard>
          <IOSCard
            className={`p-3 cursor-pointer transition-all ${paymentMethod === 'mpesa'
              ? 'bg-[#3C3C43] text-white'
              : 'hover:bg-[#F2F2F7]'
              }`}
            onClick={() => setPaymentMethod('mpesa')}
          >
            <div className="h-5 w-5 mb-2 bg-green-600 rounded" />
            <p className="font-medium">M-Pesa</p>
          </IOSCard>
        </div>
      </div>

      <div className="flex gap-3 pt-4">
        <IOSButton variant="outline" onClick={() => setStep(3)} className="flex-1">
          Back
        </IOSButton>
        <IOSButton
          onClick={submitBooking}
          disabled={isSubmitting}
          className="flex-1 bg-[#3C3C43] hover:bg-[#000000] text-white"
        >
          {isSubmitting ? 'Processing...' : 'Confirm Booking'}
        </IOSButton>
      </div>
    </motion.div>
  );

  const renderStep5 = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-6"
    >
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <Check className="h-8 w-8 text-green-600" />
      </div>
      <div>
        <h3 className="text-2xl font-bold text-green-600 mb-2">Booking Confirmed!</h3>
        <p className="text-gray-600">
          Thank you for your booking. A confirmation email has been sent to your email address.
        </p>
      </div>
      <IOSButton
        onClick={onClose}
        className="w-full bg-[#3C3C43] hover:bg-[#000000] text-white"
      >
        Close
      </IOSButton>
    </motion.div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Book Your Stay
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {/* Progress Indicator */}
          {step < 5 && (
            <div className="flex items-center justify-center mb-6">
              {[1, 2, 3, 4].map((stepNum) => (
                <div key={stepNum} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= stepNum
                      ? 'bg-[#3C3C43] text-white'
                      : 'bg-[#F2F2F7] text-[#3C3C43]'
                      }`}
                  >
                    {stepNum}
                  </div>
                  {stepNum < 4 && (
                    <div
                      className={`w-12 h-0.5 mx-2 ${step > stepNum ? 'bg-[#3C3C43]' : 'bg-[#F2F2F7]'
                        }`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
            {step === 5 && renderStep5()}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
