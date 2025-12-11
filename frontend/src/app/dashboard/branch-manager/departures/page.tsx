'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { bookingsAPI } from '@/lib/api';
import { UserCheck, RefreshCw, User, Bed, Clock, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Departure { id: string; guest_name: string; room_number: string; check_out: string; status: string; }

export default function BranchDeparturesPage() {
  const { user } = useAuth();
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDepartures = useCallback(async () => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await bookingsAPI.getBookings({ checkOut: today });
      if (response.success) setDepartures(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchDepartures(); }, [fetchDepartures]);

  const handleCheckOut = async (id: string) => {
    try {
      await bookingsAPI.checkOut(id);
      toast.success('Guest checked out');
      fetchDepartures();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  const pending = departures.filter(d => d.status !== 'checked_out').length;

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Today's Departures</h1><p className="text-gray-500">{departures.length} guests leaving</p></div>
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
                <IOSCard key={departure.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center"><User className="h-6 w-6 text-[#007AFF]" /></div>
                      <div>
                        <p className="font-bold">{departure.guest_name}</p>
                        <p className="text-sm text-gray-500 flex items-center gap-2"><Bed className="h-3 w-3" /> Room {departure.room_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {departure.status === 'checked_out' ? (
                        <IOSBadge variant="light" color="success">Checked Out</IOSBadge>
                      ) : (
                        <IOSButton size="sm" onClick={() => handleCheckOut(departure.id)} leftIcon={<LogOut />}> Check Out</IOSButton>
                      )}
                    </div>
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
