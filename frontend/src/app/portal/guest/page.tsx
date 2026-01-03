'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Home,
  Calendar,
  Bell,
  User,
  LogOut,
  ChevronRight,
  ChevronDown,
  Clock,
  MessageSquare,
  Utensils,
  Dumbbell,
  Car,
  Sparkles,
  Coffee,
  Wifi,
  Loader2,
  Plus,
  X,
  Send,
  Gift,
  AlertCircle,
  Bed,
  Check,
  Star,
  Award,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { API_URL, PYTHON_API_URL } from '@/lib/config';

interface DashboardData {
  profile: any;
  bookings: any[];
  activeBooking: any;
  loyalty: { total_points: number; tier: string; total_stays: number; total_spent: number };
  pendingRequests: any[];
  unreadMessages: number;
  amenities: any[];
}

export default function GuestPortal() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loyaltyDetails, setLoyaltyDetails] = useState<any>(null);
  const [serviceRequests, setServiceRequests] = useState<any>(null);

  // API_URL and PYTHON_API_URL are now imported from @/lib/config

  const fetchDashboard = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/guest-portal/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }

      // Fetch from Python service
      if (user?.id) {
        try {
          const loyaltyRes = await fetch(`${PYTHON_API_URL}/api/guest-portal/loyalty/details?guest_id=${user.id}`);
          const loyaltyData = await loyaltyRes.json();
          if (loyaltyData.success) {
            setLoyaltyDetails(loyaltyData.data);
          }

          const requestsRes = await fetch(`${PYTHON_API_URL}/api/guest-portal/requests?guest_id=${user.id}`);
          const requestsData = await requestsRes.json();
          if (requestsData.success) {
            setServiceRequests(requestsData.data);
          }
        } catch (pyErr) {
          console.log('Python service not available, using Node API only');
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'platinum': return 'from-slate-700 to-slate-900 text-white';
      case 'gold': return 'from-neutral-600 to-neutral-800 text-white';
      case 'silver': return 'from-neutral-400 to-neutral-600 text-white';
      default: return 'from-neutral-500 to-neutral-700 text-white';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'dining': return Utensils;
      case 'wellness': return Sparkles;
      case 'recreation': return Dumbbell;
      case 'business': return Wifi;
      case 'transport': return Car;
      default: return Coffee;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'bookings', label: 'Stays', icon: Calendar },
    { id: 'requests', label: 'Requests', icon: Bell },
    { id: 'amenities', label: 'Services', icon: Sparkles },
    { id: 'loyalty', label: 'Rewards', icon: Gift },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'profile', label: 'Account', icon: User },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-neutral-100 sticky top-0 z-50 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <Image src="/fglogo.png" alt="FG" width={28} height={28} className="object-contain" style={{ width: 'auto', height: 'auto' }} />
                <span className="font-semibold text-neutral-900">Guest</span>
              </div>
              <nav className="hidden md:flex items-center gap-1">
                {navItems.slice(0, 5).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeTab === item.id
                      ? 'bg-neutral-100 text-neutral-900 font-medium'
                      : 'text-neutral-500 hover:text-neutral-900'
                      }`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab('messages')}
                className="relative p-2 hover:bg-neutral-50 rounded-lg transition-colors"
              >
                <MessageSquare className="w-[18px] h-[18px] text-neutral-500" />
                {(data?.unreadMessages || 0) > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-neutral-900 rounded-full" />
                )}
              </button>
              <div className="h-5 w-px bg-neutral-200" />
              <button
                onClick={() => setActiveTab('profile')}
                className="flex items-center gap-2 hover:bg-neutral-50 rounded-lg px-2 py-1.5 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center">
                  <span className="text-xs font-medium text-neutral-600">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </span>
                </div>
                <span className="text-sm text-neutral-700 hidden sm:block">{user?.firstName}</span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-neutral-50 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="w-[18px] h-[18px] text-neutral-500" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <div className="md:hidden border-b border-neutral-100 bg-white overflow-x-auto">
        <div className="flex px-4 py-2 gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors ${activeTab === item.id
                ? 'bg-neutral-100 text-neutral-900 font-medium'
                : 'text-neutral-500'
                }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Current Stay / Welcome */}
            {data?.activeBooking ? (
              <section className="border border-neutral-200 rounded-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-neutral-500 mb-1">Currently staying</p>
                    <h1 className="text-2xl font-semibold text-neutral-900">
                      Room {data.activeBooking.room?.room_number}
                    </h1>
                    <p className="text-sm text-neutral-500 mt-1">
                      {data.activeBooking.room?.type?.name} · Check-out {formatDate(data.activeBooking.check_out_date)}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('requests')}
                    className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors"
                  >
                    Request Service
                  </button>
                </div>
              </section>
            ) : (
              <section className="border border-neutral-200 rounded-lg p-6">
                <h1 className="text-xl font-semibold text-neutral-900 mb-1">Welcome back, {user?.firstName}</h1>
                <p className="text-sm text-neutral-500 mb-4">Plan your next stay with us</p>
                <button
                  onClick={() => router.push('/')}
                  className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors"
                >
                  Book a Room
                </button>
              </section>
            )}

            {/* Stats Row */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button onClick={() => setActiveTab('loyalty')} className="text-left p-4 border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors">
                <p className="text-2xl font-semibold text-neutral-900">{(data?.loyalty?.total_points || 0).toLocaleString()}</p>
                <p className="text-sm text-neutral-500">Reward points</p>
              </button>
              <button onClick={() => setActiveTab('bookings')} className="text-left p-4 border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors">
                <p className="text-2xl font-semibold text-neutral-900">{data?.loyalty?.total_stays || 0}</p>
                <p className="text-sm text-neutral-500">Total stays</p>
              </button>
              <button onClick={() => setActiveTab('loyalty')} className="text-left p-4 border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors">
                <p className="text-2xl font-semibold text-neutral-900 capitalize">{data?.loyalty?.tier || 'Bronze'}</p>
                <p className="text-sm text-neutral-500">Member tier</p>
              </button>
              <button onClick={() => setActiveTab('requests')} className="text-left p-4 border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors">
                <p className="text-2xl font-semibold text-neutral-900">{data?.pendingRequests?.length || 0}</p>
                <p className="text-sm text-neutral-500">Active requests</p>
              </button>
            </section>

            {/* Quick Actions */}
            {data?.activeBooking && (
              <section>
                <h2 className="text-sm font-medium text-neutral-900 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    onClick={() => setActiveTab('requests')}
                    className="p-4 border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors text-left"
                  >
                    <Utensils className="w-5 h-5 text-neutral-600 mb-2" />
                    <p className="text-sm font-medium text-neutral-900">Room Service</p>
                    <p className="text-xs text-neutral-500">Order food & drinks</p>
                  </button>
                  <button
                    onClick={() => setActiveTab('requests')}
                    className="p-4 border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors text-left"
                  >
                    <Sparkles className="w-5 h-5 text-neutral-600 mb-2" />
                    <p className="text-sm font-medium text-neutral-900">Housekeeping</p>
                    <p className="text-xs text-neutral-500">Request cleaning</p>
                  </button>
                  <button
                    onClick={() => setActiveTab('amenities')}
                    className="p-4 border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors text-left"
                  >
                    <Dumbbell className="w-5 h-5 text-neutral-600 mb-2" />
                    <p className="text-sm font-medium text-neutral-900">Spa & Gym</p>
                    <p className="text-xs text-neutral-500">Book amenities</p>
                  </button>
                  <button
                    onClick={() => setActiveTab('messages')}
                    className="p-4 border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors text-left"
                  >
                    <MessageSquare className="w-5 h-5 text-neutral-600 mb-2" />
                    <p className="text-sm font-medium text-neutral-900">Concierge</p>
                    <p className="text-xs text-neutral-500">Chat with us</p>
                  </button>
                </div>
              </section>
            )}

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bookings */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-neutral-900">My Stays</h2>
                  <button onClick={() => setActiveTab('bookings')} className="text-sm text-neutral-500 hover:text-neutral-700">
                    View all
                  </button>
                </div>
                <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-100">
                  {data?.bookings && data.bookings.length > 0 ? (
                    data.bookings.slice(0, 3).map((booking: any) => (
                      <div key={booking.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center">
                            <Bed className="w-5 h-5 text-neutral-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-neutral-900">
                              {booking.room?.type?.name || 'Room'} {booking.room?.room_number}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {formatDate(booking.check_in_date)} - {formatDate(booking.check_out_date)}
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded capitalize ${booking.status === 'checked_in' ? 'bg-neutral-900 text-white' :
                          booking.status === 'confirmed' ? 'bg-neutral-200 text-neutral-700' :
                            'bg-neutral-100 text-neutral-600'
                          }`}>
                          {booking.status?.replace('_', ' ')}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <Calendar className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                      <p className="text-sm text-neutral-500">No bookings yet</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Requests */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-neutral-900">Recent Requests</h2>
                  <button onClick={() => setActiveTab('requests')} className="text-sm text-neutral-500 hover:text-neutral-700">
                    View all
                  </button>
                </div>
                <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-100">
                  {data?.pendingRequests && data.pendingRequests.length > 0 ? (
                    data.pendingRequests.slice(0, 3).map((request: any) => (
                      <div key={request.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-neutral-900">{request.title}</p>
                          <p className="text-xs text-neutral-500 capitalize">{request.request_type?.replace('_', ' ')}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded capitalize ${request.status === 'completed' ? 'bg-neutral-900 text-white' :
                          request.status === 'in_progress' ? 'bg-neutral-200 text-neutral-700' :
                            'bg-neutral-100 text-neutral-700'
                          }`}>
                          {request.status?.replace('_', ' ')}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <Check className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                      <p className="text-sm text-neutral-500">No active requests</p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Services */}
            {data?.amenities && data.amenities.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-neutral-900">Hotel Services</h2>
                  <button onClick={() => setActiveTab('amenities')} className="text-sm text-neutral-500 hover:text-neutral-700">
                    View all
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {data.amenities.slice(0, 4).map((amenity: any) => {
                    const Icon = getCategoryIcon(amenity.category);
                    return (
                      <button
                        key={amenity.id}
                        onClick={() => setActiveTab('amenities')}
                        className="p-4 border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors text-left"
                      >
                        <Icon className="w-5 h-5 text-neutral-600 mb-2" />
                        <p className="text-sm font-medium text-neutral-900">{amenity.name}</p>
                        <p className="text-xs text-neutral-500">{amenity.operating_hours}</p>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === 'bookings' && <BookingsTab />}
        {activeTab === 'requests' && <RequestsTab activeBooking={data?.activeBooking} onRefresh={fetchDashboard} />}
        {activeTab === 'amenities' && <AmenitiesTab amenities={data?.amenities || []} />}
        {activeTab === 'loyalty' && <LoyaltyTab loyalty={data?.loyalty} />}
        {activeTab === 'messages' && <MessagesTab activeBooking={data?.activeBooking} />}
        {activeTab === 'profile' && <ProfileTab user={user} profile={data?.profile} />}
      </main>
    </div>
  );
}

// Bookings Tab Component
function BookingsTab() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/guest-portal/bookings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const result = await response.json();
        if (result.success) {
          setBookings(result.data);
        }
      } catch (error) {
        console.error('Error fetching bookings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'checked_in': return 'bg-neutral-900 text-white';
      case 'confirmed': return 'bg-neutral-200 text-neutral-700';
      case 'pending': return 'bg-neutral-100 text-neutral-700';
      case 'checked_out': return 'bg-neutral-100 text-neutral-500';
      case 'cancelled': return 'bg-neutral-100 text-neutral-500';
      default: return 'bg-neutral-100 text-neutral-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-neutral-900">My Bookings</h2>

      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        {bookings.length > 0 ? (
          <div className="divide-y divide-neutral-100">
            {bookings.map((booking) => (
              <div key={booking.id} className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-xl bg-neutral-100 flex items-center justify-center">
                      <Bed className="w-8 h-8 text-neutral-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-neutral-900">
                        {booking.room?.type?.name || 'Room'} - {booking.room?.room_number}
                      </h4>
                      <p className="text-sm text-neutral-500 mb-2">Booking #{booking.booking_number}</p>
                      <div className="flex items-center gap-4 text-sm text-neutral-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(booking.check_in_date).toLocaleDateString()} - {new Date(booking.check_out_date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-lg text-sm font-medium capitalize ${getStatusColor(booking.status)}`}>
                      {booking.status.replace('_', ' ')}
                    </span>
                    <p className="mt-2 font-semibold text-neutral-900">
                      KES {booking.total_amount?.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-neutral-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
            <p>No bookings found</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Requests Tab Component
function RequestsTab({ activeBooking, onRefresh }: { activeBooking: any; onRefresh: () => void }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    request_type: 'room_service',
    title: '',
    description: '',
    priority: 'normal'
  });

  const fetchRequests = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/guest-portal/requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setRequests(result.data);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBooking) {
      toast.error('You must be checked in to make requests');
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/guest-portal/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Request submitted');
        setShowForm(false);
        fetchRequests();
        onRefresh();
        setFormData({ request_type: 'room_service', title: '', description: '', priority: 'normal' });
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-neutral-900 text-white';
      case 'in_progress': return 'bg-neutral-200 text-neutral-700';
      case 'cancelled': return 'bg-neutral-100 text-neutral-500';
      default: return 'bg-neutral-100 text-neutral-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-900">Service Requests</h2>
        {activeBooking && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-neutral-900 text-white rounded-xl font-medium hover:bg-neutral-800 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Request
          </button>
        )}
      </div>

      {!activeBooking && (
        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-neutral-600 mt-0.5" />
          <div>
            <p className="font-medium text-neutral-900">Not Currently Checked In</p>
            <p className="text-sm text-neutral-600">You need to be checked in to make service requests.</p>
          </div>
        </div>
      )}

      {/* Request Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6">
          <h3 className="font-semibold text-neutral-900 mb-4">New Service Request</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Request Type</label>
              <select
                value={formData.request_type}
                onChange={(e) => setFormData({ ...formData, request_type: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              >
                <option value="room_service">Room Service</option>
                <option value="housekeeping">Housekeeping</option>
                <option value="maintenance">Maintenance</option>
                <option value="amenity">Amenity Request</option>
                <option value="transport">Transport</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                placeholder="Brief description of your request"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Details</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                placeholder="Additional details..."
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-3 border border-neutral-200 text-neutral-700 rounded-xl font-medium hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-3 bg-neutral-900 text-white rounded-xl font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Requests List */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        {requests.length > 0 ? (
          <div className="divide-y divide-neutral-100">
            {requests.map((request) => (
              <div key={request.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium capitalize ${getStatusColor(request.status)}`}>
                        {request.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-neutral-400 capitalize">{request.request_type.replace('_', ' ')}</span>
                    </div>
                    <h4 className="font-medium text-neutral-900">{request.title}</h4>
                    {request.description && (
                      <p className="text-sm text-neutral-500 mt-1">{request.description}</p>
                    )}
                    <p className="text-xs text-neutral-400 mt-2">
                      {new Date(request.created_at).toLocaleString()}
                    </p>
                  </div>
                  {request.status === 'completed' && !request.rating && (
                    <button className="px-3 py-1.5 text-sm bg-neutral-100 text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors">
                      Rate
                    </button>
                  )}
                  {request.rating && (
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < request.rating ? 'text-neutral-900 fill-neutral-900' : 'text-neutral-300'}`} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-neutral-500">
            <Bell className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
            <p>No requests yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Amenities Tab Component
function AmenitiesTab({ amenities }: { amenities: any[] }) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'dining': return Utensils;
      case 'wellness': return Sparkles;
      case 'recreation': return Dumbbell;
      case 'business': return Wifi;
      case 'transport': return Car;
      default: return Coffee;
    }
  };

  const groupedAmenities = amenities.reduce((acc: any, amenity) => {
    const category = amenity.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(amenity);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-neutral-900">Hotel Amenities</h2>

      {Object.entries(groupedAmenities).map(([category, items]: [string, any]) => (
        <div key={category} className="bg-white rounded-2xl border border-neutral-200 p-6">
          <h3 className="font-semibold text-neutral-900 capitalize mb-4">{category}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((amenity: any) => {
              const Icon = getCategoryIcon(amenity.category);
              return (
                <div key={amenity.id} className="flex items-start gap-4 p-4 bg-neutral-50 rounded-xl">
                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-neutral-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-neutral-900">{amenity.name}</h4>
                    {amenity.description && (
                      <p className="text-sm text-neutral-500 mt-1">{amenity.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-neutral-400">
                      {amenity.operating_hours && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {amenity.operating_hours}
                        </span>
                      )}
                      {amenity.price > 0 && (
                        <span className="font-medium text-neutral-600">KES {amenity.price?.toLocaleString()}</span>
                      )}
                    </div>
                    {amenity.is_bookable && (
                      <button className="mt-3 px-3 py-1.5 bg-neutral-900 text-white text-sm rounded-lg hover:bg-neutral-800 transition-colors">
                        Book Now
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {amenities.length === 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center text-neutral-500">
          <Sparkles className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
          <p>No amenities available</p>
        </div>
      )}
    </div>
  );
}

// Loyalty Tab Component
function LoyaltyTab({ loyalty }: { loyalty: any }) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLoyalty = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/guest-portal/loyalty`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const result = await response.json();
        if (result.success) {
          setTransactions(result.data.transactions || []);
        }
      } catch (error) {
        console.error('Error fetching loyalty:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLoyalty();
  }, []);

  const getTierBenefits = (tier: string) => {
    const benefits: Record<string, string[]> = {
      bronze: ['Earn 1 point per KES 100 spent', 'Member-only offers', 'Birthday reward'],
      silver: ['Earn 1.5 points per KES 100 spent', 'Priority check-in', 'Room upgrade (subject to availability)', 'Late checkout'],
      gold: ['Earn 2 points per KES 100 spent', 'Guaranteed room upgrade', 'Free breakfast', 'Lounge access', 'Free airport transfer'],
      platinum: ['Earn 3 points per KES 100 spent', 'Suite upgrade', 'Personal concierge', 'All Gold benefits', 'Exclusive events access']
    };
    return benefits[tier] || benefits.bronze;
  };

  const getNextTier = (tier: string) => {
    const tiers = ['bronze', 'silver', 'gold', 'platinum'];
    const currentIndex = tiers.indexOf(tier);
    return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null;
  };

  const getPointsToNextTier = (tier: string, currentPoints: number) => {
    const thresholds: Record<string, number> = { bronze: 5000, silver: 15000, gold: 50000, platinum: Infinity };
    const nextTier = getNextTier(tier);
    if (!nextTier) return null;
    return thresholds[tier] - currentPoints;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-600" />
      </div>
    );
  }

  const nextTier = loyalty?.tier ? getNextTier(loyalty.tier) : 'bronze';
  const pointsNeeded = loyalty?.tier ? getPointsToNextTier(loyalty.tier, loyalty.total_points || 0) : 5000;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-neutral-900">Loyalty Rewards</h2>

      {/* Loyalty Card */}
      <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-neutral-400 text-xs uppercase tracking-wider mb-1">Your Status</p>
            <h3 className="text-2xl font-bold capitalize">{loyalty?.tier || 'Bronze'} Member</h3>
          </div>
          <Award className="w-10 h-10 text-neutral-400" />
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div>
            <p className="text-neutral-400 text-xs">Points Balance</p>
            <p className="text-2xl font-bold">{loyalty?.total_points?.toLocaleString() || 0}</p>
          </div>
          <div>
            <p className="text-neutral-400 text-xs">Total Stays</p>
            <p className="text-2xl font-bold">{loyalty?.total_stays || 0}</p>
          </div>
          <div>
            <p className="text-neutral-400 text-xs">Total Spent</p>
            <p className="text-2xl font-bold">KES {((loyalty?.total_spent || 0) / 1000).toFixed(0)}K</p>
          </div>
        </div>
        {nextTier && pointsNeeded && pointsNeeded > 0 && (
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-sm text-neutral-300">
              Earn <span className="font-bold text-white">{pointsNeeded.toLocaleString()}</span> more points to reach <span className="font-bold text-white capitalize">{nextTier}</span> status
            </p>
            <div className="mt-2 h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-neutral-900 rounded-full"
                style={{ width: `${Math.min(100, ((loyalty?.total_points || 0) / (loyalty?.total_points + pointsNeeded)) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Benefits */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <h3 className="font-semibold text-neutral-900 mb-4">Your Benefits</h3>
        <div className="space-y-3">
          {getTierBenefits(loyalty?.tier || 'bronze').map((benefit, index) => (
            <div key={index} className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-neutral-700" />
              <span className="text-neutral-700">{benefit}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="p-4 border-b border-neutral-100">
          <h3 className="font-semibold text-neutral-900">Points History</h3>
        </div>
        {transactions.length > 0 ? (
          <div className="divide-y divide-neutral-100">
            {transactions.map((tx) => (
              <div key={tx.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900 capitalize">{tx.transaction_type}</p>
                  <p className="text-sm text-neutral-500">{tx.description}</p>
                  <p className="text-xs text-neutral-400">{new Date(tx.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`font-semibold ${tx.points > 0 ? 'text-neutral-900' : 'text-neutral-500'}`}>
                  {tx.points > 0 ? '+' : ''}{tx.points}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-neutral-500">
            <Gift className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
            <p>No transactions yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Messages Tab Component
function MessagesTab({ activeBooking }: { activeBooking: any }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/guest-portal/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setMessages(result.data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/guest-portal/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          message: newMessage,
          booking_id: activeBooking?.id
        })
      });
      const result = await response.json();
      if (result.success) {
        setNewMessage('');
        fetchMessages();
      }
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-neutral-900">Messages</h2>

      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        {/* Messages List */}
        <div className="h-[400px] overflow-y-auto p-4 space-y-4">
          {messages.length > 0 ? (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender_type === 'guest' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-2xl ${msg.sender_type === 'guest'
                    ? 'bg-neutral-900 text-white rounded-br-md'
                    : 'bg-neutral-100 text-neutral-900 rounded-bl-md'
                    }`}
                >
                  <p>{msg.message}</p>
                  <p className={`text-xs mt-2 ${msg.sender_type === 'guest' ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    {new Date(msg.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-neutral-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-neutral-300" />
              <p>No messages yet</p>
              <p className="text-sm">Start a conversation with our concierge</p>
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-neutral-100">
          <div className="flex gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your message..."
              className="flex-1 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
            />
            <button
              onClick={handleSend}
              disabled={sending || !newMessage.trim()}
              className="px-4 py-3 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Profile Tab Component
function ProfileTab({ user, profile }: { user: any; profile: any }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    phone_number: user?.phone_number || '',
    address: user?.address || '',
    nationality: profile?.nationality || '',
    company: profile?.company || ''
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/guest-portal/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Profile updated');
        setEditing(false);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-neutral-900">My Profile</h2>
        <button
          onClick={() => editing ? handleSave() : setEditing(true)}
          disabled={saving}
          className="px-4 py-2 bg-neutral-900 text-white rounded-xl font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : editing ? 'Save Changes' : 'Edit Profile'}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 p-6">
        <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-20 rounded-2xl bg-neutral-200 flex items-center justify-center">
            <User className="w-10 h-10 text-neutral-500" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-neutral-900">{user?.firstName} {user?.lastName}</h3>
            <p className="text-neutral-500">{user?.email}</p>
            {profile?.vip_status && (
              <span className="inline-flex items-center gap-1 mt-1 px-2 py-1 bg-neutral-900 text-white rounded-lg text-xs font-medium">
                <Star className="w-3 h-3" /> VIP Guest
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
            <p className="px-4 py-3 bg-neutral-50 rounded-xl text-neutral-900">{user?.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Phone Number</label>
            {editing ? (
              <input
                type="tel"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            ) : (
              <p className="px-4 py-3 bg-neutral-50 rounded-xl text-neutral-900">{formData.phone_number || 'Not set'}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Nationality</label>
            {editing ? (
              <input
                type="text"
                value={formData.nationality}
                onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            ) : (
              <p className="px-4 py-3 bg-neutral-50 rounded-xl text-neutral-900">{formData.nationality || 'Not set'}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Company</label>
            {editing ? (
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
              />
            ) : (
              <p className="px-4 py-3 bg-neutral-50 rounded-xl text-neutral-900">{formData.company || 'Not set'}</p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-neutral-700 mb-1">Address</label>
            {editing ? (
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
              />
            ) : (
              <p className="px-4 py-3 bg-neutral-50 rounded-xl text-neutral-900">{formData.address || 'Not set'}</p>
            )}
          </div>
        </div>

        {editing && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
