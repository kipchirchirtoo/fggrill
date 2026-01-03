'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layout, Users, Calendar, Coffee, Search, CreditCard, PlusCircle,
  CheckCircle, DollarSign, LogIn, LogOut, Clock, Bed, AlertCircle,
  RefreshCw, Bell, Star, Key, Phone, Mail, MapPin, Sparkles,
  ChevronRight, ArrowUpRight, ArrowDownRight, Timer, UserCheck,
  Home, Utensils, Car, Wifi, Sun, Moon, CloudSun, Zap, Heart,
  Shield, Award, TrendingUp, Eye, MessageSquare, Settings, Building2
} from 'lucide-react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { bookingsAPI, roomsAPI } from '@/lib/api';
import {
  CheckInModal,
  CheckOutModal,
  RoomServiceModal,
  InvoiceModal,
  EventModal,
  ReservationModal
} from '@/components/modals';
import Link from 'next/link';
import { subscribeToReceptionRealtime } from '@/lib/realtime';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

// Types
interface Room {
  id: string;
  room_number: string;
  type: string | { id?: number; name: string };
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'reserved';
  floor: number;
  guest_name?: string;
  check_out_date?: string;
}

// Helper to get room type display text
const getRoomTypeText = (type: string | { id?: number; name: string } | null | undefined): string => {
  if (!type) return 'STD';
  if (typeof type === 'string') return type.substring(0, 3).toUpperCase();
  if (typeof type === 'object' && type.name && typeof type.name === 'string') {
    return type.name.substring(0, 3).toUpperCase();
  }
  return 'STD';
};

interface Arrival {
  id: string;
  guest_name: string;
  room_number: string;
  room_type: string;
  check_in_time: string;
  guests: number;
  is_vip: boolean;
  special_requests?: string;
  phone?: string;
}

interface Departure {
  id: string;
  guest_name: string;
  room_number: string;
  check_out_time: string;
  balance: number;
  room_status: string;
}

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'success' | 'vip';
  message: string;
  time: string;
}

