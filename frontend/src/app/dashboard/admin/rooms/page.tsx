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
  MapPin
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
              <h1 className="text-3xl font-bold text-gray-900">Room Management</h1>
              <p className="text-gray-600 mt-1">Manage hotel rooms and availability</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              Add Room
            </button>
          </div>

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
