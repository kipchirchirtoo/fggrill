'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCheck, Search, CreditCard, Key, Camera, FileText, Smartphone,
  CheckCircle, Clock, AlertCircle, Loader2, QrCode, Fingerprint,
  Mail, MessageSquare, Printer, Download, ChevronRight, X, Check,
  Bed, Calendar, Users, DollarSign, Star, Crown, Shield, Wifi
} from 'lucide-react';
import { toast } from 'sonner';
import { bookingsAPI, roomsAPI, guestAPI } from '@/lib/api';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate } from '@/lib/date-utils';

interface Booking {
  id: string;
  booking_number?: string;
  guest: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    is_vip?: boolean;
    id_type?: string;
    id_number?: string;
  };
  room?: {
    id: string;
    room_number: string;
    type: string;
    floor: number;
  };
  room_type?: {
    id: string;
    name: string;
  };
  check_in_date: string;
  check_out_date: string;
  adults: number;
  children: number;
  total_amount: number;
  amount_paid: number;
  status: string;
  special_requests?: string;
  payment_status?: string;
}

interface Room {
  id: string;
  room_number: string;
  type: string;
  floor: number;
  status: string;
  amenities?: string[];
}

interface CheckInStep {
  id: string;
  title: string;
  icon: any;
  completed: boolean;
  current: boolean;
}

interface ModernCheckInProps {
  bookingId?: string;
  onComplete?: () => void;
  onCancel?: () => void;
}

