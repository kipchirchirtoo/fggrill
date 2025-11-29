'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layout, Users, Calendar, Coffee, Search, CreditCard, PlusCircle,
  CheckCircle, DollarSign, LogIn, LogOut, Clock, Bed, AlertCircle,
  RefreshCw, Bell, Star, Key, Phone, Mail, MapPin, Sparkles,
  ChevronRight, ArrowUpRight, ArrowDownRight, Timer, UserCheck,
  Home, Utensils, Car, Wifi, Sun, Moon, CloudSun, Zap, Heart,
  Shield, Award, TrendingUp, Eye, MessageSquare, Settings
} from 'lucide-react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  const fetchDashboardData = async () => {
    setIsLoading(true);
    
    try {
      const [bookingsRes, roomsRes] = await Promise.all([
        bookingsAPI.getBookings(),
        roomsAPI.getRooms()
      ]);

      const bookingsData = bookingsRes.bookings || bookingsRes.data || bookingsRes || [];
      const roomsData = roomsRes.rooms || roomsRes.data || roomsRes || [];
      
      const bookings = Array.isArray(bookingsData) ? bookingsData : [];
      const roomsList = Array.isArray(roomsData) ? roomsData : [];

      // Show empty state if no data
      if (roomsList.length === 0) {
        setIsLoading(false);
        return;
      }

      // Process rooms
      const processedRooms: Room[] = roomsList.map((r: any) => ({
        id: r.id,
        room_number: r.room_number || r.number || `${r.id}`,
        type: r.type || r.room_type || 'Standard',
        status: (r.status?.toLowerCase() || 'available') as any,
        floor: r.floor || Math.ceil(parseInt(r.room_number || '100') / 100),
        guest_name: r.current_guest?.name || r.guest_name,
        check_out_date: r.check_out_date
      }));
      setRooms(processedRooms);

      // Calculate stats
      const available = processedRooms.filter(r => r.status === 'available').length;
      const occupied = processedRooms.filter(r => r.status === 'occupied').length;
      const cleaning = processedRooms.filter(r => r.status === 'cleaning').length;
      const reserved = processedRooms.filter(r => r.status === 'reserved').length;
      const maintenance = processedRooms.filter(r => r.status === 'maintenance').length;
      
      const checkIns = bookings.filter((b: any) => b.status === 'checked_in').length;
      const checkOuts = bookings.filter((b: any) => b.status === 'checked_out').length;
      const arrivals = bookings.filter((b: any) => b.status === 'confirmed' || b.status === 'pending').length;
      const vips = bookings.filter((b: any) => b.is_vip || b.guest_type === 'VIP').length;

      setStats({
        totalRooms: processedRooms.length || 50,
        available,
        occupied,
        cleaning,
        reserved,
        maintenance,
        occupancyRate: processedRooms.length > 0 ? Math.round((occupied / processedRooms.length) * 100) : 75,
        todayCheckIns: checkIns,
        todayCheckOuts: checkOuts,
        expectedArrivals: arrivals,
        expectedDepartures: checkOuts,
        pendingPayments: Math.floor(Math.random() * 5),
        vipGuests: vips
      });

      // Set arrivals
      setTodayArrivals(bookings
        .filter((b: any) => b.status === 'confirmed' || b.status === 'pending')
        .slice(0, 6)
        .map((b: any) => ({
          id: b.id,
          guest_name: b.guest_name || b.guest?.name || 'Guest',
          room_number: b.room_number || b.room?.room_number || '-',
          room_type: typeof b.room_type === 'string' ? b.room_type : (b.room?.type || 'Standard'),
          check_in_time: b.check_in_time || '14:00',
          guests: b.guests || b.number_of_guests || 1,
          is_vip: b.is_vip || b.guest_type === 'VIP',
          special_requests: b.special_requests,
          phone: b.guest_phone || b.phone
        })));

      // Set departures
      setTodayDepartures(bookings
        .filter((b: any) => b.status === 'checked_in')
        .slice(0, 5)
        .map((b: any) => ({
          id: b.id,
          guest_name: b.guest_name || b.guest?.name || 'Guest',
          room_number: b.room_number || b.room?.room_number || '-',
          check_out_time: b.check_out_time || '11:00',
          balance: b.balance || 0,
          room_status: 'Occupied'
        })));

      // Notifications will come from real-time API
      setNotifications([]);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  // Helper functions
  const getTimeGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return { text: 'Good Morning', icon: Sun, color: 'text-amber-500' };
    if (hour < 17) return { text: 'Good Afternoon', icon: CloudSun, color: 'text-orange-500' };
    return { text: 'Good Evening', icon: Moon, color: 'text-indigo-500' };
  };

  const greeting = getTimeGreeting();
  const GreetingIcon = greeting.icon;

  const getRoomStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      available: 'bg-emerald-500',
      occupied: 'bg-blue-500',
      cleaning: 'bg-amber-500',
      reserved: 'bg-purple-500',
      maintenance: 'bg-red-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  const getRoomStatusBg = (status: string) => {
    const colors: Record<string, string> = {
      available: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
      occupied: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
      cleaning: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
      reserved: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
      maintenance: 'bg-red-50 border-red-200 hover:bg-red-100'
    };
    return colors[status] || 'bg-gray-50 border-gray-200';
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'vip': return <Star className="h-4 w-4 text-amber-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <Bell className="h-4 w-4 text-blue-500" />;
    }
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
                className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg"
              >
                <Home className="h-8 w-8 text-white" />
              </motion.div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">Front Desk</h1>
                  <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0">
                    <Sparkles className="h-3 w-3 mr-1" /> Live
                  </Badge>
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
              <Button onClick={fetchDashboardData} variant="outline" size="icon">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button onClick={() => setShowReservationModal(true)} className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
                <PlusCircle className="h-4 w-4 mr-2" />
                New Booking
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0 shadow-lg shadow-emerald-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-emerald-100 text-sm">Available</p>
                    <p className="text-3xl font-bold mt-1">{stats.available}</p>
                  </div>
                  <Bed className="h-8 w-8 text-emerald-200" />
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg shadow-blue-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm">Occupied</p>
                    <p className="text-3xl font-bold mt-1">{stats.occupied}</p>
                  </div>
                  <UserCheck className="h-8 w-8 text-blue-200" />
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="p-4 bg-gradient-to-br from-amber-500 to-orange-500 text-white border-0 shadow-lg shadow-amber-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-100 text-sm">Arrivals</p>
                    <p className="text-3xl font-bold mt-1">{stats.expectedArrivals}</p>
                  </div>
                  <LogIn className="h-8 w-8 text-amber-200" />
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <Card className="p-4 bg-gradient-to-br from-rose-500 to-pink-500 text-white border-0 shadow-lg shadow-rose-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-rose-100 text-sm">Departures</p>
                    <p className="text-3xl font-bold mt-1">{stats.expectedDepartures}</p>
                  </div>
                  <LogOut className="h-8 w-8 text-rose-200" />
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="p-4 bg-gradient-to-br from-purple-500 to-indigo-500 text-white border-0 shadow-lg shadow-purple-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm">Occupancy</p>
                    <p className="text-3xl font-bold mt-1">{stats.occupancyRate}%</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-200" />
                </div>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <Card className="p-4 bg-gradient-to-br from-yellow-500 to-amber-500 text-white border-0 shadow-lg shadow-yellow-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-yellow-100 text-sm">VIP Guests</p>
                    <p className="text-3xl font-bold mt-1">{stats.vipGuests}</p>
                  </div>
                  <Star className="h-8 w-8 text-yellow-200" />
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: 'Check-In', icon: LogIn, color: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200', action: () => setShowCheckInModal(true) },
              { label: 'Check-Out', icon: LogOut, color: 'bg-rose-100 text-rose-700 hover:bg-rose-200', action: () => setShowCheckOutModal(true) },
              { label: 'Room Service', icon: Utensils, color: 'bg-amber-100 text-amber-700 hover:bg-amber-200', action: () => setShowRoomServiceModal(true) },
              { label: 'Invoice', icon: DollarSign, color: 'bg-blue-100 text-blue-700 hover:bg-blue-200', action: () => setShowInvoiceModal(true) },
              { label: 'Rooms', icon: Key, color: 'bg-purple-100 text-purple-700 hover:bg-purple-200', link: '/dashboard/reception/rooms' },
              { label: 'Guests', icon: Users, color: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200', link: '/dashboard/reception/guests' },
              { label: 'Bookings', icon: Calendar, color: 'bg-pink-100 text-pink-700 hover:bg-pink-200', link: '/dashboard/reception/reservations' },
              { label: 'Events', icon: Sparkles, color: 'bg-teal-100 text-teal-700 hover:bg-teal-200', action: () => setShowEventModal(true) }
            ].map((item, idx) => (
              <motion.div key={item.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 * idx }}>
                {item.link ? (
                  <Link href={item.link}>
                    <Card className={`p-4 cursor-pointer transition-all ${item.color} border-0 hover:shadow-md`}>
                      <div className="text-center">
                        <item.icon className="h-6 w-6 mx-auto mb-2" />
                        <p className="text-sm font-medium">{item.label}</p>
                      </div>
                    </Card>
                  </Link>
                ) : (
                  <Card 
                    className={`p-4 cursor-pointer transition-all ${item.color} border-0 hover:shadow-md`}
                    onClick={item.action}
                  >
                    <div className="text-center">
                      <item.icon className="h-6 w-6 mx-auto mb-2" />
                      <p className="text-sm font-medium">{item.label}</p>
                    </div>
                  </Card>
                )}
              </motion.div>
            ))}
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Room Grid */}
            <Card className="lg:col-span-2 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Bed className="h-5 w-5 text-indigo-500" />
                  Room Status
                </h2>
                <div className="flex items-center gap-2">
                  <select 
                    className="text-sm border rounded-lg px-3 py-1.5"
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
                    <Badge variant="outline" className="text-xs">{item.count}</Badge>
                  </div>
                ))}
              </div>

              {/* Room Grid */}
              <div className="grid grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-2 max-h-80 overflow-y-auto">
                {filteredRooms.length > 0 ? filteredRooms.map(room => (
                  <motion.div
                    key={room.id}
                    whileHover={{ scale: 1.05 }}
                    className={`p-2 rounded-lg border-2 cursor-pointer transition-all ${getRoomStatusBg(room.status)}`}
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
            </Card>

            {/* Notifications Panel */}
            <Card className="p-5">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <Bell className="h-5 w-5 text-indigo-500" />
                Live Updates
                <Badge className="bg-red-500 text-white ml-auto">{notifications.length}</Badge>
              </h2>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                <AnimatePresence>
                  {notifications.map((notif, idx) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`p-3 rounded-lg border ${
                        notif.type === 'vip' ? 'bg-amber-50 border-amber-200' :
                        notif.type === 'warning' ? 'bg-orange-50 border-orange-200' :
                        notif.type === 'success' ? 'bg-green-50 border-green-200' :
                        'bg-blue-50 border-blue-200'
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
            </Card>
          </div>

          {/* Arrivals & Departures */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Today's Arrivals */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <LogIn className="h-5 w-5 text-emerald-500" />
                  Today's Arrivals
                </h2>
                <Badge className="bg-emerald-100 text-emerald-700">{todayArrivals.length} guests</Badge>
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
                    className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${arrival.is_vip ? 'bg-amber-100' : 'bg-indigo-100'}`}>
                          {arrival.is_vip ? <Star className="h-4 w-4 text-amber-600" /> : <Users className="h-4 w-4 text-indigo-600" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{arrival.guest_name}</p>
                            {arrival.is_vip && <Badge className="bg-amber-500 text-white text-xs">VIP</Badge>}
                          </div>
                          <p className="text-sm text-gray-500">Room {arrival.room_number} • {arrival.room_type} • {arrival.guests} guest{arrival.guests > 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-emerald-600">{arrival.check_in_time}</p>
                        <Button size="sm" className="mt-1 h-7" onClick={() => setShowCheckInModal(true)}>
                          Check In
                        </Button>
                      </div>
                    </div>
                    {arrival.special_requests && (
                      <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-700">
                        <span className="font-medium">Note:</span> {arrival.special_requests}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </Card>

            {/* Today's Departures */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <LogOut className="h-5 w-5 text-rose-500" />
                  Today's Departures
                </h2>
                <Badge className="bg-rose-100 text-rose-700">{todayDepartures.length} guests</Badge>
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
                    className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-rose-100">
                          <Key className="h-4 w-4 text-rose-600" />
                        </div>
                        <div>
                          <p className="font-medium">{departure.guest_name}</p>
                          <p className="text-sm text-gray-500">Room {departure.room_number}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-rose-600">{departure.check_out_time}</p>
                        {departure.balance > 0 && (
                          <p className="text-xs text-red-500">Balance: KES {departure.balance.toLocaleString()}</p>
                        )}
                        <Button size="sm" variant="outline" className="mt-1 h-7" onClick={() => setShowCheckOutModal(true)}>
                          Check Out
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>
          </div>

          {/* Footer Quick Links */}
          <Card className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-indigo-600" />
                <span className="font-medium text-indigo-900">Quick Links</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/dashboard/reception/rooms">
                  <Button variant="outline" size="sm" className="border-indigo-200 text-indigo-700 hover:bg-indigo-100">
                    <Bed className="h-4 w-4 mr-1" /> All Rooms
                  </Button>
                </Link>
                <Link href="/dashboard/reception/guests">
                  <Button variant="outline" size="sm" className="border-indigo-200 text-indigo-700 hover:bg-indigo-100">
                    <Users className="h-4 w-4 mr-1" /> Guest List
                  </Button>
                </Link>
                <Link href="/dashboard/reception/reservations">
                  <Button variant="outline" size="sm" className="border-indigo-200 text-indigo-700 hover:bg-indigo-100">
                    <Calendar className="h-4 w-4 mr-1" /> Reservations
                  </Button>
                </Link>
                <Link href="/dashboard/housekeeping">
                  <Button variant="outline" size="sm" className="border-indigo-200 text-indigo-700 hover:bg-indigo-100">
                    <Home className="h-4 w-4 mr-1" /> Housekeeping
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
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
