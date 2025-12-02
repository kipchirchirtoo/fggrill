'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { roomsAPI, bookingsAPI, guestAPI } from '@/lib/api';
import { 
  Bed, Users, Search, Plus, RefreshCw, Filter, Eye, Edit2, Trash2,
  CheckCircle, XCircle, Clock, Wrench, Sparkles, Calendar, Phone, Mail,
  DoorOpen, DoorClosed, AlertTriangle, ChevronDown, MoreVertical,
  UserPlus, LogIn, LogOut, ClipboardList, Settings, Building2
} from 'lucide-react';
import { toast } from 'sonner';

// Room status configuration
const roomStatusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  available: { label: 'Available', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle },
  occupied: { label: 'Occupied', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: DoorClosed },
  reserved: { label: 'Reserved', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: Calendar },
  maintenance: { label: 'Maintenance', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: Wrench },
  cleaning: { label: 'Cleaning', color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: Sparkles },
  checkout: { label: 'Checkout', color: 'text-red-700', bgColor: 'bg-red-100', icon: LogOut },
};

// Room type configuration
const roomTypeConfig: Record<string, { label: string; color: string }> = {
  deluxe: { label: 'Deluxe', color: 'bg-blue-500' },
  executive: { label: 'Executive', color: 'bg-amber-500' },
  standard: { label: 'Standard', color: 'bg-gray-500' },
  suite: { label: 'Suite', color: 'bg-purple-500' },
};

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  floor: number;
  status: string;
  price_per_night: number;
  max_occupancy: number;
  amenities: string[];
  current_guest?: {
    id: string;
    name: string;
    check_in: string;
    check_out: string;
    phone?: string;
  };
  notes?: string;
}

interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  id_number?: string;
}

interface BookingFormData {
  room_id: string;
  guest_id: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  meal_plan: 'bed_breakfast' | 'half_board' | 'full_board';
  special_requests: string;
  total_amount: number;
}

