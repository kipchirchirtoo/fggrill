'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { Card } from '@/components/ui/minimal/card';
import { IOSButton } from '@/components/ui/ios-button';
import { facilitiesAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import { Bed, RefreshCw, CheckCircle, XCircle, AlertTriangle, Search, Filter } from 'lucide-react';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  floor: number;
  status: string;
  housekeeping_status: string;
  is_dnd: boolean;
  last_cleaned_at: string;
  assigned_attendant?: string;
}

function RoomsContent() {
  const { activeBranch, activeBranchId } = useBranch();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', floor: '' });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (activeBranchId) fetchRooms();
  }, [activeBranchId]);

  const fetchRooms = async () => {
    setIsLoading(true);
    try {
      const response = await facilitiesAPI.getRooms(activeBranchId);
      if (response.success) {
        setRooms(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setIsLoading(false);
    }
  };

  const updateRoomStatus = async (roomId: string, status: string) => {
    try {
      const response = await facilitiesAPI.updateRoomStatus(roomId, { housekeeping_status: status });
      if (response.success) {
        toast.success('Room status updated');
        fetchRooms();
      }
    } catch (error) {
      toast.error('Failed to update room status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'clean': case 'inspected': return 'bg-gray-100 text-gray-700 border border-gray-200';
      case 'dirty': return 'bg-gray-100 text-gray-700 border border-gray-200';
      case 'in_progress': return 'bg-gray-100 text-gray-700 border border-gray-200';
      case 'out_of_order': return 'bg-gray-100 text-gray-700 border border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
  };

  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.room_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !filter.status || room.housekeeping_status === filter.status;
    const matchesFloor = !filter.floor || room.floor?.toString() === filter.floor;
    return matchesSearch && matchesStatus && matchesFloor;
  });

  const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);

  return (
    <ProtectedRoute allowedRoles={[UserRole.FACILITIES_MANAGER, UserRole.HOUSEKEEPING, UserRole.MAINTENANCE, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <BranchAwareDashboardLayout
        title="Room Status"
        subtitle={`Manage room housekeeping status for ${activeBranch?.name || 'your branch'}`}
        actionButton={<IOSButton variant="secondary" onClick={fetchRooms} leftIcon={<RefreshCw />}>Refresh</IOSButton>}
      >
        <div className="space-y-6">
          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search rooms..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <select
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="">All Status</option>
                <option value="clean">Clean</option>
                <option value="dirty">Dirty</option>
                <option value="in_progress">In Progress</option>
                <option value="inspected">Inspected</option>
              </select>
              <select
                value={filter.floor}
                onChange={(e) => setFilter({ ...filter, floor: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="">All Floors</option>
                {floors.map(floor => (
                  <option key={floor} value={floor}>Floor {floor}</option>
                ))}
              </select>
            </div>
          </Card>

          {/* Room Grid */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredRooms.map(room => (
                <Card key={room.id} className="p-4 hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <Bed className="h-6 w-6 text-gray-600" />
                    </div>
                    <h3 className="font-bold text-lg">{room.room_number}</h3>
                    <p className="text-sm text-gray-500">{room.room_type}</p>
                    <p className="text-xs text-gray-400">Floor {room.floor}</p>
                    <span className={`inline-block mt-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(room.housekeeping_status)}`}>
                      {room.housekeeping_status || 'Unknown'}
                    </span>
                    {room.is_dnd && (
                      <span className="block mt-1 text-xs text-gray-600 font-medium">🔕 DND</span>
                    )}
                    <div className="mt-3 flex gap-1 justify-center">
                      <button
                        onClick={() => updateRoomStatus(room.id, 'clean')}
                        className="p-1 rounded hover:bg-gray-100"
                        title="Mark Clean"
                      >
                        <CheckCircle className="h-4 w-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => updateRoomStatus(room.id, 'dirty')}
                        className="p-1 rounded hover:bg-gray-100"
                        title="Mark Dirty"
                      >
                        <XCircle className="h-4 w-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => updateRoomStatus(room.id, 'inspected')}
                        className="p-1 rounded hover:bg-gray-100"
                        title="Mark Inspected"
                      >
                        <AlertTriangle className="h-4 w-4 text-gray-600" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && filteredRooms.length === 0 && (
            <Card className="p-12 text-center">
              <Bed className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No rooms found</h3>
              <p className="text-gray-500">Try adjusting your filters</p>
            </Card>
          )}
        </div>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

export default function RoomsPage() {
  return (
    <BranchPageWrapper>
      <RoomsContent />
    </BranchPageWrapper>
  );
}
