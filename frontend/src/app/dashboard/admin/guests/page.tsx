'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { Input } from '@/components/ui/input';
import { guestAPI } from '@/lib/api';
import { Users, RefreshCw, Search, User, Mail, Phone } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Guest { id: string; first_name: string; last_name: string; email?: string; phone?: string; visits: number; }

export default function AdminGuestsPage() {
  const { user } = useAuth();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchGuests = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await guestAPI.getGuests(searchQuery || undefined);
      if (response.success) setGuests(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [searchQuery]);

  useEffect(() => { fetchGuests(); }, [fetchGuests]);

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Guests</h1><p className="text-gray-500">Guest profiles</p></div>
            <IOSButton variant="secondary" onClick={fetchGuests}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          <IOSCard className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search guests..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : guests.length === 0 ? (
            <IOSCard className="p-12 text-center"><Users className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No guests found</p></IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {guests.map((guest) => (
                <IOSCard key={guest.id} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                      {guest.first_name?.[0]}{guest.last_name?.[0]}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold">{guest.first_name} {guest.last_name}</p>
                      {guest.email && <p className="text-sm text-gray-500 flex items-center gap-1"><Mail className="h-3 w-3" /> {guest.email}</p>}
                      {guest.phone && <p className="text-sm text-gray-500 flex items-center gap-1"><Phone className="h-3 w-3" /> {guest.phone}</p>}
                      <p className="text-xs text-gray-400 mt-2">{guest.visits || 0} visits</p>
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
