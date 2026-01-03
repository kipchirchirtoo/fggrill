'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bed, Users, Clock, CheckCircle, AlertCircle, Wrench, Sparkles,
  Search, Filter, RefreshCw, Eye, Edit, Key, Loader2, ChevronRight,
  Home, Star, Crown, Moon, Sun, Wifi, Coffee, Car, X, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { roomsAPI, bookingsAPI } from '@/lib/api';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate } from '@/lib/date-utils';

interface Room {
  id: string;
  room_number: string;
  floor: number;
  type: {
    id: string;
    name: string;
    base_price: number;
  } | string;
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'reserved' | 'checkout';
  guest_name?: string;
  guest_id?: string;
  check_in?: string;
  check_out?: string;
  is_vip?: boolean;
  amenities?: string[];
  notes?: string;
}

interface RoomGridProps {
  branchId?: number;
  onRoomSelect?: (room: Room) => void;
  compact?: boolean;
  showFilters?: boolean;
}

// Modern gradient color schemes for room statuses - WCAG 2.1 AA compliant
const STATUS_STYLES = {
  available: {
    gradient: 'from-emerald-50 to-green-100',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    icon: CheckCircle,
    label: 'Available',
    badge: 'bg-emerald-100 text-emerald-700'
  },
  occupied: {
    gradient: 'from-blue-50 to-indigo-100',
    border: 'border-blue-200',
    text: 'text-blue-700',
    icon: Users,
    label: 'Occupied',
    badge: 'bg-blue-100 text-blue-700'
  },
  cleaning: {
    gradient: 'from-amber-50 to-yellow-100',
    border: 'border-amber-200',
    text: 'text-amber-700',
    icon: Sparkles,
    label: 'Cleaning',
    badge: 'bg-amber-100 text-amber-700'
  },
  maintenance: {
    gradient: 'from-orange-50 to-red-100',
    border: 'border-orange-200',
    text: 'text-orange-700',
    icon: Wrench,
    label: 'Maintenance',
    badge: 'bg-orange-100 text-orange-700'
  },
  reserved: {
    gradient: 'from-purple-50 to-violet-100',
    border: 'border-purple-200',
    text: 'text-purple-700',
    icon: Clock,
    label: 'Reserved',
    badge: 'bg-purple-100 text-purple-700'
  },
  checkout: {
    gradient: 'from-rose-50 to-pink-100',
    border: 'border-rose-200',
    text: 'text-rose-700',
    icon: AlertCircle,
    label: 'Checkout Due',
    badge: 'bg-rose-100 text-rose-700'
  }
};

// Room type color schemes
const TYPE_STYLES: Record<string, { color: string; icon: any }> = {
  standard: { color: 'bg-gray-100 text-gray-700', icon: Bed },
  deluxe: { color: 'bg-blue-100 text-blue-700', icon: Star },
  suite: { color: 'bg-purple-100 text-purple-700', icon: Crown },
  executive: { color: 'bg-amber-100 text-amber-700', icon: Crown },
  presidential: { color: 'bg-gradient-to-r from-amber-200 to-yellow-300 text-amber-800', icon: Crown }
};

