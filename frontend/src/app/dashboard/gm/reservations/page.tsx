'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, Plus, Search, RefreshCw, Eye, Edit, Trash2,
  User, Bed, Clock, DollarSign, CheckCircle, XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface Reservation {
  id: string;
  guest_name?: string;
  guestName?: string;
  room_number?: string;
  roomNumber?: string;
  room_type?: string;
  check_in?: string;
  checkIn?: string;
  check_out?: string;
  checkOut?: string;
  status: string;
  payment_status?: string;
  paymentStatus?: string;
  total_amount?: number;
  totalAmount?: number;
  guests?: number;
  notes?: string;
  created_at?: string;
}

export default function GMReservationsPage() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchReservations();
  }, []);

  const fetchReservations = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/bookings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const reservationData = data?.data || data?.bookings || (Array.isArray(data) ? data : []);
        setReservations(Array.isArray(reservationData) ? reservationData : []);
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error('Failed to load reservations');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'confirmed': 'bg-green-100 text-green-700',
      'CONFIRMED': 'bg-green-100 text-green-700',
      'pending': 'bg-yellow-100 text-yellow-700',
      'PENDING': 'bg-yellow-100 text-yellow-700',
      'checked-in': 'bg-blue-100 text-blue-700',
      'CHECKED_IN': 'bg-blue-100 text-blue-700',
      'checked-out': 'bg-gray-100 text-gray-700',
      'CHECKED_OUT': 'bg-gray-100 text-gray-700',
      'cancelled': 'bg-red-100 text-red-700',
      'CANCELLED': 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getPaymentColor = (status: string) => {
    const colors: Record<string, string> = {
      'paid': 'bg-green-100 text-green-700',
      'PAID': 'bg-green-100 text-green-700',
      'partial': 'bg-yellow-100 text-yellow-700',
      'PARTIAL': 'bg-yellow-100 text-yellow-700',
      'unpaid': 'bg-red-100 text-red-700',
      'UNPAID': 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const filteredReservations = reservations.filter(r => {
    const guestName = r.guest_name || r.guestName || '';
    const roomNumber = r.room_number || r.roomNumber || '';
    const status = r.status?.toLowerCase() || '';
    
    const matchesSearch = searchTerm === '' || 
      guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      roomNumber.includes(searchTerm);
    
    const matchesStatus = filterStatus === 'all' || status === filterStatus.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: reservations.length,
    confirmed: reservations.filter(r => r.status?.toLowerCase() === 'confirmed').length,
    pending: reservations.filter(r => r.status?.toLowerCase() === 'pending').length,
    checkedIn: reservations.filter(r => r.status?.toLowerCase() === 'checked-in' || r.status?.toLowerCase() === 'checked_in').length
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Calendar className="h-6 w-6 text-indigo-600" />
                Reservations
              </h1>
              <p className="text-gray-600">Manage hotel bookings and reservations</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={fetchReservations} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Reservation
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-500">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm text-gray-500">Confirmed</p>
                  <p className="text-2xl font-bold">{stats.confirmed}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Bed className="h-8 w-8 text-indigo-500" />
                <div>
                  <p className="text-sm text-gray-500">Checked In</p>
                  <p className="text-2xl font-bold">{stats.checkedIn}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by guest or room..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border rounded-lg px-3 py-2"
              >
                <option value="all">All Status</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="checked-in">Checked In</option>
                <option value="checked-out">Checked Out</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </Card>

          {/* Reservations Table */}
          <Card>
            {isLoading ? (
              <div className="p-12 text-center text-gray-500">Loading reservations...</div>
            ) : filteredReservations.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No reservations found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check In</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check Out</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredReservations.map((reservation) => (
                      <tr key={reservation.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="font-medium">{reservation.guest_name || reservation.guestName || '-'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Bed className="h-4 w-4 text-gray-400" />
                            <span>{reservation.room_number || reservation.roomNumber || '-'}</span>
                            {reservation.room_type && (
                              <span className="text-xs text-gray-500">({reservation.room_type})</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm">
                          {formatDate(reservation.check_in || reservation.checkIn)}
                        </td>
                        <td className="px-4 py-4 text-sm">
                          {formatDate(reservation.check_out || reservation.checkOut)}
                        </td>
                        <td className="px-4 py-4">
                          <Badge className={getStatusColor(reservation.status)}>
                            {reservation.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
                          <Badge className={getPaymentColor(reservation.payment_status || reservation.paymentStatus || 'unpaid')}>
                            {reservation.payment_status || reservation.paymentStatus || 'Unpaid'}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-right font-medium">
                          KES {(reservation.total_amount || reservation.totalAmount || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
