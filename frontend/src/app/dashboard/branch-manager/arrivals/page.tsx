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
import { ArrowUpRight, RefreshCw, User, Bed, Clock, CheckCircle, Building2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

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
        {showDetailsModal && selectedArrival && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetailsModal(false)}>
            <div className="bg-white rounded-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Arrival Details</h2>
                <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-500">Guest Name</label>
                  <p className="font-semibold">{selectedArrival.guest_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">Room</label>
                    <p className="font-semibold">{selectedArrival.room_number}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Room Type</label>
                    <p className="font-semibold">{selectedArrival.room_type || 'N/A'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">Check-in</label>
                    <p className="font-semibold">{new Date(selectedArrival.check_in).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Check-out</label>
                    <p className="font-semibold">{new Date(selectedArrival.check_out).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">Nights</label>
                    <p className="font-semibold">{selectedArrival.nights}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Guests</label>
                    <p className="font-semibold">{selectedArrival.guests || 1}</p>
                  </div>
                </div>
                {selectedArrival.phone && (
                  <div>
                    <label className="text-sm text-gray-500">Phone</label>
                    <p className="font-semibold">{selectedArrival.phone}</p>
                  </div>
                )}
                {selectedArrival.email && (
                  <div>
                    <label className="text-sm text-gray-500">Email</label>
                    <p className="font-semibold">{selectedArrival.email}</p>
                  </div>
                )}
                {selectedArrival.special_requests && (
                  <div>
                    <label className="text-sm text-gray-500">Special Requests</label>
                    <p className="text-amber-600">{selectedArrival.special_requests}</p>
                  </div>
                )}
                {selectedArrival.total && (
                  <div className="pt-4 border-t">
                    <label className="text-sm text-gray-500">Total Amount</label>
                    <p className="text-2xl font-bold text-green-600">KES {selectedArrival.total.toLocaleString()}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-4">
                  <IOSButton variant="secondary" className="flex-1" onClick={() => setShowDetailsModal(false)}>
                    Close
                  </IOSButton>
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
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
