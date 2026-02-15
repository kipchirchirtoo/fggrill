'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { bookingsAPI } from '@/lib/api';
import { ArrowLeft, Calendar, User, Bed, Clock, CheckSquare, LogOut, X } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';

interface ReservationDetailPageProps {
  params: {
    id: string;
  };
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: 'Confirmed', color: 'text-green-700', bg: 'bg-green-100' },
  pending: { label: 'Pending', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  checked_in: { label: 'Checked In', color: 'text-blue-700', bg: 'bg-blue-100' },
  checked_out: { label: 'Checked Out', color: 'text-gray-700', bg: 'bg-gray-100' },
  cancelled: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-100' },
};

export default function ReservationDetailPage({ params }: ReservationDetailPageProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentBranchId = activeBranchId || user?.branch_id;
  const { id } = params;

  useEffect(() => {
    async function fetchBookingDetails() {
      if (!id) return;
      
      setIsLoading(true);
      try {
        const response = await bookingsAPI.getBooking(id);
        if (response.success) {
          setBooking(response.data);
        } else {
          toast.error('Failed to load reservation details');
          router.push('/dashboard/branch-manager/reservations');
        }
      } catch (error) {
        console.error('Error fetching booking details:', error);
        toast.error('Failed to load reservation details');
        router.push('/dashboard/branch-manager/reservations');
      } finally {
        setIsLoading(false);
      }
    }

    fetchBookingDetails();
  }, [id, router]);

  const handleCheckIn = async () => {
    setIsProcessing(true);
    try {
      const response = await bookingsAPI.checkIn(id);
      if (response.success) {
        toast.success('Guest checked in successfully');
        // Refresh booking data
        const updatedBooking = await bookingsAPI.getBooking(id);
        if (updatedBooking.success) {
          setBooking(updatedBooking.data);
        }
      } else {
        toast.error(response.message || 'Failed to check in');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to check in guest');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckOut = async () => {
    setIsProcessing(true);
    try {
      const response = await bookingsAPI.checkOut(id);
      if (response.success) {
        toast.success('Guest checked out successfully');
        // Refresh booking data
        const updatedBooking = await bookingsAPI.getBooking(id);
        if (updatedBooking.success) {
          setBooking(updatedBooking.data);
        }
      } else {
        toast.error(response.message || 'Failed to check out');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to check out guest');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    setIsProcessing(true);
    try {
      const response = await bookingsAPI.cancelBooking(id);
      if (response.success) {
        toast.success('Reservation cancelled successfully');
        // Refresh booking data
        const updatedBooking = await bookingsAPI.getBooking(id);
        if (updatedBooking.success) {
          setBooking(updatedBooking.data);
        }
      } else {
        toast.error(response.message || 'Failed to cancel reservation');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel reservation');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reservation Details</h1>
              <p className="text-gray-500">View and manage reservation</p>
            </div>
            <IOSButton 
              variant="secondary" 
              onClick={() => router.push('/dashboard/branch-manager/reservations')}
              leftIcon={<ArrowLeft />}
            >
              Back to Reservations
            </IOSButton>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
            </div>
          ) : booking ? (
            <div className="space-y-6">
              {/* Booking Header */}
              <IOSCard className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{booking.guest_name}</h2>
                      <p className="text-sm text-gray-500">
                        Booking #{booking.booking_number || booking.id.substring(0, 8)}
                      </p>
                    </div>
                  </div>
                  <IOSBadge className={`${statusConfig[booking.status]?.bg || 'bg-gray-100'} ${statusConfig[booking.status]?.color || 'text-gray-700'}`}>
                    {statusConfig[booking.status]?.label || booking.status}
                  </IOSBadge>
                </div>
              </IOSCard>

              {/* Booking Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <IOSCard className="p-6">
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <Calendar className="h-5 w-5" /> Stay Information
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Check-in</p>
                        <p className="font-semibold">
                          {booking.check_in_date ? new Date(booking.check_in_date).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          }) : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Check-out</p>
                        <p className="font-semibold">
                          {booking.check_out_date ? new Date(booking.check_out_date).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          }) : 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Nights</p>
                        <p className="font-semibold">{booking.nights || 
                          (booking.check_out_date && booking.check_in_date ? 
                            Math.ceil((new Date(booking.check_out_date).getTime() - new Date(booking.check_in_date).getTime()) / (1000 * 60 * 60 * 24)) : 0)
                        }</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Guests</p>
                        <p className="font-semibold">{(booking.adults || 0) + (booking.children || 0)} ({booking.adults || 0} adults, {booking.children || 0} children)</p>
                      </div>
                    </div>
                  </div>
                </IOSCard>

                <IOSCard className="p-6">
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <Bed className="h-5 w-5" /> Room Details
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500">Room</p>
                      <p className="font-semibold">Room {booking.room_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Room Type</p>
                      <p className="font-semibold">{booking.room_type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Rate</p>
                      <p className="font-semibold">KES {(booking.total_amount && booking.nights ? (booking.total_amount / booking.nights) : 0).toLocaleString()} per night</p>
                    </div>
                  </div>
                </IOSCard>

                {/* Guest Information */}
                <IOSCard className="p-6">
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <User className="h-5 w-5" /> Guest Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="font-semibold">{booking.guest_name}</p>
                    </div>
                    {booking.guest_email && (
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-semibold">{booking.guest_email}</p>
                      </div>
                    )}
                    {booking.guest_phone && (
                      <div>
                        <p className="text-sm text-gray-500">Phone</p>
                        <p className="font-semibold">{booking.guest_phone}</p>
                      </div>
                    )}
                  </div>
                </IOSCard>

                {/* Payment Information */}
                <IOSCard className="p-6">
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <Clock className="h-5 w-5" /> Payment Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500">Total Amount</p>
                      <p className="text-xl font-bold text-green-600">KES {booking.total_amount?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Payment Status</p>
                      <p className="font-semibold capitalize">{booking.payment_status || 'pending'}</p>
                    </div>
                  </div>
                </IOSCard>
              </div>

              {/* Special Requests */}
              {booking.special_requests && (
                <IOSCard className="p-6">
                  <h3 className="font-bold mb-4">Special Requests</h3>
                  <p>{booking.special_requests}</p>
                </IOSCard>
              )}

              {/* Actions */}
              <IOSCard className="p-6">
                <h3 className="font-bold mb-4">Actions</h3>
                <div className="flex flex-wrap gap-3">
                  {booking.status === 'confirmed' && (
                    <>
                      <IOSButton 
                        onClick={handleCheckIn}
                        disabled={isProcessing}
                        leftIcon={<CheckSquare />}
                      >
                        Check In
                      </IOSButton>
                      <IOSButton 
                        variant="secondary"
                        onClick={handleCancel}
                        disabled={isProcessing}
                        className="bg-red-50 hover:bg-red-100 text-red-600"
                        leftIcon={<X />}
                      >
                        Cancel Reservation
                      </IOSButton>
                    </>
                  )}
                  
                  {booking.status === 'checked_in' && (
                    <IOSButton 
                      onClick={handleCheckOut}
                      disabled={isProcessing}
                      leftIcon={<LogOut />}
                    >
                      Check Out
                    </IOSButton>
                  )}
                  
                  {(booking.status === 'checked_out' || booking.status === 'cancelled') && (
                    <p className="text-gray-500">No actions available for {booking.status} reservations</p>
                  )}
                </div>
              </IOSCard>
            </div>
          ) : (
            <IOSCard className="p-12 text-center">
              <p className="text-gray-500">Reservation not found</p>
              <IOSButton 
                className="mt-4"
                onClick={() => router.push('/dashboard/branch-manager/reservations')}
              >
                Back to Reservations
              </IOSButton>
            </IOSCard>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}