export function ModernCheckIn({ bookingId, onComplete, onCancel }: ModernCheckInProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Booking[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Selected booking
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Room assignment
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // ID Verification
  const [idVerified, setIdVerified] = useState(false);
  const [idPhoto, setIdPhoto] = useState<string | null>(null);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mpesa' | 'prepaid'>('prepaid');
  const [paymentComplete, setPaymentComplete] = useState(false);

  // Key card
  const [keyCardIssued, setKeyCardIssued] = useState(false);

  // Communication preferences
  const [sendEmail, setSendEmail] = useState(true);
  const [sendSMS, setSendSMS] = useState(true);

  const steps: CheckInStep[] = [
    { id: 'search', title: 'Find Reservation', icon: Search, completed: !!selectedBooking, current: currentStep === 0 },
    { id: 'verify', title: 'ID Verification', icon: Shield, completed: idVerified, current: currentStep === 1 },
    { id: 'room', title: 'Room Assignment', icon: Bed, completed: !!selectedRoom, current: currentStep === 2 },
    { id: 'payment', title: 'Payment', icon: CreditCard, completed: paymentComplete, current: currentStep === 3 },
    { id: 'keycard', title: 'Key Card', icon: Key, completed: keyCardIssued, current: currentStep === 4 },
    { id: 'complete', title: 'Complete', icon: CheckCircle, completed: false, current: currentStep === 5 }
  ];

  useEffect(() => {
    if (bookingId) {
      fetchBooking(bookingId);
    }
  }, [bookingId]);

  const fetchBooking = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await bookingsAPI.getBooking(id);
      const booking = (response.data || response) as Booking;
      setSelectedBooking(booking);
      setCurrentStep(1);

      // Check if payment is already complete
      if (booking.amount_paid >= booking.total_amount) {
        setPaymentComplete(true);
        setPaymentMethod('prepaid');
      }

      // Fetch available rooms
      await fetchAvailableRooms(booking);
    } catch (error) {
      toast.error('Failed to load booking');
    } finally {
      setIsLoading(false);
    }
  };

  const searchBookings = async () => {
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    try {
      const response = await bookingsAPI.getBookings({ status: 'confirmed' });
      const bookings = response.data || response.bookings || response || [];

      const filtered = bookings.filter((b: any) => {
        const term = searchTerm.toLowerCase();
        const guestName = `${b.guest?.first_name || ''} ${b.guest?.last_name || ''}`.toLowerCase();
        const bookingNum = (b.booking_number || b.id || '').toLowerCase();
        const roomNum = (b.room?.room_number || '').toLowerCase();
        const phone = (b.guest?.phone || '').toLowerCase();

        return guestName.includes(term) ||
          bookingNum.includes(term) ||
          roomNum.includes(term) ||
          phone.includes(term);
      });

      setSearchResults(filtered);
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const fetchAvailableRooms = async (booking: Booking) => {
    try {
      const response = await roomsAPI.getRooms();
      const rooms = response.rooms || response.data || response || [];

      // Filter available rooms matching the booking's room type
      const available = rooms.filter((r: any) => {
        const isAvailable = r.status === 'available' || r.status === 'clean';
        const matchesType = !booking.room_type ||
          r.type?.id === booking.room_type?.id ||
          r.type?.name === booking.room_type?.name ||
          r.type === booking.room_type?.name;
        return isAvailable && matchesType;
      });

      setAvailableRooms(available);

      // If booking already has a room assigned, select it
      if (booking.room) {
        setSelectedRoom(booking.room as Room);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  const handleSelectBooking = async (booking: Booking) => {
    setSelectedBooking(booking);
    setCurrentStep(1);

    if (booking.amount_paid >= booking.total_amount) {
      setPaymentComplete(true);
      setPaymentMethod('prepaid');
    }

    await fetchAvailableRooms(booking);
  };

  const handleVerifyID = () => {
    // In production, this would integrate with ID scanning hardware/API
    setIdVerified(true);
    toast.success('ID verified successfully');
    setCurrentStep(2);
  };

  const handleSelectRoom = (room: Room) => {
    setSelectedRoom(room);
    toast.success(`Room ${room.room_number} selected`);
    setCurrentStep(3);
  };

  const handleProcessPayment = async () => {
    if (paymentMethod === 'prepaid' && selectedBooking && selectedBooking.amount_paid >= selectedBooking.total_amount) {
      setPaymentComplete(true);
      setCurrentStep(4);
      return;
    }

    setIsProcessing(true);
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      setPaymentComplete(true);
      toast.success('Payment processed successfully');
      setCurrentStep(4);
    } catch (error) {
      toast.error('Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleIssueKeyCard = async () => {
    setIsProcessing(true);
    try {
      // In production, this would integrate with key card system
      await new Promise(resolve => setTimeout(resolve, 1000));
      setKeyCardIssued(true);
      toast.success('Key card issued');
      setCurrentStep(5);
    } catch (error) {
      toast.error('Failed to issue key card');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompleteCheckIn = async () => {
    if (!selectedBooking || !selectedRoom) {
      toast.error('Missing required information');
      return;
    }

    setIsProcessing(true);
    try {
      // Update booking status
      await bookingsAPI.checkIn(selectedBooking.id);

      // Update room status
      await roomsAPI.updateRoom(selectedRoom.id, { status: 'occupied' });

      toast.success('Check-in completed successfully!');

      // Send notifications if enabled
      if (sendEmail) {
        // Send welcome email
        toast.success('Welcome email sent');
      }
      if (sendSMS) {
        // Send SMS with room details
        toast.success('SMS confirmation sent');
      }

      onComplete?.();
      setIsOpen(false);
      resetState();
    } catch (error: any) {
      toast.error(error.message || 'Check-in failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetState = () => {
    setCurrentStep(0);
    setSearchTerm('');
    setSearchResults([]);
    setSelectedBooking(null);
    setSelectedRoom(null);
    setIdVerified(false);
    setIdPhoto(null);
    setPaymentComplete(false);
    setKeyCardIssued(false);
  };

  const balanceDue = selectedBooking
    ? Math.max(0, selectedBooking.total_amount - selectedBooking.amount_paid)
    : 0;

  return (
    <>
      <IOSButton
        onClick={() => setIsOpen(true)}
        className="bg-[#3C3C43] hover:bg-[#000000] text-white"
      >
        <UserCheck className="h-4 w-4 mr-2" />
        Check In Guest
      </IOSButton>

      <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetState(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Digital Check-In
            </DialogTitle>
          </DialogHeader>

          {/* Progress Steps */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#F2F2F7] rounded-xl mb-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.id} className="flex items-center">
                  <div className={`flex items-center gap-2 ${step.completed ? 'text-green-600' :
                    step.current ? 'text-[#3C3C43]' : 'text-gray-400'
                    }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step.completed ? 'bg-green-100' :
                      step.current ? 'bg-[#3C3C43] text-white' : 'bg-gray-200'
                      }`}>
                      {step.completed ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <span className="text-xs font-medium hidden md:block">{step.title}</span>
                  </div>
                  {index < steps.length - 1 && (
                    <ChevronRight className="h-4 w-4 mx-2 text-gray-300" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Step Content */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              {/* Step 0: Search */}
              {currentStep === 0 && (
                <motion.div
                  key="search"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                      <Input
                        placeholder="Search by name, booking number, phone, or room..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && searchBookings()}
                        className="pl-9"
                      />
                    </div>
                    <IOSButton onClick={searchBookings} disabled={isSearching}>
                      {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                    </IOSButton>
                    <IOSButton variant="outline">
                      <QrCode className="h-4 w-4" />
                    </IOSButton>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {searchResults.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>Search for a reservation to begin check-in</p>
                      </div>
                    ) : (
                      searchResults.map(booking => (
                        <motion.div
                          key={booking.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 border rounded-xl hover:border-[#3C3C43] cursor-pointer transition-all"
                          onClick={() => handleSelectBooking(booking)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-[#F2F2F7] flex items-center justify-center">
                                {booking.guest?.is_vip ? (
                                  <Crown className="h-6 w-6 text-[#3C3C43]" />
                                ) : (
                                  <span className="font-semibold font-sf-pro-display text-[#3C3C43]">
                                    {booking.guest?.first_name?.[0]}{booking.guest?.last_name?.[0]}
                                  </span>
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold font-sf-pro-display">
                                    {booking.guest?.first_name} {booking.guest?.last_name}
                                  </h3>
                                  {booking.guest?.is_vip && (
                                    <IOSBadge className="bg-purple-100 text-purple-700">VIP</IOSBadge>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500">
                                  {booking.booking_number || booking.id.slice(0, 8)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{booking.room_type?.name || 'Standard'}</p>
                              <p className="text-sm text-gray-500">
                                {formatDate(booking.check_in_date)} - {formatDate(booking.check_out_date)}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}

              {/* Step 1: ID Verification */}
              {currentStep === 1 && selectedBooking && (
                <motion.div
                  key="verify"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <IOSCard className="p-4">
                    <h3 className="font-semibold font-sf-pro-display mb-3">Guest Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Name</p>
                        <p className="font-medium">{selectedBooking.guest?.first_name} {selectedBooking.guest?.last_name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="font-medium">{selectedBooking.guest?.email}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Phone</p>
                        <p className="font-medium">{selectedBooking.guest?.phone}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">ID Type</p>
                        <p className="font-medium">{selectedBooking.guest?.id_type || 'Not provided'}</p>
                      </div>
                    </div>
                  </IOSCard>

                  <IOSCard className="p-4">
                    <h3 className="font-semibold font-sf-pro-display mb-3">ID Verification</h3>
                    <div className="flex gap-4">
                      <IOSButton variant="outline" className="flex-1">
                        <Camera className="h-4 w-4 mr-2" /> Scan ID
                      </IOSButton>
                      <IOSButton variant="outline" className="flex-1">
                        <Fingerprint className="h-4 w-4 mr-2" /> Biometric
                      </IOSButton>
                    </div>
                    <div className="mt-4">
                      <IOSButton
                        className="w-full bg-[#3C3C43] hover:bg-[#000000]"
                        onClick={handleVerifyID}
                      >
                        <Shield className="h-4 w-4 mr-2" /> Verify & Continue
                      </IOSButton>
                    </div>
                  </IOSCard>
                </motion.div>
              )}

              {/* Step 2: Room Assignment */}
              {currentStep === 2 && (
                <motion.div
                  key="room"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <h3 className="font-semibold font-sf-pro-display">Select Room</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-80 overflow-y-auto">
                    {availableRooms.map(room => (
                      <motion.div
                        key={room.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`p-4 border rounded-xl cursor-pointer transition-all ${selectedRoom?.id === room.id
                          ? 'border-[#3C3C43] bg-[#F2F2F7]'
                          : 'hover:border-gray-300'
                          }`}
                        onClick={() => handleSelectRoom(room)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-2xl font-bold">{room.room_number}</span>
                          {selectedRoom?.id === room.id && (
                            <Check className="h-5 w-5 text-green-600" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {typeof (room as any).type === 'string' ? (room as any).type : (room as any).type?.name || 'Standard'}
                        </p>
                        <p className="text-xs text-gray-400">Floor {room.floor}</p>
                      </motion.div>
                    ))}
                  </div>
                  {availableRooms.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Bed className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No available rooms matching the booking type</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 3: Payment */}
              {currentStep === 3 && selectedBooking && (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <IOSCard className="p-4">
                    <h3 className="font-semibold font-sf-pro-display mb-3">Payment Summary</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Amount</span>
                        <span className="font-medium">KES {selectedBooking.total_amount?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Amount Paid</span>
                        <span className="font-medium text-green-600">KES {selectedBooking.amount_paid?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-semibold font-sf-pro-display">Balance Due</span>
                        <span className={`font-bold ${balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          KES {balanceDue.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </IOSCard>

                  {balanceDue > 0 && (
                    <IOSCard className="p-4">
                      <h3 className="font-semibold font-sf-pro-display mb-3">Payment Method</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { id: 'cash', label: 'Cash', icon: DollarSign },
                          { id: 'card', label: 'Card', icon: CreditCard },
                          { id: 'mpesa', label: 'M-Pesa', icon: Smartphone }
                        ].map(method => (
                          <button
                            key={method.id}
                            onClick={() => setPaymentMethod(method.id as any)}
                            className={`p-4 border rounded-xl flex items-center gap-3 transition-all ${paymentMethod === method.id
                              ? 'border-[#3C3C43] bg-[#F2F2F7]'
                              : 'hover:border-gray-300'
                              }`}
                          >
                            <method.icon className="h-5 w-5" />
                            <span className="font-medium">{method.label}</span>
                          </button>
                        ))}
                      </div>
                    </IOSCard>
                  )}

                  <IOSButton
                    className="w-full bg-[#3C3C43] hover:bg-[#000000]"
                    onClick={handleProcessPayment}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CreditCard className="h-4 w-4 mr-2" />
                    )}
                    {balanceDue > 0 ? `Process Payment (KES ${balanceDue.toLocaleString()})` : 'Continue'}
                  </IOSButton>
                </motion.div>
              )}

              {/* Step 4: Key Card */}
              {currentStep === 4 && (
                <motion.div
                  key="keycard"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <IOSCard className="p-6 text-center">
                    <div className="w-24 h-24 mx-auto mb-4 bg-[#F2F2F7] rounded-2xl flex items-center justify-center">
                      <Key className="h-12 w-12 text-[#3C3C43]" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Issue Key Card</h3>
                    <p className="text-gray-600 mb-4">
                      Room {selectedRoom?.room_number} • Floor {selectedRoom?.floor}
                    </p>
                    <IOSButton
                      className="bg-[#3C3C43] hover:bg-[#000000]"
                      onClick={handleIssueKeyCard}
                      disabled={isProcessing || keyCardIssued}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : keyCardIssued ? (
                        <Check className="h-4 w-4 mr-2" />
                      ) : (
                        <Key className="h-4 w-4 mr-2" />
                      )}
                      {keyCardIssued ? 'Key Card Issued' : 'Issue Key Card'}
                    </IOSButton>
                  </IOSCard>

                  {keyCardIssued && (
                    <IOSCard className="p-4">
                      <h3 className="font-semibold font-sf-pro-display mb-3">Guest Communication</h3>
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sendEmail}
                            onChange={(e) => setSendEmail(e.target.checked)}
                            className="w-4 h-4 rounded"
                          />
                          <Mail className="h-4 w-4 text-gray-500" />
                          <span>Send welcome email with room details</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sendSMS}
                            onChange={(e) => setSendSMS(e.target.checked)}
                            className="w-4 h-4 rounded"
                          />
                          <MessageSquare className="h-4 w-4 text-gray-500" />
                          <span>Send SMS confirmation</span>
                        </label>
                      </div>
                    </IOSCard>
                  )}
                </motion.div>
              )}

              {/* Step 5: Complete */}
              {currentStep === 5 && (
                <motion.div
                  key="complete"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                    className="w-24 h-24 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center"
                  >
                    <CheckCircle className="h-12 w-12 text-green-600" />
                  </motion.div>
                  <h2 className="text-2xl font-bold mb-2">Ready to Complete Check-In</h2>
                  <p className="text-gray-600 mb-6">
                    {selectedBooking?.guest?.first_name} {selectedBooking?.guest?.last_name} • Room {selectedRoom?.room_number}
                  </p>

                  <div className="flex flex-wrap justify-center gap-3 mb-6">
                    <IOSBadge className="bg-green-100 text-green-700">
                      <Check className="h-3 w-3 mr-1" /> ID Verified
                    </IOSBadge>
                    <IOSBadge className="bg-green-100 text-green-700">
                      <Check className="h-3 w-3 mr-1" /> Payment Complete
                    </IOSBadge>
                    <IOSBadge className="bg-green-100 text-green-700">
                      <Check className="h-3 w-3 mr-1" /> Key Card Issued
                    </IOSBadge>
                  </div>

                  <div className="flex gap-3 justify-center">
                    <IOSButton variant="outline" onClick={() => { setIsOpen(false); resetState(); }}>
                      Cancel
                    </IOSButton>
                    <IOSButton
                      className="bg-[#3C3C43] hover:bg-[#000000]"
                      onClick={handleCompleteCheckIn}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Complete Check-In
                    </IOSButton>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Navigation */}
          {currentStep > 0 && currentStep < 5 && (
            <div className="flex justify-between pt-4 border-t">
              <IOSButton variant="outline" onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}>
                Back
              </IOSButton>
              <IOSButton
                onClick={() => setCurrentStep(Math.min(5, currentStep + 1))}
                disabled={
                  (currentStep === 1 && !idVerified) ||
                  (currentStep === 2 && !selectedRoom) ||
                  (currentStep === 3 && !paymentComplete) ||
                  (currentStep === 4 && !keyCardIssued)
                }
              >
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </IOSButton>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
