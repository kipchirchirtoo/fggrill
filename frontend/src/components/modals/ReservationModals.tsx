'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Calendar, Users, CheckCircle, Bed, Clock, DollarSign,
  ChevronRight, User, Mail, Phone, CreditCard
} from 'lucide-react';
import { toast } from 'sonner';
import { bookingsAPI } from '@/lib/api';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
  mode?: 'create' | 'edit';
}

export function ReservationModal({ isOpen, onClose, initialData, mode = 'create' }: ReservationModalProps): JSX.Element | null {
  const [step, setStep] = useState(1);
  const [reservationData, setReservationData] = useState(initialData || {
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    roomType: 'Standard',
    roomNumber: '',
    checkIn: '',
    checkOut: '',
    adults: 1,
    children: 0,
    specialRequests: '',
    paymentMethod: 'cash',
    amount: 0
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setReservationData((prev: any) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async () => {
    try {
      // Map the simple reservation wizard data into a booking payload.
      // For now we forward the raw data and let the backend validation surface issues.
      if (mode === 'create') {
        await bookingsAPI.createBooking(reservationData);
      } else if (reservationData.id) {
        await bookingsAPI.updateBooking(reservationData.id, reservationData);
      }
      
      toast.success('Reservation ' + (mode === 'create' ? 'created' : 'updated') + ' successfully!');
      onClose();
      setStep(1);
    } catch (error) {
      toast.error('Failed to save reservation');
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
        className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {mode === 'create' ? 'New Reservation' : 'Edit Reservation'}
            </h2>
            <p className="text-sm text-gray-500">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
          <div 
            className="bg-indigo-600 h-2 rounded-full transition-all" 
            style={{ width: ((step / 3) * 100) + '%' }}
          />
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold font-sf-pro-display text-gray-900 flex items-center gap-2">
              <User className="h-5 w-5" />
              Guest Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                name="guestName"
                value={reservationData.guestName}
                onChange={handleChange}
                placeholder="Guest Name"
                className="px-3 py-2 border border-gray-300 rounded-ios-lg"
              />
              <input
                type="email"
                name="guestEmail"
                value={reservationData.guestEmail}
                onChange={handleChange}
                placeholder="Email"
                className="px-3 py-2 border border-gray-300 rounded-ios-lg"
              />
              <input
                type="tel"
                name="guestPhone"
                value={reservationData.guestPhone}
                onChange={handleChange}
                placeholder="Phone"
                className="px-3 py-2 border border-gray-300 rounded-ios-lg"
              />
              <div className="flex gap-4">
                <input
                  type="number"
                  name="adults"
                  value={reservationData.adults}
                  onChange={handleChange}
                  min="1"
                  placeholder="Adults"
                  className="px-3 py-2 border border-gray-300 rounded-ios-lg w-full"
                />
                <input
                  type="number"
                  name="children"
                  value={reservationData.children}
                  onChange={handleChange}
                  min="0"
                  placeholder="Children"
                  className="px-3 py-2 border border-gray-300 rounded-ios-lg w-full"
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold font-sf-pro-display text-gray-900 flex items-center gap-2">
              <Bed className="h-5 w-5" />
              Room Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <select
                name="roomType"
                value={reservationData.roomType}
                onChange={handleChange}
                className="px-3 py-2 border border-gray-300 rounded-ios-lg"
              >
                <option value="Standard">Standard</option>
                <option value="Deluxe">Deluxe</option>
                <option value="Suite">Suite</option>
              </select>
              <input
                type="text"
                name="roomNumber"
                value={reservationData.roomNumber}
                onChange={handleChange}
                placeholder="Room Number"
                className="px-3 py-2 border border-gray-300 rounded-ios-lg"
              />
              <input
                type="date"
                name="checkIn"
                value={reservationData.checkIn}
                onChange={handleChange}
                className="px-3 py-2 border border-gray-300 rounded-ios-lg"
              />
              <input
                type="date"
                name="checkOut"
                value={reservationData.checkOut}
                onChange={handleChange}
                className="px-3 py-2 border border-gray-300 rounded-ios-lg"
              />
              <textarea
                name="specialRequests"
                value={reservationData.specialRequests}
                onChange={handleChange}
                placeholder="Special Requests"
                className="px-3 py-2 border border-gray-300 rounded-ios-lg col-span-2"
                rows={3}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold font-sf-pro-display text-gray-900 flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Details
            </h3>
            <div className="bg-gray-50 rounded-ios-lg p-4">
              <div className="flex justify-between mb-2">
                <span>Room Charges</span>
                <span className="font-bold">KES {reservationData.amount}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Taxes</span>
                <span className="font-bold">KES {reservationData.amount * 0.16}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span>Total Amount</span>
                <span className="font-bold">KES {reservationData.amount * 1.16}</span>
              </div>
            </div>
            <select
              name="paymentMethod"
              value={reservationData.paymentMethod}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="mpesa">M-Pesa</option>
            </select>
          </div>
        )}

        <div className="flex justify-between mt-6 pt-6 border-t">
          <button
            onClick={() => setStep(Math.max(1, step - 1))}
            className={'px-4 py-2 text-gray-600 ' + (step === 1 ? 'invisible' : '')}
          >
            Previous
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-6 py-2 bg-indigo-600 text-white rounded-ios-lg hover:bg-indigo-700"
            >
              Next <ChevronRight className="inline h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="px-6 py-2 bg-green-600 text-white rounded-ios-lg hover:bg-green-700"
            >
              <CheckCircle className="inline h-4 w-4 mr-2" />
              {mode === 'create' ? 'Complete Reservation' : 'Update Reservation'}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function CancelReservationModal({ isOpen, onClose, reservation }: { isOpen: boolean; onClose: () => void; reservation: any }): JSX.Element | null {
  const handleCancel = async () => {
    try {
      if (!reservation?.id) {
        toast.error('Missing reservation ID');
        return;
      }

      await bookingsAPI.cancelBooking(reservation.id);
      
      toast.success('Reservation cancelled successfully!');
      onClose();
    } catch (error) {
      toast.error('Failed to cancel reservation');
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
        className="bg-white rounded-xl p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Cancel Reservation</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to cancel this reservation? This action cannot be undone.
          </p>

          <div className="bg-gray-50 rounded-ios-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Guest Name:</span>
              <span className="font-medium">{reservation?.guestName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Room:</span>
              <span className="font-medium">{reservation?.roomNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Check-in Date:</span>
              <span className="font-medium">{reservation?.checkIn}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Check-out Date:</span>
              <span className="font-medium">{reservation?.checkOut}</span>
            </div>
          </div>

          <div className="flex justify-end gap-4 mt-6 pt-6 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-ios-lg"
            >
              Keep Reservation
            </button>
            <button
              onClick={handleCancel}
              className="px-6 py-2 bg-red-600 text-white rounded-ios-lg hover:bg-red-700"
            >
              Cancel Reservation
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
