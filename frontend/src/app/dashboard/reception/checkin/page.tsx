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
import { bookingsAPI, roomsAPI, guestAPI } from '@/lib/api';
import {
  LogIn, LogOut, Search, RefreshCw, Calendar, Clock, User, Bed,
  CheckCircle, XCircle, AlertTriangle, Phone, Mail, CreditCard,
  FileText, DollarSign, Users, Building2, ArrowRight, Printer
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Booking {
  id: string;
  room_id: string;
  room_number: string;
  room_type: string;
  guest_id: string;
  guest_name: string;
  guest_phone: string;
  guest_email?: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  meal_plan: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  total_amount: number;
  amount_paid: number;
  special_requests?: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-[#3C3C43]', bgColor: 'bg-[#F2F2F7]' },
  confirmed: { label: 'Confirmed', color: 'text-[#3C3C43]', bgColor: 'bg-[#F2F2F7]' },
  checked_in: { label: 'Checked In', color: 'text-[#3C3C43]', bgColor: 'bg-[#F2F2F7]' },
  checked_out: { label: 'Checked Out', color: 'text-[#3C3C43]', bgColor: 'bg-[#F2F2F7]' },
  cancelled: { label: 'Cancelled', color: 'text-[#3C3C43]', bgColor: 'bg-[#F2F2F7]' },
};

// Check-In Modal
function CheckInModal({
  isOpen,
  onClose,
  booking,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');

  useEffect(() => {
    if (booking) {
      setPaymentAmount(booking.total_amount - booking.amount_paid);
    }
  }, [booking]);

  if (!booking) return null;

  const balance = booking.total_amount - booking.amount_paid;

  const handleCheckIn = async () => {
    setIsSubmitting(true);
    try {
      await bookingsAPI.checkIn(booking.id);
      await roomsAPI.updateRoomStatus(booking.room_id, 'occupied');
      toast.success(`Guest checked in to Room ${booking.room_number}`);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to check in');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5 text-[#3C3C43]" />
            Check-In Guest
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Booking Summary */}
          <div className="p-4 bg-[#F2F2F7] rounded-ios-lg border border-[rgba(60,60,67,0.12)]">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-lg text-[#000000]">{booking.guest_name}</p>
                <p className="text-sm text-[#3C3C43]">{booking.guest_phone}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-[#000000]">Room {booking.room_number}</p>
                <p className="text-sm text-[#3C3C43] capitalize">{booking.room_type}</p>
              </div>
            </div>
          </div>

          {/* Stay Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-ios-lg">
              <p className="text-xs text-gray-500">Check-In</p>
              <p className="font-medium">{new Date(booking.check_in).toLocaleDateString()}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-ios-lg">
              <p className="text-xs text-gray-500">Check-Out</p>
              <p className="font-medium">{new Date(booking.check_out).toLocaleDateString()}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-ios-lg">
              <p className="text-xs text-gray-500">Guests</p>
              <p className="font-medium">{booking.adults} Adults, {booking.children} Children</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-ios-lg">
              <p className="text-xs text-gray-500">Meal Plan</p>
              <p className="font-medium capitalize">{booking.meal_plan?.replace('_', ' ')}</p>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="p-4 bg-gray-50 rounded-ios-lg space-y-2">
            <div className="flex justify-between">
              <span>Total Amount</span>
              <span className="font-medium">KES {booking.total_amount?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[#3C3C43]">
              <span>Amount Paid</span>
              <span className="font-medium">KES {booking.amount_paid?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Balance Due</span>
              <span className="text-[#3C3C43]">
                KES {balance.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Special Requests */}
          {booking.special_requests && (
            <div className="p-3 bg-[#F2F2F7] rounded-ios-lg border border-[rgba(60,60,67,0.12)]">
              <p className="text-sm font-medium text-[#3C3C43]">Special Requests</p>
              <p className="text-sm text-[#3C3C43]">{booking.special_requests}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <IOSButton variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </IOSButton>
            <IOSButton
              onClick={handleCheckIn}
              disabled={isSubmitting}
              className="flex-1 bg-[#3C3C43] hover:bg-[#000000] text-white"
            >
              {isSubmitting ? 'Processing...' : 'Complete Check-In'}
            </IOSButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Check-Out Modal
function CheckOutModal({
  isOpen,
  onClose,
  booking,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onSuccess: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [additionalCharges, setAdditionalCharges] = useState(0);

  const [isPrinting, setIsPrinting] = useState(false);

  if (!booking) return null;

  const balance = booking.total_amount - booking.amount_paid + additionalCharges;

  const handlePrintBill = async () => {
    setIsPrinting(true);
    try {
      const response = await fetch('http://localhost:5001/api/reports/generate/checkout-bill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          guest_name: booking.guest_name,
          guest_phone: booking.guest_phone,
          room_number: booking.room_number,
          nights: Math.ceil((new Date().getTime() - new Date(booking.check_in).getTime()) / (1000 * 60 * 60 * 24)),
          room_charges: booking.total_amount,
          additional_charges: additionalCharges,
          amount_paid: booking.amount_paid,
          balance: balance
        }),
      });

      if (!response.ok) throw new Error('Failed to generate bill');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bill_${booking.guest_name.replace(' ', '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Bill generated successfully');
    } catch (error) {
      console.error('Error printing bill:', error);
      toast.error('Failed to generate bill');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleCheckOut = async () => {
    if (balance > 0) {
      if (!confirm(`Guest has outstanding balance of KES ${balance.toLocaleString()}. Proceed with checkout?`)) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // 1. Perform ML-based Anomaly Detection
      const anomalyResponse = await fetch('http://localhost:5001/api/finance/verify-anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: booking.total_amount,
          currency: 'KES',
          payment_method: 'mixed',
          guest_history: { total_stays: 1 }, // Placeholder, ideally from booking data
          recent_transactions_count: 1
        })
      });

      if (anomalyResponse.ok) {
        const anomalyResult = await anomalyResponse.json();
        if (anomalyResult.data && anomalyResult.data.is_high_risk) {
          const proceed = confirm(
            `⚠️ SECURITY WARNING: High Risk Detected!\n\n` +
            `Risk Score: ${anomalyResult.data.risk_score}/100\n` +
            `Factors: ${anomalyResult.data.risk_factors.join(', ')}\n\n` +
            `Do you want to proceed with checkout anyway?`
          );
          if (!proceed) {
            setIsSubmitting(false);
            return;
          }
        }
      }

      // 2. Proceed with Checkout
      await bookingsAPI.checkOut(booking.id);
      await roomsAPI.updateRoomStatus(booking.room_id, 'cleaning');
      toast.success(`Guest checked out from Room ${booking.room_number}`);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to check out');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5 text-[#3C3C43]" />
            Check-Out Guest
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Guest Info */}
          <div className="p-4 bg-[#F2F2F7] rounded-ios-lg border border-[rgba(60,60,67,0.12)]">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-lg text-[#000000]">{booking.guest_name}</p>
                <p className="text-sm text-[#3C3C43]">{booking.guest_phone}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-[#000000]">Room {booking.room_number}</p>
                <p className="text-sm text-[#3C3C43]">
                  {Math.ceil((new Date().getTime() - new Date(booking.check_in).getTime()) / (1000 * 60 * 60 * 24))} nights
                </p>
              </div>
            </div>
          </div>

          {/* Final Bill */}
          <div className="p-4 bg-gray-50 rounded-ios-lg space-y-2">
            <div className="flex justify-between">
              <span>Room Charges</span>
              <span className="font-medium">KES {booking.total_amount?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Additional Charges</span>
              <Input
                type="number"
                value={additionalCharges}
                onChange={(e) => setAdditionalCharges(Number(e.target.value))}
                className="w-32 text-right"
              />
            </div>
            <div className="flex justify-between text-[#3C3C43]">
              <span>Amount Paid</span>
              <span className="font-medium">-KES {booking.amount_paid?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xl font-bold border-t pt-2">
              <span>Balance</span>
              <span className="text-[#3C3C43]">
                KES {balance.toLocaleString()}
              </span>
            </div>
          </div>

          {balance > 0 && (
            <div className="p-3 bg-[#F2F2F7] rounded-ios-lg border border-[rgba(60,60,67,0.12)] flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[#3C3C43]" />
              <p className="text-sm text-[#3C3C43]">Outstanding balance must be settled</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <IOSButton variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </IOSButton>
            <IOSButton
              variant="outline"
              className="flex-1"
              leftIcon={<Printer />}
              onClick={handlePrintBill}
              disabled={isPrinting}
            >
              {isPrinting ? 'Printing...' : 'Print Bill'}
            </IOSButton>
            <IOSButton
              onClick={handleCheckOut}
              disabled={isSubmitting}
              className="flex-1 bg-[#3C3C43] hover:bg-[#000000] text-white"
            >
              {isSubmitting ? 'Processing...' : 'Check Out'}
            </IOSButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CheckInPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'checkin' | 'checkout'>('checkin');

  // Modals
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [checkOutModalOpen, setCheckOutModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await bookingsAPI.getBookings({ branch_id: user?.branch_id });
      if (response.success) {
        setBookings(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setIsLoading(false);
    }
  }, [user?.branch_id]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const today = new Date().toISOString().split('T')[0];

  // Filter bookings by tab
  const filteredBookings = bookings.filter((booking) => {
    const matchesSearch =
      booking.guest_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.room_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.guest_phone?.includes(searchQuery);

    if (!matchesSearch) return false;

    const checkInDate = booking.check_in?.split('T')[0];

    switch (activeTab) {
      case 'checkin':
        // Show confirmed/pending bookings for today that haven't checked in
        return checkInDate === today && (booking.status === 'confirmed' || booking.status === 'pending');
      case 'checkout':
        // Show all currently checked-in guests
        return booking.status === 'checked_in';
      default:
        return true;
    }
  });

  // Stats
  const stats = {
    arrivals: bookings.filter(b => b.check_in?.split('T')[0] === today && (b.status === 'confirmed' || b.status === 'pending')).length,
    inhouse: bookings.filter(b => b.status === 'checked_in').length,
  };

  const openCheckIn = (booking: Booking) => {
    setSelectedBooking(booking);
    setCheckInModalOpen(true);
  };

  const openCheckOut = (booking: Booking) => {
    setSelectedBooking(booking);
    setCheckOutModalOpen(true);
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Check-In / Check-Out</h1>
              <p className="text-gray-500">Manage guest arrivals and departures</p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="outline" onClick={fetchBookings} leftIcon={<RefreshCw />} className="border-[rgba(60,60,67,0.12)] text-[#3C3C43] hover:bg-[#F2F2F7]">
                Refresh
              </IOSButton>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="border-b border-gray-200">
            <div className="flex gap-8">
              <button
                onClick={() => setActiveTab('checkin')}
                className={`pb-4 px-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'checkin'
                  ? 'border-[#3C3C43] text-[#3C3C43]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Check-In
                </div>
              </button>
              <button
                onClick={() => setActiveTab('checkout')}
                className={`pb-4 px-2 font-medium text-sm border-b-2 transition-colors ${activeTab === 'checkout'
                  ? 'border-[#3C3C43] text-[#3C3C43]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  Check-Out
                </div>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <IOSCard className="p-4 border-none shadow-sm bg-white">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 rounded-xl">
                  <LogIn className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Today's Arrivals</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.arrivals}</p>
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-4 border-none shadow-sm bg-white">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-50 rounded-xl">
                  <Users className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">In-House Guests</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.inhouse}</p>
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Search */}
          <IOSCard className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
              <Input
                placeholder="Search by guest name, room, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </IOSCard>

          {/* Bookings List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredBookings.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">
                {activeTab === 'checkin' && 'No arrivals scheduled for today'}
                {activeTab === 'checkout' && 'No guests currently in-house'}
              </p>
            </IOSCard>
          ) : (
            <div className="space-y-4">
              {filteredBookings.map((booking) => {
                const statusInfo = statusConfig[booking.status] || statusConfig.pending;
                const nights = Math.ceil(
                  (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / (1000 * 60 * 60 * 24)
                );

                return (
                  <IOSCard key={booking.id} className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Guest & Room Info */}
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-[#3C3C43] flex items-center justify-center text-white font-bold">
                          {(booking.guest_name || 'GU').split(' ').map(n => n?.[0] || '').join('').slice(0, 2) || 'GU'}
                        </div>
                        <div>
                          <p className="font-bold text-lg">{booking.guest_name}</p>
                          <div className="flex gap-3 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {booking.guest_phone}
                            </span>
                            <span className="flex items-center gap-1">
                              <Bed className="h-3 w-3" /> Room {booking.room_number}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Stay Details */}
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <p className="text-gray-500">Check-In</p>
                          <p className="font-medium">{new Date(booking.check_in).toLocaleDateString()}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                        <div className="text-center">
                          <p className="text-gray-500">Check-Out</p>
                          <p className="font-medium">{new Date(booking.check_out).toLocaleDateString()}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500">Nights</p>
                          <p className="font-medium">{nights}</p>
                        </div>
                      </div>

                      {/* Status & Actions */}
                      <div className="flex items-center gap-3">
                        <IOSBadge className={`${statusInfo.bgColor} ${statusInfo.color}`}>
                          {statusInfo.label}
                        </IOSBadge>

                        {activeTab === 'checkin' && (
                          <IOSButton
                            onClick={() => openCheckIn(booking)}
                            className="bg-[#3C3C43] hover:bg-[#000000] text-white"
                            leftIcon={<LogIn />}
                          >
                            Check In
                          </IOSButton>
                        )}

                        {activeTab === 'checkout' && (
                          <IOSButton
                            onClick={() => openCheckOut(booking)}
                            className="bg-[#3C3C43] hover:bg-[#000000] text-white"
                            leftIcon={<LogOut />}
                          >
                            Check Out
                          </IOSButton>
                        )}
                      </div>
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>

        {/* Modals */}
        <CheckInModal
          isOpen={checkInModalOpen}
          onClose={() => setCheckInModalOpen(false)}
          booking={selectedBooking}
          onSuccess={fetchBookings}
        />
        <CheckOutModal
          isOpen={checkOutModalOpen}
          onClose={() => setCheckOutModalOpen(false)}
          booking={selectedBooking}
          onSuccess={fetchBookings}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
