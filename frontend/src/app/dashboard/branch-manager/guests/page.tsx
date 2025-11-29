'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Users, Search, Plus, RefreshCw, Phone, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { bookingsAPI } from '@/lib/api';

export default function BranchManagerGuestsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [guests, setGuests] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await bookingsAPI.getBookings().catch(() => ({ bookings: [] }));
      const bookings = res.bookings || res.data || [];
      const guestList = bookings.filter((b: any) => b.status === 'checked_in').map((b: any) => ({
        id: b.id,
        name: b.guest_name,
        email: b.guest_email,
        phone: b.guest_phone || b.phone,
        room: b.room_number,
        checkIn: b.check_in_date,
        checkOut: b.check_out_date
      }));
      setGuests(guestList);
    } catch (error) {
      toast.error('Failed to load guests');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredGuests = guests.filter(g => 
    g.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Guests</h1>
              <p className="text-gray-600 mt-1">Manage current guests</p>
            </div>
            <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input type="text" placeholder="Search guests..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border rounded-lg" />
          </div>

          <div className="bg-white rounded-xl border overflow-hidden">
            {isLoading ? (
              <div className="text-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div></div>
            ) : filteredGuests.length === 0 ? (
              <div className="text-center py-12 text-gray-500"><Users className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No guests found</p></div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check Out</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredGuests.map((guest) => (
                    <tr key={guest.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium">{guest.name}</td>
                      <td className="px-6 py-4">
                        <div className="text-sm space-y-1">
                          {guest.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3" />{guest.phone}</div>}
                          {guest.email && <div className="flex items-center gap-2"><Mail className="h-3 w-3" />{guest.email}</div>}
                        </div>
                      </td>
                      <td className="px-6 py-4">{guest.room}</td>
                      <td className="px-6 py-4 text-sm">{guest.checkOut ? new Date(guest.checkOut).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
