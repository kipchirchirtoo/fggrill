'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { roomsAPI } from '@/lib/api';
import { Bed, RefreshCw, CheckCircle, XCircle, Clock, Wrench, Building2, Plus, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { AddRoomWizard } from '@/components/rooms/AddRoomWizard';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface Room { id: string; room_number: string; room_type: string; floor: number; status: string; price: number; }

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  available: { label: 'Available', color: 'text-green-600', icon: CheckCircle },
  occupied: { label: 'Occupied', color: 'text-blue-600', icon: Bed },
  cleaning: { label: 'Cleaning', color: 'text-yellow-600', icon: Clock },
  maintenance: { label: 'Maintenance', color: 'text-red-600', icon: Wrench },
};

export default function BranchRoomsPage() {
  const { user } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showWizard, setShowWizard] = useState(false);
  const [wizardMode, setWizardMode] = useState<'add' | 'edit'>('add');
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Use active branch from context, fallback to user's branch
  const currentBranchId = activeBranchId || user?.branch_id;

  const fetchRooms = useCallback(async () => {
    if (!currentBranchId) {
      setRooms([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await roomsAPI.getRooms(currentBranchId);
      if (response.success) setRooms(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [currentBranchId]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const handleDeleteRoom = async () => {
    if (!deletingRoom) return;
    
    setIsDeleting(true);
    try {
      const response = await roomsAPI.deleteRoom(deletingRoom.id);
      if (response.success) {
        toast.success('Room deleted successfully');
        fetchRooms();
        setDeletingRoom(null);
      } else {
        toast.error(response.message || 'Failed to delete room');
      }
    } catch (error: any) {
      console.error('Delete room error:', error);
      const errorMessage = error.message || 'Failed to delete room';
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditRoom = (room: Room) => {
    setEditingRoom(room);
    setWizardMode('edit');
    setShowWizard(true);
  };

  const handleAddRoom = () => {
    setEditingRoom(null);
    setWizardMode('add');
    setShowWizard(true);
  };

  const filteredRooms = rooms.filter((r) => statusFilter === 'all' || r.status === statusFilter);
  const stats = { total: rooms.length, available: rooms.filter(r => r.status === 'available').length, occupied: rooms.filter(r => r.status === 'occupied').length, cleaning: rooms.filter(r => r.status === 'cleaning').length };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Rooms</h1>
              <p className="text-gray-500 flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                {activeBranch?.name || 'Select a branch'}
              </p>
            </div>
            <div className="flex gap-2">
              <IOSButton 
                onClick={handleAddRoom}
                className="bg-[#3C3C43] hover:bg-[#000000] text-white"
                leftIcon={<Plus />}
              >
                Add Room
              </IOSButton>
              <IOSButton variant="secondary" onClick={fetchRooms} leftIcon={<RefreshCw />}>Refresh</IOSButton>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4"><Bed className="h-6 w-6 text-gray-600 mb-2" /><p className="text-sm text-gray-500">Total</p><p className="text-xl font-bold">{stats.total}</p></IOSCard>
            <IOSCard className="p-4"><CheckCircle className="h-6 w-6 text-gray-600 mb-2" /><p className="text-sm text-gray-500">Available</p><p className="text-xl font-bold">{stats.available}</p></IOSCard>
            <IOSCard className="p-4"><Bed className="h-6 w-6 text-gray-600 mb-2" /><p className="text-sm text-gray-500">Occupied</p><p className="text-xl font-bold">{stats.occupied}</p></IOSCard>
            <IOSCard className="p-4"><Clock className="h-6 w-6 text-gray-600 mb-2" /><p className="text-sm text-gray-500">Cleaning</p><p className="text-xl font-bold">{stats.cleaning}</p></IOSCard>
          </div>

          <div className="flex gap-2">
            {['all', 'available', 'occupied', 'cleaning', 'maintenance'].map((status) => (
              <IOSButton key={status} variant={statusFilter === status ? 'primary' : 'secondary'} size="sm" onClick={() => setStatusFilter(status)}>
                {status === 'all' ? 'All' : statusConfig[status]?.label || status}
              </IOSButton>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredRooms.map((room) => {
                const status = statusConfig[room.status] || statusConfig.available;
                const StatusIcon = status.icon;
                return (
                  <IOSCard key={room.id} className="p-5 group hover:shadow-lg transition-all duration-200 border border-gray-100">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">Room {room.room_number}</h3>
                        <p className="text-sm text-gray-500">{room.room_type}</p>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <IOSButton
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditRoom(room)}
                          className="p-2 hover:bg-blue-50"
                        >
                          <Edit className="h-4 w-4 text-blue-600" />
                        </IOSButton>
                        <IOSButton
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeletingRoom(room)}
                          className="p-2 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </IOSButton>
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Floor:</span>
                        <span className="font-medium">{room.floor}</span>
                      </div>
                      {room.price && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Rate:</span>
                          <span className="font-medium">KES {room.price.toLocaleString()}/night</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-gray-50">
                      <StatusIcon className={`h-4 w-4 ${status.color}`} />
                      <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}

          {/* Room Wizard (Add/Edit) */}
          {currentBranchId && (
            <AddRoomWizard
              isOpen={showWizard}
              onClose={() => {
                setShowWizard(false);
                setEditingRoom(null);
              }}
              onRoomAdded={fetchRooms}
              branchId={currentBranchId}
              editRoom={editingRoom}
              mode={wizardMode}
            />
          )}

          {/* Delete Confirmation Dialog */}
          <Dialog open={!!deletingRoom} onOpenChange={() => setDeletingRoom(null)}>
            <DialogContent className="max-w-md">
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Delete Room
              </DialogTitle>
              <DialogDescription className="text-gray-600">
                Are you sure you want to delete Room {deletingRoom?.room_number}? This action cannot be undone.
              </DialogDescription>
              <div className="flex gap-3 mt-6">
                <IOSButton
                  variant="secondary"
                  onClick={() => setDeletingRoom(null)}
                  className="flex-1"
                >
                  Cancel
                </IOSButton>
                <IOSButton
                  variant="primary"
                  onClick={handleDeleteRoom}
                  disabled={isDeleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </IOSButton>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
