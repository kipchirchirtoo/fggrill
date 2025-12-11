'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { bookingsAPI } from '@/lib/api';
import { ArrowUpRight, RefreshCw, User, Bed, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Arrival { id: string; guest_name: string; room_number: string; check_in: string; status: string; nights: number; }

export default function BranchArrivalsPage() {
  const { user } = useAuth();
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchArrivals = useCallback(async () => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await bookingsAPI.getBookings({ checkIn: today });
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

  const pending = arrivals.filter(a => a.status !== 'checked_in').length;

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Today's Arrivals</h1><p className="text-gray-500">{arrivals.length} guests expected</p></div>
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
                <IOSCard key={arrival.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center"><User className="h-6 w-6 text-[#34C759]" /></div>
                      <div>
                        <p className="font-bold">{arrival.guest_name}</p>
                        <p className="text-sm text-gray-500 flex items-center gap-2"><Bed className="h-3 w-3" /> Room {arrival.room_number} <Clock className="h-3 w-3 ml-2" /> {arrival.nights} nights</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {arrival.status === 'checked_in' ? (
                        <IOSBadge variant="light" color="success">Checked In</IOSBadge>
                      ) : (
                        <IOSButton size="sm" onClick={() => handleCheckIn(arrival.id)} leftIcon={<CheckCircle />}> Check In</IOSButton>
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
