'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar, Users, Edit, X, Check, Clock, AlertCircle,
  CreditCard, Phone, Mail, MapPin, Download, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';

interface Booking {
  id: string;
  confirmationNumber: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  roomNumber?: string;
  roomType: string;
  adults: number;
  children: number;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'modified';
  specialRequests?: string;
  paymentStatus: 'paid' | 'pending' | 'partial';
  createdAt: string;
}

interface BookingManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onBookingUpdated: (booking: Booking) => void;
}

export function BookingManagementModal({
  isOpen,
  onClose,
  booking,
  onBookingUpdated
}: BookingManagementModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'modify' | 'history'>('details');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modification form
  const [modificationData, setModificationData] = useState({
    checkIn: '',
    checkOut: '',
    adults: 1,
    children: 0,
    specialRequests: '',
    roomType: ''
  });

  // History data
  const [bookingHistory, setBookingHistory] = useState<any[]>([]);

  useEffect(() => {
    if (booking && isOpen) {
      setModificationData({
        checkIn: booking.checkIn?.split('T')[0] || '',
        checkOut: booking.checkOut?.split('T')[0] || '',
        adults: booking.adults,
        children: booking.children,
        specialRequests: booking.specialRequests || '',
        roomType: booking.roomType
      });
      fetchBookingHistory();
    }
  }, [booking, isOpen]);

  const fetchBookingHistory = async () => {
    if (!booking) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/history`);
      if (response.ok) {
        const result = await response.json();
        setBookingHistory(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching booking history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const modifyBooking = async () => {
    if (!booking) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/modify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          checkInDate: modificationData.checkIn,
          checkOutDate: modificationData.checkOut,
          adults: modificationData.adults,
          children: modificationData.children,
          specialRequests: modificationData.specialRequests
        })
      });

      if (!response.ok) {
        throw new Error('Failed to modify booking');
      }

      const result = await response.json();
      onBookingUpdated(result.data);
      toast.success('Booking modified successfully');
      setActiveTab('details');

    } catch (error: any) {
      toast.error(error.message || 'Failed to modify booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelBooking = async () => {
    if (!booking) return;

    if (!confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: 'Cancelled by staff',
          cancelledBy: 'staff'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to cancel booking');
      }

      const result = await response.json();
      onBookingUpdated(result.data);
      toast.success('Booking cancelled successfully');

    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkInGuest = async () => {
    if (!booking) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/check-in`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to check in guest');
      }

      const result = await response.json();
      onBookingUpdated(result.data);
      toast.success('Guest checked in successfully');

    } catch (error: any) {
      toast.error(error.message || 'Failed to check in guest');
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkOutGuest = async () => {
    if (!booking) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/check-out`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to check out guest');
      }

      const result = await response.json();
      onBookingUpdated(result.data);
      toast.success('Guest checked out successfully');

    } catch (error: any) {
      toast.error(error.message || 'Failed to check out guest');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'confirmed': return 'bg-blue-100 text-blue-700';
      case 'checked_in': return 'bg-green-100 text-green-700';
      case 'checked_out': return 'bg-gray-100 text-gray-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      case 'modified': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'confirmed': return <Check className="h-4 w-4" />;
      case 'checked_in': return <Check className="h-4 w-4" />;
      case 'checked_out': return <Check className="h-4 w-4" />;
      case 'cancelled': return <X className="h-4 w-4" />;
      case 'modified': return <Edit className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const renderDetailsTab = () => {
    if (!booking) return null;

    return (
      <div className="space-y-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[17px] font-black text-stone-900 leading-tight">{booking.guestName}</h3>
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mt-0.5">ID: {booking.confirmationNumber}</p>
          </div>
          <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter flex items-center gap-1.5 ${getStatusColor(booking.status)} shadow-sm`}>
            {getStatusIcon(booking.status)}
            {booking.status.replace('_', ' ')}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100 flex items-center gap-4 transition-all hover:bg-stone-100/50">
            <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-stone-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-[11px] font-black text-stone-400 uppercase tracking-widest leading-none">Stay Information</h4>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm font-bold text-stone-900">{new Date(booking.checkIn).toLocaleDateString()}</span>
                <span className="text-stone-300">→</span>
                <span className="text-sm font-bold text-stone-900">{new Date(booking.checkOut).toLocaleDateString()}</span>
                <span className="text-[10px] font-black bg-stone-200 px-1.5 py-0.5 rounded leading-none ml-1 uppercase">
                  {Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24))} nights
                </span>
              </div>
              <p className="text-[11px] text-stone-500 font-medium mt-1">{booking.roomType} • Room {booking.roomNumber || 'TBA'}</p>
            </div>
          </div>

          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100 flex items-center gap-4 transition-all hover:bg-stone-100/50">
            <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-stone-400">
              <Users className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-[11px] font-black text-stone-400 uppercase tracking-widest leading-none">Guest Information</h4>
              <div className="mt-1 flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[13px] font-bold text-stone-900">
                  <Mail className="h-3.5 w-3.5 text-stone-300" />
                  {booking.guestEmail}
                </div>
                <div className="flex items-center gap-1.5 text-[13px] font-bold text-stone-900">
                  <Phone className="h-3.5 w-3.5 text-stone-300" />
                  {booking.guestPhone}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100 flex items-center gap-4 transition-all hover:bg-stone-100/50">
            <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-stone-400">
              <CreditCard className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-[11px] font-black text-stone-400 uppercase tracking-widest leading-none">Payment Details</h4>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[15px] font-black text-stone-900">KES {booking.totalAmount.toLocaleString()}</span>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tighter ${booking.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' :
                  booking.paymentStatus === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                  {booking.paymentStatus}
                </span>
              </div>
            </div>
          </div>

          {booking.specialRequests && (
            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
              <h4 className="text-[11px] font-black text-stone-400 uppercase tracking-widest leading-none mb-2">Special Requests</h4>
              <p className="text-[13px] font-medium text-stone-600 leading-relaxed italic">
                "{booking.specialRequests}"
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-6 flex flex-wrap gap-2 sticky bottom-0 bg-white">
          {booking.status === 'confirmed' && (
            <button
              onClick={checkInGuest}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-green-600/20 active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <Check className="h-3.5 w-3.5" />
              Check In
            </button>
          )}

          {booking.status === 'checked_in' && (
            <button
              onClick={checkOutGuest}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all flex items-center gap-2"
            >
              <Check className="h-3.5 w-3.5" />
              Check Out
            </button>
          )}

          {['confirmed', 'pending'].includes(booking.status) && (
            <>
              <button
                onClick={() => setActiveTab('modify')}
                className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-black uppercase tracking-widest active:scale-[0.98] transition-all flex items-center gap-2"
              >
                <Edit className="h-3.5 w-3.5" />
                Modify
              </button>

              <button
                onClick={cancelBooking}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl border border-red-100 text-red-600 hover:bg-red-50 text-xs font-black uppercase tracking-widest active:scale-[0.98] transition-all flex items-center gap-2"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </>
          )}

          <button
            className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-black uppercase tracking-widest ml-auto active:scale-[0.98] transition-all"
          >
            Invoice
          </button>
        </div>
      </div>
    );
  };

  const renderModifyTab = () => {
    if (!booking) return null;

    return (
      <div className="space-y-8 pb-4">
        <div className="space-y-1">
          <h3 className="text-[17px] font-black text-stone-900 leading-tight">Modify Booking</h3>
          <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Update stay details and guests</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <h4 className="text-[13px] font-black text-stone-900 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-stone-400" />
              Reservation Dates
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Check-in Date</label>
                <Input
                  type="date"
                  className="rounded-xl border-stone-200 h-11"
                  value={modificationData.checkIn}
                  onChange={(e) => setModificationData({ ...modificationData, checkIn: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Check-out Date</label>
                <Input
                  type="date"
                  className="rounded-xl border-stone-200 h-11"
                  value={modificationData.checkOut}
                  onChange={(e) => setModificationData({ ...modificationData, checkOut: e.target.value })}
                  min={modificationData.checkIn || new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[13px] font-black text-stone-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-stone-400" />
              Guests
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Adults</label>
                <div className="flex items-center justify-between bg-stone-50 p-1.5 rounded-xl border border-stone-100">
                  <button
                    onClick={() => setModificationData({
                      ...modificationData,
                      adults: Math.max(1, modificationData.adults - 1)
                    })}
                    disabled={modificationData.adults <= 1}
                    className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-stone-600 disabled:opacity-30 transition-all active:scale-95"
                  >
                    -
                  </button>
                  <span className="font-bold text-stone-900">{modificationData.adults}</span>
                  <button
                    onClick={() => setModificationData({
                      ...modificationData,
                      adults: modificationData.adults + 1
                    })}
                    className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-stone-600 transition-all active:scale-95"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Children</label>
                <div className="flex items-center justify-between bg-stone-50 p-1.5 rounded-xl border border-stone-100">
                  <button
                    onClick={() => setModificationData({
                      ...modificationData,
                      children: Math.max(0, modificationData.children - 1)
                    })}
                    disabled={modificationData.children <= 0}
                    className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-stone-600 disabled:opacity-30 transition-all active:scale-95"
                  >
                    -
                  </button>
                  <span className="font-bold text-stone-900">{modificationData.children}</span>
                  <button
                    onClick={() => setModificationData({
                      ...modificationData,
                      children: modificationData.children + 1
                    })}
                    className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-stone-600 transition-all active:scale-95"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Special Requests</label>
            <textarea
              value={modificationData.specialRequests}
              onChange={(e) => setModificationData({ ...modificationData, specialRequests: e.target.value })}
              placeholder="Any special requests or changes..."
              className="w-full px-4 py-3 border border-stone-200 rounded-xl resize-none bg-stone-50 text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all"
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-6 sticky bottom-0 bg-white">
          <button
            onClick={() => setActiveTab('details')}
            className="flex-1 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-widest border border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-stone-700 transition-all"
          >
            Discard
          </button>
          <button
            onClick={modifyBooking}
            disabled={isSubmitting}
            className="flex-1 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-widest bg-stone-900 text-white hover:bg-stone-800 transition-all shadow-lg shadow-stone-900/10 active:scale-[0.98]"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    );
  };

  const renderHistoryTab = () => {
    return (
      <div className="space-y-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-[17px] font-black text-stone-900 leading-tight">Booking History</h3>
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Audit trail of all changes</p>
          </div>
          <button
            onClick={fetchBookingHistory}
            disabled={isLoading}
            className="p-2 rounded-xl border border-stone-200 text-stone-400 hover:text-stone-900 hover:bg-stone-50 transition-all active:scale-90"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-3 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-stone-100">
          {bookingHistory.length > 0 ? (
            bookingHistory.map((event, index) => (
              <div key={index} className="pl-8 relative group">
                <div className="absolute left-0 top-1.5 w-[23px] h-[23px] rounded-full border-4 border-white bg-stone-900 shadow-sm z-10 transition-transform group-hover:scale-110"></div>
                <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100 transition-all hover:bg-stone-100/50">
                  <div className="flex items-center justify-between gap-4">
                    <h4 className="text-[13px] font-black text-stone-900 uppercase tracking-tight leading-none">{event.action}</h4>
                    <span className="text-[10px] font-bold text-stone-400 whitespace-nowrap">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                  {event.description && (
                    <p className="text-[12px] font-medium text-stone-500 mt-1.5 leading-relaxed">{event.description}</p>
                  )}
                  {event.user && (
                    <div className="mt-2 pt-2 border-t border-stone-200/50 flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full bg-stone-200 flex items-center justify-center text-[8px] font-black text-stone-500">
                        {event.user[0]?.toUpperCase()}
                      </div>
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Modified by {event.user}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-stone-100">
                <Clock className="h-8 w-8 text-stone-200" />
              </div>
              <p className="text-[13px] font-bold text-stone-400 uppercase tracking-widest">No history recorded</p>
            </div>
          )}
        </div>
      </div>
    );
  };
  bitumen
  if (!booking) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] p-0 overflow-hidden flex flex-col border-none shadow-2xl rounded-2xl">
        <DialogHeader className="p-4 border-b border-stone-100 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-stone-900">
            <Calendar className="h-5 w-5 text-stone-500" />
            Booking Management
          </DialogTitle>
          <p className="text-xs text-stone-500 mt-0.5">View and manage guest reservation details</p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Tab Navigation */}
          <div className="flex px-4 bg-stone-50/50 border-b border-stone-100 overflow-x-auto scrollbar-hide">
            {[
              { id: 'details', label: 'Details', icon: Calendar },
              { id: 'modify', label: 'Modify', icon: Edit },
              { id: 'history', label: 'History', icon: Clock }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 ${activeTab === tab.id
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-400 hover:text-stone-600'
                  }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'details' && renderDetailsTab()}
              {activeTab === 'modify' && renderModifyTab()}
              {activeTab === 'history' && renderHistoryTab()}
            </motion.div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
