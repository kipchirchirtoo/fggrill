'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { branchOperationsAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import {
  Search, CalendarPlus, RefreshCw, Calendar, CheckCircle2, XCircle,
  Clock, Bed, CalendarCheck, CalendarX, Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Reservation interface
interface Reservation {
  id: string;
  reservation_number: string;
  guest_name: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  room_type: string;
  room_number?: string;
  adults: number;
  children: number;
  total_amount: number;
  payment_status: string;
}

function BranchReservationsContent() {
  const { user } = useAuth();
  const { activeBranch, activeBranchId } = useBranch();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal state
  const [showNewReservationModal, setShowNewReservationModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);

  // Form data
  const [formData, setFormData] = useState({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    check_in_date: '',
    check_out_date: '',
    room_id: '',
    adults: 1,
    children: 0,
    total_amount: 0,
    payment_status: 'pending',
    special_requests: ''
  });

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    upcoming: 0,
    checkedIn: 0,
    cancelled: 0
  });

  useEffect(() => {
    if (activeBranchId) {
      fetchReservations();
    }
  }, [activeBranchId]);

  useEffect(() => {
    applyFilters();
  }, [reservations, searchTerm, statusFilter]);

  const fetchReservations = async () => {
    setIsLoading(true);
    try {
      const response = await branchOperationsAPI.getReservations(
        { status: statusFilter !== 'all' ? statusFilter : undefined },
        activeBranchId ?? undefined
      );

      if (response.success) {
        const reservationData = response.data || [];
        setReservations(reservationData);

        // Calculate stats
        const upcoming = reservationData.filter((r: Reservation) => r.status === 'confirmed').length;
        const checkedIn = reservationData.filter((r: Reservation) => r.status === 'checked_in').length;
        const cancelled = reservationData.filter((r: Reservation) => r.status === 'cancelled').length;

        setStats({
          total: reservationData.length,
          upcoming,
          checkedIn,
          cancelled
        });
      } else {
        throw new Error(response.message || 'Failed to fetch reservations');
      }
    } catch (error) {
      console.error('Error fetching reservations:', error);
      toast.error('Failed to load reservations');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...reservations];

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(reservation => reservation.status === statusFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(reservation =>
        reservation.guest_name.toLowerCase().includes(searchLower) ||
        reservation.reservation_number.toLowerCase().includes(searchLower) ||
        (reservation.room_number && reservation.room_number.toLowerCase().includes(searchLower))
      );
    }

    setFilteredReservations(filtered);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <IOSBadge className="bg-green-100 text-green-700">Confirmed</IOSBadge>;
      case 'checked_in':
        return <IOSBadge className="bg-blue-100 text-blue-700">Checked In</IOSBadge>;
      case 'checked_out':
        return <IOSBadge className="bg-gray-100 text-gray-700">Checked Out</IOSBadge>;
      case 'cancelled':
        return <IOSBadge className="bg-red-100 text-red-700">Cancelled</IOSBadge>;
      case 'no_show':
        return <IOSBadge className="bg-yellow-100 text-yellow-700">No Show</IOSBadge>;
      default:
        return <IOSBadge className="bg-gray-100 text-gray-700">{status}</IOSBadge>;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  const handleStatusChange = async (reservationId: string, newStatus: string) => {
    try {
      const response = await branchOperationsAPI.updateReservationStatus(
        reservationId,
        newStatus,
        activeBranchId || undefined
      );

      if (response.success) {
        toast.success(`Reservation status updated to ${newStatus}`);
        // Refresh the reservations list
        fetchReservations();
      } else {
        throw new Error(response.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating reservation status:', error);
      toast.error('Failed to update reservation status');
    }
  };

  const fetchAvailableRooms = async () => {
    try {
      const response = await branchOperationsAPI.getRooms(
        { status: 'available' },
        activeBranchId ?? undefined
      );
      if (response.success) {
        setAvailableRooms(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching available rooms:', error);
    }
  };

  const handleOpenNewReservation = () => {
    fetchAvailableRooms();
    setShowNewReservationModal(true);
  };

  const handleCloseModal = () => {
    setShowNewReservationModal(false);
    setFormData({
      guest_name: '',
      guest_email: '',
      guest_phone: '',
      check_in_date: '',
      check_out_date: '',
      room_id: '',
      adults: 1,
      children: 0,
      total_amount: 0,
      payment_status: 'pending',
      special_requests: ''
    });
  };

  const calculateTotal = (roomId: string, checkIn: string, checkOut: string) => {
    if (!roomId || !checkIn || !checkOut) return 0;

    const room = availableRooms.find(r => r.id === roomId);
    if (!room) return 0;

    const nights = Math.ceil(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
    );

    return nights > 0 ? room.rate_per_night * nights : 0;
  };

  const handleFormChange = (field: string, value: any) => {
    const newFormData = { ...formData, [field]: value };

    // Auto-calculate total when room or dates change
    if (field === 'room_id' || field === 'check_in_date' || field === 'check_out_date') {
      newFormData.total_amount = calculateTotal(
        field === 'room_id' ? value : formData.room_id,
        field === 'check_in_date' ? value : formData.check_in_date,
        field === 'check_out_date' ? value : formData.check_out_date
      );
    }

    setFormData(newFormData);
  };

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await branchOperationsAPI.createReservation(
        formData,
        activeBranchId ?? undefined
      );

      if (response.success) {
        toast.success('Reservation created successfully!');
        handleCloseModal();
        fetchReservations(); // Refresh the list
      } else {
        throw new Error(response.message || 'Failed to create reservation');
      }
    } catch (error: any) {
      console.error('Error creating reservation:', error);
      toast.error(error.message || 'Failed to create reservation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[
      UserRole.BRANCH_OPERATIONS_MANAGER,
      UserRole.BRANCH_MANAGER,
      UserRole.RECEPTIONIST,
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER
    ]}>
      <BranchAwareDashboardLayout
        title="Reservations"
        subtitle={`Manage reservations for ${activeBranch?.name || 'your branch'}`}
        actionButton={
          <IOSButton leftIcon={<CalendarPlus />} onClick={handleOpenNewReservation}>
            New Reservation
          </IOSButton>
        }
      >
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <Calendar className="h-5 w-5 text-gray-600 mb-2" />
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-lg font-bold">{stats.total}</p>
            </IOSCard>

            <IOSCard className="p-4">
              <Clock className="h-5 w-5 text-green-600 mb-2" />
              <p className="text-sm text-gray-500">Upcoming</p>
              <p className="text-lg font-bold text-green-600">{stats.upcoming}</p>
            </IOSCard>

            <IOSCard className="p-4">
              <CheckCircle2 className="h-5 w-5 text-blue-600 mb-2" />
              <p className="text-sm text-gray-500">Checked In</p>
              <p className="text-lg font-bold text-blue-600">{stats.checkedIn}</p>
            </IOSCard>

            <IOSCard className="p-4">
              <XCircle className="h-5 w-5 text-red-600 mb-2" />
              <p className="text-sm text-gray-500">Cancelled</p>
              <p className="text-lg font-bold text-red-600">{stats.cancelled}</p>
            </IOSCard>
          </div>

          {/* Search and Filter */}
          <IOSCard className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <Input
                  placeholder="Search reservations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
                >
                  <option value="all">All Statuses</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checked_in">Checked In</option>
                  <option value="checked_out">Checked Out</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No Show</option>
                </select>
              </div>

              <div>
                <IOSButton
                  onClick={fetchReservations}
                  leftIcon={<RefreshCw />}
                  className="w-full"
                >
                  Refresh
                </IOSButton>
              </div>
            </div>
          </IOSCard>

          {/* Reservations Table */}
          <IOSCard>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reservation #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Check In</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Check Out</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center">
                        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                      </td>
                    </tr>
                  ) : filteredReservations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center">
                        <div className="flex flex-col items-center">
                          <Calendar className="h-12 w-12 text-gray-300 mb-2" />
                          <p className="text-gray-500">No reservations found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredReservations.map((reservation) => (
                      <tr key={reservation.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 font-mono text-sm">
                          {reservation.reservation_number}
                        </td>
                        <td className="px-4 py-4">
                          {reservation.guest_name}
                        </td>
                        <td className="px-4 py-4 text-center text-sm">
                          {formatDate(reservation.check_in_date)}
                        </td>
                        <td className="px-4 py-4 text-center text-sm">
                          {formatDate(reservation.check_out_date)}
                        </td>
                        <td className="px-4 py-4">
                          {reservation.room_type} {reservation.room_number ? `#${reservation.room_number}` : ''}
                        </td>
                        <td className="px-4 py-4 text-right">
                          {formatCurrency(reservation.total_amount)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {getStatusBadge(reservation.status)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-center space-x-2">
                            {reservation.status === 'confirmed' && (
                              <IOSButton
                                size="sm"
                                variant="secondary"
                                leftIcon={<CalendarCheck />}
                                onClick={() => handleStatusChange(reservation.id, 'checked_in')}
                              >
                                Check In
                              </IOSButton>
                            )}
                            {reservation.status === 'checked_in' && (
                              <IOSButton
                                size="sm"
                                variant="secondary"
                                leftIcon={<Bed />}
                                onClick={() => handleStatusChange(reservation.id, 'checked_out')}
                              >
                                Check Out
                              </IOSButton>
                            )}
                            {(reservation.status === 'confirmed' || reservation.status === 'checked_in') && (
                              <IOSButton
                                size="sm"
                                variant="outline"
                                leftIcon={<CalendarX />}
                                onClick={() => handleStatusChange(reservation.id, 'cancelled')}
                              >
                                Cancel
                              </IOSButton>
                            )}
                            <IOSButton
                              size="sm"
                              variant={['confirmed', 'checked_in'].includes(reservation.status) ? 'outline' : 'secondary'}
                              leftIcon={<Eye />}
                            >
                              View
                            </IOSButton>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </IOSCard>
        </div>
      </BranchAwareDashboardLayout>

      {/* New Reservation Modal */}
      <Dialog open={showNewReservationModal} onOpenChange={setShowNewReservationModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Reservation</DialogTitle>
            <DialogDescription>
              Fill in the details to create a new reservation for {activeBranch?.name}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateReservation} className="space-y-4">
            {/* Guest Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Guest Information</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="guest_name">Guest Name *</Label>
                  <Input
                    id="guest_name"
                    required
                    value={formData.guest_name}
                    onChange={(e) => handleFormChange('guest_name', e.target.value)}
                    placeholder="John Doe"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="guest_email">Email *</Label>
                  <Input
                    id="guest_email"
                    type="email"
                    required
                    value={formData.guest_email}
                    onChange={(e) => handleFormChange('guest_email', e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="guest_phone">Phone Number *</Label>
                <Input
                  id="guest_phone"
                  required
                  value={formData.guest_phone}
                  onChange={(e) => handleFormChange('guest_phone', e.target.value)}
                  placeholder="+254712345678"
                />
              </div>
            </div>

            {/* Booking Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Booking Details</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="check_in_date">Check-in Date *</Label>
                  <Input
                    id="check_in_date"
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={formData.check_in_date}
                    onChange={(e) => handleFormChange('check_in_date', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="check_out_date">Check-out Date *</Label>
                  <Input
                    id="check_out_date"
                    type="date"
                    required
                    min={formData.check_in_date || new Date().toISOString().split('T')[0]}
                    value={formData.check_out_date}
                    onChange={(e) => handleFormChange('check_out_date', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="room_id">Room *</Label>
                <select
                  id="room_id"
                  required
                  value={formData.room_id}
                  onChange={(e) => handleFormChange('room_id', e.target.value)}
                  className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
                >
                  <option value="">Select a room</option>
                  {availableRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.room_type} #{room.room_number} - KES {room.rate_per_night.toLocaleString()}/night
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="adults">Adults</Label>
                  <Input
                    id="adults"
                    type="number"
                    min="1"
                    value={formData.adults}
                    onChange={(e) => handleFormChange('adults', parseInt(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="children">Children</Label>
                  <Input
                    id="children"
                    type="number"
                    min="0"
                    value={formData.children}
                    onChange={(e) => handleFormChange('children', parseInt(e.target.value))}
                  />
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Payment Information</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="total_amount">Total Amount (KES)</Label>
                  <Input
                    id="total_amount"
                    type="number"
                    value={formData.total_amount}
                    onChange={(e) => handleFormChange('total_amount', parseFloat(e.target.value))}
                    placeholder="Auto-calculated"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_status">Payment Status</Label>
                  <select
                    id="payment_status"
                    value={formData.payment_status}
                    onChange={(e) => handleFormChange('payment_status', e.target.value)}
                    className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
                  >
                    <option value="pending">Pending</option>
                    <option value="deposit">Deposit Paid</option>
                    <option value="paid">Fully Paid</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Special Requests */}
            <div className="space-y-2">
              <Label htmlFor="special_requests">Special Requests</Label>
              <Textarea
                id="special_requests"
                value={formData.special_requests}
                onChange={(e) => handleFormChange('special_requests', e.target.value)}
                placeholder="Any special requests or notes..."
                rows={3}
              />
            </div>

            <DialogFooter>
              <IOSButton
                type="button"
                variant="outline"
                onClick={handleCloseModal}
                disabled={isSubmitting}
              >
                Cancel
              </IOSButton>
              <IOSButton
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Reservation'}
              </IOSButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
}

// Export a wrapper component that provides BranchContext
export default function BranchReservationsPage() {
  return (
    <BranchPageWrapper>
      <BranchReservationsContent />
    </BranchPageWrapper>
  );
}
