'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { roomsAPI } from '@/lib/api';
import { Bed, RefreshCw, Plus, Search, CheckCircle, XCircle, Clock, Wrench } from 'lucide-react';

interface Room { id: string; room_number: string; room_type: string; floor: number; status: string; price: number; branch_name?: string; }

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  available: { label: 'Available', color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle },
  occupied: { label: 'Occupied', color: 'text-blue-700', bg: 'bg-blue-100', icon: Bed },
  cleaning: { label: 'Cleaning', color: 'text-yellow-700', bg: 'bg-yellow-100', icon: Clock },
  maintenance: { label: 'Maintenance', color: 'text-red-700', bg: 'bg-red-100', icon: Wrench },
};

export default function AdminRoomsPage() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchRooms = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await roomsAPI.getRooms();
      if (response.success) setRooms(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const filteredRooms = rooms.filter((r) => {
    const matchesSearch = r.room_number?.includes(searchQuery) || r.room_type?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = { total: rooms.length, available: rooms.filter(r => r.status === 'available').length, occupied: rooms.filter(r => r.status === 'occupied').length };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Rooms</h1><p className="text-gray-500">Manage all rooms</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchRooms}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
              <IOSButton><Plus className="h-4 w-4 mr-2" /> Add Room</IOSButton>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4"><Bed className="h-6 w-6 text-blue-600 mb-2" /><p className="text-sm text-gray-500">Total</p><p className="text-xl font-bold">{stats.total}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-green-500"><CheckCircle className="h-6 w-6 text-green-600 mb-2" /><p className="text-sm text-gray-500">Available</p><p className="text-xl font-bold text-green-600">{stats.available}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-blue-500"><Bed className="h-6 w-6 text-blue-600 mb-2" /><p className="text-sm text-gray-500">Occupied</p><p className="text-xl font-bold text-blue-600">{stats.occupied}</p></IOSCard>
          </div>

          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search rooms..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <div className="flex gap-2">
                {['all', 'available', 'occupied', 'cleaning', 'maintenance'].map((status) => (
                  <IOSButton key={status} variant={statusFilter === status ? 'primary' : 'secondary'} size="sm" onClick={() => setStatusFilter(status)}>
                    {status === 'all' ? 'All' : statusConfig[status]?.label || status}
                  </IOSButton>
                ))}
              </div>
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {filteredRooms.map((room) => {
                const status = statusConfig[room.status] || statusConfig.available;
                const StatusIcon = status.icon;
                return (
                  <IOSCard key={room.id} className={`p-4 text-center ${status.bg}`}>
                    <p className="text-2xl font-bold">{room.room_number}</p>
                    <p className="text-sm text-gray-500">{room.room_type}</p>
                    <div className="flex items-center justify-center gap-1 mt-2">
                      <StatusIcon className={`h-4 w-4 ${status.color}`} />
                      <span className={`text-sm ${status.color}`}>{status.label}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">KES {room.price?.toLocaleString()}/night</p>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
