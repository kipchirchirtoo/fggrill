'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, RefreshCw, User, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bookingsAPI } from '@/lib/api';

export default function BranchManagerArrivalsPage() {
  const { user } = useAuth();
  const [arrivals, setArrivals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchArrivals(); }, [user]);

  const fetchArrivals = async () => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await bookingsAPI.getBookings({ branch_id: user?.branch_id, from_date: today, to_date: today });
      setArrivals((res.bookings || res || []).filter((b: any) => b.check_in_date === today));
    } catch (error) { console.error('Error:', error); } 
    finally { setIsLoading(false); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Today's Arrivals</h1>
              <p className="text-gray-600">Guests expected to check in today</p>
            </div>
            <Button onClick={fetchArrivals} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
          <div className="grid gap-4">
            {arrivals.map((a: any) => (
              <Card key={a.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-green-100 rounded-lg"><User className="h-5 w-5 text-green-600" /></div>
                  <div>
                    <p className="font-medium">{a.guest_name}</p>
                    <p className="text-sm text-gray-500">Room {a.room_number} • {a.nights} nights</p>
                  </div>
                </div>
                <Button size="sm"><ArrowRight className="h-4 w-4 mr-1" /> Check In</Button>
              </Card>
            ))}
            {arrivals.length === 0 && <Card className="p-8 text-center text-gray-500">{isLoading ? 'Loading...' : 'No arrivals today'}</Card>}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
