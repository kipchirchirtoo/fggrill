'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { bookingsAPI } from '@/lib/api';
import { Calendar, RefreshCw, Search, User, Bed, Clock, Plus } from 'lucide-react';

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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await bookingsAPI.getBookings();
      if (response.success) setBookings(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

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
              <IOSButton variant="secondary" onClick={fetchBookings}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
              <IOSButton><Plus className="h-4 w-4 mr-2" /> New Booking</IOSButton>
            </div>
          </div>

          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
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
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center"><User className="h-6 w-6 text-blue-600" /></div>
                        <div>
                          <p className="font-bold">{booking.guest_name}</p>
                          <p className="text-sm text-gray-500 flex items-center gap-2"><Bed className="h-3 w-3" /> Room {booking.room_number} <Clock className="h-3 w-3 ml-2" /> {booking.nights} nights</p>
                          <p className="text-xs text-gray-400">{new Date(booking.check_in).toLocaleDateString()} - {new Date(booking.check_out).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-bold">KES {booking.total?.toLocaleString()}</p>
                        <IOSBadge className={`${status.bg} ${status.color}`}>{status.label}</IOSBadge>
                      </div>
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
