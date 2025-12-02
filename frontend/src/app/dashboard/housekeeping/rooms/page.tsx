'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { housekeepingAPI } from '@/lib/api';
import { 
  Bed, RefreshCw, Search, Filter, Sparkles, CheckCircle, Clock,
  AlertTriangle, Wrench, User, Eye, Play, Check, Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Room {
  id: string;
  room_number: string;
  floor: number;
  room_type: string;
  status: string;
  priority?: string;
  assigned_to?: string;
  assigned_name?: string;
  last_cleaned?: string;
  current_guest?: string;
  checkout_time?: string;
  notes?: string;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  clean: { label: 'Clean', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle },
  dirty: { label: 'Dirty', color: 'text-red-700', bgColor: 'bg-red-100', icon: AlertTriangle },
  cleaning: { label: 'Cleaning', color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: Sparkles },
  inspecting: { label: 'Inspecting', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: Eye },
  maintenance: { label: 'Maintenance', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: Wrench },
  occupied: { label: 'Occupied', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: User },
};

export default function HousekeepingRoomsPage() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [floorFilter, setFloorFilter] = useState<number | 'all'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modal
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const fetchRooms = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (floorFilter !== 'all') params.floor = floorFilter;

      const response = await housekeepingAPI.getRooms(params);
      if (response.success) {
        setRooms(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, floorFilter]);

  const fetchStaff = async () => {
    try {
      const response = await housekeepingAPI.getStaff({ available: true });
      if (response.success) {
        setStaff(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  useEffect(() => {
    fetchRooms();
    fetchStaff();
  }, [fetchRooms]);

  const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);

  const filteredRooms = rooms.filter((room) => {
    const matchesSearch = room.room_number?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleUpdateStatus = async (roomId: string, status: string) => {
    try {
      await housekeepingAPI.updateRoomStatus(roomId, { status });
      toast.success(`Room status updated to ${status}`);
      fetchRooms();
      setDetailsModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update room status');
    }
  };

  const handleAssignAttendant = async (roomId: string, attendantId: string) => {
    try {
      await housekeepingAPI.assignRoomAttendant(roomId, attendantId);
      toast.success('Attendant assigned');
      fetchRooms();
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign attendant');
    }
  };

  // Stats
  const stats = {
    total: rooms.length,
    clean: rooms.filter(r => r.status === 'clean').length,
    dirty: rooms.filter(r => r.status === 'dirty').length,
    cleaning: rooms.filter(r => r.status === 'cleaning').length,
    occupied: rooms.filter(r => r.status === 'occupied').length,
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.HOUSEKEEPING, UserRole.HOUSEKEEPING_SUPERVISOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Room Status</h1>
              <p className="text-gray-500">Monitor and update room cleaning status</p>
            </div>
            <div className="flex gap-2">
              <IOSButton 
                variant={viewMode === 'grid' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                Grid
              </IOSButton>
              <IOSButton 
                variant={viewMode === 'list' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setViewMode('list')}
              >
                List
              </IOSButton>
              <IOSButton variant="outline" onClick={fetchRooms}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </IOSButton>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </IOSCard>
            <IOSCard className="p-4 border-l-4 border-green-500">
              <p className="text-sm text-gray-500">Clean</p>
              <p className="text-2xl font-bold text-[#34C759]">{stats.clean}</p>
            </IOSCard>
            <IOSCard className="p-4 border-l-4 border-red-500">
              <p className="text-sm text-gray-500">Dirty</p>
              <p className="text-2xl font-bold text-[#FF3B30]">{stats.dirty}</p>
            </IOSCard>
            <IOSCard className="p-4 border-l-4 border-yellow-500">
              <p className="text-sm text-gray-500">Cleaning</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.cleaning}</p>
            </IOSCard>
            <IOSCard className="p-4 border-l-4 border-purple-500">
              <p className="text-sm text-gray-500">Occupied</p>
              <p className="text-2xl font-bold text-purple-600">{stats.occupied}</p>
            </IOSCard>
          </div>

          {/* Filters */}
          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search room number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border rounded-ios-lg text-sm"
                >
                  <option value="all">All Status</option>
                  {Object.entries(statusConfig).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
                <select
                  value={floorFilter}
                  onChange={(e) => setFloorFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  className="px-3 py-2 border rounded-ios-lg text-sm"
                >
                  <option value="all">All Floors</option>
                  {floors.map((floor) => (
                    <option key={floor} value={floor}>Floor {floor}</option>
                  ))}
                </select>
              </div>
            </div>
          </IOSCard>

          {/* Rooms Display */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredRooms.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <Bed className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No rooms found</p>
            </IOSCard>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
              {filteredRooms.map((room) => {
                const statusInfo = statusConfig[room.status] || statusConfig.clean;
                const StatusIcon = statusInfo.icon;

                return (
                  <div
                    key={room.id}
                    onClick={() => {
                      setSelectedRoom(room);
                      setDetailsModalOpen(true);
                    }}
                    className={`p-3 rounded-xl cursor-pointer transition-all hover:scale-105 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] ${statusInfo.bgColor} border-2 border-transparent hover:border-[#E5E5EA]`}
                  >
                    <div className="text-center">
                      <StatusIcon className={`h-5 w-5 mx-auto mb-1 ${statusInfo.color}`} />
                      <p className={`font-bold ${statusInfo.color}`}>{room.room_number}</p>
                      <p className="text-xs text-gray-600 capitalize">{room.status}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRooms.map((room) => {
                const statusInfo = statusConfig[room.status] || statusConfig.clean;
                const StatusIcon = statusInfo.icon;

                return (
                  <IOSCard key={room.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-ios-lg ${statusInfo.bgColor}`}>
                          <StatusIcon className={`h-6 w-6 ${statusInfo.color}`} />
                        </div>
                        <div>
                          <p className="font-bold">Room {room.room_number}</p>
                          <p className="text-sm text-gray-500">Floor {room.floor} • {room.room_type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <IOSBadge className={`${statusInfo.bgColor} ${statusInfo.color}`}>
                          {statusInfo.label}
                        </IOSBadge>
                        {room.assigned_name && (
                          <span className="text-sm text-gray-500 flex items-center gap-1">
                            <User className="h-3 w-3" /> {room.assigned_name}
                          </span>
                        )}
                        <IOSButton
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedRoom(room);
                            setDetailsModalOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </IOSButton>
                      </div>
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <IOSCard className="p-4">
            <p className="text-sm font-medium mb-3">Status Legend</p>
            <div className="flex flex-wrap gap-4">
              {Object.entries(statusConfig).map(([key, val]) => {
                const Icon = val.icon;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <div className={`p-1 rounded ${val.bgColor}`}>
                      <Icon className={`h-4 w-4 ${val.color}`} />
                    </div>
                    <span className="text-sm">{val.label}</span>
                  </div>
                );
              })}
            </div>
          </IOSCard>
        </div>

        {/* Room Details Modal */}
        <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Room {selectedRoom?.room_number}</DialogTitle>
            </DialogHeader>
            {selectedRoom && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-ios-lg">
                    <p className="text-xs text-gray-500">Floor</p>
                    <p className="font-medium">Floor {selectedRoom.floor}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-ios-lg">
                    <p className="text-xs text-gray-500">Type</p>
                    <p className="font-medium capitalize">{selectedRoom.room_type}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-ios-lg">
                    <p className="text-xs text-gray-500">Status</p>
                    <p className="font-medium capitalize">{selectedRoom.status}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-ios-lg">
                    <p className="text-xs text-gray-500">Assigned To</p>
                    <p className="font-medium">{selectedRoom.assigned_name || 'Unassigned'}</p>
                  </div>
                </div>

                {selectedRoom.last_cleaned && (
                  <div className="p-3 bg-gray-50 rounded-ios-lg">
                    <p className="text-xs text-gray-500">Last Cleaned</p>
                    <p className="font-medium">{new Date(selectedRoom.last_cleaned).toLocaleString()}</p>
                  </div>
                )}

                {/* Assign Attendant */}
                <div>
                  <label className="text-sm font-medium">Assign Attendant</label>
                  <select
                    value={selectedRoom.assigned_to || ''}
                    onChange={(e) => handleAssignAttendant(selectedRoom.id, e.target.value)}
                    className="w-full p-2 border rounded-ios-lg mt-1"
                  >
                    <option value="">Unassigned</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.name || `${s.first_name} ${s.last_name}`}</option>
                    ))}
                  </select>
                </div>

                {/* Quick Actions */}
                <div className="space-y-2">
                  <p className="text-sm font-medium">Update Status</p>
                  <div className="grid grid-cols-3 gap-2">
                    <IOSButton
                      size="sm"
                      variant="outline"
                      className="text-yellow-600"
                      onClick={() => handleUpdateStatus(selectedRoom.id, 'cleaning')}
                    >
                      <Sparkles className="h-3 w-3 mr-1" /> Cleaning
                    </IOSButton>
                    <IOSButton
                      size="sm"
                      variant="outline"
                      className="text-[#34C759]"
                      onClick={() => handleUpdateStatus(selectedRoom.id, 'clean')}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" /> Clean
                    </IOSButton>
                    <IOSButton
                      size="sm"
                      variant="outline"
                      className="text-[#007AFF]"
                      onClick={() => handleUpdateStatus(selectedRoom.id, 'inspecting')}
                    >
                      <Eye className="h-3 w-3 mr-1" /> Inspect
                    </IOSButton>
                    <IOSButton
                      size="sm"
                      variant="outline"
                      className="text-[#FF3B30]"
                      onClick={() => handleUpdateStatus(selectedRoom.id, 'dirty')}
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" /> Dirty
                    </IOSButton>
                    <IOSButton
                      size="sm"
                      variant="outline"
                      className="text-orange-600"
                      onClick={() => handleUpdateStatus(selectedRoom.id, 'maintenance')}
                    >
                      <Wrench className="h-3 w-3 mr-1" /> Maint.
                    </IOSButton>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
