'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { motion } from 'framer-motion';
import {
  LogIn,
  LogOut,
  Search,
  User,
  Calendar,
  Clock,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Bed,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { bookingsAPI, roomsAPI } from '@/lib/api';

export default function AdminCheckInOutPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'checkin' | 'checkout'>('checkin');
  const [searchTerm, setSearchTerm] = useState('');
  const [arrivals, setArrivals] = useState<any[]>([]);
  const [departures, setDepartures] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const bookingsRes = await bookingsAPI.getBookings().catch(() => ({ bookings: [] }));
      const bookings = bookingsRes.bookings || bookingsRes.data || [];
      
      // Filter arrivals (confirmed bookings for today)
      const today = new Date().toISOString().split('T')[0];
      const arrivalsData = bookings.filter((b: any) => 
        (b.status === 'confirmed' || b.status === 'pending') && 
        b.check_in_date?.startsWith(today)
      );
      
      // Filter departures (checked-in guests leaving today)
      const departuresData = bookings.filter((b: any) => 
        b.status === 'checked_in' && 
        b.check_out_date?.startsWith(today)
      );
      
      setArrivals(arrivalsData);
      setDepartures(departuresData);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckIn = async (bookingId: string) => {
    try {
      await bookingsAPI.checkIn(bookingId, { checked_in_at: new Date().toISOString() });
      toast.success('Guest checked in successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to check in guest');
    }
  };

  const handleCheckOut = async (bookingId: string) => {
    try {
      await bookingsAPI.checkOut(bookingId, { checked_out_at: new Date().toISOString() });
      toast.success('Guest checked out successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to check out guest');
    }
  };

  const filteredArrivals = arrivals.filter(a => 
    a.guest_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.room_number?.includes(searchTerm)
  );

  const filteredDepartures = departures.filter(d => 
    d.guest_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.room_number?.includes(searchTerm)
  );

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Check In / Check Out</h1>
              <p className="text-gray-600 mt-1">Manage guest arrivals and departures</p>
            </div>
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <LogIn className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Expected Arrivals</p>
                  <p className="text-2xl font-bold">{arrivals.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <LogOut className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Expected Departures</p>
                  <p className="text-2xl font-bold">{departures.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Checked In Today</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Late Check-outs</p>
                  <p className="text-2xl font-bold">0</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex gap-8">
              <button
                onClick={() => setActiveTab('checkin')}
                className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm ${
                  activeTab === 'checkin'
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <LogIn className="h-4 w-4" />
                Check In ({arrivals.length})
              </button>
              <button
                onClick={() => setActiveTab('checkout')}
                className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm ${
                  activeTab === 'checkout'
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <LogOut className="h-4 w-4" />
                Check Out ({departures.length})
              </button>
            </nav>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by guest name or room number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
              <p className="mt-4 text-gray-500">Loading...</p>
            </div>
          ) : activeTab === 'checkin' ? (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {filteredArrivals.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <LogIn className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No arrivals expected</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-in Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nights</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredArrivals.map((arrival) => (
                      <tr key={arrival.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                              <User className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{arrival.guest_name}</p>
                              <p className="text-sm text-gray-500">{arrival.guest_email || arrival.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Bed className="h-4 w-4 text-gray-400" />
                            <span>Room {arrival.room_number}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {arrival.check_in_date ? new Date(arrival.check_in_date).toLocaleTimeString() : '2:00 PM'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{arrival.nights || 1}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                            {arrival.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleCheckIn(arrival.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                          >
                            Check In
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {filteredDepartures.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <LogOut className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No departures expected</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-out Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredDepartures.map((departure) => (
                      <tr key={departure.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center">
                              <User className="h-5 w-5 text-orange-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{departure.guest_name}</p>
                              <p className="text-sm text-gray-500">{departure.guest_email || departure.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Bed className="h-4 w-4 text-gray-400" />
                            <span>Room {departure.room_number}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {departure.check_out_date ? new Date(departure.check_out_date).toLocaleTimeString() : '11:00 AM'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`font-medium ${departure.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            KES {(departure.balance || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleCheckOut(departure.id)}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm"
                          >
                            Check Out
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
