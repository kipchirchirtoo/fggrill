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
import { BranchSelector } from '@/components/dashboard/BranchSelector';
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
  const [showRoomServiceModal, setShowRoomServiceModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  
  // Data states
  const [rooms, setRooms] = useState<Room[]>([]);
  const [todayArrivals, setTodayArrivals] = useState<Arrival[]>([]);
  const [todayDepartures, setTodayDepartures] = useState<Departure[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState({
    totalRooms: 0,
    available: 0,
    occupied: 0,
    cleaning: 0,
    reserved: 0,
    maintenance: 0,
    occupancyRate: 0,
    todayCheckIns: 0,
    todayCheckOuts: 0,
    expectedArrivals: 0,
    expectedDepartures: 0,
    pendingPayments: 0,
    vipGuests: 0
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
        bookingsAPI.getBookings({ branch_id: branchId }),
        roomsAPI.getRooms(branchId)
      ]);

      const bookingsData = bookingsRes.status === 'fulfilled' ? bookingsRes.value?.data || [] : [];
      const roomsData = roomsRes.status === 'fulfilled' ? (roomsRes.value?.rooms || roomsRes.value?.data || []) : [];
      
      // Process rooms
      const processedRooms: Room[] = roomsData.map((r: any) => ({
        id: r.id,
        room_number: r.room_number || r.roomNumber,
        type: r.type?.name || r.type || 'Standard',
        status: (r.status?.toLowerCase() || 'available') as any,
        floor: r.floor_number || r.floor || Math.ceil(parseInt(r.room_number || '100') / 100),
        guest_name: r.current_guest ? 'Occupied' : undefined, // We need to fetch guest details if current_guest is an ID
        check_out_date: r.check_out // If available
      }));
      setRooms(processedRooms);

      // Calculate stats
      const available = processedRooms.filter(r => r.status === 'available').length;
      const occupied = processedRooms.filter(r => r.status === 'occupied').length;
      const cleaning = processedRooms.filter(r => r.status === 'cleaning').length;
      const reserved = processedRooms.filter(r => r.status === 'reserved').length;
      const maintenance = processedRooms.filter(r => r.status === 'maintenance').length;
      
      const checkIns = bookingsData.filter((b: any) => b.status === 'checked_in').length;
      const checkOuts = bookingsData.filter((b: any) => b.status === 'checked_out').length;
      const arrivals = bookingsData.filter((b: any) => b.status === 'confirmed').length;
      const vips = bookingsData.filter((b: any) => b.guest?.is_vip).length;

      setStats({
        totalRooms: processedRooms.length || 0,
        available,
        occupied,
        cleaning,
        reserved,
        maintenance,
        occupancyRate: processedRooms.length > 0 ? Math.round((occupied / processedRooms.length) * 100) : 0,
        todayCheckIns: checkIns,
        todayCheckOuts: checkOuts,
        expectedArrivals: arrivals,
        expectedDepartures: 0, // Need logic for expected departures based on checkout date
        pendingPayments: 0, // Need financial API integration
        vipGuests: vips
      });

      // Set arrivals (Confirmed bookings for today)
      const today = new Date().toISOString().split('T')[0];
      setTodayArrivals(bookingsData
        .filter((b: any) => b.status === 'confirmed' && b.check_in_date && b.check_in_date.startsWith(today))
        .map((b: any) => ({
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

      // Set departures (Checked in bookings with checkout today)
      setTodayDepartures(bookingsData
        .filter((b: any) => b.status === 'checked_in' && b.check_out_date && b.check_out_date.startsWith(today))
        .map((b: any) => ({
          id: b.id,
          guest_name: b.guest ? `${b.guest.first_name} ${b.guest.last_name}` : 'Guest',
          room_number: b.room ? b.room.room_number : '-',
          check_out_time: new Date(b.check_out_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          balance: 0, // Need folio balance
          room_status: 'Occupied'
        })));

      setNotifications([]);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 60000); // Refresh every minute
    // Realtime subscription for instant updates
    const unsubscribe = subscribeToReceptionRealtime(() => {
      // Debounce quick bursts
      fetchDashboardData();
    });
    return () => {
      clearInterval(interval);
      if (unsubscribe) unsubscribe();
    };
  }, [fetchDashboardData]);

  // Helper functions
  const getTimeGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return { text: 'Good Morning', icon: Sun, color: 'text-[#3C3C43]' };
    if (hour < 17) return { text: 'Good Afternoon', icon: CloudSun, color: 'text-[#3C3C43]' };
    return { text: 'Good Evening', icon: Moon, color: 'text-[#3C3C43]' };
  };

  const greeting = getTimeGreeting();
  const GreetingIcon = greeting.icon;

  const getRoomStatusColor = (status: string) => {
    return 'bg-[#3C3C43]';
  };

  const getRoomStatusBg = (status: string) => {
    return 'bg-[#F2F2F7] border-[rgba(60,60,67,0.12)] hover:bg-[#FAFAFA]';
  };

  const getNotificationIcon = (type: string) => {
    return <Bell className="h-4 w-4 text-[#3C3C43]" />;
  };

  const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);
  const filteredRooms = rooms.filter(r => 
    (!selectedFloor || r.floor === selectedFloor) &&
    (!searchQuery || r.room_number.includes(searchQuery) || r.guest_name?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <ProtectedRoute allowedRoles={[UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header Section */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="p-3 bg-[#F2F2F7] rounded-2xl shadow-none 0_1px_3px_rgba(0,0,0,0.04)]"
              >
                <Home className="h-8 w-8 text-[#3C3C43]" />
              </motion.div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">Front Desk</h1>
                  <IOSBadge variant="light" color="secondary" className="border-[rgba(60,60,67,0.12)] text-[#3C3C43]">
                    <Sparkles className="h-3 w-3 mr-1" /> Live
                  </IOSBadge>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <GreetingIcon className={`h-4 w-4 ${greeting.color}`} />
                  <span className="text-gray-600">{greeting.text}, {user?.firstName}!</span>
                  <span className="text-gray-400">|</span>
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="font-mono text-gray-600">
                    {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-500 text-sm">
                    {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search room or guest..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <IOSButton onClick={fetchDashboardData} variant="ghost" size="sm">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </IOSButton>
              <IOSButton onClick={() => setShowReservationModal(true)} className="bg-[#3C3C43] hover:bg-[#000000] text-white" leftIcon={<PlusCircle />}>
                New Booking
              </IOSButton>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <IOSCard className="p-4 bg-[#FFFFFF] border-[rgba(60,60,67,0.12)] rounded-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#8E8E93] text-sm">Available</p>
                    <p className="text-3xl font-bold mt-1 text-[#000000]">{stats.available}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F2F2F7]">
                    <Bed className="h-6 w-6 text-[#3C3C43]" />
                  </div>
                </div>
              </IOSCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <IOSCard className="p-4 bg-[#FFFFFF] border-[rgba(60,60,67,0.12)] rounded-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#8E8E93] text-sm">Occupied</p>
                    <p className="text-3xl font-bold mt-1 text-[#000000]">{stats.occupied}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F2F2F7]">
                    <UserCheck className="h-6 w-6 text-[#3C3C43]" />
                  </div>
                </div>
              </IOSCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <IOSCard className="p-4 bg-[#FFFFFF] border-[rgba(60,60,67,0.12)] rounded-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#8E8E93] text-sm">Arrivals</p>
                    <p className="text-3xl font-bold mt-1 text-[#000000]">{stats.expectedArrivals}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F2F2F7]">
                    <LogIn className="h-6 w-6 text-[#3C3C43]" />
                  </div>
                </div>
              </IOSCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <IOSCard className="p-4 bg-[#FFFFFF] border-[rgba(60,60,67,0.12)] rounded-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#8E8E93] text-sm">Departures</p>
                    <p className="text-3xl font-bold mt-1 text-[#000000]">{stats.expectedDepartures}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F2F2F7]">
                    <LogOut className="h-6 w-6 text-[#3C3C43]" />
                  </div>
                </div>
              </IOSCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <IOSCard className="p-4 bg-[#FFFFFF] border-[rgba(60,60,67,0.12)] rounded-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#8E8E93] text-sm">Occupancy</p>
                    <p className="text-3xl font-bold mt-1 text-[#000000]">{stats.occupancyRate}%</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F2F2F7]">
                    <TrendingUp className="h-6 w-6 text-[#3C3C43]" />
                  </div>
                </div>
              </IOSCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <IOSCard className="p-4 bg-[#FFFFFF] border-[rgba(60,60,67,0.12)] rounded-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#8E8E93] text-sm">VIP Guests</p>
                    <p className="text-3xl font-bold mt-1 text-[#000000]">{stats.vipGuests}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F2F2F7]">
                    <Star className="h-6 w-6 text-[#3C3C43]" />
                  </div>
                </div>
              </IOSCard>
            </motion.div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: 'Check-In', icon: LogIn, action: () => setShowCheckInModal(true) },
              { label: 'Check-Out', icon: LogOut, action: () => setShowCheckOutModal(true) },
              { label: 'Room Service', icon: Utensils, action: () => setShowRoomServiceModal(true) },
              { label: 'Invoice', icon: DollarSign, action: () => setShowInvoiceModal(true) },
              { label: 'Rooms', icon: Key, link: '/dashboard/reception/rooms' },
              { label: 'Guests', icon: Users, link: '/dashboard/reception/guests' },
              { label: 'Bookings', icon: Calendar, link: '/dashboard/reception/reservations' },
              { label: 'Events', icon: Sparkles, action: () => setShowEventModal(true) }
            ].map((item, idx) => (
              <motion.div key={item.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 * idx }}>
                {item.link ? (
                  <Link href={item.link}>
                    <IOSCard className="p-4 cursor-pointer transition-all bg-[#FFFFFF] border-[rgba(60,60,67,0.12)] hover:bg-[#FAFAFA] rounded-xl">
                      <div className="text-center">
                        <item.icon className="h-6 w-6 mx-auto mb-2 text-[#3C3C43]" />
                        <p className="text-sm font-medium text-[#000000]">{item.label}</p>
                      </div>
                    </IOSCard>
                  </Link>
                ) : (
                  <IOSCard 
                    className="p-4 cursor-pointer transition-all bg-[#FFFFFF] border-[rgba(60,60,67,0.12)] hover:bg-[#FAFAFA] rounded-xl"
                    onClick={item.action}
                  >
                    <div className="text-center">
                      <item.icon className="h-6 w-6 mx-auto mb-2 text-[#3C3C43]" />
                      <p className="text-sm font-medium text-[#000000]">{item.label}</p>
                    </div>
                  </IOSCard>
                )}
              </motion.div>
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Room Grid */}
            <IOSCard className="lg:col-span-2 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold font-sf-pro-display flex items-center gap-2">
                  <Bed className="h-5 w-5 text-[#3C3C43]" />
                  Room Status
                </h2>
                <div className="flex items-center gap-2">
                  <select 
                    className="text-sm border rounded-ios-lg px-3 py-1.5"
                    value={selectedFloor || ''}
                    onChange={(e) => setSelectedFloor(e.target.value ? parseInt(e.target.value) : null)}
                  >
                    <option value="">All Floors</option>
                    {floors.map(f => <option key={f} value={f}>Floor {f}</option>)}
                  </select>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 mb-4 text-sm">
                {[
                  { status: 'available', label: 'Available', count: stats.available },
                  { status: 'occupied', label: 'Occupied', count: stats.occupied },
                  { status: 'cleaning', label: 'Cleaning', count: stats.cleaning },
                  { status: 'reserved', label: 'Reserved', count: stats.reserved },
                  { status: 'maintenance', label: 'Maintenance', count: stats.maintenance }
                ].map(item => (
                  <div key={item.status} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${getRoomStatusColor(item.status)}`} />
                    <span className="text-gray-600">{item.label}</span>
                    <IOSBadge variant="light" color="secondary" className="text-xs">{item.count}</IOSBadge>
                  </div>
                ))}
              </div>

              {/* Room Grid */}
              <div className="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2 max-h-80 overflow-y-auto">
                {filteredRooms.length > 0 ? filteredRooms.map(room => (
                  <motion.div
                    key={room.id}
                    whileHover={{ scale: 1.05 }}
                    className={`p-2 rounded-ios-lg border-2 cursor-pointer transition-all ${getRoomStatusBg(room.status)}`}
                    title={room.guest_name ? `${room.guest_name}` : room.status}
                  >
                    <div className="text-center">
                      <p className="font-bold text-sm">{room.room_number}</p>
                      <p className="text-xs text-gray-500">{getRoomTypeText(room.type)}</p>
                    </div>
                  </motion.div>
                )) : (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    <Bed className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No rooms found</p>
                  </div>
                )}
              </div>
            </IOSCard>

            {/* Notifications Panel */}
            <IOSCard className="p-5">
              <h2 className="text-lg font-semibold font-sf-pro-display flex items-center gap-2 mb-4">
                <Bell className="h-5 w-5 text-[#3C3C43]" />
                Live Updates
                <IOSBadge className="bg-[#F2F2F7]0 text-white ml-auto">{notifications.length}</IOSBadge>
              </h2>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                <AnimatePresence>
                  {notifications.map((notif, idx) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`p-3 rounded-ios-lg border ${
                        notif.type === 'vip' ? 'bg-[#F2F2F7] border-[rgba(60,60,67,0.12)]' :
                        notif.type === 'warning' ? 'bg-[#F2F2F7] border-[rgba(60,60,67,0.12)]' :
                        notif.type === 'success' ? 'bg-[#F2F2F7] border-[rgba(60,60,67,0.12)]' :
                        'bg-[#F2F2F7] border-[rgba(60,60,67,0.12)]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {getNotificationIcon(notif.type)}
                        <div className="flex-1">
                          <p className="text-sm">{notif.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{notif.time}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </IOSCard>
          </div>

          {/* Arrivals & Departures */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Today's Arrivals */}
            <IOSCard className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold font-sf-pro-display flex items-center gap-2">
                  <LogIn className="h-5 w-5 text-[#3C3C43]" />
                  Today's Arrivals
                </h2>
                <IOSBadge variant="light" color="secondary" className="bg-[#F2F2F7] text-[#3C3C43]">{todayArrivals.length} guests</IOSBadge>
              </div>
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {todayArrivals.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <LogIn className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No arrivals scheduled today</p>
                  </div>
                ) : todayArrivals.map((arrival, idx) => (
                  <motion.div
                    key={arrival.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-3 bg-gray-50 rounded-ios-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${arrival.is_vip ? 'bg-[#F2F2F7]' : 'bg-[#F2F2F7]'}`}>
                          {arrival.is_vip ? <Star className="h-4 w-4 text-[#3C3C43]" /> : <Users className="h-4 w-4 text-[#3C3C43]" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{arrival.guest_name}</p>
                            {arrival.is_vip && <IOSBadge className="bg-[#F2F2F7] text-white text-xs">VIP</IOSBadge>}
                          </div>
                          <p className="text-sm text-gray-500">Room {arrival.room_number} • {arrival.room_type} • {arrival.guests} guest{arrival.guests > 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-[#3C3C43]">{arrival.check_in_time}</p>
                        <IOSButton size="sm" className="mt-1 h-7" onClick={() => setShowCheckInModal(true)}>
                          Check In
                        </IOSButton>
                      </div>
                    </div>
                    {arrival.special_requests && (
                      <div className="mt-2 p-2 bg-[#F2F2F7] rounded text-xs text-[#3C3C43]">
                        <span className="font-medium">Note:</span> {arrival.special_requests}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </IOSCard>

            {/* Today's Departures */}
            <IOSCard className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold font-sf-pro-display flex items-center gap-2">
                  <LogOut className="h-5 w-5 text-[#3C3C43]" />
                  Today's Departures
                </h2>
                <IOSBadge variant="light" color="secondary" className="bg-[#F2F2F7] text-[#3C3C43]">{todayDepartures.length} guests</IOSBadge>
              </div>
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {todayDepartures.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <LogOut className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No departures scheduled today</p>
                  </div>
                ) : todayDepartures.map((departure, idx) => (
                  <motion.div
                    key={departure.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-3 bg-gray-50 rounded-ios-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-[#F2F2F7]">
                          <Key className="h-4 w-4 text-[#3C3C43]" />
                        </div>
                        <div>
                          <p className="font-medium">{departure.guest_name}</p>
                          <p className="text-sm text-gray-500">Room {departure.room_number}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-[#3C3C43]">{departure.check_out_time}</p>
                        {departure.balance > 0 && (
                          <p className="text-xs text-[#8E8E93]0">Balance: KES {departure.balance.toLocaleString()}</p>
                        )}
                        <IOSButton size="sm" variant="secondary" className="mt-1 h-7" onClick={() => setShowCheckOutModal(true)}>
                          Check Out
                        </IOSButton>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </IOSCard>
          </div>

          {/* Footer Quick Links */}
          <IOSCard className="p-4 bg-[#F2F2F7] border-[rgba(60,60,67,0.12)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-[#3C3C43]" />
                <span className="font-medium text-[#3C3C43]">Quick Links</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/dashboard/reception/rooms">
                  <IOSButton variant="secondary" size="sm" className="border-[rgba(60,60,67,0.12)] text-[#3C3C43] hover:bg-[#F2F2F7]" leftIcon={<Bed />}>
                    All Rooms
                  </IOSButton>
                </Link>
                <Link href="/dashboard/reception/guests">
                  <IOSButton variant="secondary" size="sm" className="border-[rgba(60,60,67,0.12)] text-[#3C3C43] hover:bg-[#F2F2F7]" leftIcon={<Users />}>
                    Guest List
                  </IOSButton>
                </Link>
                <Link href="/dashboard/reception/reservations">
                  <IOSButton variant="secondary" size="sm" className="border-[rgba(60,60,67,0.12)] text-[#3C3C43] hover:bg-[#F2F2F7]" leftIcon={<Calendar />}>
                    Reservations
                  </IOSButton>
                </Link>
                <Link href="/dashboard/housekeeping">
                  <IOSButton variant="secondary" size="sm" className="border-[rgba(60,60,67,0.12)] text-[#3C3C43] hover:bg-[#F2F2F7]" leftIcon={<Home />}>
                    Housekeeping
                  </IOSButton>
                </Link>
              </div>
            </div>
          </IOSCard>
        </div>

        {/* Modals */}
        <CheckInModal isOpen={showCheckInModal} onClose={() => setShowCheckInModal(false)} />
        <CheckOutModal isOpen={showCheckOutModal} onClose={() => setShowCheckOutModal(false)} />
        <RoomServiceModal isOpen={showRoomServiceModal} onClose={() => setShowRoomServiceModal(false)} />
        <InvoiceModal isOpen={showInvoiceModal} onClose={() => setShowInvoiceModal(false)} />
        <EventModal isOpen={showEventModal} onClose={() => setShowEventModal(false)} />
        <ReservationModal isOpen={showReservationModal} onClose={() => setShowReservationModal(false)} />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
