'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, RefreshCw, User, Bed, Search, Plus, Filter, 
  Clock, CreditCard, Phone, Mail, MapPin, X, Check, 
  ChevronLeft, ChevronRight, LayoutGrid, List, Users,
  TrendingUp, AlertCircle, Star, Globe, Building, Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bookingsAPI, roomsAPI } from '@/lib/api';
import { toast } from 'sonner';

const roomTypes = ['All Types', 'Standard', 'Deluxe', 'Executive', 'Suite', 'Presidential'];
const sources = ['All Sources', 'direct', 'walk-in', 'booking.com', 'expedia', 'airbnb', 'corporate'];
const statuses = ['All Status', 'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];

export default function BranchManagerReservationsPage() {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All Status');
  const [filterSource, setFilterSource] = useState('All Sources');
  const [filterRoomType, setFilterRoomType] = useState('All Types');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    fetchReservations();
  }, [user]);

  const fetchReservations = async () => {
    setIsLoading(true);
    try {
      const res = await bookingsAPI.getBookings({ branch_id: user?.branch_id || undefined }).catch(() => null);
      const data = res?.bookings || res?.data || [];
      setReservations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error:', error);
      setReservations([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter reservations
  const filteredReservations = reservations.filter(r => {
    const matchesSearch = (r.guest_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (r.room_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (r.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'All Status' || r.status === filterStatus;
    const matchesSource = filterSource === 'All Sources' || r.source === filterSource;
    const matchesRoomType = filterRoomType === 'All Types' || r.room_type === filterRoomType;
    return matchesSearch && matchesStatus && matchesSource && matchesRoomType;
  });

  // Stats
  const todayArrivals = reservations.filter(r => r.check_in_date === new Date().toISOString().split('T')[0] && r.status === 'confirmed').length;
  const todayDepartures = reservations.filter(r => r.check_out_date === new Date().toISOString().split('T')[0] && r.status === 'checked_in').length;
  const pendingConfirmations = reservations.filter(r => r.status === 'pending').length;
  const totalRevenue = reservations.reduce((sum, r) => sum + (r.total_amount || 0), 0);
  const pendingPayments = reservations.reduce((sum, r) => sum + ((r.total_amount || 0) - (r.paid_amount || 0)), 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'checked_in': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'checked_out': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'direct': return <Building className="h-4 w-4" />;
      case 'walk-in': return <User className="h-4 w-4" />;
      case 'booking.com': case 'expedia': case 'airbnb': return <Globe className="h-4 w-4" />;
      case 'corporate': return <Building className="h-4 w-4" />;
      default: return <Smartphone className="h-4 w-4" />;
    }
  };

  const updateStatus = (id: string, newStatus: string) => {
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    toast.success(`Reservation ${newStatus}`);
    setSelectedReservation(null);
  };

  // Calendar helpers
  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  
  const getReservationsForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return reservations.filter(r => r.check_in_date === dateStr || r.check_out_date === dateStr);
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Calendar className="h-8 w-8 text-indigo-600" />
                Reservations
              </h1>
              <p className="text-gray-600 mt-1">{user?.branch_name || 'Famous Gate Hotel'} - Booking Management</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={fetchReservations}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={() => setShowNewModal(true)} className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="h-4 w-4 mr-2" />
                New Reservation
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Today&apos;s Arrivals</p>
                  <p className="text-3xl font-bold text-blue-700">{todayArrivals}</p>
                </div>
                <div className="p-3 bg-blue-200 rounded-full">
                  <Users className="h-6 w-6 text-blue-700" />
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600 font-medium">Today&apos;s Departures</p>
                  <p className="text-3xl font-bold text-orange-700">{todayDepartures}</p>
                </div>
                <div className="p-3 bg-orange-200 rounded-full">
                  <Clock className="h-6 w-6 text-orange-700" />
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-yellow-600 font-medium">Pending</p>
                  <p className="text-3xl font-bold text-yellow-700">{pendingConfirmations}</p>
                </div>
                <div className="p-3 bg-yellow-200 rounded-full">
                  <AlertCircle className="h-6 w-6 text-yellow-700" />
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-700">KES {totalRevenue.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-green-200 rounded-full">
                  <TrendingUp className="h-6 w-6 text-green-700" />
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600 font-medium">Pending Payment</p>
                  <p className="text-2xl font-bold text-red-700">KES {pendingPayments.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-red-200 rounded-full">
                  <CreditCard className="h-6 w-6 text-red-700" />
                </div>
              </div>
            </Card>
          </div>

          {/* Filters & Search */}
          <Card className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by guest name, room, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2 border rounded-lg">
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="px-4 py-2 border rounded-lg">
                {sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterRoomType} onChange={(e) => setFilterRoomType(e.target.value)} className="px-4 py-2 border rounded-lg">
                {roomTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="flex border rounded-lg overflow-hidden">
                <button onClick={() => setViewMode('list')} className={`px-3 py-2 ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'bg-white'}`}>
                  <List className="h-5 w-5" />
                </button>
                <button onClick={() => setViewMode('calendar')} className={`px-3 py-2 ${viewMode === 'calendar' ? 'bg-indigo-600 text-white' : 'bg-white'}`}>
                  <LayoutGrid className="h-5 w-5" />
                </button>
              </div>
            </div>
          </Card>

          {/* List View */}
          {viewMode === 'list' && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guest</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dates</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredReservations.map((r) => (
                      <tr key={r.id} className={`hover:bg-gray-50 ${(r as any).is_vip ? 'bg-amber-50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${(r as any).is_vip ? 'bg-amber-200' : 'bg-indigo-100'}`}>
                              {(r as any).is_vip ? <Star className="h-5 w-5 text-amber-600" /> : <User className="h-5 w-5 text-indigo-600" />}
                            </div>
                            <div>
                              <p className="font-medium flex items-center gap-2">
                                {r.guest_name}
                                {(r as any).is_vip && <Badge className="bg-amber-500 text-white text-xs">VIP</Badge>}
                              </p>
                              <p className="text-sm text-gray-500">{r.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">Room {r.room_number}</p>
                            <p className="text-sm text-gray-500">{r.room_type}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm">{r.check_in_date} → {r.check_out_date}</p>
                            <p className="text-xs text-gray-500">{r.nights} night(s) • {r.adults} adult(s){r.children > 0 ? `, ${r.children} child` : ''}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {getSourceIcon(r.source)}
                            <span className="text-sm capitalize">{r.source}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">KES {r.total_amount?.toLocaleString()}</p>
                            {r.paid_amount < r.total_amount && (
                              <p className="text-xs text-red-600">Due: KES {(r.total_amount - r.paid_amount).toLocaleString()}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`${getStatusColor(r.status)} border`}>{r.status}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Button variant="outline" size="sm" onClick={() => setSelectedReservation(r)}>
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredReservations.length === 0 && (
                <div className="p-12 text-center text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No reservations found</p>
                </div>
              )}
            </Card>
          )}

          {/* Calendar View */}
          {viewMode === 'calendar' && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))} className="p-2 hover:bg-gray-100 rounded">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h3 className="text-xl font-semibold">
                  {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h3>
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))} className="p-2 hover:bg-gray-100 rounded">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">{day}</div>
                ))}
                {Array.from({ length: getFirstDayOfMonth(currentDate) }).map((_, i) => (
                  <div key={`empty-${i}`} className="p-2" />
                ))}
                {Array.from({ length: getDaysInMonth(currentDate) }).map((_, i) => {
                  const day = i + 1;
                  const dayReservations = getReservationsForDate(day);
                  const isToday = new Date().getDate() === day && new Date().getMonth() === currentDate.getMonth();
                  return (
                    <div key={day} className={`min-h-24 p-2 border rounded-lg ${isToday ? 'bg-indigo-50 border-indigo-300' : 'hover:bg-gray-50'}`}>
                      <p className={`text-sm font-medium ${isToday ? 'text-indigo-600' : ''}`}>{day}</p>
                      <div className="mt-1 space-y-1">
                        {dayReservations.slice(0, 2).map(r => (
                          <div key={r.id} onClick={() => setSelectedReservation(r)} className={`text-xs p-1 rounded cursor-pointer truncate ${getStatusColor(r.status)}`}>
                            {r.guest_name}
                          </div>
                        ))}
                        {dayReservations.length > 2 && (
                          <p className="text-xs text-gray-500">+{dayReservations.length - 2} more</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Reservation Detail Modal */}
          {selectedReservation && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      Reservation Details
                      {selectedReservation.is_vip && <Badge className="bg-amber-500 text-white">VIP</Badge>}
                    </h2>
                    <p className="text-gray-500">Booking #{selectedReservation.id}</p>
                  </div>
                  <button onClick={() => setSelectedReservation(null)} className="p-2 hover:bg-gray-100 rounded-full">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-6 space-y-6">
                  {/* Guest Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-700">Guest Information</h3>
                      <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-gray-400" />
                        <span>{selectedReservation.guest_name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-gray-400" />
                        <span>{selectedReservation.email}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="h-5 w-5 text-gray-400" />
                        <span>{selectedReservation.phone}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-700">Stay Details</h3>
                      <div className="flex items-center gap-3">
                        <Bed className="h-5 w-5 text-gray-400" />
                        <span>Room {selectedReservation.room_number} ({selectedReservation.room_type})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-gray-400" />
                        <span>{selectedReservation.check_in_date} → {selectedReservation.check_out_date}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-gray-400" />
                        <span>{selectedReservation.adults} Adults, {selectedReservation.children} Children</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Info */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h3 className="font-semibold text-gray-700 mb-3">Payment Summary</h3>
                    <div className="flex justify-between items-center">
                      <span>Total Amount</span>
                      <span className="font-bold">KES {selectedReservation.total_amount?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-green-600">
                      <span>Paid</span>
                      <span>KES {selectedReservation.paid_amount?.toLocaleString()}</span>
                    </div>
                    {selectedReservation.paid_amount < selectedReservation.total_amount && (
                      <div className="flex justify-between items-center text-red-600 font-medium mt-2 pt-2 border-t">
                        <span>Balance Due</span>
                        <span>KES {(selectedReservation.total_amount - selectedReservation.paid_amount).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Special Requests */}
                  {selectedReservation.special_requests && (
                    <div className="bg-yellow-50 rounded-xl p-4">
                      <h3 className="font-semibold text-yellow-800 mb-2">Special Requests</h3>
                      <p className="text-yellow-700">{selectedReservation.special_requests}</p>
                    </div>
                  )}

                  {/* Status & Source */}
                  <div className="flex items-center gap-4">
                    <Badge className={`${getStatusColor(selectedReservation.status)} border px-4 py-2`}>
                      {selectedReservation.status}
                    </Badge>
                    <div className="flex items-center gap-2 text-gray-500">
                      {getSourceIcon(selectedReservation.source)}
                      <span className="capitalize">via {selectedReservation.source}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t">
                    {selectedReservation.status === 'pending' && (
                      <Button onClick={() => updateStatus(selectedReservation.id, 'confirmed')} className="bg-green-600 hover:bg-green-700">
                        <Check className="h-4 w-4 mr-2" /> Confirm
                      </Button>
                    )}
                    {selectedReservation.status === 'confirmed' && (
                      <Button onClick={() => updateStatus(selectedReservation.id, 'checked_in')} className="bg-blue-600 hover:bg-blue-700">
                        <Check className="h-4 w-4 mr-2" /> Check In
                      </Button>
                    )}
                    {selectedReservation.status === 'checked_in' && (
                      <Button onClick={() => updateStatus(selectedReservation.id, 'checked_out')} className="bg-orange-600 hover:bg-orange-700">
                        <Check className="h-4 w-4 mr-2" /> Check Out
                      </Button>
                    )}
                    {selectedReservation.status !== 'cancelled' && selectedReservation.status !== 'checked_out' && (
                      <Button variant="outline" onClick={() => updateStatus(selectedReservation.id, 'cancelled')} className="text-red-600 border-red-300">
                        <X className="h-4 w-4 mr-2" /> Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* New Reservation Modal */}
          {showNewModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b flex items-center justify-between">
                  <h2 className="text-xl font-bold">New Reservation</h2>
                  <button onClick={() => setShowNewModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Guest Name *</label>
                      <input type="text" className="w-full px-4 py-2 border rounded-lg" placeholder="Full name" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Phone *</label>
                      <input type="tel" className="w-full px-4 py-2 border rounded-lg" placeholder="+254 7XX XXX XXX" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Email</label>
                      <input type="email" className="w-full px-4 py-2 border rounded-lg" placeholder="email@example.com" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">ID/Passport</label>
                      <input type="text" className="w-full px-4 py-2 border rounded-lg" placeholder="ID Number" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Check-in Date *</label>
                      <input type="date" className="w-full px-4 py-2 border rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Check-out Date *</label>
                      <input type="date" className="w-full px-4 py-2 border rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Room Type *</label>
                      <select className="w-full px-4 py-2 border rounded-lg">
                        <option>Standard - KES 4,500/night</option>
                        <option>Deluxe - KES 6,000/night</option>
                        <option>Executive - KES 9,000/night</option>
                        <option>Suite - KES 12,000/night</option>
                        <option>Presidential - KES 25,000/night</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Room Number</label>
                      <select className="w-full px-4 py-2 border rounded-lg">
                        <option>Auto-assign</option>
                        <option>101</option>
                        <option>102</option>
                        <option>103</option>
                        <option>201</option>
                        <option>202</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Adults</label>
                      <input type="number" className="w-full px-4 py-2 border rounded-lg" defaultValue={1} min={1} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Children</label>
                      <input type="number" className="w-full px-4 py-2 border rounded-lg" defaultValue={0} min={0} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Booking Source</label>
                      <select className="w-full px-4 py-2 border rounded-lg">
                        <option value="direct">Direct</option>
                        <option value="walk-in">Walk-in</option>
                        <option value="booking.com">Booking.com</option>
                        <option value="expedia">Expedia</option>
                        <option value="airbnb">Airbnb</option>
                        <option value="corporate">Corporate</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Payment Status</label>
                      <select className="w-full px-4 py-2 border rounded-lg">
                        <option value="pending">Pending</option>
                        <option value="partial">Partial Payment</option>
                        <option value="paid">Fully Paid</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Special Requests</label>
                    <textarea className="w-full px-4 py-2 border rounded-lg" rows={3} placeholder="Any special requests or notes..." />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="vip" className="rounded" />
                    <label htmlFor="vip" className="text-sm">Mark as VIP Guest</label>
                  </div>
                  <div className="flex gap-3 pt-4 border-t">
                    <Button onClick={() => { setShowNewModal(false); toast.success('Reservation created!'); }} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                      Create Reservation
                    </Button>
                    <Button variant="outline" onClick={() => setShowNewModal(false)}>Cancel</Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
