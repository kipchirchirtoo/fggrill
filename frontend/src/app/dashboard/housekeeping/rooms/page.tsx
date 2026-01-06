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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[22px] sm:text-2xl font-bold text-gray-900">Room Status</h1>
              <p className="text-gray-500 text-sm">Monitor and update room cleaning status</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-stone-100 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'grid' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'list' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
                >
                  List
                </button>
              </div>
              <IOSButton variant="outline" size="sm" onClick={fetchRooms} leftIcon={<RefreshCw className="h-4 w-4" />}>
                <span className="hidden xs:inline">Refresh</span>
              </IOSButton>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
            <IOSCard className="p-3 sm:p-4">
              <p className="text-[11px] sm:text-sm text-gray-500 font-medium">Total</p>
              <p className="text-xl sm:text-2xl font-bold">{stats.total}</p>
            </IOSCard>
            <IOSCard className="p-3 sm:p-4 border-l-4 border-green-500">
              <p className="text-[11px] sm:text-sm text-gray-500 font-medium">Clean</p>
              <p className="text-xl sm:text-2xl font-bold text-[#34C759]">{stats.clean}</p>
            </IOSCard>
            <IOSCard className="p-3 sm:p-4 border-l-4 border-red-500">
              <p className="text-[11px] sm:text-sm text-gray-500 font-medium">Dirty</p>
              <p className="text-xl sm:text-2xl font-bold text-[#FF3B30]">{stats.dirty}</p>
            </IOSCard>
            <IOSCard className="p-3 sm:p-4 border-l-4 border-yellow-500">
              <p className="text-[11px] sm:text-sm text-gray-500 font-medium">Cleaning</p>
              <p className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.cleaning}</p>
            </IOSCard>
            <IOSCard className="p-3 sm:p-4 border-l-4 border-purple-500">
              <p className="text-[11px] sm:text-sm text-gray-500 font-medium">Occupied</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-600">{stats.occupied}</p>
            </IOSCard>
          </div>

          {/* Filters */}
          <IOSCard className="p-3 sm:p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                  <Input
                    placeholder="Search room number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-[40px]"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex-1 min-w-[140px] px-3 h-[40px] border rounded-ios-lg text-sm bg-white"
                >
                  <option value="all">All Status</option>
                  {Object.entries(statusConfig).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
                <select
                  value={floorFilter}
                  onChange={(e) => setFloorFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  className="flex-1 min-w-[140px] px-3 h-[40px] border rounded-ios-lg text-sm bg-white"
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
            <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 sm:gap-3">
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
                    className={`p-2 sm:p-3 rounded-xl cursor-pointer transition-all hover:scale-105 ${statusInfo.bgColor} border-2 border-transparent hover:border-stone-200 active:scale-95`}
                  >
                    <div className="text-center">
                      <StatusIcon className={`h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1 ${statusInfo.color}`} />
                      <p className={`font-bold text-xs sm:text-base ${statusInfo.color}`}>{room.room_number}</p>
                      <p className="text-[9px] sm:text-xs text-gray-600 capitalize truncate">{room.status}</p>
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
                  <IOSCard key={room.id} className="p-3 sm:p-4">
                    <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-4">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className={`p-2.5 sm:p-3 rounded-ios-lg ${statusInfo.bgColor} shrink-0`}>
                          <StatusIcon className={`h-5 w-5 sm:h-6 sm:w-6 ${statusInfo.color}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm sm:text-base">Room {room.room_number}</p>
                          <p className="text-[11px] sm:text-sm text-gray-500 truncate">Floor {room.floor} • {room.room_type}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between xs:justify-end gap-3 border-t xs:border-t-0 pt-3 xs:pt-0">
                        <IOSBadge className={`${statusInfo.bgColor} ${statusInfo.color} text-[10px] sm:text-xs h-6`}>
                          {statusInfo.label}
                        </IOSBadge>
                        <div className="flex items-center gap-2">
                          {room.assigned_name && (
                            <span className="text-[11px] sm:text-sm text-gray-500 flex items-center gap-1">
                              <User className="h-3 w-3" /> <span className="truncate max-w-[80px] sm:max-w-none">{room.assigned_name}</span>
                            </span>
                          )}
                          <button
                            onClick={() => {
                              setSelectedRoom(room);
                              setDetailsModalOpen(true);
                            }}
                            className="p-1.5 sm:p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-500"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
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