export default function ReceptionDashboard(): JSX.Element {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();

  // Modal states
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [rooms, setRooms] = useState<Room[]>([]);
  const [todayArrivals, setTodayArrivals] = useState<Arrival[]>([]);
  const [todayDepartures, setTodayDepartures] = useState<Departure[]>([]);
  const [stats, setStats] = useState({
    available: 0,
    occupied: 0,
    expectedArrivals: 0,
    expectedDepartures: 0,
  });

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch data
  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    const branchId = activeBranchId || undefined;

    try {
      const [bookingsRes, roomsRes] = await Promise.allSettled([
        bookingsAPI.getBookings({ branch_id: branchId, limit: 100 }),
        roomsAPI.getRooms(branchId ? { branch_id: branchId } : undefined)
      ]);

      const bookingsData = bookingsRes.status === 'fulfilled' ? bookingsRes.value?.data || [] : [];
      const roomsData = roomsRes.status === 'fulfilled' ? (roomsRes.value?.data || roomsRes.value?.rooms || []) : [];

      // Process rooms
      const processedRooms: Room[] = roomsData.map((r: any) => ({
        id: r.id,
        room_number: r.room_number || r.roomNumber,
        type: r.type?.name || r.type || 'Standard',
        status: (r.status?.toLowerCase() || 'available') as any,
        floor: r.floor_number || r.floor || Math.ceil(parseInt(r.room_number || '100') / 100),
        guest_name: r.guest ? `${r.guest.first_name} ${r.guest.last_name}` : (r.current_guest ? 'Occupied' : undefined),
        check_out_date: r.check_out
      }));
      setRooms(processedRooms);

      const today = new Date().toISOString().split('T')[0];

      // Filter bookings for stats
      const arrivalsList = bookingsData.filter((b: any) => b.status === 'confirmed' && b.check_in_date && b.check_in_date.startsWith(today));
      const departuresList = bookingsData.filter((b: any) => b.status === 'checked_in' && b.check_out_date && b.check_out_date.startsWith(today));

      setStats({
        available: processedRooms.filter(r => r.status === 'available').length,
        occupied: processedRooms.filter(r => r.status === 'occupied').length,
        expectedArrivals: arrivalsList.length,
        expectedDepartures: departuresList.length,
      });

      // Set arrivals
      setTodayArrivals(arrivalsList.map((b: any) => ({
        id: b.id,
        guest_name: b.guest ? `${b.guest.first_name} ${b.guest.last_name}` : 'Guest',
        room_number: b.room ? b.room.room_number : 'Unassigned',
        room_type: b.room_type ? b.room_type.name : 'Standard',
        check_in_time: new Date(b.check_in_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        guests: (b.adults || 0) + (b.children || 0),
        is_vip: b.guest?.is_vip || false,
        special_requests: b.special_requests,
        phone: b.guest?.phone
      })));

      // Set departures
      setTodayDepartures(departuresList.map((b: any) => ({
        id: b.id,
        guest_name: b.guest ? `${b.guest.first_name} ${b.guest.last_name}` : 'Guest',
        room_number: b.room ? b.room.room_number : '-',
        check_out_time: new Date(b.check_out_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        balance: b.total_amount - (b.deposit_amount || 0),
        room_status: 'Occupied'
      })));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 60000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const filteredRooms = rooms.filter(r =>
    !searchQuery || r.room_number.includes(searchQuery) || r.guest_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ProtectedRoute allowedRoles={[UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6 max-w-[1600px] mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Front Desk Dashboard</h1>
              <p className="text-stone-500 text-sm">
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} • {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <Input
                  placeholder="Search room or guest..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64 bg-white border-stone-200"
                />
              </div>
              <IOSButton onClick={() => setShowReservationModal(true)} className="bg-[#3C3C43] hover:bg-[#000000] text-white">
                <PlusCircle className="h-4 w-4 mr-2" /> New Booking
              </IOSButton>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Available Rooms', value: stats.available, icon: Bed, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Occupied Rooms', value: stats.occupied, icon: UserCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Today Arrivals', value: stats.expectedArrivals, icon: LogIn, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Today Departures', value: stats.expectedDepartures, icon: LogOut, color: 'text-rose-600', bg: 'bg-rose-50' },
            ].map((stat) => (
              <IOSCard key={stat.label} className="p-4 border-none shadow-sm bg-white">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${stat.bg}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-sm text-stone-500 font-medium">{stat.label}</p>
                    <p className="text-2xl font-bold text-stone-900">{stat.value}</p>
                  </div>
                </div>
              </IOSCard>
            ))}
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Room Status Table */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                  <Layout className="h-5 w-5" /> Room Status
                </h2>
                <Link href="/dashboard/reception/rooms" className="text-sm text-blue-600 hover:underline">View All Rooms</Link>
              </div>
              <IOSCard className="overflow-hidden border-none shadow-sm bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-stone-50 border-b border-stone-100">
                      <tr>
                        <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Room</th>
                        <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Guest</th>
                        <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Checkout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {filteredRooms.slice(0, 10).map((room) => (
                        <tr key={room.id} className="hover:bg-stone-50 transition-colors">
                          <td className="px-4 py-3 font-bold text-stone-900">{room.room_number}</td>
                          <td className="px-4 py-3 text-sm text-stone-600">{typeof room.type === 'string' ? room.type : room.type.name}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                              ${room.status === 'available' ? 'bg-emerald-50 text-emerald-700' :
                                room.status === 'occupied' ? 'bg-blue-50 text-blue-700' :
                                  room.status === 'cleaning' ? 'bg-amber-50 text-amber-700' :
                                    'bg-stone-50 text-stone-700'}`}>
                              {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-stone-900">{room.guest_name || '-'}</td>
                          <td className="px-4 py-3 text-sm text-stone-500">
                            {room.check_out_date ? new Date(room.check_out_date).toLocaleDateString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </IOSCard>
            </div>

            {/* Arrivals & Departures */}
            <div className="space-y-6">
              {/* Arrivals */}
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                  <LogIn className="h-5 w-5" /> Today's Arrivals
                </h2>
                <div className="space-y-3">
                  {todayArrivals.length === 0 ? (
                    <div className="p-8 text-center bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200">
                      <p className="text-stone-500 text-sm">No arrivals today</p>
                    </div>
                  ) : todayArrivals.slice(0, 5).map((arrival) => (
                    <IOSCard key={arrival.id} className="p-3 border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-700 font-bold">
                            {arrival.guest_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-stone-900 text-sm">{arrival.guest_name}</p>
                            <p className="text-xs text-stone-500">Room {arrival.room_number} • {arrival.room_type}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-stone-900">{arrival.check_in_time}</p>
                          <Link href="/dashboard/reception/checkin">
                            <button className="text-[10px] text-blue-600 font-bold uppercase mt-1">Check In</button>
                          </Link>
                        </div>
                      </div>
                    </IOSCard>
                  ))}
                </div>
              </div>

              {/* Departures */}
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                  <LogOut className="h-5 w-5" /> Today's Departures
                </h2>
                <div className="space-y-3">
                  {todayDepartures.length === 0 ? (
                    <div className="p-8 text-center bg-stone-50 rounded-2xl border-2 border-dashed border-stone-200">
                      <p className="text-stone-500 text-sm">No departures today</p>
                    </div>
                  ) : todayDepartures.slice(0, 5).map((departure) => (
                    <IOSCard key={departure.id} className="p-3 border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-700 font-bold">
                            {departure.guest_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-stone-900 text-sm">{departure.guest_name}</p>
                            <p className="text-xs text-stone-500">Room {departure.room_number}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-stone-900">{departure.check_out_time}</p>
                          <Link href="/dashboard/reception/checkin">
                            <button className="text-[10px] text-rose-600 font-bold uppercase mt-1">Check Out</button>
                          </Link>
                        </div>
                      </div>
                    </IOSCard>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modals */}
        <CheckInModal isOpen={showCheckInModal} onClose={() => setShowCheckInModal(false)} />
        <CheckOutModal isOpen={showCheckOutModal} onClose={() => setShowCheckOutModal(false)} />
        <ReservationModal isOpen={showReservationModal} onClose={() => setShowReservationModal(false)} />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
