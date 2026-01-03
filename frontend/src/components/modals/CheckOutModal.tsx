'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X, Search, CheckCircle, User, Bed, Calendar,
  Clock, DollarSign, FileText, LogOut
} from 'lucide-react';
import { toast } from 'sonner';
import { bookingsAPI, folioAPI } from '@/lib/api';

interface CheckOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
}

interface GuestStay {
  id: string;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalAmount: number;
  balance: number;
  isPaid: boolean;
}

export function CheckOutModal({ isOpen, onClose, initialData }: CheckOutModalProps): JSX.Element | null {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStay, setSelectedStay] = useState<GuestStay | null>(null);
  const [additionalNotes, setAdditionalNotes] = useState('');

  useEffect(() => {
    if (initialData) {
      const loadData = async () => {
        const nights = Math.max(
          1,
          Math.ceil(
            (new Date(initialData.check_out || initialData.check_out_date).getTime() - new Date(initialData.check_in || initialData.check_in_date).getTime()) / (1000 * 60 * 60 * 24)
          )
        );

        let totalAmount = 0;
        let balance = 0;
        try {
          const folioRes = await folioAPI.getFolio(initialData.id);
          const folio = folioRes.data?.folio || folioRes.folio || folioRes.data || folioRes;
          totalAmount = folio?.total_charges ?? folio?.totalCharges ?? 0;
          balance = folio?.balance ?? 0;
        } catch (e) {
          console.error("Error fetching folio", e);
        }

        setSelectedStay({
          id: initialData.id,
          guestName: initialData.guest_name || `${initialData.guest?.first_name || ''} ${initialData.guest?.last_name || ''}`.trim() || 'Guest',
          roomNumber: initialData.room_number || initialData.room?.room_number || '-',
          checkIn: initialData.check_in || initialData.check_in_date,
          checkOut: initialData.check_out || initialData.check_out_date,
          nights,
          totalAmount,
          balance,
          isPaid: balance <= 0
        });
      };
      loadData();
    } else {
      setSelectedStay(null);
      setSearchTerm('');
    }
  }, [initialData, isOpen]);

  const handleSearch = async () => {
    try {
      const res = await bookingsAPI.getBookings({ status: 'checked_in', limit: 100 });
      const list = res.data || [];
      const term = (searchTerm || '').toLowerCase();
      const found = list.find((b: any) => {
        const guestName = ((b.guest?.first_name || '') + ' ' + (b.guest?.last_name || '')).trim().toLowerCase();
        const roomNo = (b.room?.room_number || '').toLowerCase();
        return guestName.includes(term) || roomNo.includes(term) || (b.confirmation_number || '').toLowerCase().includes(term);
      });
      if (!found) {
        toast.error('No matching checked-in stays');
        return;
      }

      // Nights and folio
      const nights = Math.max(
        1,
        Math.ceil(
          (new Date(found.check_out_date).getTime() - new Date(found.check_in_date).getTime()) / (1000 * 60 * 60 * 24)
        )
      );

      let totalAmount = 0;
      let balance = 0;
      try {
        const folioRes = await folioAPI.getFolio(found.id);
        const folio = folioRes.data?.folio || folioRes.folio || folioRes.data || folioRes;
        totalAmount = folio?.total_charges ?? folio?.totalCharges ?? 0;
        balance = folio?.balance ?? 0;
      } catch {}

      setSelectedStay({
        id: found.id,
        guestName: `${found.guest?.first_name || ''} ${found.guest?.last_name || ''}`.trim() || 'Guest',
        roomNumber: found.room?.room_number || '-',
        checkIn: found.check_in_date,
        checkOut: found.check_out_date,
        nights,
        totalAmount,
        balance,
        isPaid: balance <= 0
      });
    } catch (error) {
      toast.error('Failed to search guest stays');
    }
  };

  const handleCheckOut = async () => {
    try {
      if (!selectedStay) return;
      await bookingsAPI.checkOut(selectedStay.id);
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
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
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

          {/* Stay Details */}
          {selectedStay && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-ios-lg p-4 space-y-3">
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
                  <div className="font-semibold font-sf-pro-display">KES {selectedStay.totalAmount}</div>
                </div>
                {!selectedStay.isPaid && (
                  <div className="bg-red-50 text-red-700 px-3 py-2 rounded-ios-lg text-sm">
                    Outstanding balance: KES {selectedStay.balance}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg h-24 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end pt-4 border-t">
                <button
                  onClick={handleCheckOut}
                  disabled={!selectedStay.isPaid}
                  className={`px-6 py-2 rounded-ios-lg flex items-center gap-2 ${
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
