'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { bookingsAPI } from '@/lib/api';
import { ArrowUpRight, RefreshCw, User, Bed, Clock, CheckCircle, Building2, Eye, Phone, Mail, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Arrival {
  id: string;
  guest_name: string;
  guest_id?: string;
  room_number: string;
  room_type?: string;
  check_in: string;
  check_out: string;
  status: string;
  nights: number;
  guests?: number;
  phone?: string;
  email?: string;
  special_requests?: string;
  total?: number;
}

export default function BranchArrivalsPage() {
  const { user } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedArrival, setSelectedArrival] = useState<Arrival | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const currentBranchId = activeBranchId || user?.branch_id;

  const fetchArrivals = useCallback(async () => {
    if (!currentBranchId) { setArrivals([]); setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await bookingsAPI.getBookings({
        checkIn: today,
        branch_id: currentBranchId,
        status: 'confirmed' // Only show confirmed bookings
      });
      if (response.success && Array.isArray(response.data)) {
        setArrivals(response.data);
      } else {
        setArrivals([]);
      }
    } catch (error) {
      console.error('Error fetching arrivals:', error);
      toast.error('Failed to load arrivals');
      setArrivals([]);
    }
    finally { setIsLoading(false); }
  }, [currentBranchId]);

  useEffect(() => { fetchArrivals(); }, [fetchArrivals]);

  const handleCheckIn = async (id: string) => {
    try {
      const response = await bookingsAPI.checkIn(id);
      if (response.success) {
        toast.success('Guest checked in successfully');
        fetchArrivals();
      } else {
        toast.error(response.message || 'Failed to check in');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to check in guest');
    }
  };

  const viewDetails = (arrival: Arrival) => {
    setSelectedArrival(arrival);
    setShowDetailsModal(true);
  };

  const pending = arrivals.filter(a => a.status !== 'checked_in').length;

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Today's Arrivals</h1>
              <p className="text-gray-500 flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{activeBranch?.name || 'Select a branch'} • {arrivals.length} guests expected</p>
            </div>
            <IOSButton variant="secondary" onClick={fetchArrivals} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <IOSCard className="p-4"><ArrowUpRight className="h-6 w-6 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Total Arrivals</p><p className="text-xl font-bold">{arrivals.length}</p></IOSCard>
            <IOSCard className="p-4"><Clock className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Pending Check-in</p><p className="text-xl font-bold text-yellow-600">{pending}</p></IOSCard>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : arrivals.length === 0 ? (
            <IOSCard className="p-12 text-center"><ArrowUpRight className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No arrivals today</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {arrivals.map((arrival) => (
                <IOSCard key={arrival.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <User className="h-6 w-6 text-[#34C759]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900">{arrival.guest_name}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Bed className="h-3 w-3" /> Room {arrival.room_number}
                          </span>
                          {arrival.room_type && (
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{arrival.room_type}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {arrival.nights} {arrival.nights === 1 ? 'night' : 'nights'}
                          </span>
                          {arrival.guests && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" /> {arrival.guests} {arrival.guests === 1 ? 'guest' : 'guests'}
                            </span>
                          )}
                        </div>
                        {arrival.phone && (
                          <p className="text-xs text-gray-400 mt-1">📞 {arrival.phone}</p>
                        )}
                        {arrival.special_requests && (
                          <p className="text-xs text-amber-600 mt-1 italic">⚠️ {arrival.special_requests}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {arrival.status === 'checked_in' ? (
                        <IOSBadge variant="light" color="success">Checked In</IOSBadge>
                      ) : (
                        <>
                          <IOSButton size="sm" variant="secondary" onClick={() => viewDetails(arrival)}>
                            <Eye className="h-4 w-4" />
                          </IOSButton>
                          <IOSButton size="sm" onClick={() => handleCheckIn(arrival.id)} leftIcon={<CheckCircle />}>
                            Check In
                          </IOSButton>
                        </>
                      )}
                    </div>
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>

        {/* Details Modal */}
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-5 w-5 text-blue-600" />
                Arrival Details
              </DialogTitle>
            </DialogHeader>

            {selectedArrival && (
              <div className="space-y-6 py-4">
                {/* Guest Summary Card */}
                <div className="bg-stone-50 rounded-xl p-5 border border-stone-100">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-8 w-8 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-stone-900">{selectedArrival.guest_name}</h3>
                      <p className="text-stone-500 font-medium">Room {selectedArrival.room_number}</p>
                    </div>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-stone-400 uppercase tracking-wider">Contact Information</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-stone-600">
                        <Phone className="h-4 w-4" />
                        <span>{selectedArrival.phone || '+254 700 000 000'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-stone-600">
                        <Mail className="h-4 w-4" />
                        <span>{selectedArrival.email || 'guest@example.com'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-stone-400 uppercase tracking-wider">Stay Information</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-stone-600">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(selectedArrival.check_in).toLocaleDateString()} - {new Date(selectedArrival.check_out).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-3 text-stone-600">
                        <Clock className="h-4 w-4" />
                        <span>Nights: {selectedArrival.nights} • Guests: {selectedArrival.guests || 1}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Details */}
                <div className="pt-4 border-t border-stone-100">
                  <h4 className="text-sm font-semibold text-stone-400 uppercase tracking-wider mb-3">Special Requests & Notes</h4>
                  <div className="p-4 bg-stone-50 rounded-lg text-stone-600 text-sm italic">
                    {selectedArrival.special_requests || "No special requests noted."}
                  </div>
                </div>

                <div className="flex gap-3 pt-6">
                  <IOSButton className="flex-1" onClick={() => setShowDetailsModal(false)}>Close Details</IOSButton>
                  {selectedArrival.status !== 'checked_in' && (
                    <IOSButton className="flex-1" onClick={() => {
                      handleCheckIn(selectedArrival.id);
                      setShowDetailsModal(false);
                    }} leftIcon={<CheckCircle />}>
                      Check In
                    </IOSButton>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
