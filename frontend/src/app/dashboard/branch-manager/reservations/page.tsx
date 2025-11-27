'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, RefreshCw, User, Bed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bookingsAPI } from '@/lib/api';

export default function BranchManagerReservationsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, [user]);

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const res = await bookingsAPI.getBookings({ branch_id: user?.branch_id });
      setBookings(res.bookings || res || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Reservations</h1>
              <p className="text-gray-600">Manage branch reservations</p>
            </div>
            <Button onClick={fetchBookings} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-in</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-out</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bookings.map((b: any) => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{b.guest_name || 'Guest'}</td>
                      <td className="px-4 py-3">{b.room_number || '-'}</td>
                      <td className="px-4 py-3">{b.check_in_date}</td>
                      <td className="px-4 py-3">{b.check_out_date}</td>
                      <td className="px-4 py-3">
                        <Badge className={b.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                          {b.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {bookings.length === 0 && (
              <div className="p-8 text-center text-gray-500">{isLoading ? 'Loading...' : 'No reservations found'}</div>
            )}
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
