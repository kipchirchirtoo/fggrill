'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { branchOperationsAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import {
  Search, RefreshCw, Bed, LayoutDashboard, Check,
  ShieldAlert, AlertTriangle, Home, Wrench, Users, Plus, Trash2
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Upload, X } from 'lucide-react';

// Room interface
interface Room {
  id: string;
  room_number: string;
  room_type: string;
  floor: number;
  status: string;
  is_clean: boolean;
  maintenance_status: string;
  capacity: {
    adults: number;
    children: number;
  };
  amenities: string[];
  rate_per_night: number | null | undefined;
  images?: string[];
  image_url?: string; // Keep for backward compatibility
}

function BranchRoomsManagementContent() {
  const { user } = useAuth();
  const { activeBranch, activeBranchId } = useBranch();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [floorFilter, setFloorFilter] = useState('all');
  const [showRoomDetails, setShowRoomDetails] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Add Room Modal state
  const [showAddRoomModal, setShowAddRoomModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    room_number: '',
    room_type: '',
    floor: 1,
    rate_per_night: 0,
    capacity_adults: 2,
    capacity_children: 1,
    amenities: [] as string[],
    status: 'available',
    images: [] as string[]
  });

  // Image upload state
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    available: 0,
    occupied: 0,
    maintenance: 0,
    dirty: 0
  });

  useEffect(() => {
    if (activeBranchId) {
      fetchRooms();
    }
  }, [activeBranchId]);

  useEffect(() => {
    applyFilters();
  }, [rooms, searchTerm, statusFilter, floorFilter]);

  const fetchRooms = async () => {
    setIsLoading(true);
    console.log('Fetching rooms for branch:', activeBranchId);
    
    if (!activeBranchId) {
      console.warn('No active branch ID, cannot fetch rooms');
      setIsLoading(false);
      return;
    }
    
    try {
      // Call the real API
      const response = await branchOperationsAPI.getRooms(
        {
          status: statusFilter !== 'all' ? statusFilter : undefined,
          floor: floorFilter !== 'all' ? parseInt(floorFilter) : undefined
        },
        activeBranchId
      );

      if (response.success) {
        // Use real data from API
        const roomsData = (response.data || []) as Room[];
        setRooms(roomsData);

        // Calculate stats
        const available = roomsData.filter((r: Room) => r.status === 'available').length;
        const occupied = roomsData.filter((r: Room) => r.status === 'occupied').length;
        const maintenance = roomsData.filter((r: Room) => r.status === 'maintenance').length;
        const dirty = roomsData.filter((r: Room) => !r.is_clean).length;

        setStats({
          total: roomsData.length,
          available,
          occupied,
          maintenance,
          dirty
        });
      } else {
        console.error('API returned error:', response);
        toast.error(response.message || 'Failed to load rooms');
        setRooms([]);
        setStats({ total: 0, available: 0, occupied: 0, maintenance: 0, dirty: 0 });
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to load rooms data');
      setRooms([]);
      setStats({ total: 0, available: 0, occupied: 0, maintenance: 0, dirty: 0 });
    } finally {
      setIsLoading(false);
    }
  };

  // Generate placeholder rooms data for testing
  const generatePlaceholderRooms = (): Room[] => {
    return Array.from({ length: 10 }).map((_, i) => ({
      id: `room-${i + 1}`,
      room_number: `${100 + i}`,
      room_type: i % 3 === 0 ? 'Suite' : i % 2 === 0 ? 'Deluxe' : 'Standard',
      floor: 1,
      status: i % 5 === 0 ? 'maintenance' : i % 3 === 0 ? 'occupied' : 'available',
      is_clean: i % 4 !== 0,
      maintenance_status: 'none',
      capacity: {
        adults: 2,
        children: 1
      },
      amenities: ['Wifi', 'TV', 'AC'],
      rate_per_night: 5000 + (i * 1000)
    }));
  };

  const applyFilters = () => {
    let filtered = [...rooms];

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(room => room.status === statusFilter);
    }

    // Apply floor filter
    if (floorFilter !== 'all') {
      filtered = filtered.filter(room => room.floor === parseInt(floorFilter));
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(room =>
        room.room_number.toLowerCase().includes(searchLower) ||
        room.room_type.toLowerCase().includes(searchLower)
      );
    }

    setFilteredRooms(filtered);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <IOSBadge className="bg-green-100 text-green-700">Available</IOSBadge>;
      case 'occupied':
        return <IOSBadge className="bg-blue-100 text-blue-700">Occupied</IOSBadge>;
      case 'reserved':
        return <IOSBadge className="bg-yellow-100 text-yellow-700">Reserved</IOSBadge>;
      case 'maintenance':
        return <IOSBadge className="bg-red-100 text-red-700">Maintenance</IOSBadge>;
      default:
        return <IOSBadge className="bg-gray-100 text-gray-700">{status}</IOSBadge>;
    }
  };

  const getCleanStatusBadge = (isClean: boolean) => {
    return isClean ?
      <IOSBadge className="bg-green-100 text-green-700">Clean</IOSBadge> :
      <IOSBadge className="bg-yellow-100 text-yellow-700">Dirty</IOSBadge>;
  };

  const formatCurrency = (amount: number | undefined | null) => {
    if (!amount || amount === 0) {
      return 'KES 0';
    }
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  const handleViewRoom = (room: Room) => {
    setSelectedRoom(room);
    setShowRoomDetails(true);
  };

  const handleStatusChange = async (roomId: string, newStatus: string) => {
    try {
      // In a real implementation, you would call the API to update the status
      // const response = await branchOperationsAPI.updateRoomStatus(roomId, newStatus, activeBranchId);

      // For now, just update the local state to demonstrate functionality
      const updatedRooms = rooms.map(room => {
        if (room.id === roomId) {
          return { ...room, status: newStatus };
        }
        return room;
      });

      setRooms(updatedRooms);

      // Recalculate stats
      const available = updatedRooms.filter(r => r.status === 'available').length;
      const occupied = updatedRooms.filter(r => r.status === 'occupied').length;
      const maintenance = updatedRooms.filter(r => r.status === 'maintenance').length;
      const dirty = updatedRooms.filter(r => !r.is_clean).length;

      setStats({
        total: updatedRooms.length,
        available,
        occupied,
        maintenance,
        dirty
      });

      toast.success(`Room status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating room status:', error);
      toast.error('Failed to update room status');
    }
  };

  const handleCleanStatusChange = async (roomId: string, isClean: boolean) => {
    try {
      // In a real implementation, you would call the API to update the cleaning status
      // const response = await branchOperationsAPI.updateRoomCleanStatus(roomId, isClean, activeBranchId);

      // For now, just update the local state to demonstrate functionality
      const updatedRooms = rooms.map(room => {
        if (room.id === roomId) {
          return { ...room, is_clean: isClean };
        }
        return room;
      });

      setRooms(updatedRooms);

      // Recalculate stats
      const dirty = updatedRooms.filter(r => !r.is_clean).length;

      setStats({
        ...stats,
        dirty
      });

      toast.success(`Room marked as ${isClean ? 'clean' : 'dirty'}`);
    } catch (error) {
      console.error('Error updating room clean status:', error);
      toast.error('Failed to update room clean status');
    }
  };

  const getUniqueFloors = () => {
    const floors = Array.from(new Set(rooms.map(room => room.floor))).sort((a, b) => a - b);
    return floors;
  };

  const handleDeleteRoom = async (roomId: string, roomNumber: string) => {
    if (!confirm(`Are you sure you want to delete Room ${roomNumber}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await branchOperationsAPI.deleteRoom(roomId, activeBranchId ?? undefined);
      
      if (response.success) {
        toast.success(`Room ${roomNumber} deleted successfully`);
        fetchRooms(); // Refresh the list
      } else {
        throw new Error(response.message || 'Failed to delete room');
      }
    } catch (error: any) {
      console.error('Error deleting room:', error);
      toast.error(error.message || 'Failed to delete room');
    }
  };

  const handleOpenAddRoom = () => {
    setShowAddRoomModal(true);
  };

  const handleCloseAddRoomModal = () => {
    setShowAddRoomModal(false);
    setFormData({
      room_number: '',
      room_type: '',
      floor: 1,
      rate_per_night: 0,
      capacity_adults: 2,
      capacity_children: 1,
      amenities: [],
      status: 'available',
      images: []
    });
    setSelectedImages([]);
    setImagePreviews([]);
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleAmenityToggle = (amenity: string) => {
    const newAmenities = formData.amenities.includes(amenity)
      ? formData.amenities.filter(a => a !== amenity)
      : [...formData.amenities, amenity];
    setFormData({ ...formData, amenities: newAmenities });
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!activeBranchId) {
      toast.error('No branch selected. Please select a branch first.');
      return;
    }
    
    if (!formData.room_number || !formData.room_type || !formData.floor) {
      toast.error('Please fill in all required fields (Room Number, Type, Floor)');
      return;
    }
    
    setIsSubmitting(true);

    const roomData = {
      room_number: formData.room_number,
      room_type: formData.room_type,
      floor: formData.floor,
      rate_per_night: formData.rate_per_night || 5000,
      capacity: {
        adults: formData.capacity_adults || 2,
        children: formData.capacity_children || 1
      },
      // TODO: Fix amenities enum in database - temporarily not sending amenities
      // amenities: formData.amenities || [],
      status: formData.status || 'available'
    };
    
    console.log('Creating room with data:', JSON.stringify(roomData, null, 2), 'for branch:', activeBranchId);

    try {
      const response = await branchOperationsAPI.createRoom(roomData, activeBranchId);
      console.log('Create room response:', response);

      if (response.success) {
        toast.success('Room created successfully!');
        handleCloseAddRoomModal();
        fetchRooms(); // Refresh the list
      } else {
        throw new Error(response.message || 'Failed to create room');
      }
    } catch (error: any) {
      console.error('Error creating room:', error);
      console.error('Error details:', error.response || error);
      toast.error(error.message || 'Failed to create room');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[
      UserRole.BRANCH_OPERATIONS_MANAGER,
      UserRole.BRANCH_MANAGER,
      UserRole.RECEPTIONIST,
      UserRole.HOUSEKEEPING,
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER
    ]}>
      <BranchAwareDashboardLayout
        title="Room Management"
        subtitle={`Manage rooms for ${activeBranch?.name || 'your branch'}`}
        actionButton={
          <IOSButton leftIcon={<Plus />} onClick={handleOpenAddRoom}>
            Add Room
          </IOSButton>
        }
      >
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <IOSCard className="p-4">
              <LayoutDashboard className="h-5 w-5 text-gray-600 mb-2" />
              <p className="text-sm text-gray-500">Total Rooms</p>
              <p className="text-lg font-bold">{stats.total}</p>
            </IOSCard>

            <IOSCard className="p-4">
              <Check className="h-5 w-5 text-green-600 mb-2" />
              <p className="text-sm text-gray-500">Available</p>
              <p className="text-lg font-bold text-green-600">{stats.available}</p>
            </IOSCard>

            <IOSCard className="p-4">
              <Users className="h-5 w-5 text-blue-600 mb-2" />
              <p className="text-sm text-gray-500">Occupied</p>
              <p className="text-lg font-bold text-blue-600">{stats.occupied}</p>
            </IOSCard>

            <IOSCard className="p-4">
              <Wrench className="h-5 w-5 text-red-600 mb-2" />
              <p className="text-sm text-gray-500">Maintenance</p>
              <p className="text-lg font-bold text-red-600">{stats.maintenance}</p>
            </IOSCard>

            <IOSCard className="p-4">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mb-2" />
              <p className="text-sm text-gray-500">Dirty</p>
              <p className="text-lg font-bold text-yellow-600">{stats.dirty}</p>
            </IOSCard>
          </div>

          {/* Search and Filter */}
          <IOSCard className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search rooms..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
                >
                  <option value="all">All Statuses</option>
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="reserved">Reserved</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>

              <div>
                <select
                  value={floorFilter}
                  onChange={(e) => setFloorFilter(e.target.value)}
                  className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
                >
                  <option value="all">All Floors</option>
                  {getUniqueFloors().map((floor) => (
                    <option key={floor} value={floor}>Floor {floor}</option>
                  ))}
                </select>
              </div>

              <div>
                <IOSButton
                  onClick={fetchRooms}
                  leftIcon={<RefreshCw />}
                  className="w-full"
                >
                  Refresh
                </IOSButton>
              </div>
            </div>
          </IOSCard>

          {/* Rooms Table */}
          <IOSCard>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Image</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Floor</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Rate</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Clean</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center">
                        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                      </td>
                    </tr>
                  ) : filteredRooms.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center">
                        <div className="flex flex-col items-center">
                          <Home className="h-12 w-12 text-gray-300 mb-2" />
                          <p className="text-gray-500">No rooms found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRooms.map((room) => (
                      <tr key={room.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          {room.images && room.images.length > 0 ? (
                            <div className="relative">
                              <img
                                src={room.images[0]}
                                alt={`Room ${room.room_number}`}
                                className="w-12 h-12 object-cover rounded-lg border border-gray-200"
                              />
                              {room.images.length > 1 && (
                                <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                                  +{room.images.length - 1}
                                </div>
                              )}
                            </div>
                          ) : room.image_url ? (
                            <img
                              src={room.image_url}
                              alt={`Room ${room.room_number}`}
                              className="w-12 h-12 object-cover rounded-lg border border-gray-200"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                              <Bed className="h-6 w-6 text-gray-400" />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 font-medium">
                          {room.room_number}
                        </td>
                        <td className="px-4 py-4">
                          {room.room_type}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {room.floor}
                        </td>
                        <td className="px-4 py-4 text-right">
                          {formatCurrency(room.rate_per_night)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {getStatusBadge(room.status)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {getCleanStatusBadge(room.is_clean)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-center space-x-2">
                            {room.status === 'available' && (
                              <IOSButton
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusChange(room.id, 'maintenance')}
                              >
                                Maintenance
                              </IOSButton>
                            )}
                            {!room.is_clean && (
                              <IOSButton
                                size="sm"
                                variant="outline"
                                onClick={() => handleCleanStatusChange(room.id, true)}
                              >
                                Mark Clean
                              </IOSButton>
                            )}
                            {room.is_clean && (
                              <IOSButton
                                size="sm"
                                variant="outline"
                                onClick={() => handleCleanStatusChange(room.id, false)}
                              >
                                Mark Dirty
                              </IOSButton>
                            )}
                            <IOSButton
                              size="sm"
                              variant="secondary"
                              onClick={() => handleViewRoom(room)}
                            >
                              View
                            </IOSButton>
                            <IOSButton
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteRoom(room.id, room.room_number)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </IOSButton>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </IOSCard>
        </div>
      </BranchAwareDashboardLayout>

      {/* Room Details Dialog */}
      <Dialog open={showRoomDetails} onOpenChange={setShowRoomDetails}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Room {selectedRoom?.room_number} Details</DialogTitle>
            <DialogDescription>
              {selectedRoom?.room_type} - Floor {selectedRoom?.floor}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedRoom && (
              <>
                {selectedRoom.images && selectedRoom.images.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Room Images</p>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedRoom.images.map((image, index) => (
                        <img
                          key={index}
                          src={image}
                          alt={`Room ${selectedRoom.room_number} - Image ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border border-gray-200"
                        />
                      ))}
                    </div>
                  </div>
                )}
                {selectedRoom.image_url && !selectedRoom.images && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Room Image</p>
                    <img
                      src={selectedRoom.image_url}
                      alt={`Room ${selectedRoom.room_number}`}
                      className="w-full h-48 object-cover rounded-lg border border-gray-200"
                    />
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <p className="font-medium">{getStatusBadge(selectedRoom.status)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Cleanliness</p>
                    <p className="font-medium">{getCleanStatusBadge(selectedRoom.is_clean)}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Capacity</p>
                  <p className="font-medium">{selectedRoom.capacity.adults} Adults, {selectedRoom.capacity.children} Children</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Rate per Night</p>
                  <p className="font-medium">{formatCurrency(selectedRoom.rate_per_night)}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Amenities</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedRoom.amenities.map((amenity, index) => (
                      <IOSBadge key={index} className="bg-gray-100 text-gray-700">{amenity}</IOSBadge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Maintenance Status</p>
                  <p className="font-medium capitalize">{selectedRoom.maintenance_status.replace('_', ' ')}</p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <IOSButton variant="secondary" onClick={() => setShowRoomDetails(false)}>Close</IOSButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Room Modal */}
      <Dialog open={showAddRoomModal} onOpenChange={setShowAddRoomModal}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Room</DialogTitle>
            <DialogDescription>
              Fill in the details to add a new room to {activeBranch?.name}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateRoom} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="room_number">Room Number *</Label>
                <Input
                  id="room_number"
                  required
                  value={formData.room_number}
                  onChange={(e) => handleFormChange('room_number', e.target.value)}
                  placeholder="101"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="room_type">Room Type *</Label>
                <select
                  id="room_type"
                  required
                  value={formData.room_type}
                  onChange={(e) => handleFormChange('room_type', e.target.value)}
                  className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
                >
                  <option value="">Select Type</option>
                  <option value="Standard">Standard</option>
                  <option value="Deluxe">Deluxe</option>
                  <option value="Suite">Suite</option>
                  <option value="Executive">Executive</option>
                  <option value="Presidential">Presidential</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="floor">Floor *</Label>
                <Input
                  id="floor"
                  type="number"
                  min="1"
                  required
                  value={formData.floor}
                  onChange={(e) => handleFormChange('floor', parseInt(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rate_per_night">Rate per Night (KES) *</Label>
                <Input
                  id="rate_per_night"
                  type="number"
                  min="0"
                  required
                  value={formData.rate_per_night}
                  onChange={(e) => handleFormChange('rate_per_night', parseFloat(e.target.value))}
                  placeholder="5000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Capacity</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="capacity_adults" className="text-sm text-gray-600">Adults</Label>
                  <Input
                    id="capacity_adults"
                    type="number"
                    min="1"
                    value={formData.capacity_adults}
                    onChange={(e) => handleFormChange('capacity_adults', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="capacity_children" className="text-sm text-gray-600">Children</Label>
                  <Input
                    id="capacity_children"
                    type="number"
                    min="0"
                    value={formData.capacity_children}
                    onChange={(e) => handleFormChange('capacity_children', parseInt(e.target.value))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Room Images</Label>
              <div className="space-y-2">
                {/* Image previews */}
                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative">
                        <img
                          src={preview}
                          alt={`Room preview ${index + 1}`}
                          className="w-full h-24 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newImages = selectedImages.filter((_, i) => i !== index);
                            const newPreviews = imagePreviews.filter((_, i) => i !== index);
                            setSelectedImages(newImages);
                            setImagePreviews(newPreviews);
                            setFormData({ ...formData, images: newPreviews });
                          }}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Upload button */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
                  <Upload className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="mt-1 text-sm text-gray-600">
                    Click to upload room images
                  </p>
                  <p className="text-xs text-gray-500">PNG, JPG up to 10MB each (max 5 images)</p>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      
                      // Check total images limit
                      if (selectedImages.length + files.length > 5) {
                        alert('Maximum 5 images allowed');
                        return;
                      }
                      
                      // Check file sizes
                      const validFiles = files.filter(file => {
                        if (file.size > 10 * 1024 * 1024) {
                          alert(`File ${file.name} is too large (max 10MB)`);
                          return false;
                        }
                        return true;
                      });
                      
                      // Process valid files
                      validFiles.forEach(file => {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          const preview = e.target?.result as string;
                          setSelectedImages(prev => [...prev, file]);
                          setImagePreviews(prev => [...prev, preview]);
                          setFormData(prev => ({ ...prev, images: [...imagePreviews, preview] }));
                        };
                        reader.readAsDataURL(file);
                      });
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Amenities</Label>
              <div className="grid grid-cols-3 gap-2">
                {['WiFi', 'TV', 'AC', 'Mini-bar', 'Safe', 'Balcony', 'Bathtub', 'Shower', 'Phone'].map((amenity) => (
                  <label key={amenity} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.amenities.includes(amenity)}
                      onChange={() => handleAmenityToggle(amenity)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{amenity}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Initial Status</Label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => handleFormChange('status', e.target.value)}
                className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
              >
                <option value="available">Available</option>
                <option value="maintenance">Maintenance</option>
                <option value="out_of_order">Out of Order</option>
              </select>
            </div>

            <DialogFooter>
              <IOSButton
                type="button"
                variant="outline"
                onClick={handleCloseAddRoomModal}
                disabled={isSubmitting}
              >
                Cancel
              </IOSButton>
              <IOSButton
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Room'}
              </IOSButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>
  );
}

// Export a wrapper component that provides BranchContext
export default function BranchRoomsPage() {
  return (
    <BranchPageWrapper>
      <BranchRoomsManagementContent />
    </BranchPageWrapper>
  );
}
