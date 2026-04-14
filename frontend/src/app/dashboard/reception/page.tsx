'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layout, Users, Calendar, Coffee, Search, CreditCard, PlusCircle,
  CheckCircle, DollarSign, LogIn, LogOut, Clock, Bed, AlertCircle,
  RefreshCw, Bell, Star, Key, Phone, Mail, MapPin, Sparkles,
  ChevronRight, ArrowUpRight, ArrowDownRight, Timer, UserCheck,
  Home, Utensils, Car, Wifi, Sun, Moon, CloudSun, Zap, Heart,
  Shield, Award, TrendingUp, Eye, MessageSquare, Settings, Building2,
  Wallet, Receipt, History, UserPlus, ShieldCheck, FileCheck, Download
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { bookingsAPI, roomsAPI, cashierAPI, conferenceAPI, cateringAPI, attendanceAPI, pettyCashAPI } from '@/lib/api';
import {
  CheckInModal,
  CheckOutModal,
  RoomServiceModal,
  InvoiceModal,
  EventModal,
  ReservationModal,
  ConferenceBookingModal,
  OutsideCateringBookingModal,
  AttendanceModal,
  PettyCashModal,
  AddConferencePaymentModal
} from '@/components/modals';
import Link from 'next/link';
import { subscribeToReceptionRealtime } from '@/lib/realtime';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { CashierModals } from '@/components/modals/CashierModals';
import { downloadInvoicePDF } from '@/lib/invoice-pdf';
import { downloadConferenceInvoicePDF, printConferenceInvoicePDF } from '@/lib/conference-invoice-pdf';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { KeyboardShortcutOverlay } from '@/components/KeyboardShortcutOverlay';
import { useKeyboardShortcutOverlay } from '@/hooks/useKeyboardShortcut';
import { ShortcutBadge } from '@/components/ui/ShortcutBadge';

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
  const shortcutOverlay = useKeyboardShortcutOverlay();

  // Modal states
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showConferenceBookingModal, setShowConferenceBookingModal] = useState(false);
  const [showCateringBookingModal, setShowCateringBookingModal] = useState(false);
  const [showDynamicBillModal, setShowDynamicBillModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showPettyCashModal, setShowPettyCashModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedConferenceBooking, setSelectedConferenceBooking] = useState<any>(null);
  const [selectedBill, setSelectedBill] = useState<any>(null);

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
  const [unpaidBills, setUnpaidBills] = useState<any[]>([]);
  const [creditBills, setCreditBills] = useState<any[]>([]);
  const [cashierStats, setCashierStats] = useState<any>(null);
  const [conferenceBookings, setConferenceBookings] = useState<any[]>([]);
  const [conferenceHalls, setConferenceHalls] = useState<any[]>([]);
  const [cateringBookings, setCateringBookings] = useState<any[]>([]);
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);

  const activeTab = useSearchParams().get('view') || 'overview';

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch data
  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    const branchId = activeBranchId;
    if (!branchId) return;

    try {
      const [bookingsRes, roomsRes, paymentsRes] = await Promise.allSettled([
        bookingsAPI.getBookings({ branch_id: (branchId as any), limit: 100 }),
        roomsAPI.getRooms((branchId as any) ? { branch_id: (branchId as any) } : undefined),
        cashierAPI.getPayments({ branch_id: branchId as any, limit: 50 })
      ]);

      const bookingsData = bookingsRes.status === 'fulfilled' ? (bookingsRes.value?.data || (bookingsRes.value as any)?.bookings || []) : [];
      const roomsData = roomsRes.status === 'fulfilled' ? (roomsRes.value?.data || (roomsRes.value as any)?.rooms || []) : [];
      const paymentsData = paymentsRes.status === 'fulfilled' ? (paymentsRes.value?.data || (paymentsRes.value as any)?.payments || []) : [];

      setAllBookings(Array.isArray(bookingsData) ? bookingsData : []);
      setRecentPayments(Array.isArray(paymentsData) ? paymentsData : []);

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
      const arrivalsList = bookingsData.filter((b: any) => b.status === 'confirmed' && b.check_in && b.check_in.startsWith(today));
      const departuresList = bookingsData.filter((b: any) => b.status === 'checked_in' && b.check_out && b.check_out.startsWith(today));

      setStats({
        available: processedRooms.filter(r => r.status === 'available').length,
        occupied: processedRooms.filter(r => r.status === 'occupied').length,
        expectedArrivals: arrivalsList.length,
        expectedDepartures: departuresList.length,
      });

      // Set arrivals
      setTodayArrivals(arrivalsList.map((b: any) => ({
        id: b.id,
        guest_name: b.guest_name || 'Guest',
        room_number: b.room_number || 'Unassigned',
        room_type: b.room_type || 'Standard',
        check_in_time: b.check_in ? new Date(b.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        guests: (b.adults || 0) + (b.children || 0),
        is_vip: false,
        special_requests: b.special_requests,
        phone: b.guest_phone
      })));

      // Set departures
      setTodayDepartures(departuresList.map((b: any) => ({
        id: b.id,
        guest_name: b.guest_name || 'Guest',
        room_number: b.room_number || '-',
        check_out_time: b.check_out ? new Date(b.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        balance: b.balance || 0,
        room_status: 'Occupied'
      })));

      // Fetch Conference Data
      const [hallsRes, confBookingsRes] = await Promise.allSettled([
        conferenceAPI.getHalls(branchId as any),
        conferenceAPI.getBookings({ branch_id: branchId as any, status: 'confirmed' })
      ]);

      if (hallsRes.status === 'fulfilled' && hallsRes.value.success) {
        setConferenceHalls(hallsRes.value.data || []);
      }
      if (confBookingsRes.status === 'fulfilled' && confBookingsRes.value.success) {
        setConferenceBookings(confBookingsRes.value.data || []);
      }

      // Fetch Catering Data
      const cateringRes = await cateringAPI.getBookings({ branch_id: branchId as any, status: 'confirmed' });
      if (cateringRes.success) {
        setCateringBookings(cateringRes.data || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId]);

  const handleDownloadCateringInvoice = async (b: any) => {
    const toastId = toast.loading(`Generating invoice for ${b.customer_name}...`);
    try {
      // Map catering booking to InvoiceData format
      const invoiceData = {
        id: b.id,
        invoice_number: b.booking_number || `CAT-${b.id.slice(0, 8).toUpperCase()}`,
        invoice_date: b.created_at || new Date().toISOString(),
        status: b.status || 'confirmed',
        total_amount: b.total_amount,
        subtotal: b.total_amount,
        vat_amount: 0,
        customer: {
          name: b.customer_name,
          customer_name: b.customer_name,
          phone: b.customer_phone,
        },
        items: [
          {
            description: `Outside Catering - ${b.event_location} (${b.guest_count} guests)`,
            quantity: 1,
            unit_price: b.total_amount,
            total_amount: b.total_amount,
            vat_rate: 0
          }
        ],
        notes: `Event Date: ${new Date(b.event_date).toLocaleDateString()} at ${new Date(b.event_date).toLocaleTimeString()}\nMenu: ${b.menu_details || 'Standard Menu'}\n${b.notes || ''}`
      };

      await downloadInvoicePDF(invoiceData as any);
      toast.success("Invoice downloaded successfully", { id: toastId });
    } catch (error) {
      console.error("Catering invoice generation failed:", error);
      toast.error("Failed to generate catering invoice", { id: toastId });
    }
  };

  const fetchCashierData = useCallback(async () => {
    const branchId = activeBranchId;
    if (!branchId) return;
    try {
      const [unpaidRes, creditRes, statsRes] = await Promise.all([
        cashierAPI.getUnpaidBills({ branch_id: branchId as any }),
        cashierAPI.getCreditBills({ branch_id: branchId as any }),
        cashierAPI.getStats(branchId as any)
      ]);

      if (unpaidRes.success) setUnpaidBills(unpaidRes.data || []);
      if (creditRes.success) setCreditBills(creditRes.data || []);
      if (statsRes.success) setCashierStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching cashier data:', error);
    }
  }, [activeBranchId]);

  useEffect(() => {
    if (activeBranchId) {
      fetchDashboardData();
      fetchCashierData();
      const interval = setInterval(() => {
        fetchDashboardData();
        fetchCashierData();
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [activeBranchId, fetchDashboardData, fetchCashierData]);

  const filteredRooms = rooms.filter(r =>
    !searchQuery || r.room_number.includes(searchQuery) || r.guest_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Keyboard shortcuts
  useKeyboardShortcut('ctrl+n', () => setShowReservationModal(true), { enabled: true });
  useKeyboardShortcut('ctrl+i', () => setShowCheckInModal(true), { enabled: true });
  useKeyboardShortcut('ctrl+o', () => setShowCheckOutModal(true), { enabled: true });
  useKeyboardShortcut('ctrl+r', fetchDashboardData, { enabled: true });
  useKeyboardShortcut(['/', 'f2'], () => {
    const input = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
    if (input) { input.focus(); input.select(); }
  }, { enabled: true });

  return (
    <ProtectedRoute allowedRoles={[UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6 max-w-[1600px] mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Front Desk Dashboard</h1>
              <p className="text-stone-500 text-sm">
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} • {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} • Press ? for shortcuts
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <Input
                  placeholder="Search room or guest..."
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64 bg-white border-stone-200"
                />
              </div>
              <div className="flex items-center gap-2 p-1 bg-stone-100 rounded-xl">
                <button
                  onClick={() => setShowAttendanceModal(true)}
                  className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-blue-600"
                  title="Staff Attendance"
                >
                  <Clock className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setShowPettyCashModal(true)}
                  className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-amber-600"
                  title="Petty Cash"
                >
                  <Wallet className="h-5 w-5" />
                </button>
              </div>
              <IOSButton onClick={() => setShowReservationModal(true)} className="bg-[#3C3C43] hover:bg-[#000000] text-white flex items-center gap-1">
                <PlusCircle className="h-4 w-4 mr-2" /> New Booking <ShortcutBadge shortcut="ctrl+n" variant="inline" />
              </IOSButton>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl w-fit">
            {[
              { id: 'overview', label: 'Overview', icon: Layout },
              { id: 'conference', label: 'Conference', icon: Calendar },
              { id: 'catering', label: 'Catering', icon: Utensils },
              { id: 'cashier', label: 'Cashier', icon: Wallet },
              { id: 'history', label: 'History', icon: History },
            ].map((tab) => (
              <Link
                key={tab.id}
                href={`?view=${tab.id}`}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${activeTab === tab.id
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'}`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </Link>
            ))}
          </div>

          {activeTab === 'overview' ? (
            <>
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
                                <button className="text-[10px] text-blue-600 font-bold uppercase mt-1 flex items-center gap-1">
                                  Check In <ShortcutBadge shortcut="ctrl+i" variant="compact" className="opacity-60" />
                                </button>
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
                                <button className="text-[10px] text-rose-600 font-bold uppercase mt-1 flex items-center gap-1">
                                  Check Out <ShortcutBadge shortcut="ctrl+o" variant="compact" className="opacity-60" />
                                </button>
                              </Link>
                            </div>
                          </div>
                        </IOSCard>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : activeTab === 'conference' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                  <Building2 className="h-6 w-6 text-indigo-600" />
                  Conference Halls & Bookings
                </h2>
                <IOSButton
                  onClick={() => setShowConferenceBookingModal(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <PlusCircle className="h-4 w-4 mr-2" /> Book Conference Hall
                </IOSButton>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Halls List */}
                <div className="lg:col-span-1 space-y-4">
                  <h3 className="font-semibold text-stone-700">Available Halls</h3>
                  <div className="space-y-3">
                    {conferenceHalls.map(hall => (
                      <IOSCard key={hall.id} className="p-4 bg-white border-none shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-stone-900">{hall.name}</h4>
                          <select
                            value={hall.status}
                            onChange={async (e) => {
                              const newStatus = e.target.value;
                              try {
                                await conferenceAPI.updateHall(hall.id, { status: newStatus });
                                toast.success(`Hall status updated to ${newStatus}`);
                                // Refresh halls
                                const hallsRes = await conferenceAPI.getHalls(activeBranchId as any);
                                if (hallsRes.success) {
                                  setConferenceHalls(hallsRes.data || []);
                                }
                              } catch (error) {
                                toast.error('Failed to update hall status');
                              }
                            }}
                            className={`px-2 py-1 text-xs font-medium rounded-full border-none cursor-pointer ${
                              hall.status === 'available' ? 'bg-emerald-50 text-emerald-700' :
                              hall.status === 'occupied' ? 'bg-blue-50 text-blue-700' :
                              hall.status === 'maintenance' ? 'bg-amber-50 text-amber-700' :
                              'bg-stone-50 text-stone-700'
                            }`}
                          >
                            <option value="available">Available</option>
                            <option value="occupied">Occupied</option>
                            <option value="maintenance">Maintenance</option>
                            <option value="unavailable">Unavailable</option>
                          </select>
                        </div>
                        <p className="text-sm text-stone-500 mb-3 line-clamp-2">{hall.description}</p>
                        <div className="flex items-center gap-4 text-xs text-stone-600">
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {hall.capacity}</span>
                          <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> {hall.base_price_per_day}/day</span>
                        </div>
                      </IOSCard>
                    ))}
                  </div>
                </div>

                {/* Upcoming Bookings */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="font-semibold text-stone-700">Active & Upcoming Bookings</h3>
                  <IOSCard className="overflow-hidden border-none shadow-sm bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-stone-50 border-b border-stone-100">
                          <tr>
                            <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Client / Company</th>
                            <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Hall & Event</th>
                            <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">PAX</th>
                            <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Dates</th>
                            <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Financials</th>
                            <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50">
                          {conferenceBookings.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="px-4 py-8 text-center text-stone-500 italic">No conference bookings found</td>
                            </tr>
                          ) : conferenceBookings.map((b: any) => (
                            <tr key={b.id} className="hover:bg-stone-50 transition-colors">
                              <td className="px-4 py-3">
                                <p className="font-bold text-stone-900">{b.company_name || b.customer_name}</p>
                                <p className="text-[10px] text-stone-500">{b.contact_person || b.customer_phone}</p>
                                <p className="text-[10px] font-medium text-blue-600 mt-0.5">{b.invoice_number}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-sm font-medium text-stone-800">{b.hall?.name || 'Hall'}</p>
                                <p className="text-[10px] text-stone-500">{b.activity_type || 'Convention'}</p>
                              </td>
                              <td className="px-4 py-3 text-sm text-stone-600 font-medium">
                                {b.num_participants || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-stone-600">
                                {new Date(b.start_date).toLocaleDateString()}
                                <div className="text-[10px] text-stone-500">
                                  {new Date(b.start_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(b.end_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <IOSBadge color={b.payment_status === 'paid' ? 'success' : b.payment_status === 'partial' ? 'info' : 'warning'}>
                                  {b.payment_status?.toUpperCase() || 'UNPAID'}
                                </IOSBadge>
                                <div className="text-[10px] text-stone-500 mt-0.5">{b.booking_status}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-bold text-stone-900 text-sm">KES {b.total_amount.toLocaleString()}</div>
                                <div className="text-[10px] text-green-600 font-medium">Paid: KES {(b.amount_paid || 0).toLocaleString()}</div>
                                {b.total_amount - (b.amount_paid || 0) > 0 && (
                                  <div className="text-[10px] text-red-600 font-bold italic">Bal: KES {(b.total_amount - (b.amount_paid || 0)).toLocaleString()}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 flex gap-2">
                                <div className="flex gap-1">
                                  <IOSButton
                                    size="sm"
                                    variant="secondary"
                                    onClick={async () => {
                                      try {
                                        await downloadConferenceInvoicePDF(b);
                                        toast.success('Invoice downloaded');
                                      } catch (error) {
                                        toast.error('Failed to download invoice');
                                      }
                                    }}
                                    className="h-8 px-2 text-xs"
                                    title="Download Invoice"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </IOSButton>
                                  <IOSButton
                                    size="sm"
                                    variant="secondary"
                                    onClick={async () => {
                                      try {
                                        await printConferenceInvoicePDF(b);
                                        toast.success('Invoice sent to printer');
                                      } catch (error) {
                                        toast.error('Failed to print invoice');
                                      }
                                    }}
                                    className="h-8 px-2 text-xs"
                                    title="Print Invoice"
                                  >
                                    <Receipt className="h-3.5 w-3.5" />
                                  </IOSButton>
                                </div>
                                {b.payment_status !== 'paid' && b.invoice_number && (
                                  <Link href={`/dashboard/cashier?invoice=${b.invoice_number}`}>
                                    <IOSButton
                                      size="sm"
                                      className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white border-none"
                                    >
                                      Pay
                                    </IOSButton>
                                  </Link>
                                )}
                                {b.payment_status !== 'paid' && !b.invoice_number && (
                                  <IOSButton
                                    size="sm"
                                    disabled
                                    className="h-8 px-3 text-xs opacity-50"
                                    title="Invoice number not generated"
                                  >
                                    Pay
                                  </IOSButton>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </IOSCard>
                </div>
              </div>
            </div>
          ) : activeTab === 'catering' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                  <Utensils className="h-6 w-6 text-orange-600" />
                  Outside Catering Bookings
                </h2>
                <IOSButton
                  onClick={() => setShowCateringBookingModal(true)}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  <PlusCircle className="h-4 w-4 mr-2" /> Book Catering Event
                </IOSButton>
              </div>

              <IOSCard className="overflow-hidden border-none shadow-sm bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-stone-50 border-b border-stone-100">
                      <tr>
                        <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Customer</th>
                        <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Location</th>
                        <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Details</th>
                        <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Amount</th>
                        <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {cateringBookings.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-stone-500 italic">No catering bookings found</td>
                        </tr>
                      ) : cateringBookings.map((b: any) => (
                        <tr key={b.id} className="hover:bg-stone-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-stone-900">
                            {b.customer_name}
                            <div className="text-[10px] text-stone-500">{b.customer_phone}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-stone-600">
                            {b.event_location}
                            <div className="text-[10px] text-stone-500">
                              {new Date(b.event_date).toLocaleDateString()} at {new Date(b.event_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-stone-600">
                            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {b.guest_count} guests</span>
                            <div className="text-[10px] text-stone-500 truncate max-w-[200px]">{b.menu_details || 'Standard Menu'}</div>
                          </td>
                          <td className="px-4 py-3">
                            <IOSBadge color={b.payment_status === 'paid' ? 'success' : 'warning'}>
                              {b.status}
                            </IOSBadge>
                          </td>
                          <td className="px-4 py-3 font-bold text-orange-600">KES {b.total_amount.toLocaleString()}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleDownloadCateringInvoice(b)}
                              className="p-2 text-stone-400 hover:text-orange-600 hover:bg-orange-50 rounded-full transition-all"
                              title="Download Invoice"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </IOSCard>
            </div>
          ) : activeTab === 'cashier' ? (
            <div className="space-y-6">
              {/* Cashier Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <IOSCard className="p-4 bg-white border-none shadow-sm">
                  <p className="text-xs text-stone-500 font-medium">Today's Revenue</p>
                  <p className="text-xl font-bold text-stone-900">KES {cashierStats?.today_payments?.toLocaleString() || '0'}</p>
                </IOSCard>
                <IOSCard className="p-4 bg-white border-none shadow-sm">
                  <p className="text-xs text-stone-500 font-medium">Pending Confirmation</p>
                  <p className="text-xl font-bold text-amber-600">{unpaidBills.filter((b: any) => !b.accountant_confirmed_at || !b.auditor_confirmed_at).length} Bills</p>
                </IOSCard>
                <IOSCard className="p-4 bg-white border-none shadow-sm">
                  <p className="text-xs text-stone-500 font-medium">Active Credit Bills</p>
                  <p className="text-xl font-bold text-rose-600">{creditBills.filter((b: any) => b.status === 'unpaid').length} Items</p>
                </IOSCard>
                <IOSButton
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDynamicBillModal(true);
                  }}
                  className="h-full bg-emerald-600 text-white hover:bg-emerald-700 rounded-2xl"
                >
                  <PlusCircle className="h-4 w-4 mr-2" /> Dynamic Bill
                </IOSButton>
              </div>

              {/* Revenue Breakdown */}
              {cashierStats?.revenueBreakdown && Object.keys(cashierStats.revenueBreakdown).length > 0 && (
                <IOSCard className="p-4 bg-white border-none shadow-sm">
                  <h4 className="text-xs font-bold text-stone-400 uppercase mb-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Revenue Distribution
                  </h4>
                  <div className="space-y-4">
                    {Object.entries(cashierStats.revenueBreakdown).map(([type, amount]: [string, any]) => (
                      <div key={type} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-stone-600 font-medium capitalize">{type.replace('_', ' ')}</span>
                          <span className="text-stone-900 font-bold">KES {amount.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((amount / (cashierStats.todayRevenue || 1)) * 100, 100)}%` }}
                            className="bg-emerald-500 h-full rounded-full"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </IOSCard>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Unconfirmed Bills Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                    <Receipt className="h-5 w-5" /> Unconfirmed Bills
                  </h3>
                  <IOSCard className="bg-white overflow-hidden border-none shadow-sm">
                    <div className="divide-y divide-stone-100">
                      {unpaidBills.length === 0 ? (
                        <div className="p-8 text-center text-stone-500">No pending bills</div>
                      ) : unpaidBills.map((bill: any) => (
                        <div key={bill.id} className="p-4 hover:bg-stone-50 transition-colors flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-stone-900">#{bill.bill_number}</span>
                              <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{bill.bill_type || bill.source}</span>
                            </div>
                            <p className="text-sm text-stone-600">{bill.customer_name || 'Walk-in Customer'}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <p className="text-xs text-stone-400">{new Date(bill.created_at).toLocaleString()}</p>
                              <div className="flex items-center gap-2">
                                <span title="Accountant Confirmation">
                                  <ShieldCheck className={`h-3.5 w-3.5 ${bill.accountant_confirmed_at ? 'text-emerald-500' : 'text-stone-300'}`} />
                                </span>
                                <span title="Auditor Confirmation">
                                  <FileCheck className={`h-3.5 w-3.5 ${bill.auditor_confirmed_at ? 'text-blue-500' : 'text-stone-300'}`} />
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-4">
                            <div>
                              <p className="font-bold text-stone-900">KES {bill.total_amount?.toLocaleString()}</p>
                            </div>
                            <IOSButton
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-stone-100 rounded-full"
                              onClick={() => setSelectedBill(bill)}
                            >
                              <ChevronRight className="h-4 w-4 text-stone-400" />
                            </IOSButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  </IOSCard>
                </div>

                {/* Recent Credit Bills */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                    <UserPlus className="h-5 w-5 text-rose-500" /> Recent Credit Bills
                  </h3>
                  <IOSCard className="bg-white overflow-hidden border-none shadow-sm">
                    <div className="divide-y divide-stone-100">
                      {creditBills.length === 0 ? (
                        <div className="p-8 text-center text-stone-500">No credit bills</div>
                      ) : creditBills.slice(0, 10).map((bill: any) => (
                        <div key={bill.id} className="p-4 hover:bg-stone-50 transition-colors flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-stone-900">#{bill.bill_number}</span>
                              <span className="text-xs px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full">Credit</span>
                            </div>
                            <p className="text-sm text-stone-600">{bill.staff_name || bill.customer_name}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <p className="text-xs text-stone-400">{new Date(bill.created_at).toLocaleDateString()}</p>
                              <div className="flex items-center gap-2">
                                <span title="Accountant Confirmation">
                                  <ShieldCheck className={`h-3.5 w-3.5 ${bill.accountant_confirmed_at ? 'text-emerald-500' : 'text-stone-300'}`} />
                                </span>
                                <span title="Auditor Confirmation">
                                  <FileCheck className={`h-3.5 w-3.5 ${bill.auditor_confirmed_at ? 'text-blue-500' : 'text-stone-300'}`} />
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-4">
                            <div>
                              <p className="font-bold text-stone-900">KES {bill.total_amount?.toLocaleString()}</p>
                            </div>
                            <IOSButton
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-stone-100 rounded-full"
                              onClick={() => setSelectedBill(bill)}
                            >
                              <ChevronRight className="h-4 w-4 text-stone-400" />
                            </IOSButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  </IOSCard>
                </div>
              </div>
            </div>
          ) : activeTab === 'history' ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                  <History className="h-6 w-6 text-blue-600" />
                  Activity History & Logs
                </h2>
                <div className="flex gap-2">
                  <IOSButton variant="secondary" size="sm" onClick={() => fetchDashboardData()} className="flex items-center gap-1">
                    <RefreshCw className="h-4 w-4 mr-2" /> Refresh <ShortcutBadge shortcut="ctrl+r" variant="compact" className="opacity-50" />
                  </IOSButton>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Bookings History */}
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider">Recent Bookings History</h3>
                  <IOSCard className="overflow-hidden border-none shadow-sm bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-sans">
                        <thead className="bg-stone-50 border-b border-stone-100">
                          <tr>
                            <th className="px-4 py-3 text-[11px] font-bold text-stone-400 uppercase">Ref #</th>
                            <th className="px-4 py-3 text-[11px] font-bold text-stone-400 uppercase">Guest</th>
                            <th className="px-4 py-3 text-[11px] font-bold text-stone-400 uppercase">Room</th>
                            <th className="px-4 py-3 text-[11px] font-bold text-stone-400 uppercase">Status</th>
                            <th className="px-4 py-3 text-[11px] font-bold text-stone-400 uppercase text-right">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50">
                          {allBookings.length === 0 ? (
                            <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400 italic">No bookings found</td></tr>
                          ) : allBookings.slice(0, 50).map((b: any) => (
                            <tr key={b.id} className="hover:bg-stone-50/50 transition-colors">
                              <td className="px-4 py-3 text-xs font-mono font-bold text-blue-600">{b.booking_number?.slice(-8) || b.id.slice(0, 8)}</td>
                              <td className="px-4 py-3 text-sm">
                                <span className="font-bold text-stone-900">{b.guest_name || 'Walk-in'}</span>
                                <div className="text-[10px] text-stone-400">{b.guest_phone || '-'}</div>
                              </td>
                              <td className="px-4 py-3 text-sm text-stone-600 font-medium">Room {b.room_number || 'N/A'}</td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full
                                  ${b.status === 'checked_in' ? 'bg-blue-50 text-blue-600' :
                                    b.status === 'checked_out' ? 'bg-emerald-50 text-emerald-600' :
                                      b.status === 'cancelled' ? 'bg-rose-50 text-rose-600' :
                                        'bg-stone-100 text-stone-500'}`}>
                                  {b.status.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-[11px] text-stone-500 text-right">
                                {new Date(b.created_at).toLocaleDateString()}
                                <div className="text-[9px] opacity-75">{new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </IOSCard>
                </div>

                {/* Payments Log */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider">Recent Payments</h3>
                  <IOSCard className="p-0 border-none shadow-sm bg-white overflow-hidden">
                    <div className="divide-y divide-stone-50">
                      {recentPayments.length === 0 ? (
                        <div className="p-8 text-center text-stone-400 italic">No payments found</div>
                      ) : recentPayments.slice(0, 50).map((p: any) => (
                        <div key={p.id} className="p-4 hover:bg-stone-50/50 transition-colors flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                              <DollarSign className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-stone-900">{p.customer_name || 'Walk-in Guest'}</p>
                              <p className="text-[10px] text-stone-400 font-medium uppercase tracking-tight">{p.payment_method} • {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-emerald-600">+{p.amount?.toLocaleString()}</p>
                            <p className="text-[10px] text-stone-400 italic">verified</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {recentPayments.length > 0 && (
                      <div className="p-3 bg-stone-50 border-t border-stone-100 text-center">
                        <span className="text-[11px] font-bold text-stone-400">Showing last {Math.min(recentPayments.length, 50)} transactions</span>
                      </div>
                    )}
                  </IOSCard>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-[32px] shadow-sm border border-stone-100">
              <History className="h-12 w-12 text-stone-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-stone-900 shadow-sm">Coming Soon</h3>
              <p className="text-stone-500">Advanced analytics and historical reports are being implemented.</p>
            </div>
          )}
        </div>

        {/* Modals */}
        <CheckInModal isOpen={showCheckInModal} onClose={() => setShowCheckInModal(false)} />
        <CheckOutModal isOpen={showCheckOutModal} onClose={() => setShowCheckOutModal(false)} />
        <ReservationModal isOpen={showReservationModal} onClose={() => setShowReservationModal(false)} />
        <AnimatePresence mode="wait">
          {showDynamicBillModal && (
            <CashierModals.CreateDynamicBillModal
              isOpen={showDynamicBillModal}
              onClose={() => setShowDynamicBillModal(false)}
              onSuccess={() => {
                setShowDynamicBillModal(false);
                fetchCashierData();
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {selectedBill && (
            <CashierModals.BillDetailsModal
              isOpen={!!selectedBill}
              bill={selectedBill}
              // Distinguish by checking for employee_id or if it came from credit list
              type={selectedBill?.employee_id || selectedBill?.credit_limit ? 'credit' : 'unpaid'}
              onClose={() => setSelectedBill(null)}
              onSuccess={() => {
                fetchCashierData();
                setSelectedBill(null);
              }}
            />
          )}
        </AnimatePresence>

        <ConferenceBookingModal
          isOpen={showConferenceBookingModal}
          onClose={() => setShowConferenceBookingModal(false)}
          onSuccess={fetchDashboardData}
        />

        <OutsideCateringBookingModal
          isOpen={showCateringBookingModal}
          onClose={() => setShowCateringBookingModal(false)}
          onSuccess={fetchDashboardData}
        />

        <AttendanceModal
          isOpen={showAttendanceModal}
          onClose={() => setShowAttendanceModal(false)}
          onSuccess={() => { }}
        />

        <PettyCashModal
          isOpen={showPettyCashModal}
          onClose={() => setShowPettyCashModal(false)}
          onSuccess={() => { }}
        />

        <AddConferencePaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedConferenceBooking(null);
          }}
          booking={selectedConferenceBooking}
          onSuccess={() => {
            // Refresh dashboard to show updated payment status
            if (typeof (fetchDashboardData as any) === 'function') {
              (fetchDashboardData as any)();
            } else {
              window.location.reload();
            }
          }}
        />

        <KeyboardShortcutOverlay
          isOpen={shortcutOverlay.isOpen}
          onClose={shortcutOverlay.close}
          currentModule="reception"
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
