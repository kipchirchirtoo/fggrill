'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { bookingsAPI } from '@/lib/api';
import { Calendar, RefreshCw, Search, User, Bed, Clock, Plus, CheckSquare, LogOut, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Booking { id: string; guest_name: string; room_number: string; check_in: string; check_out: string; status: string; total: number; nights: number; }

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: 'Confirmed', color: 'text-green-700', bg: 'bg-green-100' },
  pending: { label: 'Pending', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  checked_in: { label: 'Checked In', color: 'text-blue-700', bg: 'bg-blue-100' },
  checked_out: { label: 'Checked Out', color: 'text-gray-700', bg: 'bg-gray-100' },
  cancelled: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-100' },
};

export default function BranchReservationsPage() {
  const { user } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Use active branch from context, fallback to user's branch
  const currentBranchId = activeBranchId || user?.branch_id;

  const fetchBookings = useCallback(async () => {
    if (!currentBranchId) {
      setBookings([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await bookingsAPI.getBookings({ branch_id: currentBranchId });

      if (response.success) {
        // Ensure data is an array before setting state
        if (Array.isArray(response.data)) {
          setBookings(response.data);
        } else {
          console.error('Invalid booking data format: expected array');
          setBookings([]);
        }
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [currentBranchId]);

  const handleCreateBooking = () => {
    // Redirect to booking creation form
    window.location.href = '/dashboard/branch-manager/reservations/new';
  };

  const handleCancelBooking = async (bookingId: string) => {
    try {
      await bookingsAPI.cancelBooking(bookingId);
      toast.success('Booking cancelled successfully');
      fetchBookings();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel booking');
    }
  };

  const handleCheckIn = async (bookingId: string) => {
    try {
      await bookingsAPI.checkIn(bookingId);
      toast.success('Check-in successful');
      fetchBookings();
    } catch (error: any) {
      toast.error(error.message || 'Failed to check in');
    }
  };

  const handleCheckOut = async (bookingId: string) => {
    try {
      await bookingsAPI.checkOut(bookingId);
      toast.success('Check-out successful');
      fetchBookings();
    } catch (error: any) {
      toast.error(error.message || 'Failed to check out');
    }
  };

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const filteredBookings = bookings.filter((b) => {
    const matchesSearch = b.guest_name?.toLowerCase().includes(searchQuery.toLowerCase()) || b.room_number?.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Reservations</h1><p className="text-gray-500">Manage bookings</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchBookings} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <IOSButton leftIcon={<Plus />} onClick={handleCreateBooking}>New Booking</IOSButton>
            </div>
          </div>

          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {['all', 'pending', 'confirmed', 'checked_in'].map((status) => (
                  <IOSButton key={status} variant={statusFilter === status ? 'primary' : 'secondary'} size="sm" onClick={() => setStatusFilter(status)}>
                    {status === 'all' ? 'All' : statusConfig[status]?.label || status}
                  </IOSButton>
                ))}
              </div>
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredBookings.length === 0 ? (
            <IOSCard className="p-12 text-center"><Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No reservations found</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {filteredBookings.map((booking) => {
                const status = statusConfig[booking.status] || statusConfig.pending;
                return (
                  <IOSCard key={booking.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center"><User className="h-6 w-6 text-[#007AFF]" /></div>
                        <div>
                          <p className="font-bold">{booking.guest_name}</p>
                          <p className="text-sm text-gray-500 flex items-center gap-2"><Bed className="h-3 w-3" /> Room {booking.room_number} <Clock className="h-3 w-3 ml-2" /> {booking.nights} nights</p>
                          <p className="text-xs text-gray-400">{new Date(booking.check_in).toLocaleDateString()} - {new Date(booking.check_out).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          {(user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER) && (
                            <p className="font-bold mb-2">KES {(booking.total || 0).toLocaleString()}</p>
                          )}
                          <IOSBadge className={`${status.bg} ${status.color}`}>{status.label}</IOSBadge>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-3">
                      <IOSButton
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setSelectedBooking(booking);
                          setShowDetailsModal(true);
                        }}
                      >
                        View Details
                      </IOSButton>

                      {booking.status === 'confirmed' && (
                        <>
                          <IOSButton
                            variant="secondary"
                            size="sm"
                            leftIcon={<CheckSquare />}
                            onClick={() => handleCheckIn(booking.id)}
                          >
                            Check In
                          </IOSButton>
                          <IOSButton
                            variant="secondary"
                            size="sm"
                            className="bg-red-50 hover:bg-red-100 text-red-600"
                            onClick={() => handleCancelBooking(booking.id)}
                          >
                            Cancel
                          </IOSButton>
                        </>
                      )}

                      {booking.status === 'checked_in' && (
                        <IOSButton
                          variant="secondary"
                          size="sm"
                          leftIcon={<LogOut />}
                          onClick={() => handleCheckOut(booking.id)}
                        >
                          Check Out
                        </IOSButton>
                      )}
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>

        {/* Details Modal */}
        {showDetailsModal && selectedBooking && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetailsModal(false)}>
            <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Booking Details</h2>
                <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b">
                  <div>
                    <p className="text-sm text-gray-500">Booking ID</p>
                    <p className="font-semibold">{selectedBooking.id}</p>
                  </div>
                  <IOSBadge className={`${statusConfig[selectedBooking.status]?.bg || 'bg-gray-100'} ${statusConfig[selectedBooking.status]?.color || 'text-gray-700'}`}>
                    {statusConfig[selectedBooking.status]?.label || selectedBooking.status}
                  </IOSBadge>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Guest Name</p>
                  <p className="font-semibold text-lg">{selectedBooking.guest_name}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Room Number</p>
                    <p className="font-semibold">{selectedBooking.room_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Nights</p>
                    <p className="font-semibold">{selectedBooking.nights}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Check-In</p>
                    <p className="font-semibold">{new Date(selectedBooking.check_in).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Check-Out</p>
                    <p className="font-semibold">{new Date(selectedBooking.check_out).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  {(user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER) && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Total Amount</span>
                      <span className="text-2xl font-bold text-green-600">KES {(selectedBooking.total || 0).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <IOSButton variant="secondary" className="flex-1" onClick={() => setShowDetailsModal(false)}>
                    Close
                  </IOSButton>

                  {selectedBooking.status === 'confirmed' && (
                    <>
                      <IOSButton
                        className="flex-1"
                        onClick={() => {
                          handleCheckIn(selectedBooking.id);
                          setShowDetailsModal(false);
                        }}
                        leftIcon={<CheckSquare />}
                      >
                        Check In
                      </IOSButton>
                      <IOSButton
                        variant="destructive"
                        onClick={() => {
                          handleCancelBooking(selectedBooking.id);
                          setShowDetailsModal(false);
                        }}
                      >
                        Cancel
                      </IOSButton>
                    </>
                  )}

                  {selectedBooking.status === 'checked_in' && (
                    <IOSButton
                      className="flex-1"
                      onClick={() => {
                        handleCheckOut(selectedBooking.id);
                        setShowDetailsModal(false);
                      }}
                      leftIcon={<LogOut />}
                    >
                      Check Out
                    </IOSButton>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
