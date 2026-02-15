'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { bookingsAPI } from '@/lib/api';
import { ArrowLeft, Calendar, User, Bed, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';

interface ArrivalDetailPageProps {
  params: {
    id: string;
  };
}

export default function ArrivalDetailPage({ params }: ArrivalDetailPageProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [arrival, setArrival] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentBranchId = activeBranchId || user?.branch_id;
  const { id } = params;

  useEffect(() => {
    async function fetchArrivalDetails() {
      if (!id) return;
      
      setIsLoading(true);
      try {
        const response = await bookingsAPI.getBooking(id);
        if (response.success) {
          setArrival(response.data);
        } else {
          toast.error('Failed to load arrival details');
          router.push('/dashboard/branch-manager/arrivals');
        }
      } catch (error) {
        console.error('Error fetching arrival details:', error);
        toast.error('Failed to load arrival details');
        router.push('/dashboard/branch-manager/arrivals');
      } finally {
        setIsLoading(false);
      }
    }

    fetchArrivalDetails();
  }, [id, router]);

  const handleCheckIn = async () => {
    setIsProcessing(true);
    try {
      const response = await bookingsAPI.checkIn(id);
      if (response.success) {
        toast.success('Guest checked in successfully');
        router.push('/dashboard/branch-manager/arrivals');
      } else {
        toast.error(response.message || 'Failed to check in');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to check in guest');
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
              <h1 className="text-2xl font-bold text-gray-900">Arrival Details</h1>
              <p className="text-gray-500">View and check in guest</p>
            </div>
            <IOSButton 
              variant="secondary" 
              onClick={() => router.push('/dashboard/branch-manager/arrivals')}
              leftIcon={<ArrowLeft />}
            >
              Back to Arrivals
            </IOSButton>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
            </div>
          ) : arrival ? (
            <div className="space-y-6">
              {/* Arrival Header */}
              <IOSCard className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                      <User className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{arrival.guest_name}</h2>
                      <p className="text-sm text-gray-500">
                        Arriving today - {new Date(arrival.check_in).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <IOSBadge variant="light" color={arrival.status === 'checked_in' ? 'success' : 'warning'}>
                    {arrival.status === 'checked_in' ? 'Checked In' : 'Confirmed'}
                  </IOSBadge>
                </div>
              </IOSCard>

              {/* Arrival Details */}
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
                          {new Date(arrival.check_in).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Check-out</p>
                        <p className="font-semibold">
                          {new Date(arrival.check_out).toLocaleDateString('en-US', { 
                            weekday: 'short', 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Nights</p>
                        <p className="font-semibold">{arrival.nights || 
                          Math.ceil((new Date(arrival.check_out).getTime() - new Date(arrival.check_in).getTime()) / (1000 * 60 * 60 * 24))
                        }</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Guests</p>
                        <p className="font-semibold">{arrival.adults + (arrival.children || 0)} ({arrival.adults} adults, {arrival.children || 0} children)</p>
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
                      <p className="font-semibold">Room {arrival.room_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Room Type</p>
                      <p className="font-semibold">{arrival.room_type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Rate</p>
                      <p className="font-semibold">KES {(arrival.total_amount / arrival.nights).toLocaleString()} per night</p>
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
                      <p className="font-semibold">{arrival.guest_name}</p>
                    </div>
                    {arrival.guest_email && (
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-semibold">{arrival.guest_email}</p>
                      </div>
                    )}
                    {arrival.guest_phone && (
                      <div>
                        <p className="text-sm text-gray-500">Phone</p>
                        <p className="font-semibold">{arrival.guest_phone}</p>
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
                      <p className="text-xl font-bold text-green-600">KES {arrival.total_amount?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Payment Status</p>
                      <p className="font-semibold capitalize">{arrival.payment_status || 'pending'}</p>
                    </div>
                  </div>
                </IOSCard>
              </div>

              {/* Special Requests */}
              {arrival.special_requests && (
                <IOSCard className="p-6">
                  <h3 className="font-bold mb-4">Special Requests</h3>
                  <p>{arrival.special_requests}</p>
                </IOSCard>
              )}

              {/* Actions */}
              <IOSCard className="p-6">
                <h3 className="font-bold mb-4">Actions</h3>
                <div className="flex flex-wrap gap-3">
                  {arrival.status !== 'checked_in' ? (
                    <IOSButton 
                      onClick={handleCheckIn}
                      disabled={isProcessing}
                      leftIcon={<CheckCircle />}
                    >
                      {isProcessing ? 'Processing...' : 'Check In Guest'}
                    </IOSButton>
                  ) : (
                    <p className="text-green-600 font-medium flex items-center gap-2">
                      <CheckCircle className="h-5 w-5" /> Guest already checked in
                    </p>
                  )}
                </div>
              </IOSCard>
            </div>
          ) : (
            <IOSCard className="p-12 text-center">
              <p className="text-gray-500">Arrival not found</p>
              <IOSButton 
                className="mt-4"
                onClick={() => router.push('/dashboard/branch-manager/arrivals')}
              >
                Back to Arrivals
              </IOSButton>
            </IOSCard>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}