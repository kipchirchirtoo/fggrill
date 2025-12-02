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
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

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
  const [bookingDetails, setBookingDetails] = useState({
    roomId: searchParams.get('roomId') || '',
    checkIn: searchParams.get('checkIn') || '',
    checkOut: searchParams.get('checkOut') || '',
    guests: parseInt(searchParams.get('guests') || '1')
  });

  useEffect(() => {
    if (bookingDetails.roomId) {
      fetchRoomDetails();
    }
  }, [bookingDetails.roomId]);

  const fetchRoomDetails = async () => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/rooms/${bookingDetails.roomId}`);
      const data = await response.json();
      if (data.success) {
        setRoomDetails(data.data);
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

    setIsProcessing(true);

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      
      // Create booking
      const bookingResponse = await fetch(`${API_URL}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          roomId: bookingDetails.roomId,
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
          bookingId: bookingData.data.id,
          phoneNumber: formData.phone,
          amount: calculateTotal(),
          paymentMethod
        })
      });

      const paymentData = await paymentResponse.json();

      if (paymentData.success) {
        toast.success('Booking created! Please complete payment.');
        
        if (paymentMethod === 'mpesa') {
          toast.info('Please check your phone for the M-Pesa payment prompt');
        } else if (paymentMethod === 'paystack') {
          // Redirect to Paystack payment page
          window.location.href = paymentData.data.authorization_url;
          return;
        }

        // Redirect to confirmation page
        setTimeout(() => {
          router.push(`/booking/confirmation?bookingId=${bookingData.data.id}`);
        }, 2000);
      } else {
        throw new Error('Failed to initiate payment');
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="p-2 hover:bg-gray-100 rounded-ios-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <Image
                src="/fglogo.png"
                alt="Famous Gate Hotel"
                width={40}
                height={40}
                className="object-contain"
                style={{ width: 'auto', height: 'auto' }}
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Complete Your Booking</h1>
                <p className="text-sm text-gray-600">Famous Gate Hotel</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Booking Form */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-8"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Guest Information</h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <User className="inline w-4 h-4 mr-2" />
                      First Name *
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-ios-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <User className="inline w-4 h-4 mr-2" />
                      Last Name *
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-ios-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Mail className="inline w-4 h-4 mr-2" />
                      Email Address *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-ios-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Phone className="inline w-4 h-4 mr-2" />
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+254..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-ios-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ID Number
                  </label>
                  <input
                    type="text"
                    name="idNumber"
                    value={formData.idNumber}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-ios-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Special Requests
                  </label>
                  <textarea
                    name="specialRequests"
                    value={formData.specialRequests}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-ios-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    placeholder="Any special requests or requirements..."
                  />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Payment Method</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('mpesa')}
                      className={`p-4 border-2 rounded-ios-lg transition-colors ${
                        paymentMethod === 'mpesa'
                          ? 'border-gray-900 bg-gray-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">M-Pesa</span>
                        {paymentMethod === 'mpesa' && <Check className="w-5 h-5 text-gray-900" />}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('paystack')}
                      className={`p-4 border-2 rounded-ios-lg transition-colors ${
                        paymentMethod === 'paystack'
                          ? 'border-gray-900 bg-gray-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Paystack</span>
                        {paymentMethod === 'paystack' && <Check className="w-5 h-5 text-gray-900" />}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`p-4 border-2 rounded-ios-lg transition-colors ${
                        paymentMethod === 'card'
                          ? 'border-gray-900 bg-gray-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Card</span>
                        {paymentMethod === 'card' && <Check className="w-5 h-5 text-gray-900" />}
                      </div>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full px-6 py-4 bg-gray-900 text-white rounded-ios-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      Confirm & Pay KES {total.toLocaleString()}
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>

          {/* Booking Summary */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-4"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-6">Booking Summary</h3>
              
              {roomDetails && (
                <div className="space-y-4">
                  <div className="pb-4 border-b border-gray-200">
                    <h4 className="font-bold text-gray-900">{roomDetails.type}</h4>
                    <p className="text-sm text-gray-600">Room {roomDetails.roomNumber}</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="w-4 h-4 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-700">Check-in</p>
                        <p className="text-gray-600">{bookingDetails.checkIn}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="w-4 h-4 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-700">Check-out</p>
                        <p className="text-gray-600">{bookingDetails.checkOut}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <Users className="w-4 h-4 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-700">Guests</p>
                        <p className="text-gray-600">{bookingDetails.guests}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        KES {roomDetails.pricePerNight.toLocaleString()} × {nights} nights
                      </span>
                      <span className="font-medium text-gray-900">
                        KES {(roomDetails.pricePerNight * nights).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-900">Total</span>
                      <span className="text-2xl font-bold text-gray-900">
                        KES {total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
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
