'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { bookingsAPI } from '@/lib/api';
import { ArrowLeft, Calendar, User, Bed, Clock, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';

interface DepartureDetailPageProps {
  params: {
    id: string;
  };
}

export default function DepartureDetailPage({ params }: DepartureDetailPageProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [departure, setDeparture] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentBranchId = activeBranchId || user?.branch_id;
  const { id } = params;

  useEffect(() => {
    async function fetchDepartureDetails() {
      if (!id) return;
      
      setIsLoading(true);
      try {
        const response = await bookingsAPI.getBooking(id);
        if (response.success) {
          setDeparture(response.data);
        } else {
          toast.error('Failed to load departure details');
          router.push('/dashboard/branch-manager/departures');
        }
      } catch (error) {
        console.error('Error fetching departure details:', error);
        toast.error('Failed to load departure details');
        router.push('/dashboard/branch-manager/departures');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDepartureDetails();
  }, [id, router]);

  const handleCheckOut = async () => {
    setIsProcessing(true);
    try {
      const response = await bookingsAPI.checkOut(id);
      if (response.success) {
        toast.success('Guest checked out successfully');
        router.push('/dashboard/branch-manager/departures');
      } else {
        toast.error(response.message || 'Failed to check out');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to check out guest');
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
              <h1 className="text-2xl font-bold text-gray-900">Departure Details</h1>
              <p className="text-gray-500">View and check out guest</p>
            </div>
            <IOSButton 
              variant="secondary" 
              onClick={() => router.push('/dashboard/branch-manager/departures')}
              leftIcon={<ArrowLeft />}
            >
              Back to Departures
            </IOSButton>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
            </div>
          ) : departure ? (
            <div className="space-y-6">
              {/* Departure Header */}
              <IOSCard className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{departure.guest_name}</h2>
                      <p className="text-sm text-gray-500">
                        Departing today - {new Date(departure.check_out).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <IOSBadge variant="light" color={departure.status === 'checked_out' ? 'success' : 'primary'}>
                    {departure.status === 'checked_out' ? 'Checked Out' : 'Checked In'}
                  </IOSBadge>
                </div>
              </IOSCard>

              {/* Departure Details */}
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
                          {new Date(departure.check_in).toLocaleDateString('en-US', { 
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
                          {new Date(departure.check_out).toLocaleDateString('en-US', { 
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
                        <p className="font-semibold">{departure.nights || 
                          Math.ceil((new Date(departure.check_out).getTime() - new Date(departure.check_in).getTime()) / (1000 * 60 * 60 * 24))
                        }</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Guests</p>
                        <p className="font-semibold">{departure.adults + (departure.children || 0)} ({departure.adults} adults, {departure.children || 0} children)</p>
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
                      <p className="font-semibold">Room {departure.room_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Room Type</p>
                      <p className="font-semibold">{departure.room_type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Rate</p>
                      <p className="font-semibold">KES {(departure.total_amount / departure.nights).toLocaleString()} per night</p>
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
                      <p className="font-semibold">{departure.guest_name}</p>
                    </div>
                    {departure.guest_email && (
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-semibold">{departure.guest_email}</p>
                      </div>
                    )}
                    {departure.guest_phone && (
                      <div>
                        <p className="text-sm text-gray-500">Phone</p>
                        <p className="font-semibold">{departure.guest_phone}</p>
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
                      <p className="text-xl font-bold text-green-600">KES {departure.total_amount?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Payment Status</p>
                      <p className="font-semibold capitalize">{departure.payment_status || 'pending'}</p>
                    </div>
                    {departure.balance !== undefined && (
                      <div>
                        <p className="text-sm text-gray-500">Balance Due</p>
                        <p className={`font-bold ${departure.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          KES {departure.balance.toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </IOSCard>
              </div>

              {/* Special Requests */}
              {departure.special_requests && (
                <IOSCard className="p-6">
                  <h3 className="font-bold mb-4">Special Requests</h3>
                  <p>{departure.special_requests}</p>
                </IOSCard>
              )}

              {/* Actions */}
              <IOSCard className="p-6">
                <h3 className="font-bold mb-4">Actions</h3>
                <div className="flex flex-wrap gap-3">
                  {departure.status !== 'checked_out' ? (
                    <IOSButton 
                      onClick={handleCheckOut}
                      disabled={isProcessing}
                      leftIcon={<LogOut />}
                    >
                      {isProcessing ? 'Processing...' : 'Check Out Guest'}
                    </IOSButton>
                  ) : (
                    <p className="text-green-600 font-medium flex items-center gap-2">
                      <LogOut className="h-5 w-5" /> Guest already checked out
                    </p>
                  )}
                </div>
              </IOSCard>
            </div>
          ) : (
            <IOSCard className="p-12 text-center">
              <p className="text-gray-500">Departure not found</p>
              <IOSButton 
                className="mt-4"
                onClick={() => router.push('/dashboard/branch-manager/departures')}
              >
                Back to Departures
              </IOSButton>
            </IOSCard>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}