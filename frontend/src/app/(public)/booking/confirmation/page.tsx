'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  Calendar,
  Users,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  ArrowLeft,
  Download,
  Share2,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { formatNumber } from '@/lib/utils';
import { bookingsAPI } from '@/lib/api';
import { API_URL } from '@/lib/config';

function ConfirmationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const confirmationNumber = searchParams.get('confirmationNumber');
  const email = searchParams.get('email');

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (confirmationNumber && email) {
      fetchBookingDetails();
    } else if (bookingId) {
      // Fallback for existing links or internal navigation if logged in (though this might fail if not authenticated, keeping for compatibility)
      // Better to try redirect or handle differently, but let's try the new method primarily.
      // Actually, let's just use the new method if available, else try ID but expect 401 if not logged in.
      // Given the user issue, we should prioritize the confirmation number flow.
      fetchBookingById();
    } else {
      setError('No booking information provided');
      setLoading(false);
    }
  }, [bookingId, confirmationNumber, email]);

  const fetchBookingDetails = async () => {
    try {
      if (!confirmationNumber || !email) return;
      const response = await bookingsAPI.getBookingByConfirmation(confirmationNumber, email);
      const data = response.data || response;

      setBooking(data);
    } catch (error: any) {
      console.error('Error fetching booking:', error);
      setError(error.message || 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const fetchBookingById = async () => {
    try {
      const response = await fetch(`${API_URL}/api/bookings/${bookingId}`);
      const data = await response.json();

      if (data.success) {
        setBooking(data.data);
      } else {
        // Try to ask user for email if we only have ID? 
        // Or just show error.
        setError(data.message || 'Failed to fetch booking details');
      }
    } catch (error) {
      console.error('Error fetching booking:', error);
      setError('Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto mb-4" />
          <p className="text-stone-600">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-stone-900 mb-2">Booking Not Found</h1>
          <p className="text-stone-600 mb-6">{error || 'The booking you are looking for could not be found.'}</p>
          <button
            onClick={() => router.push('/')}
            className="bg-amber-500 text-white px-6 py-3 rounded-xl hover:bg-amber-600 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-stone-100 rounded-xl transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-stone-600" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-stone-900">Booking Confirmation</h1>
              <p className="text-sm text-stone-500">Confirmation #{booking.confirmationNumber}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Success Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-8 mb-8 text-center border border-stone-200"
        >
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-stone-900 mb-2">Booking Confirmed!</h2>
          <p className="text-stone-600 mb-6">
            Your reservation has been successfully created. A confirmation email has been sent to your email address.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-700 rounded-xl hover:bg-stone-200 transition-colors">
              <Download className="h-4 w-4" />
              Download Receipt
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-stone-100 text-stone-700 rounded-xl hover:bg-stone-200 transition-colors">
              <Share2 className="h-4 w-4" />
              Share Booking
            </button>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Booking Details */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 border border-stone-200"
          >
            <h3 className="text-lg font-semibold text-stone-900 mb-6">Booking Details</h3>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-stone-900">Check-in</p>
                  <p className="text-stone-600">{formatDate(booking.checkInDate)}</p>
                  <p className="text-sm text-stone-500">After 3:00 PM</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-stone-900">Check-out</p>
                  <p className="text-stone-600">{formatDate(booking.checkOutDate)}</p>
                  <p className="text-sm text-stone-500">Before 11:00 AM</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-stone-900">Guests</p>
                  <p className="text-stone-600">
                    {booking.adults} Adult{booking.adults !== 1 ? 's' : ''}
                    {booking.children > 0 && `, ${booking.children} Child${booking.children !== 1 ? 'ren' : ''}`}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-stone-900">Room</p>
                  <p className="text-stone-600">Room {booking.roomId}</p>
                  <p className="text-sm text-stone-500">Standard Room</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Payment Summary */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-6 border border-stone-200"
          >
            <h3 className="text-lg font-semibold text-stone-900 mb-6">Payment Summary</h3>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-stone-600">Room Rate</span>
                <span className="text-stone-900">KES {formatNumber(booking.roomRate)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-stone-600">Subtotal</span>
                <span className="text-stone-900">KES {formatNumber(booking.subtotal)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-stone-600">Tax (16%)</span>
                <span className="text-stone-900">KES {formatNumber(booking.taxAmount)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-stone-600">Service Charge (10%)</span>
                <span className="text-stone-900">KES {formatNumber(booking.serviceCharge)}</span>
              </div>

              {booking.discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-KES {formatNumber(booking.discountAmount)}</span>
                </div>
              )}

              <div className="border-t border-stone-200 pt-3">
                <div className="flex justify-between text-lg font-semibold">
                  <span className="text-stone-900">Total Amount</span>
                  <span className="text-stone-900">KES {formatNumber(booking.totalAmount)}</span>
                </div>
              </div>

              <div className="mt-4 p-3 bg-green-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">Payment Status</span>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  {booking.depositPaid ? 'Paid' : 'Pending'}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Contact Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-6 border border-stone-200 mt-8"
        >
          <h3 className="text-lg font-semibold text-stone-900 mb-6">Need Help?</h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium text-stone-900">Call Us</p>
                <p className="text-stone-600">+254 700 000 000</p>
                <p className="text-sm text-stone-500">Available 24/7</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium text-stone-900">Email Us</p>
                <p className="text-stone-600">reservations@fggrill.com</p>
                <p className="text-sm text-stone-500">We'll respond within 24 hours</p>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export default function BookingConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  );
}
