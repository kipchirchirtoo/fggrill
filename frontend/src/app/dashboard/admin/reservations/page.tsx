'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { bookingsAPI } from '@/lib/api';
import { Calendar, RefreshCw, User, Bed, Clock } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Booking { id: string; guest_name: string; room_number: string; check_in: string; check_out: string; status: string; total_amount: number; }

const statusConfig: Record<string, { color: string; bg: string }> = {
  confirmed: { color: 'text-green-700', bg: 'bg-green-100' },
  pending: { color: 'text-yellow-700', bg: 'bg-yellow-100' },
  checked_in: { color: 'text-blue-700', bg: 'bg-blue-100' },
  checked_out: { color: 'text-gray-700', bg: 'bg-gray-100' },
  cancelled: { color: 'text-red-700', bg: 'bg-red-100' },
};

export default function AdminReservationsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await bookingsAPI.getBookings(statusFilter !== 'all' ? { status: statusFilter } : undefined);
      if (response.success) setBookings(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Reservations</h1><p className="text-gray-500">All bookings</p></div>
            <IOSButton variant="secondary" onClick={fetchBookings} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          <div className="flex gap-2 flex-wrap">
            {['all', 'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'].map((status) => (
              <IOSButton key={status} variant={statusFilter === status ? 'primary' : 'secondary'} size="sm" onClick={() => setStatusFilter(status)}>
                {status === 'all' ? 'All' : status.replace('_', ' ')}
              </IOSButton>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : bookings.length === 0 ? (
            <IOSCard className="p-12 text-center"><Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No reservations</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {bookings.map((booking) => {
                const status = statusConfig[booking.status] || statusConfig.pending;
                return (
                  <IOSCard key={booking.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-ios-lg bg-blue-100 flex items-center justify-center"><Bed className="h-6 w-6 text-[#007AFF]" /></div>
                        <div>
                          <p className="font-bold flex items-center gap-2"><User className="h-4 w-4" /> {booking.guest_name}</p>
                          <p className="text-sm text-gray-500">Room {booking.room_number}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(booking.check_in).toLocaleDateString()} - {new Date(booking.check_out).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <IOSBadge className={`${status.bg} ${status.color}`}>{booking.status?.replace('_', ' ')}</IOSBadge>
                        <p className="font-bold mt-2">KES {booking.total_amount?.toLocaleString()}</p>
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
