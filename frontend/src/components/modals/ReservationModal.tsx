'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X, Save, User, Mail, Phone, Calendar,
  Clock, Users, Bed, FileText, Search, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { bookingsAPI, guestAPI, roomsAPI } from '@/lib/api';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ReservationData {
  guestName: string;
  email: string;
  phone: string;
  checkIn: string;
  checkOut: string;
  roomTypeId: string;
  roomId?: string;
  adults: number;
  children: number;
  specialRequests: string;
}

export function ReservationModal({ isOpen, onClose }: ReservationModalProps): JSX.Element | null {
  const [isLoading, setIsLoading] = useState(false);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [guestSearchTerm, setGuestSearchTerm] = useState('');
  const [guestSearchResults, setGuestSearchResults] = useState<any[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<any>(null);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [step, setStep] = useState(1);
  const [reservationData, setReservationData] = useState<ReservationData>({
    guestName: '',
    email: '',
    phone: '',
    checkIn: '',
    checkOut: '',
    roomTypeId: '',
    adults: 1,
    children: 0,
    specialRequests: ''
  });

  useEffect(() => {
    let active = true;
    const loadTypes = async () => {
      try {
        const res = await roomsAPI.getRoomTypes();
        const types = res.data || res.types || res || [];
        if (active) setRoomTypes(Array.isArray(types) ? types : []);
      } catch (e) {
        // ignore
      }
    };
    if (isOpen) {
      loadTypes();
      setStep(1);
      setSelectedGuest(null);
      setSelectedRoom(null);
      setGuestSearchTerm('');
      setGuestSearchResults([]);
    }
    return () => { active = false; };
  }, [isOpen]);

  const handleGuestSearch = async () => {
    if (!guestSearchTerm.trim()) return;
    try {
      const res = await guestAPI.getGuests(guestSearchTerm);
      const results = res.data || [];
      setGuestSearchResults(results);
      if (results.length === 0) {
        toast.info('No guest found. You can create a new one.');
      }
    } catch (error) {
      toast.error('Failed to search guests');
    }
  };

  const handleSelectGuest = (guest: any) => {
    setSelectedGuest(guest);
    setReservationData(prev => ({
      ...prev,
      guestName: `${guest.first_name} ${guest.last_name}`,
      email: guest.email || '',
      phone: guest.phone || ''
    }));
    setGuestSearchResults([]);
  };

  const loadAvailableRooms = async () => {
    if (!reservationData.checkIn || !reservationData.checkOut || !reservationData.roomTypeId) {
      toast.error('Please select dates and room type first');
      return;
    }
    try {
      setIsLoading(true);
      const res = await bookingsAPI.getAvailableRooms(
        reservationData.checkIn,
        reservationData.checkOut,
        reservationData.adults
      );
      const rooms = res.data || [];
      const filtered = rooms.filter((r: any) => 
        (r.type?.id || r.type_id) === reservationData.roomTypeId
      );
      setAvailableRooms(filtered);
      if (filtered.length === 0) {
        toast.warning('No available rooms for selected type and dates');
      } else {
        setStep(3);
      }
    } catch (error) {
      toast.error('Failed to load available rooms');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setReservationData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }));
  };

  const handleSubmit = async () => {
    if (!selectedRoom) {
      toast.error('Please select a room');
      return;
    }

    try {
      setIsLoading(true);

      // 1. Get or Create Guest
      let guestId = selectedGuest?.id;
      if (!guestId) {
        // Create new guest
        const nameParts = reservationData.guestName.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || 'Guest';
        
        const newGuestRes = await guestAPI.createGuest({
          firstName,
          lastName,
          email: reservationData.email,
          phone: reservationData.phone,
          preferences: {}
        });
        guestId = newGuestRes.data?.id;
      }

      if (!guestId) throw new Error('Failed to process guest information');

      // 2. Create Reservation with selected room
      await bookingsAPI.createBooking({
        roomId: selectedRoom.id,
        roomTypeId: reservationData.roomTypeId,
        checkInDate: reservationData.checkIn,
        checkOutDate: reservationData.checkOut,
        guestId: guestId,
        adults: reservationData.adults,
        children: reservationData.children,
        specialRequests: reservationData.specialRequests
      });
      
      toast.success('Reservation created successfully!');
      onClose();
    } catch (error: any) {
      console.error('Reservation error:', error);
      toast.error(error.message || 'Failed to create reservation');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">New Reservation</h2>
            <p className="text-sm text-gray-500">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
          <div 
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
            style={{ width: `${(step / 3) * 100}%` }} 
          />
        </div>

        {/* Step 1: Guest Search & Information */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold font-sf-pro-display text-gray-900 mb-4 flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search Existing Guest
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={guestSearchTerm}
                  onChange={(e) => setGuestSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleGuestSearch()}
                  placeholder="Search by name, email, or phone..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-ios-lg"
                />
                <button
                  onClick={handleGuestSearch}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-ios-lg hover:bg-indigo-700 flex items-center gap-2"
                >
                  <Search className="h-4 w-4" />
                  Search
                </button>
              </div>

              {/* Search Results */}
              {guestSearchResults.length > 0 && (
                <div className="mt-3 border border-gray-200 rounded-ios-lg max-h-48 overflow-y-auto">
                  {guestSearchResults.map((guest: any) => (
                    <div
                      key={guest.id}
                      onClick={() => handleSelectGuest(guest)}
                      className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 flex items-center justify-between"
                    >
                      <div>
                        <p className="font-medium">{guest.first_name} {guest.last_name}</p>
                        <p className="text-sm text-gray-500">{guest.email} • {guest.phone}</p>
                      </div>
                      <Check className="h-5 w-5 text-green-600" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedGuest && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-ios-lg">
                <p className="text-sm font-medium text-green-800">Selected Guest:</p>
                <p className="text-sm text-green-700">{selectedGuest.first_name} {selectedGuest.last_name}</p>
              </div>
            )}

            <div className="border-t pt-4">
              <h3 className="font-semibold font-sf-pro-display text-gray-900 mb-4 flex items-center gap-2">
                <User className="h-5 w-5" />
                Guest Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Full Name*
                  </label>
                  <input
                    type="text"
                    name="guestName"
                    value={reservationData.guestName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Email*
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={reservationData.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={reservationData.phone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Stay Details */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold font-sf-pro-display text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Stay Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Check-in Date*
                  </label>
                  <input
                    type="date"
                    name="checkIn"
                    value={reservationData.checkIn}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Check-out Date*
                  </label>
                  <input
                    type="date"
                    name="checkOut"
                    value={reservationData.checkOut}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Room Type*
                  </label>
                  <select
                    name="roomTypeId"
                    value={reservationData.roomTypeId}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
                  >
                    <option value="">Select Room Type</option>
                    {roomTypes.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Adults
                    </label>
                    <input
                      type="number"
                      name="adults"
                      value={reservationData.adults}
                      onChange={handleChange}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">
                      Children
                    </label>
                    <input
                      type="number"
                      name="children"
                      value={reservationData.children}
                      onChange={handleChange}
                      min="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold font-sf-pro-display text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Additional Information
              </h3>
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Special Requests
                </label>
                <textarea
                  name="specialRequests"
                  value={reservationData.specialRequests}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg resize-none"
                  placeholder="Any special requirements or requests..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Room Selection */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold font-sf-pro-display text-gray-900 mb-4 flex items-center gap-2">
                <Bed className="h-5 w-5" />
                Select Room
              </h3>
              
              {availableRooms.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-ios-lg">
                  <Bed className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-600">Loading available rooms...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                  {availableRooms.map((room: any) => (
                    <div
                      key={room.id}
                      onClick={() => setSelectedRoom(room)}
                      className={`p-4 border-2 rounded-ios-lg cursor-pointer transition-all ${
                        selectedRoom?.id === room.id
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-lg">Room {room.room_number}</p>
                            {selectedRoom?.id === room.id && (
                              <Check className="h-5 w-5 text-indigo-600" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{room.type?.name || 'Standard'}</p>
                          <p className="text-sm text-gray-500 mt-1">Floor {room.floor || 1}</p>
                          {room.type?.base_price && (
                            <p className="text-sm font-medium text-indigo-600 mt-2">
                              KES {room.type.base_price.toLocaleString()}/night
                            </p>
                          )}
                        </div>
                        <Bed className="h-6 w-6 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedRoom && (
                <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-ios-lg">
                  <p className="text-sm font-medium text-indigo-800">Selected Room:</p>
                  <p className="text-sm text-indigo-700">
                    Room {selectedRoom.room_number} - {selectedRoom.type?.name || 'Standard'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between gap-3 mt-6 pt-6 border-t">
          <button
            onClick={() => {
              if (step === 1) {
                onClose();
              } else {
                setStep(step - 1);
              }
            }}
            disabled={isLoading}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
          >
            {step === 1 ? 'Cancel' : 'Previous'}
          </button>

          {step < 3 ? (
            <button
              onClick={() => {
                if (step === 1) {
                  if (!reservationData.guestName || !reservationData.email) {
                    toast.error('Please fill in guest name and email');
                    return;
                  }
                  setStep(2);
                } else if (step === 2) {
                  if (!reservationData.checkIn || !reservationData.checkOut || !reservationData.roomTypeId) {
                    toast.error('Please fill in all stay details');
                    return;
                  }
                  loadAvailableRooms();
                }
              }}
              className="px-6 py-2 bg-indigo-600 text-white rounded-ios-lg hover:bg-indigo-700 flex items-center gap-2"
            >
              Next
              <Calendar className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isLoading || !selectedRoom}
              className="px-6 py-2 bg-green-600 text-white rounded-ios-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Processing...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Create Reservation
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
