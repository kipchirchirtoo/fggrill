'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  User,
  Mail,
  Phone,
  CreditCard,
  Calendar,
  Users,
  Check,
  ArrowLeft,
  Loader2,
  Bed,
  Shield,
  Clock,
  MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import { formatNumber } from '@/lib/utils';
import { API_URL } from '@/lib/config';

function BookingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    idNumber: '',
    specialRequests: ''
  });
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'paystack' | 'card'>('mpesa');
  const [isProcessing, setIsProcessing] = useState(false);
  const [roomDetails, setRoomDetails] = useState<any>(null);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string | null>(null);

  // Parse adults and children from URL params
  const adultsParam = parseInt(searchParams.get('adults') || '2');
  const childrenParam = parseInt(searchParams.get('children') || '0');

  const [bookingDetails, setBookingDetails] = useState({
    roomId: searchParams.get('roomId') || '',
    checkIn: searchParams.get('checkIn') || '',
    checkOut: searchParams.get('checkOut') || '',
    guests: adultsParam + childrenParam,
    adults: adultsParam,
    children: childrenParam
  });

  useEffect(() => {
    if (bookingDetails.roomId) {
      fetchRoomDetails();
    }
  }, [bookingDetails.roomId]);

  const fetchRoomDetails = async () => {
    try {
      const response = await fetch(`${API_URL}/api/rooms/${bookingDetails.roomId}`);
      const data = await response.json();
      if (data.success) {
        const room = data.data;
        // Extract and store room type ID
        const roomTypeId = room.type_id || room.room_type_id || room.type?.id;
        setSelectedRoomTypeId(roomTypeId);

        // Map snake_case to camelCase
        const basePrice = room.price_override || room.type?.base_price || 0;
        const inclusivePrice = Math.round(basePrice * 1.26);

        setRoomDetails({
          ...room,
          roomNumber: room.room_number,
          basePrice: basePrice,
          pricePerNight: inclusivePrice,
          type: room.type?.name || 'Standard'
        });
      }
    } catch (error) {
      console.error('Error fetching room details:', error);
    }
  };

  const calculateNights = () => {
    if (!bookingDetails.checkIn || !bookingDetails.checkOut) return 0;
    const checkIn = new Date(bookingDetails.checkIn);
    const checkOut = new Date(bookingDetails.checkOut);
    const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const calculateTotal = () => {
    if (!roomDetails) return 0;
    return roomDetails.pricePerNight * calculateNights();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!bookingDetails.roomId || bookingDetails.roomId.trim() === '') {
      toast.error('Room selection is required');
      return;
    }

    if (!bookingDetails.checkIn || !bookingDetails.checkOut) {
      toast.error('Check-in and check-out dates are required');
      return;
    }

    setIsProcessing(true);

    try {
      // Create booking
      const bookingResponse = await fetch(`${API_URL}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roomId: bookingDetails.roomId.trim(),
          roomTypeId: selectedRoomTypeId,
          checkInDate: bookingDetails.checkIn,
          checkOutDate: bookingDetails.checkOut,
          adults: bookingDetails.guests,
          children: 0,
          guestId: null,
          specialRequests: formData.specialRequests,
          guestInfo: formData
        })
      });

      const bookingData = await bookingResponse.json();

      if (!bookingData.success) {
        throw new Error(bookingData.message || 'Failed to create booking');
      }

      // Initiate payment
      const paymentResponse = await fetch(`${API_URL}/api/payments/booking/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          bookingId: bookingData.data.bookingId || bookingData.data.booking?.id,
          phoneNumber: formData.phone,
          email: formData.email,
          amount: calculateTotal(),
          paymentMethod
        })
      });

      const paymentData = await paymentResponse.json();

      if (paymentData.success) {
        toast.success('Booking created! Please complete payment.');

        if (paymentMethod === 'mpesa') {
          toast.info('Please check your phone for the M-Pesa payment prompt');

          // Poll for payment status
          const paymentId = paymentData.data.paymentId;
          const pollPaymentStatus = async () => {
            try {
              const statusResponse = await fetch(`${API_URL}/api/payments/status/${paymentId}`);
              const statusData = await statusResponse.json();

              if (statusData.success) {
                if (statusData.data.status === 'completed') {
                  toast.success('Payment completed successfully!');
                  const confirmationNumber = bookingData.data.confirmationNumber || bookingData.data.booking?.confirmation_number;
                  router.push(`/booking/confirmation?confirmationNumber=${confirmationNumber}&email=${encodeURIComponent(formData.email)}`);
                  return;
                } else if (statusData.data.status === 'failed') {
                  toast.error('Payment failed. Please try again.');
                  return;
                }
              }

              // Continue polling if still pending
              setTimeout(pollPaymentStatus, 3000);
            } catch (error) {
              console.error('Error checking payment status:', error);
            }
          };

          // Start polling after 5 seconds
          setTimeout(pollPaymentStatus, 5000);

        } else if (paymentMethod === 'paystack') {
          // Redirect to Paystack payment page
          if (paymentData.data.authorization_url) {
            window.location.href = paymentData.data.authorization_url;
            return;
          } else {
            throw new Error('No authorization URL received from Paystack');
          }
        } else if (paymentMethod === 'pay_at_hotel') {
          toast.success('Booking confirmed! We look forward to seeing you.');
          const confirmationNumber = bookingData.data.confirmationNumber || bookingData.data.booking?.confirmation_number;
          const bookingId = bookingData.data.bookingId || bookingData.data.booking?.id;
          router.push(`/booking/confirmation?confirmationNumber=${confirmationNumber || ''}&bookingId=${bookingId || ''}&email=${encodeURIComponent(formData.email)}`);
          return;
        }

        // For other payment methods or if no redirect needed
        setTimeout(() => {
          const bookingId = bookingData.data.bookingId || bookingData.data.booking?.id;
          const confirmationNumber = bookingData.data.confirmationNumber || bookingData.data.booking?.confirmation_number;
          router.push(`/booking/confirmation?bookingId=${bookingId || ''}&confirmationNumber=${confirmationNumber || ''}`);
        }, 2000);
      } else {
        throw new Error(paymentData.message || 'Failed to initiate payment');
      }
    } catch (error: any) {
      console.error('Booking error:', error);
      toast.error(error.message || 'Failed to process booking');
    } finally {
      setIsProcessing(false);
    }
  };

  const nights = calculateNights();
  const total = calculateTotal();

  // Format date for display
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Minimal Header */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-stone-100 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-stone-600" />
            </button>
            <div className="flex items-center gap-3">
              <Image
                src="/fglogo.png"
                alt="Famous Gate Hotel"
                width={36}
                height={36}
                className="object-contain"
                style={{ width: 'auto', height: 'auto' }}
              />
              <div>
                <h1 className="text-lg font-semibold text-stone-900">Complete Booking</h1>
                <p className="text-xs text-stone-500">Famous Gate Hotel</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Main Form Section */}
          <div className="flex-1 order-2 lg:order-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Guest Information Card */}
              <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-stone-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-stone-900">Guest Details</h2>
                    <p className="text-sm text-stone-500">Please provide your information</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1.5">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all"
                        placeholder="John"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1.5">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all"
                        placeholder="Doe"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1.5">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all"
                          placeholder="john@example.com"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1.5">
                        Phone <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          placeholder="+254 712 345 678"
                          className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      ID / Passport Number
                    </label>
                    <input
                      type="text"
                      name="idNumber"
                      value={formData.idNumber}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all"
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      Special Requests
                    </label>
                    <textarea
                      name="specialRequests"
                      value={formData.specialRequests}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder-stone-400 focus:ring-2 focus:ring-stone-900 focus:border-transparent transition-all resize-none"
                      placeholder="Early check-in, extra pillows, etc..."
                    />
                  </div>
                </form>
              </div>

              {/* Payment Method Card */}
              <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-stone-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-stone-900">Payment Method</h2>
                    <p className="text-sm text-stone-500">Choose how you'd like to pay</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'mpesa', label: 'M-Pesa', desc: 'Mobile money' },
                    { id: 'paystack', label: 'Paystack', desc: 'Card payment' },
                    { id: 'card', label: 'Pay at Hotel', desc: 'Cash or card' }
                  ].map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setPaymentMethod(method.id as any)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${paymentMethod === method.id
                        ? 'border-stone-900 bg-stone-50'
                        : 'border-stone-200 hover:border-stone-300'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-stone-900">{method.label}</p>
                          <p className="text-xs text-stone-500">{method.desc}</p>
                        </div>
                        {paymentMethod === method.id && (
                          <div className="w-5 h-5 rounded-full bg-stone-900 flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Security Note */}
                <div className="mt-6 flex items-start gap-3 p-4 bg-stone-50 rounded-xl">
                  <Shield className="w-5 h-5 text-stone-500 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-stone-700">Secure Payment</p>
                    <p className="text-xs text-stone-500">Your payment information is encrypted and secure</p>
                  </div>
                </div>
              </div>

              {/* Submit Button - Mobile */}
              <div className="lg:hidden">
                <button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={isProcessing}
                  className="w-full px-6 py-4 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Confirm & Pay KES {formatNumber(total)}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>

          {/* Sticky Booking Summary */}
          <div className="w-full lg:w-[380px] order-1 lg:order-2">
            <div className="lg:sticky lg:top-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-2xl border border-stone-200 overflow-hidden"
              >
                {/* Room Header */}
                <div className="p-6 bg-gradient-to-br from-stone-900 to-stone-800 text-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-stone-400 text-xs font-medium uppercase tracking-wider mb-1">Your Stay</p>
                      <h3 className="text-xl font-semibold">
                        {roomDetails ? (typeof roomDetails.type === 'string' ? roomDetails.type : roomDetails.type?.name || 'Standard') : 'Loading...'}
                      </h3>
                      {roomDetails && (
                        <p className="text-stone-300 text-sm mt-1 flex items-center gap-1.5">
                          <Bed className="w-4 h-4" />
                          Room {roomDetails.roomNumber}
                        </p>
                      )}
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>

                {/* Booking Details */}
                <div className="p-6 space-y-4">
                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-stone-50 rounded-xl">
                      <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Check-in</p>
                      <p className="text-sm font-semibold text-stone-900">{formatDate(bookingDetails.checkIn)}</p>
                      <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> From 2:00 PM
                      </p>
                    </div>
                    <div className="p-3 bg-stone-50 rounded-xl">
                      <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Check-out</p>
                      <p className="text-sm font-semibold text-stone-900">{formatDate(bookingDetails.checkOut)}</p>
                      <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> By 11:00 AM
                      </p>
                    </div>
                  </div>

                  {/* Guests */}
                  <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-stone-500" />
                      <span className="text-sm font-medium text-stone-700">Guests</span>
                    </div>
                    <span className="text-sm font-semibold text-stone-900">
                      {bookingDetails.adults} Adult{bookingDetails.adults !== 1 ? 's' : ''}
                      {bookingDetails.children > 0 && `, ${bookingDetails.children} Child${bookingDetails.children !== 1 ? 'ren' : ''}`}
                    </span>
                  </div>

                  {/* Price Breakdown */}
                  <div className="pt-4 border-t border-stone-200 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-600">
                        Room Rate ({nights} night{nights !== 1 ? 's' : ''})
                      </span>
                      <span className="font-medium text-stone-900">
                        KES {formatNumber((roomDetails?.basePrice || 0) * nights)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-600">VAT (16%)</span>
                      <span className="font-medium text-stone-900">
                        KES {formatNumber(Math.round((roomDetails?.basePrice || 0) * nights * 0.16))}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-600">Service Charge (10%)</span>
                      <span className="font-medium text-stone-900">
                        KES {formatNumber(Math.round((roomDetails?.basePrice || 0) * nights * 0.10))}
                      </span>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="pt-4 border-t border-stone-200">
                    <div className="flex justify-between items-center">
                      <span className="text-base font-semibold text-stone-900">Total</span>
                      <span className="text-2xl font-bold text-stone-900">
                        KES {formatNumber(total)}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1 text-right">VAT inclusive</p>
                  </div>

                  {/* Submit Button - Desktop */}
                  <div className="hidden lg:block pt-2">
                    <button
                      type="submit"
                      onClick={handleSubmit}
                      disabled={isProcessing}
                      className="w-full px-6 py-4 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Confirm & Pay
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Trust Badges */}
              <div className="mt-4 flex items-center justify-center gap-6 text-xs text-stone-500">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4" />
                  <span>Secure</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  <span>Instant Confirmation</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-900" />
      </div>
    }>
      <BookingContent />
    </Suspense>
  );
}
