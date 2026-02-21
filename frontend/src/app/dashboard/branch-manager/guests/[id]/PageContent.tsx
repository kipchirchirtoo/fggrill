'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { guestAPI } from '@/lib/api';
import { ArrowLeft, User, Mail, Phone, MapPin, Calendar, Star } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';

interface GuestDetailPageProps {
  params: {
    id: string;
  };
}

export default function GuestDetailPage({ params }: GuestDetailPageProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [guest, setGuest] = useState<any>(null);
  const [guestHistory, setGuestHistory] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentBranchId = activeBranchId || user?.branch_id;
  const { id } = params;

  useEffect(() => {
    async function fetchGuestDetails() {
      if (!id) return;

      setIsLoading(true);
      try {
        // Fetch guest details
        const guestResponse = await guestAPI.getGuest(id);
        if (guestResponse.success) {
          setGuest(guestResponse.data);
        } else {
          toast.error('Failed to load guest details');
          router.push('/dashboard/branch-manager/guests');
        }

        // Fetch guest stay history
        const historyResponse = await fetchAPI(`/guests/${id}/history`);
        if (historyResponse.success) {
          setGuestHistory(historyResponse.data);
        }
      } catch (error) {
        console.error('Error fetching guest details:', error);
        toast.error('Failed to load guest details');
        router.push('/dashboard/branch-manager/guests');
      } finally {
        setIsLoading(false);
      }
    }

    fetchGuestDetails();
  }, [id, router]);

  // Helper function for API calls
  async function fetchAPI(endpoint: string, options?: RequestInit) {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const headers = {
      'Content-Type': 'application/json',
      ...(typeof window !== 'undefined' && localStorage.getItem('token')
        ? { Authorization: `Bearer ${localStorage.getItem('token')}` }
        : {})
    };

    const response = await fetch(`${API_URL}/api${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options?.headers
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || error.detail || 'Request failed');
    }

    return response.json();
  }

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Guest Profile</h1>
              <p className="text-gray-500">View guest information and stay history</p>
            </div>
            <IOSButton
              variant="secondary"
              onClick={() => router.push('/dashboard/branch-manager/guests')}
              leftIcon={<ArrowLeft />}
            >
              Back to Guests
            </IOSButton>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
            </div>
          ) : guest ? (
            <div className="space-y-6">
              {/* Guest Header */}
              <IOSCard className="p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-8 w-8 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold">{guest.firstName} {guest.lastName}</h2>
                        {guest.isVip && (
                          <IOSBadge variant="light" color="warning" className="ml-2">
                            <Star className="h-3 w-3 mr-1" /> VIP
                          </IOSBadge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        Guest since {new Date(guest.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </IOSCard>

              {/* Guest Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <IOSCard className="p-6">
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <User className="h-5 w-5" /> Personal Information
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">First Name</p>
                        <p className="font-semibold">{guest.firstName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Last Name</p>
                        <p className="font-semibold">{guest.lastName}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-semibold flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        {guest.email || 'Not provided'}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <p className="font-semibold flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        {guest.phone || 'Not provided'}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500">Nationality</p>
                      <p className="font-semibold">{guest.nationality || 'Not specified'}</p>
                    </div>
                  </div>
                </IOSCard>

                <IOSCard className="p-6">
                  <h3 className="font-bold mb-4 flex items-center gap-2">
                    <MapPin className="h-5 w-5" /> Address & ID
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500">Address</p>
                      <p className="font-semibold">{guest.address || 'Not provided'}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">ID Type</p>
                        <p className="font-semibold capitalize">{guest.idType?.replace('_', ' ') || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">ID Number</p>
                        <p className="font-semibold">{guest.idNumber || 'Not provided'}</p>
                      </div>
                    </div>
                  </div>
                </IOSCard>

                {/* Stay Statistics */}
                {guestHistory && (
                  <IOSCard className="p-6">
                    <h3 className="font-bold mb-4 flex items-center gap-2">
                      <Calendar className="h-5 w-5" /> Stay Statistics
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Total Stays</p>
                        <p className="text-xl font-bold">{guestHistory.statistics?.totalStays || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Nights</p>
                        <p className="text-xl font-bold">{guestHistory.statistics?.totalNights || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total Spent</p>
                        <p className="text-xl font-bold text-green-600">
                          KES {(guestHistory.statistics?.totalSpent || 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Average Stay Value</p>
                        <p className="text-xl font-bold">
                          KES {(guestHistory.statistics?.averageStayValue || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </IOSCard>
                )}

                {/* Preferences */}
                {guest.preferences && Object.keys(guest.preferences).length > 0 && (
                  <IOSCard className="p-6">
                    <h3 className="font-bold mb-4">Guest Preferences</h3>
                    <div className="space-y-2">
                      {Object.entries(guest.preferences).map(([key, value]) => (
                        <div key={key}>
                          <p className="text-sm text-gray-500 capitalize">{key.replace('_', ' ')}</p>
                          <p className="font-semibold">{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  </IOSCard>
                )}
              </div>

              {/* Stay History */}
              {guestHistory && guestHistory.bookings && guestHistory.bookings.length > 0 && (
                <IOSCard className="p-6">
                  <h3 className="font-bold mb-4">Stay History</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-4">Date</th>
                          <th className="text-left py-2 px-4">Room</th>
                          <th className="text-left py-2 px-4">Nights</th>
                          <th className="text-left py-2 px-4">Status</th>
                          <th className="text-right py-2 px-4">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {guestHistory.bookings.map((booking: any) => {
                          const checkIn = new Date(booking.check_in_date);
                          const checkOut = new Date(booking.check_out_date);
                          const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

                          return (
                            <tr key={booking.id} className="border-b hover:bg-gray-50">
                              <td className="py-2 px-4">
                                {checkIn.toLocaleDateString()}
                              </td>
                              <td className="py-2 px-4">
                                {booking.room?.room_number || 'N/A'}
                              </td>
                              <td className="py-2 px-4">
                                {nights}
                              </td>
                              <td className="py-2 px-4">
                                <IOSBadge variant="light" color={
                                  booking.status === 'checked_out' ? 'success' :
                                    booking.status === 'checked_in' ? 'primary' :
                                      booking.status === 'confirmed' ? 'warning' :
                                        booking.status === 'cancelled' ? 'danger' : 'default'
                                }>
                                  {booking.status.replace('_', ' ')}
                                </IOSBadge>
                              </td>
                              <td className="py-2 px-4 text-right">
                                KES {(booking.total_amount || 0).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </IOSCard>
              )}

              {/* Actions */}
              <IOSCard className="p-6">
                <h3 className="font-bold mb-4">Actions</h3>
                <div className="flex flex-wrap gap-3">
                  <IOSButton
                    onClick={() => router.push(`/dashboard/branch-manager/reservations/new?guest=${guest.id}`)}
                    leftIcon={<Calendar />}
                  >
                    Create New Booking
                  </IOSButton>
                  <IOSButton
                    variant="secondary"
                    onClick={() => router.push(`/dashboard/branch-manager/guests/edit/${guest.id}`)}
                  >
                    Edit Guest
                  </IOSButton>
                </div>
              </IOSCard>
            </div>
          ) : (
            <IOSCard className="p-12 text-center">
              <p className="text-gray-500">Guest not found</p>
              <IOSButton
                className="mt-4"
                onClick={() => router.push('/dashboard/branch-manager/guests')}
              >
                Back to Guests
              </IOSButton>
            </IOSCard>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}