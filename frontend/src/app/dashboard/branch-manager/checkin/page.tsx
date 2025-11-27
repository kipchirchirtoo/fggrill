'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, CheckCircle, LogOut, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bookingsAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function BranchManagerCheckinPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { fetchBookings(); }, [user]);

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const res = await bookingsAPI.getBookings({ branch_id: user?.branch_id });
      setBookings(res.bookings || res || []);
    } catch (error) { console.error('Error:', error); } 
    finally { setIsLoading(false); }
  };

  const handleCheckIn = async (id: string) => {
    try {
      await bookingsAPI.checkIn(id, {});
      toast.success('Guest checked in successfully');
      fetchBookings();
    } catch (error) {
      toast.error('Failed to check in');
    }
  };

  const handleCheckOut = async (id: string) => {
    try {
      await bookingsAPI.checkOut(id, {});
      toast.success('Guest checked out successfully');
      fetchBookings();
    } catch (error) {
      toast.error('Failed to check out');
    }
  };

  const filteredBookings = bookings.filter((b: any) => 
    (b.guest_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.room_number || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingArrivals = filteredBookings.filter((b: any) => b.status === 'confirmed');
  const checkedIn = filteredBookings.filter((b: any) => b.status === 'checked_in');

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Check In / Check Out</h1>
              <p className="text-gray-600">Manage guest arrivals and departures</p>
            </div>
            <Button onClick={fetchBookings} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by guest name or room..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending Check-ins */}
            <Card>
              <div className="p-4 border-b bg-green-50">
                <h2 className="font-semibold text-green-800">Pending Check-ins ({pendingArrivals.length})</h2>
              </div>
              <div className="divide-y max-h-96 overflow-y-auto">
                {pendingArrivals.map((b: any) => (
                  <div key={b.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <User className="h-8 w-8 text-gray-400" />
                      <div>
                        <p className="font-medium">{b.guest_name}</p>
                        <p className="text-sm text-gray-500">Room {b.room_number}</p>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => handleCheckIn(b.id)}>
                      <CheckCircle className="h-4 w-4 mr-1" /> Check In
                    </Button>
                  </div>
                ))}
                {pendingArrivals.length === 0 && (
                  <div className="p-4 text-center text-gray-500">No pending arrivals</div>
                )}
              </div>
            </Card>

            {/* Checked-in Guests */}
            <Card>
              <div className="p-4 border-b bg-blue-50">
                <h2 className="font-semibold text-blue-800">Checked-in Guests ({checkedIn.length})</h2>
              </div>
              <div className="divide-y max-h-96 overflow-y-auto">
                {checkedIn.map((b: any) => (
                  <div key={b.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <User className="h-8 w-8 text-blue-400" />
                      <div>
                        <p className="font-medium">{b.guest_name}</p>
                        <p className="text-sm text-gray-500">Room {b.room_number}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleCheckOut(b.id)}>
                      <LogOut className="h-4 w-4 mr-1" /> Check Out
                    </Button>
                  </div>
                ))}
                {checkedIn.length === 0 && (
                  <div className="p-4 text-center text-gray-500">No guests checked in</div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
