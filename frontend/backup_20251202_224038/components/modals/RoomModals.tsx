'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X, Bed, Users, DollarSign, Wifi, Coffee, Wind, Bath, MapPin,
  Calendar, Clock, CheckCircle, AlertCircle, Camera, Edit, Save,
  Trash2, Plus, Shield, Key, Settings, Star, MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { roomsAPI } from '@/lib/api';

// ============= ADD/EDIT ROOM MODAL =============
export function RoomModal({ isOpen, onClose, room = null }: any) {
  const [roomData, setRoomData] = useState({
    roomNumber: room?.roomNumber || '',
    floor: room?.floor || 1,
    type: room?.type || 'Standard',
    status: room?.status || 'available',
    price: room?.price || 0,
    maxOccupancy: room?.maxOccupancy || 2,
    amenities: room?.amenities || [],
    description: room?.description || '',
    photos: []
  });

  const amenitiesList = [
    { id: 'wifi', label: 'WiFi', icon: Wifi },
    { id: 'ac', label: 'Air Conditioning', icon: Wind },
    { id: 'minibar', label: 'Mini Bar', icon: Coffee },
    { id: 'jacuzzi', label: 'Jacuzzi', icon: Bath },
    { id: 'balcony', label: 'Balcony', icon: MapPin },
    { id: 'tv', label: 'Smart TV', icon: Settings },
    { id: 'safe', label: 'Safe', icon: Shield },
    { id: 'kitchen', label: 'Kitchenette', icon: Coffee }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        roomNumber: roomData.roomNumber,
        floor: roomData.floor,
        // Map simple type/status strings into backend fields where possible
        // For now, we just forward them; the backend will validate
        type: roomData.type,
        status: roomData.status,
        price: roomData.price,
        maxOccupancy: roomData.maxOccupancy,
        amenities: roomData.amenities,
        description: roomData.description,
      };

      if (room?.id) {
        await roomsAPI.updateRoom(room.id, payload);
      } else {
        await roomsAPI.createRoom(payload);
      }

      toast.success(room ? 'Room updated successfully!' : 'Room added successfully!');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const toggleAmenity = (amenityId: string) => {
    setRoomData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenityId)
        ? prev.amenities.filter((a: string) => a !== amenityId)
        : [...prev.amenities, amenityId]
    }));
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {room ? 'Edit Room' : 'Add New Room'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Bed className="h-5 w-5" />
              Room Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Number *</label>
                <input
                  type="text"
                  required
                  value={roomData.roomNumber}
                  onChange={(e) => setRoomData({ ...roomData, roomNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Floor *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={roomData.floor}
                  onChange={(e) => setRoomData({ ...roomData, floor: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Type *</label>
                <select
                  value={roomData.type}
                  onChange={(e) => setRoomData({ ...roomData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Standard">Standard</option>
                  <option value="Deluxe">Deluxe</option>
                  <option value="Suite">Suite</option>
                  <option value="Executive">Executive</option>
                  <option value="Presidential">Presidential</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                <select
                  value={roomData.status}
                  onChange={(e) => setRoomData({ ...roomData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="out_of_order">Out of Order</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price per Night (KES) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={roomData.price}
                  onChange={(e) => setRoomData({ ...roomData, price: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Occupancy *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={roomData.maxOccupancy}
                  onChange={(e) => setRoomData({ ...roomData, maxOccupancy: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Amenities */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Amenities</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {amenitiesList.map(amenity => {
                const Icon = amenity.icon;
                const isSelected = roomData.amenities.includes(amenity.id);
                return (
                  <button
                    key={amenity.id}
                    type="button"
                    onClick={() => toggleAmenity(amenity.id)}
                    className={'p-3 rounded-lg border-2 transition-colors ' + (isSelected ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300')}
                  >
                    <Icon className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-xs">{amenity.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={roomData.description}
              onChange={(e) => setRoomData({ ...roomData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              rows={4}
              placeholder="Room description and special features..."
            />
          </div>

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Photos</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Camera className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Click to upload room photos</p>
              <input type="file" multiple accept="image/*" className="hidden" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {room ? 'Update Room' : 'Add Room'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ============= ROOM DETAILS MODAL =============
interface RoomDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: any;
  setShowEditModal?: (show: boolean) => void;
}

export function RoomDetailsModal({ isOpen, onClose, room, setShowEditModal }: RoomDetailsModalProps) {
  const [activeTab, setActiveTab] = useState('details');
  const [bookingHistory, setBookingHistory] = useState<any[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);

  // Fetch room history when tab changes
  useEffect(() => {
    if (!isOpen || !room) return;

    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem('token');
        let endpoint = '';

        switch (activeTab) {
          case 'history': {
            const data = await roomsAPI.getRoomBookings(room.id);
            setBookingHistory(data.data || data || []);
            break;
          }
          case 'maintenance': {
            const data = await roomsAPI.getRoomMaintenance(room.id);
            setMaintenanceRecords(data.data || data || []);
            break;
          }
          case 'reviews': {
            const data = await roomsAPI.getRoomReviews(room.id);
            setReviews(data.data || data || []);
            break;
          }
          default:
            return;
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Failed to fetch ${activeTab}`);
      }
    };

    fetchHistory();
  }, [isOpen, room, activeTab]);

  if (!isOpen || !room) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Room {room.roomNumber}</h2>
            <p className="text-sm text-gray-500">{room.type} • Floor {room.floor}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {['details', 'history', 'maintenance', 'reviews'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={'py-2 px-1 border-b-2 font-medium text-sm capitalize ' + (activeTab === tab ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700')}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'details' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Room Information</h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Status:</dt>
                    <dd className="font-medium">{room.status}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Price:</dt>
                    <dd className="font-medium">KES {room.price?.toLocaleString()}/night</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Max Occupancy:</dt>
                    <dd className="font-medium">{room.maxOccupancy} guests</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Last Cleaned:</dt>
                    <dd className="font-medium">{new Date(room.lastCleaned).toLocaleString()}</dd>
                  </div>
                </dl>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Current Guest</h3>
                {room.currentGuest ? (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="font-medium text-blue-900">{room.currentGuest}</p>
                    <p className="text-sm text-blue-700">Check-out: {room.checkOut}</p>
                  </div>
                ) : (
                  <p className="text-gray-500">No current guest</p>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Amenities</h3>
              <div className="flex flex-wrap gap-2">
                {room.amenities?.map((amenity: string) => (
                  <span key={amenity} className="px-3 py-1 bg-gray-100 rounded-full text-sm capitalize">
                    {amenity}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => {
                  if (setShowEditModal) {
                    setShowEditModal(true);
                    onClose();
                  }
                }}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                <Edit className="inline h-4 w-4 mr-2" />
                Edit Room
              </button>
              <button 
                onClick={async () => {
                  try {
                    await roomsAPI.updateRoomStatus(room.id, 'maintenance');
                    toast.success('Room status updated successfully');
                    onClose();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Failed to update room status');
                  }
                }}
                className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">
                <AlertCircle className="inline h-4 w-4 mr-2" />
                Change Status
              </button>
              <button 
                onClick={async () => {
                  if (confirm('Are you sure you want to delete this room?')) {
                    try {
                      await roomsAPI.deleteRoom(room.id);
                      toast.success('Room deleted successfully');
                      onClose();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Failed to delete room');
                    }
                  }
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                <Trash2 className="inline h-4 w-4 mr-2" />
                Delete Room
              </button>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Booking History</h3>
            <div className="space-y-3">
              {bookingHistory.length > 0 ? (
                bookingHistory.map(booking => (
                  <div key={booking.id} className="border rounded-lg p-4">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-medium">{booking.guest?.firstName} {booking.guest?.lastName}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(booking.checkIn).toLocaleDateString()} - {new Date(booking.checkOut).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-green-600 font-medium">KES {booking.totalAmount.toLocaleString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>No booking history</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Maintenance Records</h3>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
                <Plus className="inline h-4 w-4 mr-1" />
                Add Record
              </button>
            </div>
            <div className="space-y-3">
              {maintenanceRecords.length > 0 ? (
                maintenanceRecords.map(record => (
                  <div key={record.id} className="border rounded-lg p-4">
                    <div className="flex justify-between mb-2">
                      <div>
                        <p className="font-medium">{record.type}</p>
                        <p className="text-sm text-gray-600">{new Date(record.date).toLocaleDateString()}</p>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${record.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {record.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{record.description}</p>
                    {record.notes && <p className="text-xs text-gray-500 mt-2">{record.notes}</p>}
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <Settings className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>No maintenance records</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Guest Reviews</h3>
            <div className="space-y-3">
              {reviews.length > 0 ? (
                reviews.map(review => (
                  <div key={review.id} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex text-yellow-400">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={'h-4 w-4 ' + (i < review.rating ? 'fill-current' : '')} />
                        ))}
                      </div>
                      <span className="text-sm text-gray-600">{review.rating}.0</span>
                    </div>
                    <p className="text-sm text-gray-700">{review.comment}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {review.guest?.firstName} {review.guest?.lastName} - {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>No reviews yet</p>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
