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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold">{booking.guestName}</h3>
            <p className="text-gray-600">Confirmation: {booking.confirmationNumber}</p>
          </div>
          <IOSBadge className={getStatusColor(booking.status)}>
            <div className="flex items-center gap-1">
              {getStatusIcon(booking.status)}
              {booking.status.replace('_', ' ').toUpperCase()}
            </div>
          </IOSBadge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <IOSCard className="p-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Stay Information
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Check-in:</span>
                <span className="font-medium">{new Date(booking.checkIn).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Check-out:</span>
                <span className="font-medium">{new Date(booking.checkOut).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Nights:</span>
                <span className="font-medium">
                  {Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Room:</span>
                <span className="font-medium">{booking.roomNumber || 'TBA'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Room Type:</span>
                <span className="font-medium">{booking.roomType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Guests:</span>
                <span className="font-medium">
                  {booking.adults} Adults{booking.children > 0 && `, ${booking.children} Children`}
                </span>
              </div>
            </div>
          </IOSCard>

          <IOSCard className="p-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Guest Information
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-500" />
                <span>{booking.guestEmail}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-500" />
                <span>{booking.guestPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Booked on:</span>
                <span className="font-medium">{new Date(booking.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </IOSCard>

          <IOSCard className="p-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Information
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-bold text-lg">KES {booking.totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Status:</span>
                <IOSBadge className={
                  booking.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' :
                  booking.paymentStatus === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }>
                  {booking.paymentStatus.toUpperCase()}
                </IOSBadge>
              </div>
            </div>
          </IOSCard>

          {booking.specialRequests && (
            <IOSCard className="p-4">
              <h4 className="font-semibold mb-3">Special Requests</h4>
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                {booking.specialRequests}
              </p>
            </IOSCard>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {booking.status === 'confirmed' && (
            <IOSButton
              onClick={checkInGuest}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700 text-white"
              leftIcon={<Check className="h-4 w-4" />}
            >
              Check In
            </IOSButton>
          )}
          
          {booking.status === 'checked_in' && (
            <IOSButton
              onClick={checkOutGuest}
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              leftIcon={<Check className="h-4 w-4" />}
            >
              Check Out
            </IOSButton>
          )}

          {['confirmed', 'pending'].includes(booking.status) && (
            <>
              <IOSButton
                variant="outline"
                onClick={() => setActiveTab('modify')}
                leftIcon={<Edit className="h-4 w-4" />}
              >
                Modify Booking
              </IOSButton>
              
              <IOSButton
                variant="outline"
                onClick={cancelBooking}
                disabled={isSubmitting}
                className="border-red-200 text-red-600 hover:bg-red-50"
                leftIcon={<X className="h-4 w-4" />}
              >
                Cancel Booking
              </IOSButton>
            </>
          )}

          <IOSButton
            variant="outline"
            leftIcon={<Download className="h-4 w-4" />}
          >
            Download Invoice
          </IOSButton>
        </div>
      </div>
    );
  };

  const renderModifyTab = () => {
    if (!booking) return null;

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-bold mb-2">Modify Booking</h3>
          <p className="text-gray-600">Update booking details for {booking.guestName}</p>
        </div>

        <IOSCard className="p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Check-in Date</label>
                <Input
                  type="date"
                  value={modificationData.checkIn}
                  onChange={(e) => setModificationData({...modificationData, checkIn: e.target.value})}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Check-out Date</label>
                <Input
                  type="date"
                  value={modificationData.checkOut}
                  onChange={(e) => setModificationData({...modificationData, checkOut: e.target.value})}
                  min={modificationData.checkIn || new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Adults</label>
                <div className="flex items-center gap-2">
                  <IOSButton
                    variant="outline"
                    size="sm"
                    onClick={() => setModificationData({
                      ...modificationData, 
                      adults: Math.max(1, modificationData.adults - 1)
                    })}
                    disabled={modificationData.adults <= 1}
                  >
                    -
                  </IOSButton>
                  <span className="w-8 text-center">{modificationData.adults}</span>
                  <IOSButton
                    variant="outline"
                    size="sm"
                    onClick={() => setModificationData({
                      ...modificationData, 
                      adults: modificationData.adults + 1
                    })}
                  >
                    +
                  </IOSButton>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Children</label>
                <div className="flex items-center gap-2">
                  <IOSButton
                    variant="outline"
                    size="sm"
                    onClick={() => setModificationData({
                      ...modificationData, 
                      children: Math.max(0, modificationData.children - 1)
                    })}
                    disabled={modificationData.children <= 0}
                  >
                    -
                  </IOSButton>
                  <span className="w-8 text-center">{modificationData.children}</span>
                  <IOSButton
                    variant="outline"
                    size="sm"
                    onClick={() => setModificationData({
                      ...modificationData, 
                      children: modificationData.children + 1
                    })}
                  >
                    +
                  </IOSButton>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Special Requests</label>
              <textarea
                value={modificationData.specialRequests}
                onChange={(e) => setModificationData({...modificationData, specialRequests: e.target.value})}
                placeholder="Any special requests or changes..."
                className="w-full px-3 py-2 border rounded-lg resize-none"
                rows={3}
              />
            </div>
          </div>
        </IOSCard>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-yellow-800">Modification Policy</p>
              <p className="text-yellow-700 mt-1">
                Changes are subject to availability and may incur additional charges. 
                Guest will receive updated confirmation email.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <IOSButton
            variant="outline"
            onClick={() => setActiveTab('details')}
            className="flex-1"
          >
            Cancel
          </IOSButton>
          <IOSButton
            onClick={modifyBooking}
            disabled={isSubmitting}
            className="flex-1 bg-[#3C3C43] hover:bg-[#000000] text-white"
          >
            {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
          </IOSButton>
        </div>
      </div>
    );
  };

  const renderHistoryTab = () => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold">Booking History</h3>
          <IOSButton
            variant="outline"
            size="sm"
            onClick={fetchBookingHistory}
            disabled={isLoading}
            leftIcon={<RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </IOSButton>
        </div>

        <div className="space-y-3">
          {bookingHistory.length > 0 ? (
            bookingHistory.map((event, index) => (
              <IOSCard key={index} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-[#3C3C43] rounded-full mt-2"></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{event.action}</h4>
                      <span className="text-sm text-gray-500">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {event.description && (
                      <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                    )}
                    {event.user && (
                      <p className="text-xs text-gray-500 mt-1">by {event.user}</p>
                    )}
                  </div>
                </div>
              </IOSCard>
            ))
          ) : (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No history available</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!booking) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Booking Management
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200 mb-6">
            {[
              { id: 'details', label: 'Details', icon: Calendar },
              { id: 'modify', label: 'Modify', icon: Edit },
              { id: 'history', label: 'History', icon: Clock }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#3C3C43] text-[#3C3C43]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'details' && renderDetailsTab()}
            {activeTab === 'modify' && renderModifyTab()}
            {activeTab === 'history' && renderHistoryTab()}
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
