'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X, Search, CheckCircle, User, Bed, Calendar,
  Clock, DollarSign, FileText, Key, Upload
} from 'lucide-react';
import { toast } from 'sonner';
import { bookingsAPI } from '@/lib/api';
import DocumentUploadModal from './DocumentUploadModal';

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
}

export function CheckInModal({ isOpen, onClose, initialData }: CheckInModalProps): JSX.Element | null {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amount, setAmount] = useState(0);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  useEffect(() => {
    if (initialData) {
      const nights = Math.max(
        1,
        Math.ceil(
          (new Date(initialData.check_out || initialData.check_out_date).getTime() - new Date(initialData.check_in || initialData.check_in_date).getTime()) / (1000 * 60 * 60 * 24)
        )
      );
      
      // Check if the booking is already paid
      const amountPaid = initialData.amount_paid || initialData.deposit_amount || 0;
      const totalAmount = initialData.total_amount || 0;
      const isPaidInFull = amountPaid >= totalAmount;
      
      setIsPaid(isPaidInFull);
      if (isPaidInFull) {
        setAmount(0); // No additional payment needed
      } else {
        setAmount(totalAmount - amountPaid); // Set the remaining balance
      }
      
      setSelectedBooking({
        id: initialData.id,
        guestName: initialData.guest_name || `${initialData.guest?.first_name || ''} ${initialData.guest?.last_name || ''}`.trim() || 'Guest',
        roomNumber: initialData.room_number || initialData.room?.room_number || 'Unassigned',
        checkIn: initialData.check_in || initialData.check_in_date,
        checkOut: initialData.check_out || initialData.check_out_date,
        nights,
        totalAmount: totalAmount,
        amountPaid: amountPaid
      });
    } else {
      setSelectedBooking(null);
      setSearchTerm('');
      setIsPaid(false);
    }
  }, [initialData, isOpen]);

  const handleSearch = async () => {
    try {
      const res = await bookingsAPI.getBookings({ status: 'confirmed', limit: 100 });
      const list = res.data || [];
      const term = (searchTerm || '').toLowerCase();
      const found = list.find((b: any) => {
        const conf = (b.confirmation_number || '').toLowerCase();
        const guestName = ((b.guest?.first_name || '') + ' ' + (b.guest?.last_name || '')).trim().toLowerCase();
        const roomNo = (b.room?.room_number || '').toLowerCase();
        return conf.includes(term) || guestName.includes(term) || roomNo.includes(term);
      });
      if (!found) {
        toast.error('No matching confirmed bookings');
        return;
      }
      // Map to UI shape
      const nights = Math.max(
        1,
        Math.ceil(
          (new Date(found.check_out_date).getTime() - new Date(found.check_in_date).getTime()) / (1000 * 60 * 60 * 24)
        )
      );
      setSelectedBooking({
        id: found.id,
        guestName: `${found.guest?.first_name || ''} ${found.guest?.last_name || ''}`.trim() || 'Guest',
        roomNumber: found.room?.room_number || 'Unassigned',
        checkIn: found.check_in_date,
        checkOut: found.check_out_date,
        nights
      });
    } catch (error) {
      toast.error('Failed to search bookings');
    }
  };

  const handleCheckIn = async () => {
    try {
      if (!selectedBooking) return;
      await bookingsAPI.checkIn(selectedBooking.id);
      toast.success('Guest checked in successfully!');
      onClose();
    } catch (error) {
      toast.error('Failed to check in guest');
    }
  };

  if (!isOpen) return null;

  return (
    <>
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
          <h2 className="text-xl font-bold text-gray-900">Guest Check-In</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Search - Only show if no initial data */}
          {!initialData && (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by booking number or guest name"
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-ios-lg"
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-indigo-600 text-white rounded-ios-lg hover:bg-indigo-700"
              >
                Search
              </button>
            </div>
          )}

          {/* Booking Details */}
          {selectedBooking && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-ios-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-gray-500" />
                    <span className="font-medium">{selectedBooking.guestName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-gray-500" />
                    <span>{new Date(selectedBooking.checkIn).toLocaleDateString()} - {new Date(selectedBooking.checkOut).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Bed className="h-5 w-5 text-gray-500" />
                    <span>Room {selectedBooking.roomNumber}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-gray-500" />
                    <span>{selectedBooking.nights} nights</span>
                  </div>
                </div>
              </div>

              {/* Payment Status */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium text-gray-900">Payment Details</h3>
                  {isPaid && (
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium flex items-center">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Paid in Full
                    </span>
                  )}
                </div>
                
                {selectedBooking && (
                  <div className="bg-gray-50 p-3 rounded-ios-lg">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Total Amount:</span>
                      <span className="font-medium">KES {selectedBooking.totalAmount?.toLocaleString() || '0'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Already Paid:</span>
                      <span className="font-medium text-green-600">KES {selectedBooking.amountPaid?.toLocaleString() || '0'}</span>
                    </div>
                  </div>
                )}
                
                {!isPaid && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Payment Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
                      >
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="mpesa">M-Pesa</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        Amount (KES)
                      </label>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Documents Section */}
              <div className="space-y-2">
                <h3 className="font-medium text-gray-900">Guest Documents</h3>
                <button
                  onClick={() => setShowDocumentModal(true)}
                  className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 text-gray-600 hover:text-indigo-600"
                >
                  <Upload className="h-5 w-5" />
                  <span>Upload ID / Passport</span>
                </button>
              </div>

              {/* Actions */}
              <div className="flex justify-end pt-4 border-t">
                <button
                  onClick={handleCheckIn}
                  className="px-6 py-2 bg-green-600 text-white rounded-ios-lg hover:bg-green-700"
                >
                  <Key className="inline h-4 w-4 mr-2" />
                  Complete Check-In
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!selectedBooking && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Search for a booking to check in</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>

    {/* Document Upload Modal */}
    {selectedBooking && (
      <DocumentUploadModal
        isOpen={showDocumentModal}
        onClose={() => setShowDocumentModal(false)}
        guestId={initialData?.guest_id || initialData?.guest?.id || ''}
        guestName={selectedBooking.guestName}
        reservationId={selectedBooking.id}
        onDocumentUploaded={() => toast.success('Document saved')}
      />
    )}
  </>
  );
}