// Quick Check-in Modal
function QuickCheckInModal({ 
  isOpen, 
  onClose, 
  room, 
  onSuccess 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  room: Room | null;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<'guest' | 'booking'>('guest');
  const [searchQuery, setSearchQuery] = useState('');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [isNewGuest, setIsNewGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New guest form
  const [newGuest, setNewGuest] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    id_number: '',
  });

  // Booking details
  const [booking, setBooking] = useState({
    check_in: new Date().toISOString().split('T')[0],
    check_out: '',
    adults: 1,
    children: 0,
    meal_plan: 'bed_breakfast' as const,
    special_requests: '',
  });

  const searchGuests = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    try {
      const response = await guestAPI.getGuests(searchQuery);
      if (response.success) {
        setGuests(response.data || []);
      }
    } catch (error) {
      console.error('Error searching guests:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  const handleCreateGuest = async () => {
    if (!newGuest.first_name || !newGuest.last_name || !newGuest.phone) {
      toast.error('Please fill in required fields');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await guestAPI.createGuest(newGuest);
      if (response.success) {
        setSelectedGuest(response.data);
        setIsNewGuest(false);
        setStep('booking');
        toast.success('Guest created successfully');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create guest');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckIn = async () => {
    if (!room || !selectedGuest) return;
    if (!booking.check_out) {
      toast.error('Please select check-out date');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create booking
      const bookingData = {
        room_id: room.id,
        guest_id: selectedGuest.id,
        check_in: booking.check_in,
        check_out: booking.check_out,
        adults: booking.adults,
        children: booking.children,
        meal_plan: booking.meal_plan,
        special_requests: booking.special_requests,
        status: 'checked_in',
      };

      const response = await bookingsAPI.createBooking(bookingData);
      if (response.success) {
        // Update room status
        await roomsAPI.updateRoomStatus(room.id, 'occupied');
        toast.success(`Guest ${selectedGuest.first_name} checked into Room ${room.room_number}`);
        onSuccess();
        onClose();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to check in guest');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetModal = () => {
    setStep('guest');
    setSearchQuery('');
    setGuests([]);
    setSelectedGuest(null);
    setIsNewGuest(false);
    setNewGuest({ first_name: '', last_name: '', email: '', phone: '', id_number: '' });
    setBooking({
      check_in: new Date().toISOString().split('T')[0],
      check_out: '',
      adults: 1,
      children: 0,
      meal_plan: 'bed_breakfast',
      special_requests: '',
    });
  };

  useEffect(() => {
    if (!isOpen) resetModal();
  }, [isOpen]);

  if (!room) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5 text-green-600" />
            Quick Check-In - Room {room.room_number}
          </DialogTitle>
        </DialogHeader>

        {step === 'guest' && (
          <div className="space-y-4 mt-4">
            {!isNewGuest ? (
              <>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search guest by name, phone, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchGuests()}
                  />
                  <IOSButton onClick={searchGuests} disabled={isLoading}>
                    <Search className="h-4 w-4" />
                  </IOSButton>
                </div>

                {guests.length > 0 && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {guests.map((guest) => (
                      <div
                        key={guest.id}
                        onClick={() => {
                          setSelectedGuest(guest);
                          setStep('booking');
                        }}
                        className="p-3 border rounded-ios-lg cursor-pointer hover:bg-gray-50 transition"
                      >
                        <p className="font-medium">{guest.first_name} {guest.last_name}</p>
                        <p className="text-sm text-gray-500">{guest.phone} • {guest.email}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t pt-4">
                  <IOSButton 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setIsNewGuest(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Register New Guest
                  </IOSButton>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">First Name *</label>
                    <Input
                      value={newGuest.first_name}
                      onChange={(e) => setNewGuest({ ...newGuest, first_name: e.target.value })}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Last Name *</label>
                    <Input
                      value={newGuest.last_name}
                      onChange={(e) => setNewGuest({ ...newGuest, last_name: e.target.value })}
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Phone *</label>
                  <Input
                    value={newGuest.phone}
                    onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })}
                    placeholder="+254 700 000 000"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={newGuest.email}
                    onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">ID/Passport Number</label>
                  <Input
                    value={newGuest.id_number}
                    onChange={(e) => setNewGuest({ ...newGuest, id_number: e.target.value })}
                    placeholder="12345678"
                  />
                </div>
                <div className="flex gap-3">
                  <IOSButton variant="outline" onClick={() => setIsNewGuest(false)} className="flex-1">
                    Back
                  </IOSButton>
                  <IOSButton onClick={handleCreateGuest} disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? 'Creating...' : 'Create & Continue'}
                  </IOSButton>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'booking' && selectedGuest && (
          <div className="space-y-4 mt-4">
            <div className="p-3 bg-green-50 rounded-ios-lg border border-green-200">
              <p className="font-medium text-green-800">
                {selectedGuest.first_name} {selectedGuest.last_name}
              </p>
              <p className="text-sm text-green-600">{selectedGuest.phone}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Check-In Date</label>
                <Input
                  type="date"
                  value={booking.check_in}
                  onChange={(e) => setBooking({ ...booking, check_in: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Check-Out Date *</label>
                <Input
                  type="date"
                  value={booking.check_out}
                  onChange={(e) => setBooking({ ...booking, check_out: e.target.value })}
                  min={booking.check_in}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Adults</label>
                <Input
                  type="number"
                  min={1}
                  max={room.max_occupancy}
                  value={booking.adults}
                  onChange={(e) => setBooking({ ...booking, adults: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Children</label>
                <Input
                  type="number"
                  min={0}
                  value={booking.children}
                  onChange={(e) => setBooking({ ...booking, children: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Meal Plan</label>
              <select
                value={booking.meal_plan}
                onChange={(e) => setBooking({ ...booking, meal_plan: e.target.value as any })}
                className="w-full p-2 border rounded-ios-lg mt-1"
              >
                <option value="bed_breakfast">Bed & Breakfast</option>
                <option value="half_board">Half Board</option>
                <option value="full_board">Full Board</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Special Requests</label>
              <textarea
                value={booking.special_requests}
                onChange={(e) => setBooking({ ...booking, special_requests: e.target.value })}
                className="w-full p-2 border rounded-ios-lg mt-1"
                rows={2}
                placeholder="Any special requests..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <IOSButton variant="outline" onClick={() => setStep('guest')} className="flex-1">
                Back
              </IOSButton>
              <IOSButton 
                onClick={handleCheckIn} 
                disabled={isSubmitting}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? 'Processing...' : 'Complete Check-In'}
              </IOSButton>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Room Details Modal
function RoomDetailsModal({
  isOpen,
  onClose,
  room,
  onStatusChange,
  onCheckOut,
}: {
  isOpen: boolean;
  onClose: () => void;
  room: Room | null;
  onStatusChange: (roomId: string, status: string) => void;
  onCheckOut: (room: Room) => void;
}) {
  if (!room) return null;

  const statusInfo = roomStatusConfig[room.status] || roomStatusConfig.available;
  const typeInfo = roomTypeConfig[room.room_type] || roomTypeConfig.standard;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Bed className="h-5 w-5" />
              Room {room.room_number}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Room Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-ios-lg">
              <p className="text-xs text-gray-500">Type</p>
              <p className="font-medium">{typeInfo.label}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-ios-lg">
              <p className="text-xs text-gray-500">Floor</p>
              <p className="font-medium">Floor {room.floor}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-ios-lg">
              <p className="text-xs text-gray-500">Max Occupancy</p>
              <p className="font-medium">{room.max_occupancy} Guests</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-ios-lg">
              <p className="text-xs text-gray-500">Rate/Night</p>
              <p className="font-medium">KES {room.price_per_night?.toLocaleString()}</p>
            </div>
          </div>

          {/* Current Guest Info */}
          {room.current_guest && (
            <div className="p-4 bg-blue-50 rounded-ios-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-800 mb-2">Current Guest</p>
              <p className="font-semibold font-sf-pro-display">{room.current_guest.name}</p>
              <div className="flex gap-4 mt-2 text-sm text-blue-600">
                <span>In: {new Date(room.current_guest.check_in).toLocaleDateString()}</span>
                <span>Out: {new Date(room.current_guest.check_out).toLocaleDateString()}</span>
              </div>
              {room.current_guest.phone && (
                <p className="text-sm text-blue-600 mt-1">{room.current_guest.phone}</p>
              )}
            </div>
          )}

          {/* Quick Actions */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Quick Actions</p>
            <div className="grid grid-cols-2 gap-2">
              {room.status === 'occupied' && (
                <IOSButton
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => onCheckOut(room)}
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  Check Out
                </IOSButton>
              )}
              {room.status === 'available' && (
                <IOSButton
                  variant="outline"
                  className="text-orange-600 border-orange-200 hover:bg-orange-50"
                  onClick={() => onStatusChange(room.id, 'maintenance')}
                >
                  <Wrench className="h-4 w-4 mr-1" />
                  Maintenance
                </IOSButton>
              )}
              {room.status === 'cleaning' && (
                <IOSButton
                  variant="outline"
                  className="text-green-600 border-green-200 hover:bg-green-50"
                  onClick={() => onStatusChange(room.id, 'available')}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Mark Ready
                </IOSButton>
              )}
              {room.status === 'maintenance' && (
                <IOSButton
                  variant="outline"
                  className="text-green-600 border-green-200 hover:bg-green-50"
                  onClick={() => onStatusChange(room.id, 'available')}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Complete
                </IOSButton>
              )}
              <IOSButton
                variant="outline"
                className="text-yellow-600 border-yellow-200 hover:bg-yellow-50"
                onClick={() => onStatusChange(room.id, 'cleaning')}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Request Clean
              </IOSButton>
            </div>
          </div>

          {/* Amenities */}
          {room.amenities && room.amenities.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Amenities</p>
              <div className="flex flex-wrap gap-2">
                {room.amenities.map((amenity, idx) => (
                  <span key={idx} className="px-2 py-1 bg-gray-100 rounded-full text-xs">
                    {amenity}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ReceptionRoomsPage() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [floorFilter, setFloorFilter] = useState<number | 'all'>('all');
  
  // Modals
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Fetch rooms
  const fetchRooms = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await roomsAPI.getRooms(user?.branch_id || undefined);
      if (response.success) {
        setRooms(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setIsLoading(false);
    }
  }, [user?.branch_id]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Filter rooms
  const filteredRooms = rooms.filter((room) => {
    const matchesSearch = room.room_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || room.status === statusFilter;
    const matchesType = typeFilter === 'all' || room.room_type === typeFilter;
    const matchesFloor = floorFilter === 'all' || room.floor === floorFilter;
    return matchesSearch && matchesStatus && matchesType && matchesFloor;
  });

  // Get unique floors
  const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);

  // Stats
  const stats = {
    total: rooms.length,
    available: rooms.filter((r) => r.status === 'available').length,
    occupied: rooms.filter((r) => r.status === 'occupied').length,
    reserved: rooms.filter((r) => r.status === 'reserved').length,
    maintenance: rooms.filter((r) => r.status === 'maintenance').length,
    cleaning: rooms.filter((r) => r.status === 'cleaning').length,
  };

  const handleStatusChange = async (roomId: string, newStatus: string) => {
    try {
      await roomsAPI.updateRoomStatus(roomId, newStatus);
      toast.success(`Room status updated to ${newStatus}`);
      fetchRooms();
      setDetailsModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update room status');
    }
  };

  const handleCheckOut = async (room: Room) => {
    try {
      // Find active booking and check out
      const bookingsResponse = await roomsAPI.getRoomBookings(room.id);
      const activeBooking = bookingsResponse.data?.find((b: any) => b.status === 'checked_in');
      
      if (activeBooking) {
        await bookingsAPI.checkOut(activeBooking.id);
      }
      
      await roomsAPI.updateRoomStatus(room.id, 'cleaning');
      toast.success(`Guest checked out from Room ${room.room_number}`);
      fetchRooms();
      setDetailsModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to check out guest');
    }
  };

  const openCheckIn = (room: Room) => {
    setSelectedRoom(room);
    setCheckInModalOpen(true);
  };

  const openDetails = (room: Room) => {
    setSelectedRoom(room);
    setDetailsModalOpen(true);
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Room Management</h1>
              <p className="text-gray-500">Manage rooms, check-ins, and availability</p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="outline" onClick={fetchRooms}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </IOSButton>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total', value: stats.total, color: 'bg-gray-100 text-gray-700' },
              { label: 'Available', value: stats.available, color: 'bg-green-100 text-green-700' },
              { label: 'Occupied', value: stats.occupied, color: 'bg-blue-100 text-blue-700' },
              { label: 'Reserved', value: stats.reserved, color: 'bg-purple-100 text-purple-700' },
              { label: 'Cleaning', value: stats.cleaning, color: 'bg-yellow-100 text-yellow-700' },
              { label: 'Maintenance', value: stats.maintenance, color: 'bg-orange-100 text-orange-700' },
            ].map((stat) => (
              <IOSCard key={stat.label} className="p-4">
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className={`text-2xl font-bold mt-1 ${stat.color.split(' ')[1]}`}>{stat.value}</p>
              </IOSCard>
            ))}
          </div>

          {/* Filters */}
          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by room number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border rounded-ios-lg text-sm"
                >
                  <option value="all">All Status</option>
                  {Object.entries(roomStatusConfig).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-3 py-2 border rounded-ios-lg text-sm"
                >
                  <option value="all">All Types</option>
                  {Object.entries(roomTypeConfig).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
                <select
                  value={floorFilter}
                  onChange={(e) => setFloorFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  className="px-3 py-2 border rounded-ios-lg text-sm"
                >
                  <option value="all">All Floors</option>
                  {floors.map((floor) => (
                    <option key={floor} value={floor}>Floor {floor}</option>
                  ))}
                </select>
              </div>
            </div>
          </IOSCard>

          {/* Rooms Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredRooms.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <Bed className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No rooms found</p>
            </IOSCard>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredRooms.map((room) => {
                const statusInfo = roomStatusConfig[room.status] || roomStatusConfig.available;
                const typeInfo = roomTypeConfig[room.room_type] || roomTypeConfig.standard;
                const StatusIcon = statusInfo.icon;

                return (
                  <IOSCard
                    key={room.id}
                    className={`p-4 cursor-pointer hover:shadow-lg transition-all border-2 ${
                      room.status === 'available' ? 'border-green-200 hover:border-green-400' :
                      room.status === 'occupied' ? 'border-blue-200 hover:border-blue-400' :
                      room.status === 'reserved' ? 'border-purple-200 hover:border-purple-400' :
                      room.status === 'maintenance' ? 'border-orange-200 hover:border-orange-400' :
                      room.status === 'cleaning' ? 'border-yellow-200 hover:border-yellow-400' :
                      'border-gray-200 hover:border-gray-400'
                    }`}
                    onClick={() => openDetails(room)}
                  >
                    {/* Room Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${typeInfo.color}`} />
                        <span className="font-bold text-lg">{room.room_number}</span>
                      </div>
                      <StatusIcon className={`h-5 w-5 ${statusInfo.color}`} />
                    </div>

                    {/* Status Badge */}
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                      {statusInfo.label}
                    </div>

                    {/* Room Info */}
                    <div className="mt-3 space-y-1 text-sm text-gray-500">
                      <p>{typeInfo.label} • Floor {room.floor}</p>
                      <p className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Max {room.max_occupancy}
                      </p>
                    </div>

                    {/* Current Guest Preview */}
                    {room.current_guest && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-gray-500">Guest</p>
                        <p className="text-sm font-medium truncate">{room.current_guest.name}</p>
                      </div>
                    )}

                    {/* Quick Action */}
                    {room.status === 'available' && (
                      <IOSButton
                        size="sm"
                        className="w-full mt-3 bg-green-600 hover:bg-green-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCheckIn(room);
                        }}
                      >
                        <LogIn className="h-3 w-3 mr-1" />
                        Check In
                      </IOSButton>
                    )}
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>

        {/* Modals */}
        <QuickCheckInModal
          isOpen={checkInModalOpen}
          onClose={() => setCheckInModalOpen(false)}
          room={selectedRoom}
          onSuccess={fetchRooms}
        />

        <RoomDetailsModal
          isOpen={detailsModalOpen}
          onClose={() => setDetailsModalOpen(false)}
          room={selectedRoom}
          onStatusChange={handleStatusChange}
          onCheckOut={handleCheckOut}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
