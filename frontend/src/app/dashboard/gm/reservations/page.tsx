'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { bookingsAPI } from '@/lib/api';
import { Calendar, RefreshCw, Search, User, Building2, Bed, Clock } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Booking { id: string; guest_name: string; room_number: string; branch_name?: string; check_in: string; check_out: string; status: string; total: number; }

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: 'Confirmed', color: 'text-green-700', bg: 'bg-green-100' },
  pending: { label: 'Pending', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  checked_in: { label: 'Checked In', color: 'text-blue-700', bg: 'bg-blue-100' },
  checked_out: { label: 'Checked Out', color: 'text-gray-700', bg: 'bg-gray-100' },
  cancelled: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-100' },
};

export default function GMReservationsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await bookingsAPI.getBookings();
      if (response.success) setBookings(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const filteredBookings = bookings.filter((b) => 
    b.guest_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.room_number?.includes(searchQuery)
  );

  const stats = {
    total: bookings.length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    checkedIn: bookings.filter(b => b.status === 'checked_in').length,
    pending: bookings.filter(b => b.status === 'pending').length,
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">All Reservations</h1><p className="text-gray-500">View bookings across all branches</p></div>
            <IOSButton variant="secondary" onClick={fetchBookings}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4"><Calendar className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Total</p><p className="text-xl font-bold">{stats.total}</p></IOSCard>
            <IOSCard className="p-4"><Clock className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Pending</p><p className="text-xl font-bold text-yellow-600">{stats.pending}</p></IOSCard>
            <IOSCard className="p-4"><Bed className="h-6 w-6 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Confirmed</p><p className="text-xl font-bold text-[#34C759]">{stats.confirmed}</p></IOSCard>
            <IOSCard className="p-4"><User className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Checked In</p><p className="text-xl font-bold text-[#007AFF]">{stats.checkedIn}</p></IOSCard>
          </div>

          <IOSCard className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search reservations..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
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
                          <p className="text-sm text-gray-500">Room {booking.room_number}</p>
                          <p className="text-xs text-gray-400">{new Date(booking.check_in).toLocaleDateString()} - {new Date(booking.check_out).toLocaleDateString()}</p>
                          {booking.branch_name && <p className="text-xs text-gray-400 flex items-center gap-1"><Building2 className="h-3 w-3" /> {booking.branch_name}</p>}
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
