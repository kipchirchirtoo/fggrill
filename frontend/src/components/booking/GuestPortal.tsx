'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Calendar, MapPin, Phone, Mail, Edit, X, 
  CheckCircle, Clock, AlertCircle, CreditCard, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Booking {
  id: string;
  confirmationNumber: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  roomNumber?: string;
  roomType: string;
  adults: number;
  children: number;
  totalAmount: number;
  status: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  specialRequests?: string;
  paymentStatus: 'paid' | 'pending' | 'partial';
}

interface GuestPortalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GuestPortal({ isOpen, onClose }: GuestPortalProps) {
  const [step, setStep] = useState<'search' | 'booking' | 'modify'>('search');
  const [isLoading, setIsLoading] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  
  // Search form
  const [confirmationNumber, setConfirmationNumber] = useState('');
  const [email, setEmail] = useState('');
  
  // Modification form
  const [modificationData, setModificationData] = useState({
    checkIn: '',
    checkOut: '',
    specialRequests: ''
  });

  const searchBooking = async () => {
    if (!confirmationNumber || !email) {
      toast.error('Please enter both confirmation number and email');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/bookings/confirmation/${confirmationNumber}?email=${encodeURIComponent(email)}`);
      
      if (!response.ok) {
        throw new Error('Booking not found or invalid credentials');
      }

      const result = await response.json();
      setBooking(result.data);
      setModificationData({
        checkIn: result.data.checkIn?.split('T')[0] || '',
        checkOut: result.data.checkOut?.split('T')[0] || '',
        specialRequests: result.data.specialRequests || ''
      });
      setStep('booking');
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to find booking');
    } finally {
      setIsLoading(false);
    }
  };

  const modifyBooking = async () => {
    if (!booking) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/modify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          checkInDate: modificationData.checkIn,
          checkOutDate: modificationData.checkOut,
          specialRequests: modificationData.specialRequests
        })
      });

      if (!response.ok) {
        throw new Error('Failed to modify booking');
      }

      const result = await response.json();
      setBooking(result.data);
      toast.success('Booking modified successfully');
      setStep('booking');
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to modify booking');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelBooking = async () => {
    if (!booking) return;
    
    if (!confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: 'Guest cancellation via portal'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to cancel booking');
      }

      toast.success('Booking cancelled successfully');
      setBooking({ ...booking, status: 'cancelled' });
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel booking');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-blue-100 text-blue-700';
      case 'checked_in': return 'bg-green-100 text-green-700';
      case 'checked_out': return 'bg-gray-100 text-gray-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <Clock className="h-4 w-4" />;
      case 'checked_in': return <CheckCircle className="h-4 w-4" />;
      case 'checked_out': return <CheckCircle className="h-4 w-4" />;
      case 'cancelled': return <X className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const renderSearchStep = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="text-center">
        <Search className="h-12 w-12 text-[#3C3C43] mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Find Your Booking</h2>
        <p className="text-gray-600">Enter your confirmation number and email to view and manage your reservation</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Confirmation Number</label>
          <Input
            value={confirmationNumber}
            onChange={(e) => setConfirmationNumber(e.target.value.toUpperCase())}
            placeholder="HTL241215-0001"
            className="text-center text-lg font-mono"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Email Address</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your.email@example.com"
          />
        </div>
      </div>

      <IOSButton
        onClick={searchBooking}
        disabled={isLoading || !confirmationNumber || !email}
        className="w-full bg-[#3C3C43] hover:bg-[#000000] text-white"
      >
        {isLoading ? 'Searching...' : 'Find My Booking'}
      </IOSButton>

      <div className="text-center text-sm text-gray-500">
        <p>Need help? Contact us at <a href="tel:+254XXXXXXXXX" className="text-[#3C3C43] underline">+254 XXX XXX XXX</a></p>
      </div>
    </motion.div>
  );

  const renderBookingDetails = () => {
    if (!booking) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Booking Details</h2>
            <p className="text-gray-600">Confirmation: {booking.confirmationNumber}</p>
          </div>
          <IOSBadge className={getStatusColor(booking.status)}>
            <div className="flex items-center gap-1">
              {getStatusIcon(booking.status)}
              {booking.status.replace('_', ' ').toUpperCase()}
            </div>
          </IOSBadge>
        </div>

        <IOSCard className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Stay Details
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Check-in:</span>
                  <span className="font-medium">{new Date(booking.checkIn).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Check-out:</span>
                  <span className="font-medium">{new Date(booking.checkOut).toLocaleDateString()}</span>
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
            </div>

            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Information
              </h3>
              <div className="space-y-3">
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
            </div>
          </div>

          {booking.specialRequests && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold mb-2">Special Requests</h3>
              <p className="text-gray-600 bg-gray-50 p-3 rounded">{booking.specialRequests}</p>
            </div>
          )}
        </IOSCard>

        <IOSCard className="p-4">
          <h3 className="font-semibold mb-4">Hotel Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span>123 Hotel Street, Nairobi, Kenya</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-500" />
              <span>+254 XXX XXX XXX</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-500" />
              <span>info@fggrillhotel.com</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span>Check-in: 3:00 PM | Check-out: 11:00 AM</span>
            </div>
          </div>
        </IOSCard>

        {booking.status === 'confirmed' && (
          <div className="flex gap-3">
            <IOSButton
              variant="outline"
              onClick={() => setStep('modify')}
              className="flex-1"
              leftIcon={<Edit className="h-4 w-4" />}
            >
              Modify Booking
            </IOSButton>
            <IOSButton
              variant="outline"
              onClick={cancelBooking}
              disabled={isLoading}
              className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
              leftIcon={<X className="h-4 w-4" />}
            >
              Cancel Booking
            </IOSButton>
          </div>
        )}

        <div className="flex gap-3">
          <IOSButton
            variant="outline"
            onClick={() => setStep('search')}
            className="flex-1"
          >
            Search Another Booking
          </IOSButton>
          <IOSButton
            variant="outline"
            className="flex-1"
            leftIcon={<Download className="h-4 w-4" />}
          >
            Download Confirmation
          </IOSButton>
        </div>
      </motion.div>
    );
  };

  const renderModifyStep = () => {
    if (!booking) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div>
          <h2 className="text-2xl font-bold mb-2">Modify Booking</h2>
          <p className="text-gray-600">Confirmation: {booking.confirmationNumber}</p>
        </div>

        <IOSCard className="p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">New Check-in Date</label>
                <Input
                  type="date"
                  value={modificationData.checkIn}
                  onChange={(e) => setModificationData({...modificationData, checkIn: e.target.value})}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">New Check-out Date</label>
                <Input
                  type="date"
                  value={modificationData.checkOut}
                  onChange={(e) => setModificationData({...modificationData, checkOut: e.target.value})}
                  min={modificationData.checkIn || new Date().toISOString().split('T')[0]}
                />
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
                Changes to your booking are subject to availability and may incur additional charges. 
                You'll receive an updated confirmation email if the modification is successful.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <IOSButton
            variant="outline"
            onClick={() => setStep('booking')}
            className="flex-1"
          >
            Cancel
          </IOSButton>
          <IOSButton
            onClick={modifyBooking}
            disabled={isLoading}
            className="flex-1 bg-[#3C3C43] hover:bg-[#000000] text-white"
          >
            {isLoading ? 'Modifying...' : 'Confirm Changes'}
          </IOSButton>
        </div>
      </motion.div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Guest Portal
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          {step === 'search' && renderSearchStep()}
          {step === 'booking' && renderBookingDetails()}
          {step === 'modify' && renderModifyStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
