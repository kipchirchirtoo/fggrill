'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Save, User, Mail, Phone, Calendar,
  Clock, Users, Bed, FileText
} from 'lucide-react';
import { toast } from 'sonner';

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
  roomType: string;
  adults: number;
  children: number;
  specialRequests: string;
}

export function ReservationModal({ isOpen, onClose }: ReservationModalProps): JSX.Element | null {
  const [reservationData, setReservationData] = useState<ReservationData>({
    guestName: '',
    email: '',
    phone: '',
    checkIn: '',
    checkOut: '',
    roomType: 'standard',
    adults: 1,
    children: 0,
    specialRequests: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setReservationData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }));
  };

  const handleSubmit = async () => {
    try {
      // Validate required fields
      if (!reservationData.guestName || !reservationData.checkIn || !reservationData.checkOut) {
        toast.error('Please fill in all required fields');
        return;
      }

      // TODO: Implement API call
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservationData)
      });

      if (!response.ok) throw new Error('Failed to create reservation');
      
      toast.success('Reservation created successfully!');
      onClose();
    } catch (error) {
      toast.error('Failed to create reservation');
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
          <h2 className="text-xl font-bold text-gray-900">New Reservation</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Guest Information */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={reservationData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={reservationData.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Stay Details */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Room Type
                </label>
                <select
                  name="roomType"
                  value={reservationData.roomType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="standard">Standard</option>
                  <option value="deluxe">Deluxe</option>
                  <option value="suite">Suite</option>
                  <option value="family">Family Room</option>
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                placeholder="Any special requirements or requests..."
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Create Reservation
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
