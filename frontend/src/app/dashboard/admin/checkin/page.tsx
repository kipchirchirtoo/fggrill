'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { bookingsAPI } from '@/lib/api';
import { UserCheck, RefreshCw, User, Bed, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Arrival { id: string; guest_name: string; room_number: string; check_in: string; status: string; }

export default function AdminCheckinPage() {
  const { user } = useAuth();
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchArrivals = useCallback(async () => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await bookingsAPI.getBookings({ checkIn: today, status: 'confirmed' });
      if (response.success) setArrivals(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchArrivals(); }, [fetchArrivals]);

  const handleCheckIn = async (id: string) => {
    try {
      await bookingsAPI.checkIn(id);
      toast.success('Guest checked in');
      fetchArrivals();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Check-In</h1><p className="text-gray-500">Today's arrivals</p></div>
            <IOSButton variant="secondary" onClick={fetchArrivals}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          <IOSCard className="p-4"><UserCheck className="h-6 w-6 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Pending Check-ins</p><p className="text-xl font-bold">{arrivals.length}</p></IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : arrivals.length === 0 ? (
            <IOSCard className="p-12 text-center"><UserCheck className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No pending arrivals</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {arrivals.map((arrival) => (
                <IOSCard key={arrival.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-ios-lg bg-green-100 flex items-center justify-center"><User className="h-6 w-6 text-[#34C759]" /></div>
                      <div>
                        <p className="font-bold">{arrival.guest_name}</p>
                        <p className="text-sm text-gray-500 flex items-center gap-1"><Bed className="h-3 w-3" /> Room {arrival.room_number}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1"><Clock className="h-3 w-3" /> Expected: {new Date(arrival.check_in).toLocaleTimeString()}</p>
                      </div>
                    </div>
                    <IOSButton onClick={() => handleCheckIn(arrival.id)}><CheckCircle className="h-4 w-4 mr-2" /> Check In</IOSButton>
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