export function RoomGrid({ branchId, onRoomSelect, compact = false, showFilters = true }: RoomGridProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [floorFilter, setFloorFilter] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Modal states
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    available: 0,
    occupied: 0,
    cleaning: 0,
    maintenance: 0,
    reserved: 0
  });

  useEffect(() => {
    fetchRooms();
  }, [branchId]);

  const fetchRooms = async () => {
    setIsLoading(true);
    try {
      const response = await roomsAPI.getRooms();
      const roomsData = response.rooms || response.data || response || [];
      
      const processedRooms: Room[] = roomsData.map((r: any) => ({
        id: r.id,
        room_number: r.room_number || r.roomNumber,
        floor: r.floor_number || r.floor || Math.floor(parseInt(r.room_number || '100') / 100),
        type: r.type || r.room_type || 'Standard',
        status: (r.status?.toLowerCase() || 'available') as Room['status'],
        guest_name: r.current_guest?.name || r.guest_name,
        guest_id: r.current_guest?.id || r.guest_id,
        check_in: r.check_in_date || r.check_in,
        check_out: r.check_out_date || r.check_out,
        is_vip: r.current_guest?.is_vip || r.is_vip,
        amenities: r.amenities || [],
        notes: r.notes
      }));

      setRooms(processedRooms);

      // Calculate stats
      setStats({
        total: processedRooms.length,
        available: processedRooms.filter(r => r.status === 'available').length,
        occupied: processedRooms.filter(r => r.status === 'occupied').length,
        cleaning: processedRooms.filter(r => r.status === 'cleaning').length,
        maintenance: processedRooms.filter(r => r.status === 'maintenance').length,
        reserved: processedRooms.filter(r => r.status === 'reserved').length
      });
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setIsLoading(false);
    }
  };

  const floors = useMemo(() => {
    return [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);
  }, [rooms]);

  const roomTypes = useMemo(() => {
    return [...new Set(rooms.map(r => typeof r.type === 'string' ? r.type : r.type?.name || 'Standard'))];
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    let result = [...rooms];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r =>
        r.room_number.toLowerCase().includes(term) ||
        r.guest_name?.toLowerCase().includes(term)
      );
    }

    if (statusFilter) {
      result = result.filter(r => r.status === statusFilter);
    }

    if (floorFilter !== null) {
      result = result.filter(r => r.floor === floorFilter);
    }

    if (typeFilter) {
      result = result.filter(r => {
        const typeName = typeof r.type === 'string' ? r.type : r.type?.name;
        return typeName?.toLowerCase() === typeFilter.toLowerCase();
      });
    }

    return result.sort((a, b) => a.room_number.localeCompare(b.room_number, undefined, { numeric: true }));
  }, [rooms, searchTerm, statusFilter, floorFilter, typeFilter]);

  const handleRoomClick = (room: Room) => {
    if (onRoomSelect) {
      onRoomSelect(room);
    } else {
      setSelectedRoom(room);
      setIsDetailModalOpen(true);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedRoom) return;

    try {
      await roomsAPI.updateRoom(selectedRoom.id, { status: newStatus });
      toast.success(`Room ${selectedRoom.room_number} status updated to ${newStatus}`);
      setIsStatusModalOpen(false);
      fetchRooms();
    } catch (error) {
      toast.error('Failed to update room status');
    }
  };

  const getRoomTypeName = (type: Room['type']) => {
    if (typeof type === 'string') return type;
    return type?.name || 'Standard';
  };

  const getTypeStyle = (type: Room['type']) => {
    const typeName = getRoomTypeName(type).toLowerCase();
    return TYPE_STYLES[typeName] || TYPE_STYLES.standard;
  };

  return (
    <div className="space-y-4">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Home className="h-6 w-6" />
            Room Status
          </h2>
          <p className="text-sm text-gray-500">{stats.total} rooms • {stats.available} available</p>
        </div>
        <div className="flex items-center gap-3">
          <IOSButton variant="outline" onClick={fetchRooms}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </IOSButton>
          <div className="flex border rounded-ios-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-sm ${viewMode === 'grid' ? 'bg-[#3C3C43] text-white' : 'bg-white'}`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm ${viewMode === 'list' ? 'bg-[#3C3C43] text-white' : 'bg-white'}`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {Object.entries(STATUS_STYLES).map(([status, style]) => {
          const count = stats[status as keyof typeof stats] || 0;
          const Icon = style.icon;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
              className={`p-3 rounded-xl border-2 transition-all ${
                statusFilter === status 
                  ? `bg-gradient-to-br ${style.gradient} ${style.border}` 
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <Icon className={`h-5 w-5 mx-auto mb-1 ${style.text}`} />
              <p className="text-lg font-bold">{count}</p>
              <p className="text-xs text-gray-500">{style.label}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
            <Input
              placeholder="Search room or guest..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={floorFilter ?? ''}
            onChange={(e) => setFloorFilter(e.target.value ? parseInt(e.target.value) : null)}
            className="px-3 py-2 border rounded-ios-lg text-sm"
          >
            <option value="">All Floors</option>
            {floors.map(floor => (
              <option key={floor} value={floor}>Floor {floor}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border rounded-ios-lg text-sm"
          >
            <option value="">All Types</option>
            {roomTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      )}

      {/* Room Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Bed className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No rooms found</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <AnimatePresence>
            {filteredRooms.map((room, index) => {
              const statusStyle = STATUS_STYLES[room.status] || STATUS_STYLES.available;
              const StatusIcon = statusStyle.icon;
              const typeStyle = getTypeStyle(room.type);

              return (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.02 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleRoomClick(room)}
                  className={`
                    relative p-4 rounded-2xl border-2 cursor-pointer transition-all
                    bg-gradient-to-br ${statusStyle.gradient} ${statusStyle.border}
                    hover:shadow-lg
                  `}
                >
                  {/* VIP Indicator */}
                  {room.is_vip && (
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full flex items-center justify-center shadow-md">
                      <Crown className="h-3 w-3 text-white" />
                    </div>
                  )}

                  {/* Room Number */}
                  <div className="text-center mb-2">
                    <span className="text-2xl font-bold text-gray-900">{room.room_number}</span>
                  </div>

                  {/* Status Icon */}
                  <div className="flex justify-center mb-2">
                    <div className={`p-2 rounded-xl ${statusStyle.badge}`}>
                      <StatusIcon className="h-5 w-5" />
                    </div>
                  </div>

                  {/* Room Type */}
                  <div className="text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${typeStyle.color}`}>
                      {getRoomTypeName(room.type)}
                    </span>
                  </div>

                  {/* Guest Name (if occupied) */}
                  {room.guest_name && (
                    <p className="text-xs text-center text-gray-600 mt-2 truncate">
                      {room.guest_name}
                    </p>
                  )}

                  {/* Checkout Time (if applicable) */}
                  {room.status === 'checkout' && room.check_out && (
                    <p className="text-xs text-center text-rose-600 mt-1">
                      Due: {new Date(room.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        /* List View */
        <IOSCard className="divide-y">
          {filteredRooms.map(room => {
            const statusStyle = STATUS_STYLES[room.status] || STATUS_STYLES.available;
            const StatusIcon = statusStyle.icon;

            return (
              <motion.div
                key={room.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                onClick={() => handleRoomClick(room)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${statusStyle.gradient} ${statusStyle.border} border-2 flex items-center justify-center`}>
                    <span className="text-lg font-bold">{room.room_number}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold font-sf-pro-display">Room {room.room_number}</h3>
                      {room.is_vip && (
                        <Crown className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      Floor {room.floor} • {getRoomTypeName(room.type)}
                    </p>
                    {room.guest_name && (
                      <p className="text-sm text-gray-600">{room.guest_name}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <IOSBadge className={statusStyle.badge}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusStyle.label}
                  </IOSBadge>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </motion.div>
            );
          })}
        </IOSCard>
      )}

      {/* Room Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Room {selectedRoom?.room_number}</DialogTitle>
          </DialogHeader>
          {selectedRoom && (
            <div className="space-y-4">
              {/* Status Card */}
              <div className={`p-4 rounded-xl bg-gradient-to-br ${STATUS_STYLES[selectedRoom.status]?.gradient} ${STATUS_STYLES[selectedRoom.status]?.border} border-2`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Current Status</p>
                    <p className="text-xl font-bold">{STATUS_STYLES[selectedRoom.status]?.label}</p>
                  </div>
                  {(() => {
                    const Icon = STATUS_STYLES[selectedRoom.status]?.icon || Bed;
                    return <Icon className="h-8 w-8 text-gray-600" />;
                  })()}
                </div>
              </div>

              {/* Room Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-ios-lg">
                  <p className="text-xs text-gray-500">Floor</p>
                  <p className="font-medium">{selectedRoom.floor}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-ios-lg">
                  <p className="text-xs text-gray-500">Type</p>
                  <p className="font-medium">{getRoomTypeName(selectedRoom.type)}</p>
                </div>
              </div>

              {/* Guest Info (if occupied) */}
              {selectedRoom.guest_name && (
                <div className="p-3 bg-blue-50 rounded-ios-lg">
                  <p className="text-xs text-blue-600">Current Guest</p>
                  <p className="font-medium flex items-center gap-2">
                    {selectedRoom.guest_name}
                    {selectedRoom.is_vip && <Crown className="h-4 w-4 text-amber-500" />}
                  </p>
                  {selectedRoom.check_out && (
                    <p className="text-sm text-gray-600">
                      Checkout: {formatDate(selectedRoom.check_out)}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <IOSButton variant="outline" className="flex-1" onClick={() => setIsDetailModalOpen(false)}>
                  Close
                </IOSButton>
                <IOSButton 
                  className="flex-1 bg-[#3C3C43]"
                  onClick={() => { setIsDetailModalOpen(false); setIsStatusModalOpen(true); }}
                >
                  <Edit className="h-4 w-4 mr-2" /> Change Status
                </IOSButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Status Change Modal */}
      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Room Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {Object.entries(STATUS_STYLES).map(([status, style]) => {
              const Icon = style.icon;
              return (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`w-full p-3 rounded-xl border-2 flex items-center gap-3 transition-all hover:shadow-md ${
                    selectedRoom?.status === status 
                      ? `bg-gradient-to-br ${style.gradient} ${style.border}` 
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`p-2 rounded-ios-lg ${style.badge}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-medium">{style.label}</span>
                  {selectedRoom?.status === status && (
                    <Check className="h-5 w-5 ml-auto text-green-600" />
                  )}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
