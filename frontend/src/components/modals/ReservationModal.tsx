'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X, Save, User, Mail, Phone, Calendar,
  Clock, Users, Bed, FileText, Search, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog as UIDialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { useBranch } from '@/lib/branch-context';
import { roomsAPI, guestAPI, bookingsAPI } from '@/lib/api';

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
  const { activeBranchId } = useBranch();
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
        const trimmedName = reservationData.guestName.trim();
        const nameParts = trimmedName.split(/\s+/).filter(part => part.length > 0);

        // Ensure first_name and last_name are at least 2 chars (DB constraint)
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || 'Guest';

        if (firstName.length < 2) {
          throw new Error('Guest first name must be at least 2 characters long');
        }

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
        specialRequests: reservationData.specialRequests,
        branchId: activeBranchId
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
    <UIDialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden flex flex-col border-none shadow-2xl rounded-2xl bg-white max-h-[90vh]">
        <DialogHeader className="p-4 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <DialogTitle className="text-[17px] font-black text-stone-900 leading-tight">New Reservation</DialogTitle>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className={`h-1 w-6 rounded-full transition-all ${s <= step ? 'bg-stone-900' : 'bg-stone-100'}`} />
                  ))}
                </div>
                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest leading-none">Step {step} of 3</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: step > 1 ? 10 : -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Step 1: Guest Search & Information */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-[13px] font-black text-stone-900 uppercase tracking-widest flex items-center gap-2">
                    <Search className="h-4 w-4 text-stone-400" />
                    Guest Search
                  </h3>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={guestSearchTerm}
                      onChange={(e) => setGuestSearchTerm(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleGuestSearch()}
                      placeholder="Name, email, or phone..."
                      className="rounded-xl border-stone-200 h-11"
                    />
                    <button
                      onClick={handleGuestSearch}
                      className="px-4 py-2 bg-stone-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all"
                    >
                      Search
                    </button>
                  </div>

                  {/* Search Results */}
                  {guestSearchResults.length > 0 && (
                    <div className="mt-2 border border-stone-100 rounded-2xl overflow-hidden bg-stone-50 shadow-inner">
                      {guestSearchResults.map((guest: any) => (
                        <button
                          key={guest.id}
                          onClick={() => handleSelectGuest(guest)}
                          className="w-full p-4 text-left hover:bg-white border-b border-stone-100 last:border-b-0 transition-colors flex items-center justify-between group"
                        >
                          <div>
                            <p className="text-[13px] font-black text-stone-900 leading-tight">{guest.first_name} {guest.last_name}</p>
                            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mt-1">{guest.email} • {guest.phone}</p>
                          </div>
                          <Check className="h-4 w-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4 pt-4 border-t border-stone-100">
                  <h3 className="text-[13px] font-black text-stone-900 uppercase tracking-widest flex items-center gap-2">
                    <User className="h-4 w-4 text-stone-400" />
                    Guest Profile
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Full Name*</label>
                      <Input
                        type="text"
                        name="guestName"
                        value={reservationData.guestName}
                        onChange={handleChange}
                        className="rounded-xl border-stone-200 h-11"
                        placeholder="e.g. John Doe"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Email*</label>
                        <Input
                          type="email"
                          name="email"
                          value={reservationData.email}
                          onChange={handleChange}
                          className="rounded-xl border-stone-200 h-11"
                          placeholder="john@example.com"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Phone</label>
                        <Input
                          type="tel"
                          name="phone"
                          value={reservationData.phone}
                          onChange={handleChange}
                          className="rounded-xl border-stone-200 h-11"
                          placeholder="+254..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Stay Details */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-[13px] font-black text-stone-900 uppercase tracking-widest flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-stone-400" />
                    Stay Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Check-in</label>
                      <Input
                        type="date"
                        name="checkIn"
                        value={reservationData.checkIn}
                        onChange={handleChange}
                        className="rounded-xl border-stone-200 h-11"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Check-out</label>
                      <Input
                        type="date"
                        name="checkOut"
                        value={reservationData.checkOut}
                        onChange={handleChange}
                        className="rounded-xl border-stone-200 h-11"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Room Type*</label>
                    <select
                      name="roomTypeId"
                      value={reservationData.roomTypeId}
                      onChange={handleChange}
                      className="w-full h-11 px-4 border border-stone-200 rounded-xl bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all font-bold text-sm"
                    >
                      <option value="">Select Room Type</option>
                      {roomTypes.map((t: any) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Adults</label>
                      <Input
                        type="number"
                        name="adults"
                        value={reservationData.adults}
                        onChange={handleChange}
                        min="1"
                        className="rounded-xl border-stone-200 h-11 font-black text-center"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Children</label>
                      <Input
                        type="number"
                        name="children"
                        value={reservationData.children}
                        onChange={handleChange}
                        min="0"
                        className="rounded-xl border-stone-200 h-11 font-black text-center"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-stone-100">
                  <h3 className="text-[13px] font-black text-stone-900 uppercase tracking-widest flex items-center gap-2">
                    <FileText className="h-4 w-4 text-stone-400" />
                    Additional Info
                  </h3>
                  <textarea
                    name="specialRequests"
                    value={reservationData.specialRequests}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl resize-none bg-stone-50 text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all text-sm font-medium"
                    placeholder="Any special requirements..."
                  />
                </div>
              </div>
            )}

            {/* Step 3: Room Selection */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-[13px] font-black text-stone-900 uppercase tracking-widest flex items-center gap-2">
                    <Bed className="h-4 w-4 text-stone-400" />
                    Select Room
                  </h3>

                  {availableRooms.length === 0 ? (
                    <div className="text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                      <Bed className="h-10 w-10 mx-auto text-stone-200 mb-3" />
                      <p className="text-[11px] font-black text-stone-400 uppercase tracking-widest">Searching available rooms...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto pr-2 scrollbar-thin">
                      {availableRooms.map((room: any) => (
                        <button
                          key={room.id}
                          onClick={() => setSelectedRoom(room)}
                          className={`p-4 rounded-2xl border-2 text-left transition-all ${selectedRoom?.id === room.id
                            ? 'border-stone-900 bg-stone-900 text-white shadow-lg'
                            : 'border-stone-100 bg-stone-50 text-stone-900 hover:border-stone-200'
                            }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <p className="text-[15px] font-black leading-none">Room {room.room_number}</p>
                              <p className={`text-[11px] font-bold uppercase tracking-widest ${selectedRoom?.id === room.id ? 'text-stone-400' : 'text-stone-400'}`}>
                                {room.type?.name || 'Standard'} • Floor {room.floor || 1}
                              </p>
                              {room.type?.base_price && (
                                <p className={`text-[13px] font-black mt-1 ${selectedRoom?.id === room.id ? 'text-white' : 'text-stone-900'}`}>
                                  KES {room.type.base_price.toLocaleString()}
                                  <span className="text-[10px] font-bold opacity-60 ml-1">/ NIGHT</span>
                                </p>
                              )}
                            </div>
                            {selectedRoom?.id === room.id ? (
                              <Check className="h-5 w-5" />
                            ) : (
                              <Bed className="h-5 w-5 text-stone-200" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Navigation Buttons */}
        <div className="p-4 border-t border-stone-100 bg-white flex justify-between gap-3 flex-shrink-0">
          <button
            onClick={() => {
              if (step === 1) {
                onClose();
              } else {
                setStep(step - 1);
              }
            }}
            disabled={isLoading}
            className="px-6 py-2.5 text-[11px] font-black text-stone-400 uppercase tracking-widest hover:text-stone-900 transition-colors disabled:opacity-30"
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

                  const nameParts = reservationData.guestName.trim().split(/\s+/);
                  if (nameParts[0].length < 2) {
                    toast.error('First name must be at least 2 characters long');
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
              className="px-8 py-2.5 bg-stone-900 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-stone-800 transition-all shadow-lg active:scale-95"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isLoading || !selectedRoom}
              className="px-8 py-2.5 bg-green-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Processing...' : 'Create Reservation'}
            </button>
          )}
        </div>
      </DialogContent>
    </UIDialog>
  );
}
