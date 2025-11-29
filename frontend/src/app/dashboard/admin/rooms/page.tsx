'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bed,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  Wifi,
  Tv,
  Coffee,
  Wind,
  Bath,
  Users,
  DollarSign,
  MapPin,
  Settings,
  Tag,
  Building2,
  RefreshCw,
  Star,
  Percent
} from 'lucide-react';
import { toast } from 'sonner';
import { RoomModal, RoomDetailsModal } from '@/components/modals/RoomModals';

// Room types
enum RoomType {
  STANDARD = 'Standard',
  DELUXE = 'Deluxe',
  SUITE = 'Suite'
}

enum RoomStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  CLEANING = 'cleaning',
  MAINTENANCE = 'maintenance',
  OUT_OF_ORDER = 'out_of_order'
}

// API base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Room interface
interface Room {
  id: string;
  roomNumber: string;
  type: RoomType;
  floor: number;
  status: RoomStatus;
  price: number;
  maxOccupancy: number;
  amenities: string[];
  lastCleaned: string;
  image?: string;
  currentGuest?: string;
  checkOut?: string;
}

export default function RoomsManagement() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch rooms from API
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/rooms`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch rooms');
        }

        const data = await response.json();
        setRooms(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        toast.error('Failed to load rooms');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRooms();
  }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<RoomStatus | 'all'>('all');
  const [filterType, setFilterType] = useState<RoomType | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'rooms' | 'types' | 'rates' | 'amenities'>('rooms');

  // Room Types Configuration
  const roomTypes = [
    { id: 1, name: 'Standard', basePrice: 3500, maxOccupancy: 2, description: 'Comfortable room with basic amenities', count: rooms.filter(r => r.type === RoomType.STANDARD).length },
    { id: 2, name: 'Deluxe', basePrice: 5500, maxOccupancy: 3, description: 'Spacious room with premium amenities', count: rooms.filter(r => r.type === RoomType.DELUXE).length },
    { id: 3, name: 'Suite', basePrice: 8500, maxOccupancy: 4, description: 'Luxury suite with separate living area', count: rooms.filter(r => r.type === RoomType.SUITE).length },
  ];

  // Rate Seasons
  const rateSeasons = [
    { id: 1, name: 'Low Season', multiplier: 0.85, startDate: 'Jan 15', endDate: 'Mar 31' },
    { id: 2, name: 'Regular Season', multiplier: 1.0, startDate: 'Apr 1', endDate: 'Nov 30' },
    { id: 3, name: 'High Season', multiplier: 1.25, startDate: 'Dec 1', endDate: 'Jan 14' },
    { id: 4, name: 'Peak Season', multiplier: 1.5, startDate: 'Dec 20', endDate: 'Jan 5' },
  ];

  // Available Amenities
  const availableAmenities = [
    { id: 'wifi', name: 'Free WiFi', icon: Wifi, enabled: true },
    { id: 'tv', name: 'Smart TV', icon: Tv, enabled: true },
    { id: 'ac', name: 'Air Conditioning', icon: Wind, enabled: true },
    { id: 'minibar', name: 'Mini Bar', icon: Coffee, enabled: true },
    { id: 'jacuzzi', name: 'Jacuzzi', icon: Bath, enabled: false },
    { id: 'balcony', name: 'Balcony', icon: MapPin, enabled: true },
  ];

  // Filter rooms based on search and filters
  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          room.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || room.status === filterStatus;
    const matchesType = filterType === 'all' || room.type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusColor = (status: RoomStatus) => {
    switch (status) {
      case RoomStatus.AVAILABLE:
        return 'bg-green-100 text-green-800 border-green-200';
      case RoomStatus.OCCUPIED:
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case RoomStatus.CLEANING:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case RoomStatus.MAINTENANCE:
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case RoomStatus.OUT_OF_ORDER:
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: RoomStatus) => {
    switch (status) {
      case RoomStatus.AVAILABLE:
        return <CheckCircle className="h-4 w-4" />;
      case RoomStatus.OCCUPIED:
        return <Users className="h-4 w-4" />;
      case RoomStatus.CLEANING:
        return <AlertCircle className="h-4 w-4" />;
      case RoomStatus.MAINTENANCE:
        return <AlertCircle className="h-4 w-4" />;
      case RoomStatus.OUT_OF_ORDER:
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const amenityIcons: Record<string, any> = {
    wifi: Wifi,
    tv: Tv,
    ac: Wind,
    minibar: Coffee,
    balcony: MapPin,
    jacuzzi: Bath,
    kitchen: Coffee
  };

  const handleStatusChange = (roomId: string, newStatus: RoomStatus) => {
    setRooms(prev => prev.map(room => 
      room.id === roomId ? { ...room, status: newStatus } : room
    ));
    toast.success('Room status updated successfully');
  };

  const RoomCard = ({ room }: { room: any }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow"
    >
      {/* Room Image */}
      <div className="relative h-48 bg-gradient-to-br from-indigo-100 to-purple-100">
        <div className="absolute top-4 left-4">
          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(room.status)}`}>
            {getStatusIcon(room.status)}
            {room.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>
        <div className="absolute bottom-4 left-4">
          <h3 className="text-2xl font-bold text-gray-900">Room {room.roomNumber}</h3>
          <p className="text-sm text-gray-600">{room.type} • Floor {room.floor}</p>
        </div>
      </div>

      {/* Room Details */}
      <div className="p-4 space-y-4">
        {/* Price and Occupancy */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <DollarSign className="h-4 w-4 text-gray-400" />
            <span className="font-semibold text-gray-900">KES {room.price.toLocaleString()}</span>
            <span className="text-sm text-gray-500">/ night</span>
          </div>
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600">Max {room.maxOccupancy}</span>
          </div>
        </div>

        {/* Current Guest (if occupied) */}
        {room.status === RoomStatus.OCCUPIED && room.currentGuest && (
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-sm font-medium text-blue-900">Current Guest: {room.currentGuest}</p>
            <p className="text-xs text-blue-700">Check-out: {room.checkOut}</p>
          </div>
        )}

        {/* Amenities */}
        <div className="flex flex-wrap gap-2">
          {room.amenities.map((amenity: string) => {
            const Icon = amenityIcons[amenity];
            return Icon ? (
              <div key={amenity} className="flex items-center gap-1 text-gray-600">
                <Icon className="h-4 w-4" />
                <span className="text-xs capitalize">{amenity}</span>
              </div>
            ) : null;
          })}
        </div>

        {/* Last Cleaned */}
        <div className="text-xs text-gray-500">
          Last cleaned: {new Date(room.lastCleaned).toLocaleString()}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <button
            onClick={() => {
              setSelectedRoom(room);
              setShowDetailsModal(true);
            }}
            className="flex-1 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
          >
            <Eye className="h-4 w-4 inline mr-1" />
            View
          </button>
          <button 
            onClick={async () => {
              setSelectedRoom(room);
              setShowEditModal(true);
            }}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <Edit className="h-4 w-4" />
          </button>
          <button 
            onClick={async () => {
              if (confirm('Are you sure you want to delete this room?')) {
                try {
                  const token = localStorage.getItem('token');
                  const response = await fetch(`${API_URL}/api/rooms/${room.id}`, {
                    method: 'DELETE',
                    headers: {
                      'Authorization': `Bearer ${token}`
                    }
                  });

                  if (!response.ok) {
                    throw new Error('Failed to delete room');
                  }

                  setRooms(prev => prev.filter(r => r.id !== room.id));
                  toast.success('Room deleted successfully');
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Failed to delete room');
                }
              }
            }}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Room Configuration</h1>
              <p className="text-gray-600 mt-1">Manage rooms, types, rates and amenities</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="h-5 w-5" />
                Add Room
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex gap-8">
              {[
                { id: 'rooms', label: 'All Rooms', icon: Bed },
                { id: 'types', label: 'Room Types', icon: Tag },
                { id: 'rates', label: 'Rate Management', icon: Percent },
                { id: 'amenities', label: 'Amenities', icon: Star }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Rooms Tab */}
          {activeTab === 'rooms' && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {Object.values(RoomStatus).map(status => {
                  const count = rooms.filter(r => r.status === status).length;
                  return (
                    <div key={status} className="bg-white rounded-lg p-4 border border-gray-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 capitalize">{status.replace('_', ' ')}</p>
                          <p className="text-2xl font-bold text-gray-900">{count}</p>
                        </div>
                        <div className={`p-2 rounded-lg ${getStatusColor(status).split(' ')[0]}`}>
                          {getStatusIcon(status)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

          {/* Filters and Search */}
          <div className="bg-white rounded-lg p-4 border border-gray-100">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search rooms..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as RoomStatus | 'all')}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Status</option>
                {Object.values(RoomStatus).map(status => (
                  <option key={status} value={status}>
                    {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
                  </option>
                ))}
              </select>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as RoomType | 'all')}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Types</option>
                {Object.values(RoomType).map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Rooms Grid/List */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredRooms.map(room => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Room</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guest</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRooms.map(room => (
                    <tr key={room.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">Room {room.roomNumber}</div>
                        <div className="text-sm text-gray-500">Floor {room.floor}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{room.type}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(room.status)}`}>
                          {getStatusIcon(room.status)}
                          {room.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        KES {room.price.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {room.currentGuest || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              setSelectedRoom(room);
                              setShowDetailsModal(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-900">View</button>
                          <button 
                            onClick={() => {
                              setSelectedRoom(room);
                              setShowEditModal(true);
                            }}
                            className="text-gray-600 hover:text-gray-900">Edit</button>
                          <button 
                            onClick={async () => {
                              if (confirm('Are you sure you want to delete this room?')) {
                                try {
                                  const token = localStorage.getItem('token');
                                  const response = await fetch(`${API_URL}/api/rooms/${room.id}`, {
                                    method: 'DELETE',
                                    headers: {
                                      'Authorization': `Bearer ${token}`
                                    }
                                  });

                                  if (!response.ok) {
                                    throw new Error('Failed to delete room');
                                  }

                                  setRooms(prev => prev.filter(r => r.id !== room.id));
                                  toast.success('Room deleted successfully');
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : 'Failed to delete room');
                                }
                              }
                            }}
                            className="text-red-600 hover:text-red-900">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty State */}
              {filteredRooms.length === 0 && (
                <div className="bg-white rounded-lg p-12 text-center">
                  <Bed className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No rooms found</h3>
                  <p className="text-gray-600">Try adjusting your search or filters</p>
                </div>
              )}
            </>
          )}

          {/* Room Types Tab */}
          {activeTab === 'types' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Room Types Configuration</h2>
                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  <Plus className="h-4 w-4" />
                  Add Room Type
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {roomTypes.map(type => (
                  <div key={type.id} className="bg-white rounded-xl p-6 border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-gray-900">{type.name}</h3>
                      <span className="text-sm bg-indigo-100 text-indigo-700 px-2 py-1 rounded">{type.count} rooms</span>
                    </div>
                    <p className="text-gray-600 text-sm mb-4">{type.description}</p>
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Base Price:</span>
                        <span className="font-medium">KES {type.basePrice.toLocaleString()}/night</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Max Occupancy:</span>
                        <span className="font-medium">{type.maxOccupancy} guests</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
                        <Edit className="h-4 w-4 inline mr-1" />
                        Edit
                      </button>
                      <button className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rate Management Tab */}
          {activeTab === 'rates' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Rate Management</h2>
                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  <Plus className="h-4 w-4" />
                  Add Season
                </button>
              </div>

              {/* Current Rates */}
              <div className="bg-white rounded-xl p-6 border border-gray-100">
                <h3 className="font-semibold mb-4">Current Rate Card</h3>
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Base Rate</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Low Season</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">High Season</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Peak Season</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {roomTypes.map(type => (
                      <tr key={type.id}>
                        <td className="px-4 py-3 font-medium">{type.name}</td>
                        <td className="px-4 py-3">KES {type.basePrice.toLocaleString()}</td>
                        <td className="px-4 py-3 text-green-600">KES {Math.round(type.basePrice * 0.85).toLocaleString()}</td>
                        <td className="px-4 py-3 text-amber-600">KES {Math.round(type.basePrice * 1.25).toLocaleString()}</td>
                        <td className="px-4 py-3 text-red-600">KES {Math.round(type.basePrice * 1.5).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Seasons */}
              <div className="bg-white rounded-xl p-6 border border-gray-100">
                <h3 className="font-semibold mb-4">Seasonal Rates</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {rateSeasons.map(season => (
                    <div key={season.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{season.name}</span>
                        <span className={`text-sm font-bold ${season.multiplier > 1 ? 'text-red-600' : season.multiplier < 1 ? 'text-green-600' : 'text-gray-600'}`}>
                          {season.multiplier > 1 ? '+' : ''}{Math.round((season.multiplier - 1) * 100)}%
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">{season.startDate} - {season.endDate}</p>
                      <button className="mt-2 text-sm text-indigo-600 hover:underline">Edit dates</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Amenities Tab */}
          {activeTab === 'amenities' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Amenities Configuration</h2>
                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  <Plus className="h-4 w-4" />
                  Add Amenity
                </button>
              </div>

              <div className="bg-white rounded-xl p-6 border border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableAmenities.map(amenity => (
                    <div key={amenity.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${amenity.enabled ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                          <amenity.icon className={`h-5 w-5 ${amenity.enabled ? 'text-indigo-600' : 'text-gray-400'}`} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{amenity.name}</p>
                          <p className="text-xs text-gray-500">{amenity.enabled ? 'Enabled' : 'Disabled'}</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked={amenity.enabled} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Amenity by Room Type */}
              <div className="bg-white rounded-xl p-6 border border-gray-100">
                <h3 className="font-semibold mb-4">Amenities by Room Type</h3>
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amenity</th>
                      {roomTypes.map(type => (
                        <th key={type.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">{type.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {availableAmenities.map(amenity => (
                      <tr key={amenity.id}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <amenity.icon className="h-4 w-4 text-gray-400" />
                            {amenity.name}
                          </div>
                        </td>
                        {roomTypes.map(type => (
                          <td key={type.id} className="px-4 py-3 text-center">
                            <input type="checkbox" defaultChecked={type.id > 1 || amenity.id !== 'jacuzzi'} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modals */}
        <RoomModal 
          isOpen={showAddModal} 
          onClose={() => setShowAddModal(false)} 
        />
        <RoomModal 
          isOpen={showEditModal} 
          onClose={() => {
            setShowEditModal(false);
            setSelectedRoom(null);
          }} 
          room={selectedRoom}
        />
        <RoomDetailsModal 
          isOpen={showDetailsModal} 
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedRoom(null);
          }} 
          room={selectedRoom}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
