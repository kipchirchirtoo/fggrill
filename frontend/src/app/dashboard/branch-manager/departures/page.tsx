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
import { UserCheck, RefreshCw, User, Bed, Clock, LogOut, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Departure { 
  id: string; 
  guest_name: string; 
  guest_id?: string;
  room_number: string; 
  room_type?: string;
  check_in: string;
  check_out: string; 
  status: string;
  nights?: number;
  total?: number;
  balance?: number;
  phone?: string;
  email?: string;
}

export default function BranchDeparturesPage() {
  const { user } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDeparture, setSelectedDeparture] = useState<Departure | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const currentBranchId = activeBranchId || user?.branch_id;

  const fetchDepartures = useCallback(async () => {
    if (!currentBranchId) { setDepartures([]); setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await bookingsAPI.getBookings({ 
        checkOut: today, 
        branch_id: currentBranchId,
        status: 'checked_in' // Only show checked-in guests
      });
      if (response.success && Array.isArray(response.data)) {
        setDepartures(response.data);
      } else {
        setDepartures([]);
      }
    } catch (error) { 
      console.error('Error fetching departures:', error);
      toast.error('Failed to load departures');
      setDepartures([]);
    }
    finally { setIsLoading(false); }
  }, [currentBranchId]);

  useEffect(() => { fetchDepartures(); }, [fetchDepartures]);

  const handleCheckOut = async (id: string) => {
    try {
      const response = await bookingsAPI.checkOut(id);
      if (response.success) {
        toast.success('Guest checked out successfully');
        fetchDepartures();
      } else {
        toast.error(response.message || 'Failed to check out');
      }
    } catch (error: any) { 
      toast.error(error.message || 'Failed to check out guest'); 
    }
  };

  const viewDetails = (departure: Departure) => {
    setSelectedDeparture(departure);
    setShowDetailsModal(true);
  };

  const pending = departures.filter(d => d.status !== 'checked_out').length;

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Today's Departures</h1>
              <p className="text-gray-500 flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{activeBranch?.name || 'Select a branch'} • {departures.length} guests leaving</p>
            </div>
            <IOSButton variant="secondary" onClick={fetchDepartures} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <IOSCard className="p-4"><UserCheck className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Total Departures</p><p className="text-xl font-bold">{departures.length}</p></IOSCard>
            <IOSCard className="p-4"><Clock className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Pending Check-out</p><p className="text-xl font-bold text-yellow-600">{pending}</p></IOSCard>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : departures.length === 0 ? (
            <IOSCard className="p-12 text-center"><UserCheck className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No departures today</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {departures.map((departure) => (
                <IOSCard key={departure.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <User className="h-6 w-6 text-[#007AFF]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900">{departure.guest_name}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Bed className="h-3 w-3" /> Room {departure.room_number}
                          </span>
                          {departure.room_type && (
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{departure.room_type}</span>
                          )}
                          {departure.nights && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {departure.nights} {departure.nights === 1 ? 'night' : 'nights'}
                            </span>
                          )}
                        </div>
                        {departure.total && (
                          <p className="text-sm font-semibold text-green-600 mt-1">
                            Total: KES {departure.total.toLocaleString()}
                            {departure.balance && departure.balance > 0 && (
                              <span className="text-red-600 ml-2">(Balance: KES {departure.balance.toLocaleString()})</span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {departure.status === 'checked_out' ? (
                        <IOSBadge variant="light" color="success">Checked Out</IOSBadge>
                      ) : (
                        <>
                          <IOSButton size="sm" variant="secondary" onClick={() => viewDetails(departure)}>
                            <UserCheck className="h-4 w-4" />
                          </IOSButton>
                          <IOSButton size="sm" onClick={() => handleCheckOut(departure.id)} leftIcon={<LogOut />}>
                            Check Out
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
        {showDetailsModal && selectedDeparture && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetailsModal(false)}>
            <div className="bg-white rounded-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Departure Details</h2>
                <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-500">Guest Name</label>
                  <p className="font-semibold">{selectedDeparture.guest_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">Room</label>
                    <p className="font-semibold">{selectedDeparture.room_number}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Room Type</label>
                    <p className="font-semibold">{selectedDeparture.room_type || 'N/A'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-500">Check-in</label>
                    <p className="font-semibold">{new Date(selectedDeparture.check_in).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-500">Check-out</label>
                    <p className="font-semibold">{new Date(selectedDeparture.check_out).toLocaleDateString()}</p>
                  </div>
                </div>
                {selectedDeparture.nights && (
                  <div>
                    <label className="text-sm text-gray-500">Total Nights</label>
                    <p className="font-semibold">{selectedDeparture.nights}</p>
                  </div>
                )}
                {selectedDeparture.phone && (
                  <div>
                    <label className="text-sm text-gray-500">Phone</label>
                    <p className="font-semibold">{selectedDeparture.phone}</p>
                  </div>
                )}
                {selectedDeparture.email && (
                  <div>
                    <label className="text-sm text-gray-500">Email</label>
                    <p className="font-semibold">{selectedDeparture.email}</p>
                  </div>
                )}
                {selectedDeparture.total && (
                  <div className="pt-4 border-t">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Total Amount</span>
                        <span className="font-semibold">KES {selectedDeparture.total.toLocaleString()}</span>
                      </div>
                      {selectedDeparture.balance !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Balance Due</span>
                          <span className={`font-bold ${selectedDeparture.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            KES {selectedDeparture.balance.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-4">
                  <IOSButton variant="secondary" className="flex-1" onClick={() => setShowDetailsModal(false)}>
                    Close
                  </IOSButton>
                  {selectedDeparture.status !== 'checked_out' && (
                    <IOSButton className="flex-1" onClick={() => {
                      handleCheckOut(selectedDeparture.id);
                      setShowDetailsModal(false);
                    }} leftIcon={<LogOut />}>
                      Check Out
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
