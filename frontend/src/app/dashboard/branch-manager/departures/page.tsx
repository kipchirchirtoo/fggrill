'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { User, RefreshCw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bookingsAPI } from '@/lib/api';

export default function BranchManagerDeparturesPage() {
  const { user } = useAuth();
  const [departures, setDepartures] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchDepartures(); }, [user]);

  const fetchDepartures = async () => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await bookingsAPI.getBookings({ branch_id: user?.branch_id });
      setDepartures((res.bookings || res || []).filter((b: any) => b.check_out_date === today && b.status === 'checked_in'));
    } catch (error) { console.error('Error:', error); } 
    finally { setIsLoading(false); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Today's Departures</h1>
              <p className="text-gray-600">Guests checking out today</p>
            </div>
            <Button onClick={fetchDepartures} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
          <div className="grid gap-4">
            {departures.map((d: any) => (
              <Card key={d.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-amber-100 rounded-lg"><User className="h-5 w-5 text-amber-600" /></div>
                  <div>
                    <p className="font-medium">{d.guest_name}</p>
                    <p className="text-sm text-gray-500">Room {d.room_number}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline"><LogOut className="h-4 w-4 mr-1" /> Check Out</Button>
              </Card>
            ))}
            {departures.length === 0 && <Card className="p-8 text-center text-gray-500">{isLoading ? 'Loading...' : 'No departures today'}</Card>}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
