'use client';

import { useState, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Input } from '@/components/ui/input';
import { bookingsAPI, guestAPI, roomsAPI } from '@/lib/api';
import { UserPlus, ArrowRight, Search, User, Calendar, Users, Bed } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';

export default function BranchCheckinPage() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    room_id: '',
    check_in: new Date().toISOString().split('T')[0],
    check_out: '',
    guests: 1,
    special_requests: ''
  });

  const currentBranchId = activeBranchId || user?.branch_id;

  const fetchAvailableRooms = useCallback(async () => {
    if (!currentBranchId) return;
    try {
      const response = await roomsAPI.getRooms({ status: 'available', branch_id: currentBranchId });
      if (response.success && Array.isArray(response.data)) {
        setAvailableRooms(response.data);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  }, [currentBranchId]);

  const handleWalkInCheckIn = async () => {
    if (!formData.first_name || !formData.last_name || !formData.room_id || !formData.check_out) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create guest first
      const guestResponse = await guestAPI.createGuest({
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        phone: formData.phone
      });

      if (!guestResponse.success) {
        toast.error('Failed to create guest profile');
        return;
      }

      // Create booking
      const bookingResponse = await bookingsAPI.createBooking({
        guest_id: guestResponse.data.id,
        room_id: formData.room_id,
        check_in: formData.check_in,
        check_out: formData.check_out,
        guests: formData.guests,
        special_requests: formData.special_requests,
        branch_id: currentBranchId,
        status: 'confirmed'
      });

      if (!bookingResponse.success) {
        toast.error('Failed to create booking');
        return;
      }

      // Check in immediately
      const checkinResponse = await bookingsAPI.checkIn(bookingResponse.data.id);

      if (checkinResponse.success) {
        toast.success('Walk-in guest checked in successfully!');
        setShowWalkInModal(false);
        setFormData({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          room_id: '',
          check_in: new Date().toISOString().split('T')[0],
          check_out: '',
          guests: 1,
          special_requests: ''
        });
      } else {
        toast.error('Booking created but check-in failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to process walk-in check-in');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openWalkInModal = () => {
    fetchAvailableRooms();
    setShowWalkInModal(true);
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Check-In</h1>
            <p className="text-gray-500">Guest check-in process</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Reservation Check-In */}
            <div className="bg-white rounded-lg p-6 border border-stone-200/80 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                  <Search className="h-6 w-6 text-stone-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-[15px] font-semibold text-stone-800 mb-1">Check-In with Reservation</h2>
                  <p className="text-sm text-stone-500">Check in guests who have existing reservations</p>
                </div>
              </div>
              <Link href="/dashboard/branch-manager/arrivals">
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-800 text-white text-[13px] font-medium rounded-lg hover:bg-stone-700 transition-colors">
                  <span>Go to Arrivals</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
            </div>

            {/* Walk-In Check-In */}
            <div className="bg-white rounded-lg p-6 border border-stone-200/80 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                  <UserPlus className="h-6 w-6 text-stone-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-[15px] font-semibold text-stone-800 mb-1">Walk-In Check-In</h2>
                  <p className="text-sm text-stone-500">Check in guests without prior reservations</p>
                </div>
              </div>
              <button
                onClick={openWalkInModal}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-800 text-white text-[13px] font-medium rounded-lg hover:bg-stone-700 transition-colors"
              >
                <span>Start Walk-In</span>
                <UserPlus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Walk-In Modal */}
        <Dialog open={showWalkInModal} onOpenChange={setShowWalkInModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-sf-pro-display">
                <UserPlus className="h-5 w-5 text-stone-600" />
                Walk-In Guest Registration
              </DialogTitle>
            </DialogHeader>

            <DialogBody>
              <div className="space-y-8 py-4 px-1">
                {/* Profile Information Section */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">Guest Profile</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">First Name *</label>
                      <Input
                        value={formData.first_name}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        placeholder="e.g. John"
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Last Name *</label>
                      <Input
                        value={formData.last_name}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        placeholder="e.g. Doe"
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Email Address</label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="john@example.com"
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Phone Number *</label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+254..."
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                {/* Stay Details Section */}
                <div className="space-y-4 pt-4 border-t border-stone-100">
                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">Stay Details</h4>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Select Available Room *</label>
                    <select
                      className="w-full h-11 border border-stone-200 rounded-xl px-4 text-sm bg-white focus:ring-2 focus:ring-stone-900 transition-all outline-none"
                      value={formData.room_id}
                      onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                    >
                      <option value="">Choose a room from the inventory...</option>
                      {availableRooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.roomNumber || room.room_number} — {room.typeName || room.room_type || 'Standard'} (KES {(room.currentPrice || room.basePrice || room.price_override || 0).toLocaleString()}/night)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Check-In *</label>
                      <Input
                        type="date"
                        value={formData.check_in}
                        onChange={(e) => setFormData({ ...formData, check_in: e.target.value })}
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Check-Out *</label>
                      <Input
                        type="date"
                        value={formData.check_out}
                        onChange={(e) => setFormData({ ...formData, check_out: e.target.value })}
                        min={formData.check_in}
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Number of Guests *</label>
                      <Input
                        type="number"
                        min="1"
                        value={formData.guests}
                        onChange={(e) => setFormData({ ...formData, guests: parseInt(e.target.value) || 1 })}
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Information Section */}
                <div className="space-y-4 pt-4 border-t border-stone-100">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Special Requests & Notes</label>
                    <textarea
                      className="w-full border border-stone-200 rounded-2xl px-4 py-3 min-h-[100px] text-sm bg-white focus:ring-2 focus:ring-stone-900 transition-all outline-none"
                      value={formData.special_requests}
                      onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
                      placeholder="Any specific guest requirements..."
                    />
                  </div>
                </div>
              </div>
            </DialogBody>
            <DialogFooter className="p-4 bg-stone-50 border-t border-stone-100 flex gap-4">
              <IOSButton
                variant="secondary"
                onClick={() => setShowWalkInModal(false)}
                disabled={isSubmitting}
                className="flex-1 h-12 text-base font-semibold"
              >
                Cancel
              </IOSButton>
              <IOSButton
                onClick={handleWalkInCheckIn}
                disabled={isSubmitting}
                className="flex-1 h-12 text-base font-semibold"
              >
                {isSubmitting ? 'Checking In...' : 'Complete Check-In'}
              </IOSButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout >
    </ProtectedRoute >
  );
}
