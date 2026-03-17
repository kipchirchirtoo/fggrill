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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Phone, Mail, Calendar } from 'lucide-react';

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
        <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
          <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-sf-pro-display">
                <FileText className="h-5 w-5 text-blue-600" />
                Departure Details
              </DialogTitle>
            </DialogHeader>

            {selectedDeparture && (
              <div className="space-y-6 py-4">
                {/* Guest Summary Card */}
                <div className="bg-stone-50 rounded-xl p-5 border border-stone-100">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-8 w-8 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-stone-900">{selectedDeparture.guest_name}</h3>
                      <p className="text-stone-500 font-medium">Room {selectedDeparture.room_number} • {selectedDeparture.room_type || 'Standard'}</p>
                    </div>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-stone-400 uppercase tracking-wider">Contact Details</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-stone-600">
                        <Phone className="h-4 w-4" />
                        <span>{selectedDeparture.phone || 'Not provided'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-stone-600">
                        <Mail className="h-4 w-4" />
                        <span>{selectedDeparture.email || 'Not provided'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-stone-400 uppercase tracking-wider">Stay Period</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-stone-600">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(selectedDeparture.check_in).toLocaleDateString()} - {new Date(selectedDeparture.check_out).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-3 text-stone-600">
                        <Clock className="h-4 w-4" />
                        <span>Nights stayed: {selectedDeparture.nights || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financial Overview */}
                <div className="pt-6 border-t border-stone-100">
                  <h4 className="text-sm font-semibold text-stone-400 uppercase tracking-wider mb-4">Financial Summary</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                      <p className="text-xs text-stone-500 mb-1">Total Bill</p>
                      <p className="text-xl font-bold text-stone-900">KES {(selectedDeparture.total || 0).toLocaleString()}</p>
                    </div>
                    <div className={`p-4 rounded-xl border ${selectedDeparture.balance && selectedDeparture.balance > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                      <p className="text-xs text-stone-500 mb-1">Outstanding Balance</p>
                      <p className={`text-xl font-bold ${selectedDeparture.balance && selectedDeparture.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        KES {(selectedDeparture.balance || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-6">
                  <IOSButton className="flex-1" onClick={() => setShowDetailsModal(false)}>Close Overview</IOSButton>
                  {selectedDeparture.status !== 'checked_out' && (
                    <IOSButton
                      className="flex-1"
                      onClick={() => {
                        handleCheckOut(selectedDeparture.id);
                        setShowDetailsModal(false);
                      }}
                      leftIcon={<LogOut />}
                    >
                      Check Out Guest
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
