'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { restaurantAPI } from '@/lib/api';
import { Settings, RefreshCw, Monitor, Power, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Terminal { id: string; name: string; location: string; status: 'online' | 'offline'; last_activity?: string; }

export default function AdminPOSControlPage() {
  const { user } = useAuth();
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTerminals = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await restaurantAPI.getTerminals();
      if (response.success) setTerminals(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchTerminals(); }, [fetchTerminals]);

  const stats = { online: terminals.filter(t => t.status === 'online').length, offline: terminals.filter(t => t.status === 'offline').length };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">POS Control</h1><p className="text-gray-500">Manage POS terminals</p></div>
            <IOSButton variant="secondary" onClick={fetchTerminals}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <IOSCard className="p-4"><Power className="h-6 w-6 text-green-600 mb-2" /><p className="text-sm text-gray-500">Online</p><p className="text-xl font-bold text-green-600">{stats.online}</p></IOSCard>
            <IOSCard className="p-4"><AlertTriangle className="h-6 w-6 text-red-600 mb-2" /><p className="text-sm text-gray-500">Offline</p><p className="text-xl font-bold text-red-600">{stats.offline}</p></IOSCard>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : terminals.length === 0 ? (
            <IOSCard className="p-12 text-center"><Monitor className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No terminals configured</p></IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {terminals.map((terminal) => (
                <IOSCard key={terminal.id} className="p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-ios-lg ${terminal.status === 'online' ? 'bg-green-100' : 'bg-red-100'}`}>
                        <Monitor className={`h-6 w-6 ${terminal.status === 'online' ? 'text-green-600' : 'text-red-600'}`} />
                      </div>
                      <div>
                        <p className="font-bold">{terminal.name}</p>
                        <p className="text-sm text-gray-500">{terminal.location}</p>
                      </div>
                    </div>
                    <IOSBadge variant={terminal.status === 'online' ? 'success' : 'error'}>{terminal.status}</IOSBadge>
                  </div>
                  {terminal.last_activity && <p className="text-xs text-gray-400">Last activity: {new Date(terminal.last_activity).toLocaleString()}</p>}
                  <div className="flex gap-2 mt-4">
                    <IOSButton size="sm" variant="secondary" className="flex-1"><Settings className="h-4 w-4 mr-1" /> Configure</IOSButton>
                    <IOSButton size="sm" variant="secondary" className="flex-1"><Power className="h-4 w-4 mr-1" /> Restart</IOSButton>
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
