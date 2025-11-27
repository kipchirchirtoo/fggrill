'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Search, CheckCircle, User, Bed, Calendar,
  Clock, DollarSign, FileText, LogOut
} from 'lucide-react';
import { toast } from 'sonner';

interface CheckOutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GuestStay {
  id: string;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalAmount: number;
  additionalCharges: number;
  isPaid: boolean;
}

export function CheckOutModal({ isOpen, onClose }: CheckOutModalProps): JSX.Element | null {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStay, setSelectedStay] = useState<GuestStay | null>(null);
  const [additionalNotes, setAdditionalNotes] = useState('');

  const handleSearch = async () => {
    try {
      // TODO: Implement API call
      const response = await fetch('/api/stays/search?term=' + searchTerm);
      if (!response.ok) throw new Error('Failed to search guest stays');
      const data = await response.json();
      setSelectedStay(data);
    } catch (error) {
      toast.error('Failed to search guest stays');
    }
  };

  const handleCheckOut = async () => {
    try {
      if (!selectedStay) return;
      
      // TODO: Implement API call
      const response = await fetch('/api/stays/' + selectedStay.id + '/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          additionalNotes
        })
      });

      if (!response.ok) throw new Error('Failed to check out guest');
      
      toast.success('Guest checked out successfully!');
      onClose();
    } catch (error) {
      toast.error('Failed to check out guest');
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
          <h2 className="text-xl font-bold text-gray-900">Guest Check-Out</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by room number or guest name"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Search
            </button>
          </div>

          {/* Stay Details */}
          {selectedStay && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-gray-500" />
                    <span className="font-medium">{selectedStay.guestName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-gray-500" />
                    <span>{selectedStay.checkIn} - {selectedStay.checkOut}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Bed className="h-5 w-5 text-gray-500" />
                    <span>Room {selectedStay.roomNumber}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-gray-500" />
                    <span>{selectedStay.nights} nights</span>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-gray-500" />
                    <span>Total Amount</span>
                  </div>
                  <div className="font-semibold">
                    KES {selectedStay.totalAmount + selectedStay.additionalCharges}
                  </div>
                </div>
                {!selectedStay.isPaid && (
                  <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">
                    Outstanding payment required before check-out
                  </div>
                )}
              </div>

              {/* Additional Notes */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">
                  Additional Notes
                </label>
                <textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Any notes about room condition, items left behind, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg h-24 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end pt-4 border-t">
                <button
                  onClick={handleCheckOut}
                  disabled={!selectedStay.isPaid}
                  className={`px-6 py-2 rounded-lg flex items-center gap-2 ${
                    selectedStay.isPaid 
                      ? 'bg-green-600 text-white hover:bg-green-700' 
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <LogOut className="h-4 w-4" />
                  Complete Check-Out
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!selectedStay && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Search for a guest to check out</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
