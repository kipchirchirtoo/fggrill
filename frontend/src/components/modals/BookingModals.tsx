'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Calendar, Users, CheckCircle, Bed, Clock, DollarSign,
  ChevronRight, User, Mail, Phone, CreditCard
} from 'lucide-react';
import { toast } from 'sonner';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
  mode?: 'create' | 'edit';
}

export function BookingModal({ isOpen, onClose, initialData, mode = 'create' }: BookingModalProps): JSX.Element | null {
  const [step, setStep] = useState(1);
  const [bookingData, setBookingData] = useState(initialData || {
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
    setBookingData((prev: any) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async () => {
    try {
      // TODO: Implement API call
      const response = await fetch('/api/bookings', {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
      });

      if (!response.ok) throw new Error('Failed to save booking');

      toast.success('Booking ' + (mode === 'create' ? 'created' : 'updated') + ' successfully!');
      onClose();
      setStep(1);
    } catch (error) {
      toast.error('Failed to save booking');
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
              {mode === 'create' ? 'New Booking' : 'Edit Booking'}
            </h2>
            <p className="text-sm text-gray-500">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
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
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <User className="h-5 w-5" />
              Guest Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                name="guestName"
                value={bookingData.guestName}
                onChange={handleChange}
                placeholder="Guest Name"
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="email"
                name="guestEmail"
                value={bookingData.guestEmail}
                onChange={handleChange}
                placeholder="Email"
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="tel"
                name="guestPhone"
                value={bookingData.guestPhone}
                onChange={handleChange}
                placeholder="Phone"
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
              <div className="flex gap-4">
                <input
                  type="number"
                  name="adults"
                  value={bookingData.adults}
                  onChange={handleChange}
                  min="1"
                  placeholder="Adults"
                  className="px-3 py-2 border border-gray-300 rounded-lg w-full"
                />
                <input
                  type="number"
                  name="children"
                  value={bookingData.children}
                  onChange={handleChange}
                  min="0"
                  placeholder="Children"
                  className="px-3 py-2 border border-gray-300 rounded-lg w-full"
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Bed className="h-5 w-5" />
              Room Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <select
                name="roomType"
                value={bookingData.roomType}
                onChange={handleChange}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="Standard">Standard</option>
                <option value="Deluxe">Deluxe</option>
                <option value="Suite">Suite</option>
              </select>
              <input
                type="text"
                name="roomNumber"
                value={bookingData.roomNumber}
                onChange={handleChange}
                placeholder="Room Number"
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="date"
                name="checkIn"
                value={bookingData.checkIn}
                onChange={handleChange}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="date"
                name="checkOut"
                value={bookingData.checkOut}
                onChange={handleChange}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              />
              <textarea
                name="specialRequests"
                value={bookingData.specialRequests}
                onChange={handleChange}
                placeholder="Special Requests"
                className="px-3 py-2 border border-gray-300 rounded-lg col-span-2"
                rows={3}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Details
            </h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between mb-2">
                <span>Room Charges</span>
                <span className="font-bold">KES {bookingData.amount}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Taxes</span>
                <span className="font-bold">KES {bookingData.amount * 0.16}</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span>Total Amount</span>
                <span className="font-bold">KES {bookingData.amount * 1.16}</span>
              </div>
            </div>
            <select
              name="paymentMethod"
              value={bookingData.paymentMethod}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
            className={'bg-white/20 backdrop-blur-sm rounded-lg p-4 hover:bg-white/30 transition-colors ' + (step === 1 ? 'invisible' : '')}
          >
            Previous
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Next <ChevronRight className="inline h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <CheckCircle className="inline h-4 w-4 mr-2" />
              {mode === 'create' ? 'Complete Booking' : 'Update Booking'}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}


